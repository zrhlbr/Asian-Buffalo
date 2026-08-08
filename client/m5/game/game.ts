/**
 * Game — M5 presentation orchestrator.
 * Outcomes come only from GameProvider (FormalGameProvider on formal path).
 * Win tiers are UI celebrations only.
 */
import * as THREE from "three";
import {
  BET_PRESETS,
  type BetPreset,
  type GameProvider,
  type PresentationSpinResult,
  type WinTier,
  ROWS,
} from "../adapter.ts";
import type { ReelRig } from "./reels.ts";
import type { Buffalo } from "../scene/buffalo.ts";
import type { Particles } from "../scene/particles.ts";
import type { World } from "../scene/world.ts";
import { audio } from "../audio.ts";
import {
  choreographyFor,
  FREE_SPIN_ENTER_CHOREO,
  NEAR_MISS_CHOREO,
  PSEUDO_WIN_CHOREO,
  presentationFxScale,
  resolvePresentationOutcome,
  scaleChoreographyFx,
  type BuffaloAction,
  type PresentationTier,
  type TierChoreography,
} from "../win-presentation.ts";

export interface HudHooks {
  setBalance(v: number, animate?: boolean): void;
  setBet(v: number): void;
  showWin(amount: number): void;
  setFreeSpins(n: number): void;
  toastKey(key: string): void;
  toastMessage?(message: string): void;
  celebrate(tier: WinTier, amount: number): Promise<void>;
  flashMeters?(level: 0 | 1 | 2 | 3): void;
  setSpinBusy(busy: boolean): void;
  setAutoActive(on: boolean): void;
  setTurboActive(on: boolean): void;
  refreshStatic(): void;
  setStatus?(message: string): void;
  setSessionOnline?(online: boolean): void;
  /** Clear stuck celebration / modal / loading pointer traps (HUD only). */
  releasePointerTraps?(): void;
}

export class Game {
  private provider: GameProvider;
  private rig: ReelRig;
  private buffalo: Buffalo;
  private particles: Particles;
  private world: World;
  private hud!: HudHooks;

  betIndex = 0;
  freeSpins = 0;
  autoMode = false;
  turbo = false;
  busy = false;
  private fsTotalWin = 0;
  private autoTimer: number | null = null;

  constructor(
    provider: GameProvider,
    rig: ReelRig,
    buffalo: Buffalo,
    particles: Particles,
    world: World,
  ) {
    this.provider = provider;
    this.rig = rig;
    this.buffalo = buffalo;
    this.particles = particles;
    this.world = world;
    this.rig.onReelStop = () => audio.reelStop();
    this.buffalo.onRoarSound = () => audio.roar();
    // Default total bet 50 (roomBase 50 × level 1 × mult 1)
    const idx = BET_PRESETS.findIndex((p) => p.totalBetMinor === 50);
    this.betIndex = idx >= 0 ? idx : 0;
  }

  attachHud(hud: HudHooks): void {
    this.hud = hud;
    hud.setBalance(this.provider.getBalance());
    hud.setBet(this.bet.totalBetMinor);
    hud.setFreeSpins(this.provider.getFreeGamesRemaining());
  }

  get bet(): BetPreset {
    return BET_PRESETS[this.betIndex]!;
  }

  getCurrency(): string {
    return this.provider.getCurrency();
  }

  betUp(): void {
    if (this.busy) return;
    this.betIndex = Math.min(this.betIndex + 1, BET_PRESETS.length - 1);
    audio.betStep();
    this.hud.setBet(this.bet.totalBetMinor);
  }

  betDown(): void {
    if (this.busy) return;
    this.betIndex = Math.max(this.betIndex - 1, 0);
    audio.betStep();
    this.hud.setBet(this.bet.totalBetMinor);
  }

  toggleTurbo(): void {
    this.turbo = !this.turbo;
    audio.uiClick();
    this.hud.setTurboActive(this.turbo);
  }

  toggleAuto(): void {
    this.autoMode = !this.autoMode;
    audio.uiClick();
    this.hud.setAutoActive(this.autoMode);
    if (this.autoMode && !this.busy) void this.spin();
    if (!this.autoMode && this.autoTimer !== null) {
      clearTimeout(this.autoTimer);
      this.autoTimer = null;
    }
  }

  async bootstrap(): Promise<void> {
    await this.provider.ensureReady();
    this.freeSpins = this.provider.getFreeGamesRemaining();
    this.hud.setBalance(this.provider.getBalance());
    this.hud.setFreeSpins(this.freeSpins);
    const recovered = await this.provider.recoverLastRound();
    if (recovered) {
      this.freeSpins = recovered.freeGamesRemaining;
      this.hud.setBalance(recovered.balanceAfterMinor);
      this.hud.setFreeSpins(this.freeSpins);
      this.hud.showWin(recovered.winMinor);
      this.rig.setGrid(recovered.grid);
      this.highlightWins(recovered);
      this.world.setFreeSpinMood(
        recovered.isFreeGame || recovered.freeGamesRemaining > 0,
      );
    }
    try {
      const notes = await this.provider.fetchAnnouncements();
      if (notes.length > 0) {
        this.hud.toastMessage?.(notes[0]!.title);
      }
    } catch {
      /* announcements are non-blocking */
    }
  }

  /** Page resume / recovery — re-sync formal wallet balance into HUD. */
  async refreshBalanceFromWallet(): Promise<void> {
    try {
      const bal = await this.provider.refreshBalance();
      this.hud.setBalance(bal);
      this.hud.setSessionOnline?.(true);
    } catch {
      this.hud.setSessionOnline?.(false);
    }
  }

  async spin(): Promise<void> {
    if (this.busy) return;
    const preset = this.bet;
    const inFreeSpin = this.freeSpins > 0 || this.provider.getFreeGamesRemaining() > 0;
    if (!inFreeSpin && !this.provider.canBet(preset.totalBetMinor)) {
      this.hud.toastKey("insufficient");
      this.autoMode = false;
      this.hud.setAutoActive(false);
      return;
    }

    this.busy = true;
    this.hud.setSpinBusy(true);
    this.hud.showWin(0);
    this.rig.clearHighlights();
    this.rig.setFrameGlow(0);
    this.rig.setWinAmp(1);
    this.buffalo.interrupt();
    this.world.clearCelebrationMood();

    audio.unlock();
    audio.spinStart();
    if (Math.random() < 0.18) this.buffalo.roar();

    try {
      let result: PresentationSpinResult;
      try {
        result = await this.provider.spin({
          roomBase: preset.roomBase,
          betLevel: preset.betLevel,
          betMultiplier: preset.betMultiplier,
        });
      } catch (error) {
        audio.stopSpinLoop();
        const code = (error as Error & { code?: string }).code ?? "";
        if (code === "INSUFFICIENT_BALANCE" || String(error).includes("INSUFFICIENT")) {
          this.hud.toastKey("insufficient");
        } else {
          this.hud.toastKey("errorGeneric");
        }
        return;
      }

      this.freeSpins = result.freeGamesRemaining;
      const inFs =
        result.isFreeGame || result.freeGamesRemaining > 0 || result.awardedFreeGames > 0;
      this.world.setFreeSpinMood(inFs);
      await this.rig.spinAll(result.grid, this.turbo);
      audio.stopSpinLoop();
      this.hud.setBalance(result.balanceAfterMinor, true);
      this.hud.setFreeSpins(this.freeSpins);

      // UI-only presentation — must not affect balance / money path / math / settlement
      const outcome = resolvePresentationOutcome(result);
      const fxScale = readPresentationFxScale();
      if (result.winMinor > 0) {
        // HUD Win meter always shows server truth (including LDW / pseudoWin)
        this.hud.showWin(result.winMinor);
        await this.presentPaylines(result);
        if (result.isFreeGame) this.fsTotalWin += result.winMinor;
      }

      if (result.awardedFreeGames > 0) {
        await this.presentFreeSpinEnter(result);
      }
      if (result.scatterCount >= 3) audio.scatterLand();

      if (outcome.pseudoWin) {
        await this.presentPseudoWin(result, fxScale);
      } else if (outcome.tier !== "none") {
        await this.presentWinTier(outcome.tier, result.winMinor);
      } else if (outcome.nearMiss) {
        await this.presentNearMiss(result, outcome.nearMissCells, fxScale);
      } else if (result.winMinor > 0) {
        audio.winSmall();
        await sleep(this.turbo ? 250 : 700);
      } else {
        await sleep(this.turbo ? 120 : 350);
      }

      if (result.isFreeGame && this.freeSpins === 0) {
        this.particles.setPillars(false);
        this.world.setBloom(0.2);
        this.world.setFreeSpinMood(false);
        this.world.clearCelebrationMood();
        if (this.fsTotalWin > 0) {
          this.hud.showWin(this.fsTotalWin);
          audio.bigWin();
          await sleep(900);
        }
        this.fsTotalWin = 0;
      } else if (!inFs && this.freeSpins === 0) {
        this.world.setFreeSpinMood(false);
      }

      if (this.autoMode && (this.freeSpins > 0 || this.provider.canBet(this.bet.totalBetMinor))) {
        this.autoTimer = window.setTimeout(() => {
          this.autoTimer = null;
          void this.spin();
        }, this.turbo ? 250 : 600);
      } else if (this.autoMode) {
        this.autoMode = false;
        this.hud.setAutoActive(false);
      }
    } catch (error) {
      audio.stopSpinLoop();
      console.error("[m5] spin presentation failed", error);
      this.hud.toastKey("errorGeneric");
      // Never leave celebration chrome covering the HUD after a throw
      this.hud.releasePointerTraps?.();
    } finally {
      this.busy = false;
      this.hud.setSpinBusy(false);
    }
  }

  /** Collect winning cells from server payload only — never recompute wins. */
  private collectWinCells(result: PresentationSpinResult): Array<[number, number]> {
    const cells: Array<[number, number]> = [];
    const seen = new Set<string>();
    const push = (r: number, row: number) => {
      const key = `${r}:${row}`;
      if (!seen.has(key)) {
        seen.add(key);
        cells.push([r, row]);
      }
    };
    for (const pos of result.winningPositions) {
      push(pos.reel, pos.row);
    }
    if (result.winningPositions.length === 0 && result.lineWins.length > 0) {
      for (const w of result.lineWins) {
        for (let r = 0; r < w.count && r < result.grid.length; r++) {
          for (let row = 0; row < ROWS; row++) {
            const s = result.grid[r]![row];
            if (s === w.symbol || s === "wild") push(r, row);
          }
        }
      }
    }
    if (result.scatterCount >= 3) {
      for (let r = 0; r < result.grid.length; r++) {
        for (let row = 0; row < ROWS; row++) {
          if (result.grid[r]![row] === "scatter") push(r, row);
        }
      }
    }
    return cells;
  }

  private highlightWins(result: PresentationSpinResult, winAmp = 1): void {
    const cells = this.collectWinCells(result);
    this.rig.setWinAmp(winAmp);
    if (cells.length) this.rig.highlightCells(cells, result.grid);
    this.playWinSymbolCues(result, cells);
  }

  /** One soft cue per winning animal/special — never triggers business IO. */
  private playWinSymbolCues(
    result: PresentationSpinResult,
    cells: Array<[number, number]>,
  ): void {
    const heard = new Set<string>();
    for (const [reel, row] of cells) {
      const s = result.grid[reel]?.[row];
      if (!s || heard.has(s)) continue;
      if (
        s === "buffalo" ||
        s === "lion" ||
        s === "elephant" ||
        s === "zebra" ||
        s === "antelope" ||
        s === "wild" ||
        s === "scatter"
      ) {
        heard.add(s);
        audio.animalCue(s);
      }
    }
  }

  /** Multi-line sequential highlight (server lineWins order), then settle on all. */
  private async presentPaylines(result: PresentationSpinResult): Promise<void> {
    if (result.lineWins.length > 1 && !this.turbo) {
      for (const w of result.lineWins.slice(0, 6)) {
        const cells: Array<[number, number]> = [];
        for (let r = 0; r < w.count && r < result.grid.length; r++) {
          for (let row = 0; row < ROWS; row++) {
            const s = result.grid[r]![row];
            if (s === w.symbol || s === "wild") cells.push([r, row]);
          }
        }
        if (cells.length) {
          this.rig.highlightCells(cells, result.grid);
          await sleep(380);
        }
      }
    }
    this.highlightWins(result);
  }

  private async presentFreeSpinEnter(result: PresentationSpinResult): Promise<void> {
    const choreo = FREE_SPIN_ENTER_CHOREO;
    this.applyChoreography(choreo, result);
    this.hud.toastKey("freeSpinsWon");
    this.world.setFreeSpinMood(true);
    await sleep(this.turbo ? 700 : choreo.durationMs);
    // Keep free-spin mood; clear one-shot FX
    this.particles.coinRainActive = false;
    this.rig.setFrameGlow(0.25);
  }

  private async presentWinTier(tier: PresentationTier, amount: number): Promise<void> {
    const choreo = choreographyFor(tier);
    this.applyChoreography(choreo);
    this.hud.flashMeters?.(choreo.hudFlash);

    const overlayTier = toOverlayWinTier(tier);
    if (choreo.hudOverlay && overlayTier) {
      await this.hud.celebrate(overlayTier, amount);
    } else {
      await sleep(this.turbo ? Math.min(400, choreo.durationMs) : choreo.durationMs);
    }

    this.particles.coinRainActive = false;
    this.particles.setCoinRainRate(1);
    this.rig.setFrameGlow(0);
    if (this.freeSpins === 0) {
      this.particles.setPillars(false);
      this.world.setBloom(0.2);
      this.world.clearCelebrationMood();
    }
  }

  /** LDW — light celebration; amount on HUD remains server winMinor (already set). */
  private async presentPseudoWin(
    result: PresentationSpinResult,
    fxScale: number,
  ): Promise<void> {
    const choreo = scaleChoreographyFx(PSEUDO_WIN_CHOREO, fxScale);
    this.applyChoreography(choreo, result);
    this.hud.flashMeters?.(choreo.hudFlash);
    await sleep(this.turbo ? Math.min(350, choreo.durationMs) : choreo.durationMs);
    this.particles.coinRainActive = false;
    this.particles.setCoinRainRate(1);
    this.rig.setFrameGlow(0);
    if (this.freeSpins === 0) {
      this.particles.setPillars(false);
      this.world.setBloom(0.2);
      this.world.clearCelebrationMood();
    }
  }

  /**
   * Near-miss edge accent after a true miss — FX only.
   * Does not show win meters, invent grids, or change spin timing.
   */
  private async presentNearMiss(
    result: PresentationSpinResult,
    cells: Array<[number, number]>,
    fxScale: number,
  ): Promise<void> {
    const choreo = scaleChoreographyFx(NEAR_MISS_CHOREO, fxScale);
    for (const cue of choreo.audio) audio.playCue(cue);
    this.rig.pulseNearMissAccent(cells, result.grid, fxScale);
    this.rig.setFrameGlow(choreo.reelFrameGlow);
    if (choreo.shake > 0) this.world.shake(choreo.shake, choreo.shakeDecay);
    if (choreo.punchZoom > 0) this.world.punchZoom(choreo.punchZoom);
    this.world.setBloom(choreo.bloom);
    if (choreo.sparkBurst > 0) {
      this.particles.burstSparks(new THREE.Vector3(0, 2.4, 1.5), choreo.sparkBurst, choreo.sparkSpeed);
    }
    await sleep(this.turbo ? Math.min(220, choreo.durationMs) : choreo.durationMs);
    this.rig.clearHighlights();
    this.rig.setFrameGlow(0);
    this.world.setBloom(0.2);
    this.world.clearCelebrationMood();
  }

  private applyChoreography(
    choreo: TierChoreography | typeof FREE_SPIN_ENTER_CHOREO,
    result?: PresentationSpinResult,
  ): void {
    const center = new THREE.Vector3(0, 2.4, 1.5);
    for (const cue of choreo.audio) audio.playCue(cue);

    this.fireBuffalo(choreo.buffalo);
    this.rig.setWinAmp(choreo.symbolWin);
    this.rig.setFrameGlow(choreo.reelFrameGlow);
    if (result) this.highlightWins(result, choreo.symbolWin);

    if (choreo.shake > 0) this.world.shake(choreo.shake, choreo.shakeDecay);
    if (choreo.punchZoom > 0) this.world.punchZoom(choreo.punchZoom);
    this.world.setBloom(choreo.bloom);
    this.world.setCelebrationMood({
      colorWash: choreo.colorWash,
      darkenBg: choreo.darkenBg,
      lightning: choreo.lightning,
      wind: choreo.wind,
      slowMo: choreo.slowMo,
    });
    if (choreo.wind > 0) this.world.setWind(0.75 + choreo.wind);

    this.particles.setPillarStyle(choreo.particleStyle);
    this.particles.setPillars(choreo.pillars);
    if (choreo.sparkBurst > 0) {
      this.particles.burstSparks(center, choreo.sparkBurst, choreo.sparkSpeed);
    }
    if (choreo.coinBurst > 0) {
      this.particles.coinBurst(center, choreo.coinBurst);
    }
    this.particles.coinRainActive = choreo.coinRain;
    const rainRate =
      choreo.tier === "jackpot" || choreo.tier === "fullscreen_buffalo"
        ? 2.2
        : choreo.tier === "epic" || choreo.tier === "super"
          ? 1.8
          : choreo.tier === "ultra" || choreo.tier === "mega"
            ? 1.45
            : choreo.coinRain
              ? 1.15
              : 1;
    this.particles.setCoinRainRate(rainRate);

    if (choreo.speciesCall && result) {
      const cells = this.collectWinCells(result);
      this.playWinSymbolCues(result, cells);
    }
  }

  private fireBuffalo(action: BuffaloAction): void {
    switch (action) {
      case "roar":
        this.buffalo.roar();
        break;
      case "lowRoar":
        this.buffalo.lowRoar();
        break;
      case "headUp":
        this.buffalo.headUp();
        break;
      case "lookAtWin":
        this.buffalo.lookAtWin();
        break;
      case "bigWin":
        this.buffalo.bigWin();
        break;
      case "run":
        this.buffalo.run();
        break;
      case "victory":
        this.buffalo.victory();
        break;
      case "charge":
        this.buffalo.charge();
        break;
      case "jumpOut":
        this.buffalo.jumpOut();
        break;
      case "slowWalk":
        this.buffalo.slowWalk();
        break;
      case "standRoar":
        this.buffalo.standRoar();
        break;
      case "breakReel":
      case "jackpot":
        this.buffalo.breakReel();
        break;
      default:
        break;
    }
  }
}

function toOverlayWinTier(tier: PresentationTier): WinTier | null {
  switch (tier) {
    case "big":
    case "mega":
    case "ultra":
    case "super":
    case "epic":
    case "jackpot":
      return tier;
    case "fullscreen_buffalo":
      return "big"; // long overlay uses big chrome + buffalo charge FX
    default:
      return null;
  }
}

/** Read quality tier attr set by boot — presentation FX scale only. */
function readPresentationFxScale(): number {
  if (typeof document === "undefined") return 1;
  return presentationFxScale(document.documentElement.getAttribute("data-xi-tier"));
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

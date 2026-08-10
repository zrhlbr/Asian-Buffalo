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
  winTier,
  type WinTier,
  ROWS,
} from "../adapter.ts";
import type { ReelRig } from "./reels.ts";
import type { Buffalo } from "../scene/buffalo.ts";
import type { Particles } from "../scene/particles.ts";
import type { World } from "../scene/world.ts";
import { audio } from "../audio.ts";

export interface HudHooks {
  setBalance(v: number, animate?: boolean): void;
  setBet(v: number): void;
  showWin(amount: number): void;
  setFreeSpins(n: number): void;
  toastKey(key: string): void;
  celebrate(tier: WinTier, amount: number): Promise<void>;
  setSpinBusy(busy: boolean): void;
  setAutoActive(on: boolean): void;
  setTurboActive(on: boolean): void;
  refreshStatic(): void;
  setStatus?(message: string): void;
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
    this.buffalo.interrupt();

    audio.unlock();
    audio.spinStart();
    if (Math.random() < 0.18) this.buffalo.roar();

    let result: PresentationSpinResult;
    try {
      result = await this.provider.spin({
        roomBase: preset.roomBase,
        betLevel: preset.betLevel,
        betMultiplier: preset.betMultiplier,
      });
    } catch (error) {
      this.busy = false;
      this.hud.setSpinBusy(false);
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

    // UI-only tier — must not affect balance/ledger/math
    const tier = winTier(result.winMinor, result.totalBetMinor);
    if (result.winMinor > 0) {
      this.hud.showWin(result.winMinor);
      await this.presentPaylines(result);
      if (result.isFreeGame) this.fsTotalWin += result.winMinor;
    }

    if (result.awardedFreeGames > 0) {
      audio.freeSpinTrigger();
      this.buffalo.roar();
      this.hud.toastKey("freeSpinsWon");
      this.particles.setPillars(true);
      this.world.setBloom(0.6);
      this.world.setFreeSpinMood(true);
    }
    if (result.scatterCount >= 3) audio.scatterLand();

    if (tier !== "none") {
      this.fireTierEffects(tier);
      await this.hud.celebrate(tier, result.winMinor);
      this.particles.coinRainActive = false;
      if (this.freeSpins === 0) {
        this.particles.setPillars(false);
        this.world.setBloom(0.38);
      }
    } else if (result.winMinor > 0) {
      audio.winSmall();
      await sleep(this.turbo ? 250 : 700);
    } else {
      await sleep(this.turbo ? 120 : 350);
    }

    if (result.isFreeGame && this.freeSpins === 0) {
      this.particles.setPillars(false);
      this.world.setBloom(0.38);
      this.world.setFreeSpinMood(false);
      if (this.fsTotalWin > 0) {
        this.hud.showWin(this.fsTotalWin);
        audio.bigWin();
        await sleep(900);
      }
      this.fsTotalWin = 0;
    } else if (!inFs && this.freeSpins === 0) {
      this.world.setFreeSpinMood(false);
    }

    this.busy = false;
    this.hud.setSpinBusy(false);

    if (this.autoMode && (this.freeSpins > 0 || this.provider.canBet(this.bet.totalBetMinor))) {
      this.autoTimer = window.setTimeout(() => {
        this.autoTimer = null;
        void this.spin();
      }, this.turbo ? 250 : 600);
    } else if (this.autoMode) {
      this.autoMode = false;
      this.hud.setAutoActive(false);
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

  private highlightWins(result: PresentationSpinResult): void {
    const cells = this.collectWinCells(result);
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

  private fireTierEffects(tier: WinTier): void {
    const center = new THREE.Vector3(0, 2.4, 1.5);
    switch (tier) {
      case "big":
        audio.bigWin();
        this.buffalo.bigWin();
        this.world.shake(0.18, 5.2);
        this.world.punchZoom(0.32);
        this.particles.burstSparks(center, 140);
        this.particles.coinBurst(center, 110);
        this.particles.setPillars(true);
        break;
      case "mega":
        audio.megaWin();
        this.buffalo.run();
        this.world.shake(0.28, 4.4);
        this.world.punchZoom(0.48);
        this.particles.burstSparks(center, 210, 7);
        this.particles.coinBurst(center, 170);
        this.particles.coinRainActive = true;
        this.particles.setPillars(true);
        break;
      case "ultra":
        audio.ultraWin();
        this.buffalo.victory();
        this.world.shake(0.4, 3.5);
        this.world.punchZoom(0.62);
        this.particles.burstSparks(center, 300, 9);
        this.particles.coinRainActive = true;
        this.particles.setPillars(true);
        this.world.setBloom(0.78);
        break;
      case "jackpot":
        audio.jackpot();
        this.buffalo.jackpot();
        this.world.shake(0.52, 2.9);
        this.world.punchZoom(0.78);
        this.particles.burstSparks(center, 380, 12);
        this.particles.coinRainActive = true;
        this.particles.setPillars(true);
        this.world.setBloom(0.9);
        break;
      default:
        break;
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

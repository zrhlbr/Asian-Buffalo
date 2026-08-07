"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BET_LEVELS,
  BET_MULTIPLIERS,
  BASE_FREE_GAMES,
  MATH_DISCLOSURE,
  PAYLINES,
  PAYTABLE,
  RETRIGGER_FREE_GAMES,
  ROOM_BASE_BETS,
  SCATTER_PAYOUT,
  SYMBOLS,
  type RegularSymbol,
  type SymbolId,
} from "../lib/game-config";
import { createDemoGrid, evaluateSpin, type Grid, type SpinEvaluation } from "../lib/game-engine";
import "./m6/m6.css";
import {
  LOCALES,
  LOCALE_LABEL,
  SYMBOL_NAME,
  readStoredLocale,
  storeLocale,
  translate,
  type Locale,
} from "./m6/i18n";
import {
  profileFor,
  readStoredQualityMode,
  storeQualityMode,
  type QualityMode,
  type QualityProfile,
} from "./m6/quality";
import { audioEngine } from "./m6/audio-engine";
import {
  REEL_STAGGER_MS,
  SPIN_ROLL_MS,
  TOTAL_SPIN_MS,
} from "./m6/reel-motion";
import SceneHost, { type SceneHostHandle } from "./m6/components/SceneHost";
import PaylineOverlay from "./m6/components/PaylineOverlay";
import WinCelebration, {
  classifyWin,
  type Celebration,
} from "./m6/components/WinCelebration";

const INITIAL_GRID: Grid = [
  ["a", "lion", "ten", "buffalo"],
  ["zebra", "wild", "q", "elephant"],
  ["nine", "antelope", "scatter", "k"],
  ["elephant", "j", "wild", "lion"],
  ["buffalo", "ten", "zebra", "a"],
];

const PAYTABLE_ORDER: RegularSymbol[] = [
  "buffalo",
  "lion",
  "elephant",
  "zebra",
  "antelope",
  "a",
  "k",
  "q",
  "j",
  "ten",
  "nine",
];

const money = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});

const emptyEvaluation: SpinEvaluation = {
  lineWins: [],
  lineWin: 0,
  scatterCount: 0,
  scatterWin: 0,
  multiplier: 1,
  totalWin: 0,
  awardedFreeGames: 0,
};

function SymbolTile({
  symbol,
  winning,
  multiplier,
  locale,
}: {
  symbol: SymbolId;
  winning: boolean;
  multiplier?: number;
  locale: Locale;
}) {
  const definition = SYMBOLS[symbol];
  const localized = SYMBOL_NAME[symbol]?.[locale] ?? definition.label;
  return (
    <div
      className={`reel-symbol ${definition.className} ${winning ? "is-winning" : ""}`}
      aria-label={localized}
    >
      <span className="symbol-mark">{definition.mark}</span>
      <small>{localized}</small>
      {symbol === "wild" && multiplier && multiplier > 1 ? (
        <b className="wild-multiplier">×{multiplier}</b>
      ) : null}
    </div>
  );
}

export default function GameClient() {
  const [grid, setGrid] = useState<Grid>(INITIAL_GRID);
  const [roomBase, setRoomBase] = useState<(typeof ROOM_BASE_BETS)[number]>(50);
  const [betLevel, setBetLevel] = useState(1);
  const [betMultiplier, setBetMultiplier] = useState(1);
  const [balance, setBalance] = useState(100_000);
  const [freeGames, setFreeGames] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [stoppedReels, setStoppedReels] = useState<boolean[]>([true, true, true, true, true]);
  const [lastResult, setLastResult] = useState(emptyEvaluation);
  const [helpOpen, setHelpOpen] = useState(false);
  const [autoRemaining, setAutoRemaining] = useState(0);
  const [roundNumber, setRoundNumber] = useState(0);
  const [locale, setLocale] = useState<Locale>("zh");
  const [qualityMode, setQualityMode] = useState<QualityMode>("auto");
  const [muted, setMuted] = useState(false);
  const [celebration, setCelebration] = useState<Celebration | null>(null);
  const [activeProfile, setActiveProfile] = useState<QualityProfile>(() => profileFor("medium"));

  const sceneRef = useRef<SceneHostHandle>(null);
  const timersRef = useRef<number[]>([]);

  const t = useCallback(
    (key: Parameters<typeof translate>[1], vars?: Record<string, string | number>) =>
      translate(locale, key, vars),
    [locale],
  );
  const [message, setMessage] = useState(() => translate("zh", "msgVerified"));

  const totalBet = roomBase * betLevel * betMultiplier;
  const lineBet = totalBet / PAYLINES.length;

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  // 读取持久化偏好
  useEffect(() => {
    setLocale(readStoredLocale());
    setQualityMode(readStoredQualityMode());
  }, []);

  // 首次手势解锁音频（浏览器自动播放策略）
  useEffect(() => {
    const unlock = () => {
      audioEngine.unlock();
      window.removeEventListener("pointerdown", unlock);
    };
    window.addEventListener("pointerdown", unlock);
    return () => window.removeEventListener("pointerdown", unlock);
  }, []);

  // 免费旋转：场景黄昏化 + BGM 变奏
  useEffect(() => {
    sceneRef.current?.setFreeSpin(freeGames > 0);
    audioEngine.setFreeMode(freeGames > 0);
  }, [freeGames]);

  const winningCells = useMemo(() => {
    const cells = new Set<string>();
    lastResult.lineWins.forEach((win) => {
      const line = PAYLINES[win.line - 1];
      for (let reel = 0; reel < win.count; reel += 1) {
        cells.add(`${reel}-${line[reel]}`);
      }
    });
    return cells;
  }, [lastResult]);

  const spin = useCallback(() => {
    if (spinning) return;
    const isFree = freeGames > 0;
    if (!isFree && balance < totalBet) {
      setMessage(t("msgNoBalance"));
      setAutoRemaining(0);
      return;
    }

    clearTimers();
    setSpinning(true);
    setStoppedReels([false, false, false, false, false]);
    setLastResult(emptyEvaluation);
    setCelebration(null);
    setMessage(t(isFree ? "msgSpinningFree" : "msgSpinning"));

    // M6-5：Spin 音效 + 水牛奔跑步声
    audioEngine.play("spinStart");
    if (Math.random() < 0.4) sceneRef.current?.playRun();

    // 结果在滚动期生成（数学流程不变），逐轴停止后再结算展示
    timersRef.current.push(
      window.setTimeout(() => {
        const nextGrid = createDemoGrid();
        const evaluation = evaluateSpin(nextGrid, totalBet, isFree);
        setGrid(nextGrid);

        // 逐轴停止 + 停止音效
        for (let reel = 0; reel < 5; reel += 1) {
          timersRef.current.push(
            window.setTimeout(() => {
              setStoppedReels((current) => {
                const next = [...current];
                next[reel] = true;
                return next;
              });
              audioEngine.play("reelStop");
            }, REEL_STAGGER_MS * reel),
          );
        }

        // 全部回弹结束后统一结算（余额/免费局/消息语义与 M1-M5 一致）
        timersRef.current.push(
          window.setTimeout(() => {
            setBalance((current) => current - (isFree ? 0 : totalBet) + evaluation.totalWin);
            setFreeGames((current) => Math.max(0, current - (isFree ? 1 : 0)) + evaluation.awardedFreeGames);
            setLastResult(evaluation);
            setRoundNumber((current) => current + 1);
            setMessage(
              evaluation.totalWin > 0
                ? t("msgWin", {
                    amount: money.format(evaluation.totalWin),
                    mult: evaluation.multiplier > 1 ? t("msgFreeMult", { n: evaluation.multiplier }) : "",
                  })
                : evaluation.awardedFreeGames > 0
                  ? t("msgFreeTrigger", { n: evaluation.awardedFreeGames })
                  : t("msgNoWin"),
            );
            setSpinning(false);

            // M6-4 / M6-5：大奖分级演出 + 音效 + 水牛动作
            const tier = classifyWin(evaluation.totalWin, totalBet);
            if (tier) {
              setCelebration({ tier, amount: evaluation.totalWin, id: Date.now() });
              audioEngine.play(tier === "big" ? "bigWin" : tier === "mega" ? "megaWin" : tier === "ultra" ? "ultraWin" : "jackpot");
              audioEngine.play("coinShower");
              sceneRef.current?.celebrate(tier);
            } else if (evaluation.totalWin > 0) {
              audioEngine.play("winSmall");
              if (evaluation.lineWins.some((win) => win.symbol === "buffalo")) {
                audioEngine.play("roar");
                sceneRef.current?.playRoar();
              }
            }
            if (evaluation.awardedFreeGames > 0) {
              audioEngine.play("freeTrigger");
              sceneRef.current?.playVictory();
            }
          }, TOTAL_SPIN_MS - SPIN_ROLL_MS),
        );
      }, SPIN_ROLL_MS),
    );
  }, [balance, clearTimers, freeGames, spinning, t, totalBet]);

  useEffect(() => {
    if (autoRemaining <= 0 || spinning) return;
    const timer = window.setTimeout(() => {
      setAutoRemaining((current) => Math.max(0, current - 1));
      spin();
    }, 850);
    return () => window.clearTimeout(timer);
  }, [autoRemaining, spin, spinning]);

  const updateLevel = (direction: -1 | 1) => {
    if (spinning || freeGames > 0) return;
    audioEngine.play("click");
    setBetLevel((current) => Math.min(10, Math.max(1, current + direction)));
  };

  const changeLocale = (next: Locale) => {
    setLocale(next);
    storeLocale(next);
    audioEngine.play("click");
  };

  const changeQuality = (next: QualityMode) => {
    setQualityMode(next);
    storeQualityMode(next);
    audioEngine.play("click");
  };

  const toggleMute = () => {
    setMuted((current) => {
      audioEngine.setMuted(!current);
      return !current;
    });
  };

  const showPaylines = !spinning && lastResult.lineWins.length > 0 && !celebration;

  return (
    <main className="game-shell">
      <SceneHost
        ref={sceneRef}
        locale={locale}
        qualityMode={qualityMode}
        onProfileChange={setActiveProfile}
      />

      <header className="game-topbar">
        <div className="brand-lockup">
          <span className="brand-kicker">{t("brandKicker")}</span>
          <h1>ASIAN BUFFALO</h1>
          <span className="brand-note">{t("brandNote")}</span>
        </div>
        <div className="m6-controls">
          <div className="m6-group" role="group" aria-label={t("language")}>
            <span>{t("language")}</span>
            {LOCALES.map((item) => (
              <button
                key={item}
                type="button"
                className={item === locale ? "is-active" : ""}
                onClick={() => changeLocale(item)}
              >
                {LOCALE_LABEL[item]}
              </button>
            ))}
          </div>
          <div className="m6-group">
            <span>{t("quality")}</span>
            <select
              value={qualityMode}
              onChange={(event) => changeQuality(event.target.value as QualityMode)}
              aria-label={t("quality")}
            >
              <option value="auto">{t("qualityAuto")}</option>
              <option value="high">{t("qualityHigh")}</option>
              <option value="medium">{t("qualityMedium")}</option>
              <option value="low">{t("qualityLow")}</option>
            </select>
          </div>
          <div className="m6-group">
            <button type="button" onClick={toggleMute} aria-label={t(muted ? "unmute" : "mute")}>
              {muted ? "🔇" : "🔊"}
            </button>
          </div>
        </div>
        <div className="wallet-summary" aria-label={t("demoWallet")}>
          <span>{t("demoWallet")}</span>
          <strong>{money.format(balance)} MMK</strong>
          <small>{t("realMoneyOff")}</small>
        </div>
      </header>

      <section className="game-stage">
        <aside className="stage-rail left-rail">
          <button className="rail-button" type="button" onClick={() => setHelpOpen(true)}>
            <span>?</span>
            {t("rules")}
          </button>
          <div className="rail-stat">
            <span>{t("fixedLines")}</span>
            <strong>50</strong>
          </div>
          <div className="rail-stat">
            <span>{t("freeGames")}</span>
            <strong>{freeGames}</strong>
          </div>
        </aside>

        <div className={`reel-machine ${freeGames > 0 ? "is-free-spin" : ""}`}>
          <div className="machine-heading">
            <span>50 LINES</span>
            <strong>{freeGames > 0 ? t("freeGameLeft", { n: freeGames }) : t("baseGame")}</strong>
            <span>ROOM {roomBase}</span>
          </div>

          <div className="reel-window" aria-live="polite" aria-busy={spinning}>
            {grid.map((reel, reelIndex) => (
              <div
                className={`reel-column ${
                  spinning ? (stoppedReels[reelIndex] ? "is-stopping" : "is-rolling") : ""
                }`}
                key={`reel-${reelIndex}`}
              >
                {reel.map((symbol, rowIndex) => (
                  <SymbolTile
                    key={`${reelIndex}-${rowIndex}`}
                    symbol={symbol}
                    winning={winningCells.has(`${reelIndex}-${rowIndex}`)}
                    multiplier={lastResult.multiplier}
                    locale={locale}
                  />
                ))}
              </div>
            ))}
            <PaylineOverlay
              paylines={PAYLINES}
              wins={lastResult.lineWins}
              active={showPaylines}
            />
          </div>

          <div className="result-strip">
            <span>{t("roundLabel")} DEMO-{String(roundNumber).padStart(6, "0")}</span>
            <strong>{message}</strong>
            <span>{t("winLabel")} {money.format(lastResult.totalWin)}</span>
          </div>
        </div>

        <aside className="stage-rail right-rail">
          <div className="rail-stat">
            <span>{t("lineBet")}</span>
            <strong>{money.format(lineBet)}</strong>
          </div>
          <div className="rail-stat">
            <span>{t("totalBet")}</span>
            <strong>{money.format(totalBet)}</strong>
          </div>
          <div className="rail-stat warning-stat">
            <span>RTP</span>
            <strong>{t("rtpPending")}</strong>
          </div>
        </aside>
      </section>

      <section className="control-deck" aria-label="游戏控制">
        <div className="control-group room-control">
          <label htmlFor="room">{t("room")}</label>
          <select
            id="room"
            value={roomBase}
            disabled={spinning || freeGames > 0}
            onChange={(event) => setRoomBase(Number(event.target.value) as 50 | 500)}
          >
            {ROOM_BASE_BETS.map((room) => (
              <option key={room} value={room}>{t("roomSuffix", { n: room })}</option>
            ))}
          </select>
        </div>

        <div className="control-group stepper-control">
          <span>{t("level")}</span>
          <div>
            <button type="button" onClick={() => updateLevel(-1)} disabled={spinning || freeGames > 0}>−</button>
            <strong>{betLevel}</strong>
            <button type="button" onClick={() => updateLevel(1)} disabled={spinning || freeGames > 0}>＋</button>
          </div>
        </div>

        <div className="control-group multiplier-control">
          <label htmlFor="multiplier">{t("multiplier")}</label>
          <select
            id="multiplier"
            value={betMultiplier}
            disabled={spinning || freeGames > 0}
            onChange={(event) => setBetMultiplier(Number(event.target.value))}
          >
            {BET_MULTIPLIERS.map((value) => (
              <option key={value} value={value}>×{value}</option>
            ))}
          </select>
        </div>

        <button
          className={`auto-button ${autoRemaining > 0 ? "is-active" : ""}`}
          type="button"
          onClick={() => setAutoRemaining((current) => (current > 0 ? 0 : 25))}
          disabled={spinning && autoRemaining === 0}
        >
          <span>{t("auto")}</span>
          <strong>{autoRemaining > 0 ? autoRemaining : "25"}</strong>
        </button>

        <button className="spin-button" type="button" onClick={spin} disabled={spinning || autoRemaining > 0}>
          <span>{spinning ? t("spinBusy") : freeGames > 0 ? t("spinFree") : t("spinIdle")}</span>
          <strong>SPIN</strong>
        </button>

        <button
          className="max-button"
          type="button"
          disabled={spinning || freeGames > 0}
          onClick={() => {
            audioEngine.play("click");
            setBetLevel(BET_LEVELS[BET_LEVELS.length - 1]);
            setBetMultiplier(BET_MULTIPLIERS[BET_MULTIPLIERS.length - 1]);
          }}
        >
          {t("maxBet")}
        </button>
      </section>

      <footer className="prototype-footer">
        <span>{t("footerSource")}</span>
        <span>{t("footerMath", { status: MATH_DISCLOSURE.status })}</span>
        <span>{t("footerNoMoney")}</span>
      </footer>

      {helpOpen ? (
        <div className="rules-overlay" role="dialog" aria-modal="true" aria-labelledby="rules-title">
          <div className="rules-panel">
            <header>
              <div>
                <span>{t("rulesVerified")}</span>
                <h2 id="rules-title">{t("rulesTitle")}</h2>
              </div>
              <button type="button" onClick={() => setHelpOpen(false)} aria-label={t("closeRules")}>×</button>
            </header>

            <div className="rules-body">
              <section className="rule-copy">
                <h3>{t("basicRules")}</h3>
                <p>{t("basicRulesP1")}</p>
                <p>{t("basicRulesP2")}</p>

                <h3>{t("freeGameRules")}</h3>
                <div className="rule-grid">
                  {Object.entries(BASE_FREE_GAMES).map(([count, games]) => (
                    <div key={count}><strong>{count} S</strong><span>{games}{t("times")}</span></div>
                  ))}
                </div>
                <p>{t("freeRetrigger", { list: Object.values(RETRIGGER_FREE_GAMES).join(" / ") })}</p>

                <h3>{t("scatterPays")}</h3>
                <p>{t("scatterPaysP", { list: `${Object.values(SCATTER_PAYOUT).join("× / ")}×` })}</p>
              </section>

              <section className="paytable-wrap">
                <div className="paytable-heading">
                  <span>{t("colSymbol")}</span><span>{t("col2")}</span><span>{t("col3")}</span><span>{t("col4")}</span><span>{t("col5")}</span>
                </div>
                {PAYTABLE_ORDER.map((symbol) => (
                  <div className="paytable-row" key={symbol}>
                    <span className={`mini-symbol ${SYMBOLS[symbol].className}`}>{SYMBOLS[symbol].mark}</span>
                    <span>{PAYTABLE[symbol][2] ?? "—"}</span>
                    <span>{PAYTABLE[symbol][3] ?? "—"}</span>
                    <span>{PAYTABLE[symbol][4] ?? "—"}</span>
                    <span>{PAYTABLE[symbol][5] ?? "—"}</span>
                  </div>
                ))}
                <small>{t("paytableNote")}</small>
              </section>
            </div>
          </div>
        </div>
      ) : null}

      {celebration ? (
        <WinCelebration
          key={celebration.id}
          celebration={celebration}
          locale={locale}
          quality={activeProfile}
          onDone={() => setCelebration(null)}
        />
      ) : null}
    </main>
  );
}

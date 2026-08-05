"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
  spinning,
  multiplier,
}: {
  symbol: SymbolId;
  winning: boolean;
  spinning: boolean;
  multiplier?: number;
}) {
  const definition = SYMBOLS[symbol];
  return (
    <div
      className={`reel-symbol ${definition.className} ${winning ? "is-winning" : ""} ${spinning ? "is-spinning" : ""}`}
      aria-label={definition.label}
    >
      <span className="symbol-mark">{definition.mark}</span>
      <small>{definition.label}</small>
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
  const [lastResult, setLastResult] = useState(emptyEvaluation);
  const [message, setMessage] = useState("原游戏规则已核对；当前为非真钱数学原型");
  const [helpOpen, setHelpOpen] = useState(false);
  const [autoRemaining, setAutoRemaining] = useState(0);
  const [roundNumber, setRoundNumber] = useState(0);

  const totalBet = roomBase * betLevel * betMultiplier;
  const lineBet = totalBet / PAYLINES.length;

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
      setMessage("演示余额不足；真钱模式尚未开放");
      setAutoRemaining(0);
      return;
    }

    setSpinning(true);
    setLastResult(emptyEvaluation);
    setMessage(isFree ? "免费游戏旋转中…" : "正在生成演示局结果…");

    window.setTimeout(() => {
      const nextGrid = createDemoGrid();
      const evaluation = evaluateSpin(nextGrid, totalBet, isFree);
      setGrid(nextGrid);
      setBalance((current) => current - (isFree ? 0 : totalBet) + evaluation.totalWin);
      setFreeGames((current) => Math.max(0, current - (isFree ? 1 : 0)) + evaluation.awardedFreeGames);
      setLastResult(evaluation);
      setRoundNumber((current) => current + 1);
      setMessage(
        evaluation.totalWin > 0
          ? `本局赢得 ${money.format(evaluation.totalWin)} MMK${evaluation.multiplier > 1 ? `，免费局 ×${evaluation.multiplier}` : ""}`
          : evaluation.awardedFreeGames > 0
            ? `触发 ${evaluation.awardedFreeGames} 次免费游戏`
            : "本局未中奖",
      );
      setSpinning(false);
    }, 720);
  }, [balance, freeGames, spinning, totalBet]);

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
    setBetLevel((current) => Math.min(10, Math.max(1, current + direction)));
  };

  return (
    <main className="game-shell">
      <header className="game-topbar">
        <div className="brand-lockup">
          <span className="brand-kicker">INDEPENDENT WEB BUILD · MILESTONE 1</span>
          <h1>ASIAN BUFFALO</h1>
          <span className="brand-note">ASIAN BUFFALO 玩法开发版 / 原创美术占位</span>
        </div>
        <div className="wallet-summary" aria-label="演示钱包">
          <span>演示钱包</span>
          <strong>{money.format(balance)} MMK</strong>
          <small>真钱通道：关闭</small>
        </div>
      </header>

      <section className="game-stage">
        <aside className="stage-rail left-rail">
          <button className="rail-button" type="button" onClick={() => setHelpOpen(true)}>
            <span>?</span>
            规则
          </button>
          <div className="rail-stat">
            <span>固定线</span>
            <strong>50</strong>
          </div>
          <div className="rail-stat">
            <span>免费局</span>
            <strong>{freeGames}</strong>
          </div>
        </aside>

        <div className="reel-machine">
          <div className="machine-heading">
            <span>50 LINES</span>
            <strong>{freeGames > 0 ? `FREE GAME · ${freeGames} LEFT` : "BASE GAME"}</strong>
            <span>ROOM {roomBase}</span>
          </div>

          <div className="reel-window" aria-live="polite" aria-busy={spinning}>
            {grid.map((reel, reelIndex) => (
              <div className="reel-column" key={`reel-${reelIndex}`}>
                {reel.map((symbol, rowIndex) => (
                  <SymbolTile
                    key={`${reelIndex}-${rowIndex}`}
                    symbol={symbol}
                    winning={winningCells.has(`${reelIndex}-${rowIndex}`)}
                    spinning={spinning}
                    multiplier={lastResult.multiplier}
                  />
                ))}
              </div>
            ))}
          </div>

          <div className="result-strip">
            <span>局号 DEMO-{String(roundNumber).padStart(6, "0")}</span>
            <strong>{message}</strong>
            <span>赢分 {money.format(lastResult.totalWin)}</span>
          </div>
        </div>

        <aside className="stage-rail right-rail">
          <div className="rail-stat">
            <span>线注</span>
            <strong>{money.format(lineBet)}</strong>
          </div>
          <div className="rail-stat">
            <span>总注</span>
            <strong>{money.format(totalBet)}</strong>
          </div>
          <div className="rail-stat warning-stat">
            <span>RTP</span>
            <strong>待校准</strong>
          </div>
        </aside>
      </section>

      <section className="control-deck" aria-label="游戏控制">
        <div className="control-group room-control">
          <label htmlFor="room">房间</label>
          <select
            id="room"
            value={roomBase}
            disabled={spinning || freeGames > 0}
            onChange={(event) => setRoomBase(Number(event.target.value) as 50 | 500)}
          >
            {ROOM_BASE_BETS.map((room) => (
              <option key={room} value={room}>{room} 房</option>
            ))}
          </select>
        </div>

        <div className="control-group stepper-control">
          <span>等级</span>
          <div>
            <button type="button" onClick={() => updateLevel(-1)} disabled={spinning || freeGames > 0}>−</button>
            <strong>{betLevel}</strong>
            <button type="button" onClick={() => updateLevel(1)} disabled={spinning || freeGames > 0}>＋</button>
          </div>
        </div>

        <div className="control-group multiplier-control">
          <label htmlFor="multiplier">倍率</label>
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
          <span>AUTO</span>
          <strong>{autoRemaining > 0 ? autoRemaining : "25"}</strong>
        </button>

        <button className="spin-button" type="button" onClick={spin} disabled={spinning || autoRemaining > 0}>
          <span>{spinning ? "旋转中" : freeGames > 0 ? "免费旋转" : "开始"}</span>
          <strong>SPIN</strong>
        </button>

        <button
          className="max-button"
          type="button"
          disabled={spinning || freeGames > 0}
          onClick={() => {
            setBetLevel(BET_LEVELS[BET_LEVELS.length - 1]);
            setBetMultiplier(BET_MULTIPLIERS[BET_MULTIPLIERS.length - 1]);
          }}
        >
          最大投注
        </button>
      </section>

      <footer className="prototype-footer">
        <span>规则来源：目标游戏客户端帮助页与运行代码</span>
        <span>数学状态：{MATH_DISCLOSURE.status}</span>
        <span>本版本不存款、不提款、不兑换</span>
      </footer>

      {helpOpen ? (
        <div className="rules-overlay" role="dialog" aria-modal="true" aria-labelledby="rules-title">
          <div className="rules-panel">
            <header>
              <div>
                <span>已核验规则</span>
                <h2 id="rules-title">玩法与赔付表</h2>
              </div>
              <button type="button" onClick={() => setHelpOpen(false)} aria-label="关闭规则">×</button>
            </header>

            <div className="rules-body">
              <section className="rule-copy">
                <h3>基础规则</h3>
                <p>5轴×4行、50条固定赔付线。普通符号从最左轴起连续命中；水牛2个起赔，其余普通符号3个起赔。</p>
                <p>WILD代替SCATTER以外的普通符号，并且只会出现在第2、3、4轴。</p>

                <h3>免费游戏</h3>
                <div className="rule-grid">
                  {Object.entries(BASE_FREE_GAMES).map(([count, games]) => (
                    <div key={count}><strong>{count} S</strong><span>{games}次</span></div>
                  ))}
                </div>
                <p>免费游戏中，2/3/4/5个SCATTER分别追加 {Object.values(RETRIGGER_FREE_GAMES).join(" / ")} 次。免费局WILD带×2或×3倍数。</p>

                <h3>SCATTER赔付</h3>
                <p>3/4/5个SCATTER分别支付总投注的 {Object.values(SCATTER_PAYOUT).join("× / ")}。</p>
              </section>

              <section className="paytable-wrap">
                <div className="paytable-heading">
                  <span>符号</span><span>2个</span><span>3个</span><span>4个</span><span>5个</span>
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
                <small>普通符号数值 × 单线投注；客户端未公开RTP与卷轴权重。</small>
              </section>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

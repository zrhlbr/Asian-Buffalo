import {
  BASE_FREE_GAMES,
  GRID_COLUMNS,
  GRID_ROWS,
  PAYLINES,
  PAYTABLE,
  RETRIGGER_FREE_GAMES,
  SCATTER_PAYOUT,
  type RegularSymbol,
  type SymbolId,
} from "./game-config";

export type Grid = SymbolId[][];

export type LineWin = {
  line: number;
  symbol: RegularSymbol;
  count: number;
  payout: number;
};

export type SpinEvaluation = {
  lineWins: LineWin[];
  lineWin: number;
  scatterCount: number;
  scatterWin: number;
  multiplier: 1 | 2 | 3;
  totalWin: number;
  awardedFreeGames: number;
};

const REGULAR_SYMBOLS: RegularSymbol[] = [
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

const BASE_WEIGHTS: Array<[SymbolId, number]> = [
  ["buffalo", 3],
  ["lion", 5],
  ["elephant", 5],
  ["zebra", 7],
  ["antelope", 7],
  ["a", 10],
  ["k", 10],
  ["q", 11],
  ["j", 11],
  ["ten", 12],
  ["nine", 12],
  ["scatter", 2],
];

function randomInt(maxExclusive: number): number {
  const limit = Math.floor(0x100000000 / maxExclusive) * maxExclusive;
  const value = new Uint32Array(1);
  do {
    crypto.getRandomValues(value);
  } while (value[0] >= limit);
  return value[0] % maxExclusive;
}

function weightedSymbol(reelIndex: number): SymbolId {
  const weights = [...BASE_WEIGHTS];
  if (reelIndex >= 1 && reelIndex <= 3) weights.push(["wild", 3]);
  const total = weights.reduce((sum, [, weight]) => sum + weight, 0);
  let cursor = randomInt(total);
  for (const [symbol, weight] of weights) {
    if (cursor < weight) return symbol;
    cursor -= weight;
  }
  return "nine";
}

export function createDemoGrid(): Grid {
  return Array.from({ length: GRID_COLUMNS }, (_, reelIndex) =>
    Array.from({ length: GRID_ROWS }, () => weightedSymbol(reelIndex)),
  );
}

export function evaluateSpin(
  grid: Grid,
  totalBet: number,
  inFreeGames: boolean,
): SpinEvaluation {
  const lineBet = totalBet / PAYLINES.length;
  const lineWins: LineWin[] = [];

  PAYLINES.forEach((rows, lineIndex) => {
    const first = grid[0][rows[0]];
    if (!REGULAR_SYMBOLS.includes(first as RegularSymbol)) return;
    const target = first as RegularSymbol;
    let count = 1;
    for (let reel = 1; reel < GRID_COLUMNS; reel += 1) {
      const symbol = grid[reel][rows[reel]];
      if (symbol === target || symbol === "wild") count += 1;
      else break;
    }
    const payoutMultiple = PAYTABLE[target][count as 2 | 3 | 4 | 5];
    if (!payoutMultiple) return;
    lineWins.push({
      line: lineIndex + 1,
      symbol: target,
      count,
      payout: payoutMultiple * lineBet,
    });
  });

  const scatterCount = grid.flat().filter((symbol) => symbol === "scatter").length;
  const cappedScatter = Math.min(scatterCount, 5) as 3 | 4 | 5;
  const scatterWin = scatterCount >= 3 ? (SCATTER_PAYOUT[cappedScatter] ?? 0) * totalBet : 0;
  const lineWin = lineWins.reduce((sum, win) => sum + win.payout, 0);
  const hasWild = grid.some((reel, reelIndex) => reelIndex >= 1 && reelIndex <= 3 && reel.includes("wild"));
  const multiplier = inFreeGames && hasWild && lineWin > 0 ? ((randomInt(2) + 2) as 2 | 3) : 1;
  const totalWin = lineWin * multiplier + scatterWin;
  const awardedFreeGames = inFreeGames
    ? scatterCount >= 2
      ? RETRIGGER_FREE_GAMES[Math.min(scatterCount, 5) as 2 | 3 | 4 | 5] ?? 0
      : 0
    : scatterCount >= 3
      ? BASE_FREE_GAMES[cappedScatter] ?? 0
      : 0;

  return {
    lineWins,
    lineWin,
    scatterCount,
    scatterWin,
    multiplier,
    totalWin,
    awardedFreeGames,
  };
}

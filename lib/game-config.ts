export const GAME_VERSION = "afb-prototype-0.1.0";
export const GRID_COLUMNS = 5;
export const GRID_ROWS = 4;
export const PAYLINE_COUNT = 50;

export type RegularSymbol =
  | "buffalo"
  | "lion"
  | "elephant"
  | "zebra"
  | "antelope"
  | "a"
  | "k"
  | "q"
  | "j"
  | "ten"
  | "nine";

export type SymbolId = RegularSymbol | "wild" | "scatter";

export type SymbolDefinition = {
  id: SymbolId;
  label: string;
  mark: string;
  className: string;
};

export const SYMBOLS: Record<SymbolId, SymbolDefinition> = {
  buffalo: { id: "buffalo", label: "水牛", mark: "牛", className: "symbol-buffalo" },
  lion: { id: "lion", label: "狮子", mark: "狮", className: "symbol-lion" },
  elephant: { id: "elephant", label: "大象", mark: "象", className: "symbol-elephant" },
  zebra: { id: "zebra", label: "斑马", mark: "斑", className: "symbol-zebra" },
  antelope: { id: "antelope", label: "羚羊", mark: "羚", className: "symbol-antelope" },
  a: { id: "a", label: "A", mark: "A", className: "symbol-card" },
  k: { id: "k", label: "K", mark: "K", className: "symbol-card" },
  q: { id: "q", label: "Q", mark: "Q", className: "symbol-card" },
  j: { id: "j", label: "J", mark: "J", className: "symbol-card" },
  ten: { id: "ten", label: "10", mark: "10", className: "symbol-card" },
  nine: { id: "nine", label: "9", mark: "9", className: "symbol-card" },
  wild: { id: "wild", label: "WILD", mark: "W", className: "symbol-wild" },
  scatter: { id: "scatter", label: "SCATTER", mark: "S", className: "symbol-scatter" },
};

/**
 * Exact client-visible paytable recovered from the target game's own help art.
 * Values are line-bet multipliers. Scatter uses total-bet multipliers.
 */
export const PAYTABLE: Record<RegularSymbol, Partial<Record<2 | 3 | 4 | 5, number>>> = {
  buffalo: { 2: 10, 3: 50, 4: 100, 5: 250 },
  lion: { 3: 50, 4: 100, 5: 150 },
  elephant: { 3: 50, 4: 100, 5: 150 },
  zebra: { 3: 20, 4: 80, 5: 120 },
  antelope: { 3: 20, 4: 80, 5: 120 },
  a: { 3: 10, 4: 50, 5: 80 },
  k: { 3: 10, 4: 50, 5: 80 },
  q: { 3: 5, 4: 20, 5: 60 },
  j: { 3: 5, 4: 20, 5: 60 },
  ten: { 3: 5, 4: 10, 5: 60 },
  nine: { 3: 5, 4: 10, 5: 60 },
};

export const SCATTER_PAYOUT: Partial<Record<3 | 4 | 5, number>> = {
  3: 2,
  4: 10,
  5: 20,
};

export const BASE_FREE_GAMES: Partial<Record<3 | 4 | 5, number>> = {
  3: 8,
  4: 15,
  5: 20,
};

export const RETRIGGER_FREE_GAMES: Partial<Record<2 | 3 | 4 | 5, number>> = {
  2: 5,
  3: 8,
  4: 15,
  5: 20,
};

export type Payline = readonly [number, number, number, number, number];

function buildPrototypePaylines(): Payline[] {
  const horizontal: Payline[] = [
    [0, 0, 0, 0, 0],
    [1, 1, 1, 1, 1],
    [2, 2, 2, 2, 2],
    [3, 3, 3, 3, 3],
  ];
  const candidates: Payline[] = [];

  for (let a = 0; a < GRID_ROWS; a += 1) {
    for (let b = 0; b < GRID_ROWS; b += 1) {
      for (let c = 0; c < GRID_ROWS; c += 1) {
        for (let d = 0; d < GRID_ROWS; d += 1) {
          for (let e = 0; e < GRID_ROWS; e += 1) {
            const line: Payline = [a, b, c, d, e];
            if (horizontal.some((item) => item.every((row, index) => row === line[index]))) {
              continue;
            }
            candidates.push(line);
          }
        }
      }
    }
  }

  candidates.sort((left, right) => {
    const score = (line: Payline) => {
      const travel = line.slice(1).reduce((sum, row, index) => sum + Math.abs(row - line[index]), 0);
      const jumps = line.slice(1).reduce((sum, row, index) => sum + (Math.abs(row - line[index]) > 1 ? 4 : 0), 0);
      const turns = line.slice(2).reduce((sum, row, index) => {
        const before = line[index + 1] - line[index];
        const after = row - line[index + 1];
        return sum + (Math.sign(before) !== Math.sign(after) ? 1 : 0);
      }, 0);
      return jumps * 100 + travel * 10 + turns;
    };

    const difference = score(left) - score(right);
    if (difference !== 0) return difference;
    return left.join("").localeCompare(right.join(""));
  });

  return [...horizontal, ...candidates.slice(0, PAYLINE_COUNT - horizontal.length)];
}

/**
 * The original client confirms 50 lines but does not expose the line map.
 * This independent deterministic map is provisional until line-by-line capture.
 */
export const PAYLINES = buildPrototypePaylines();

export const ROOM_BASE_BETS = [50, 500] as const;
export const BET_LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;
export const BET_MULTIPLIERS = [1, 5, 10, 20, 50] as const;

export const MATH_DISCLOSURE = {
  status: "UNCALIBRATED_PROTOTYPE",
  targetRtp: null,
  volatility: "待百万局以上仿真后冻结",
  originalRtpKnown: false,
  realMoneyEnabled: false,
} as const;

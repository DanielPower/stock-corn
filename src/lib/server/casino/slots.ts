// Slot machine rules: reel weights, pay table and spin logic.
// Pure functions only, so the odds can be checked without a database.

export const SYMBOLS = [
  "cherry",
  "lemon",
  "corn",
  "bell",
  "diamond",
  "seven",
] as const;

export type SlotSymbol = (typeof SYMBOLS)[number];

/** Relative chance of each symbol landing on the payline, per reel. */
export const REEL_WEIGHTS: Record<SlotSymbol, number> = {
  cherry: 7,
  lemon: 6,
  corn: 5,
  bell: 4,
  diamond: 2,
  seven: 1,
};

/** Payout for three of a kind, as a multiple of the bet (stake included). */
export const THREE_OF_A_KIND: Record<SlotSymbol, number> = {
  cherry: 10,
  lemon: 8,
  corn: 20,
  bell: 25,
  diamond: 75,
  seven: 200,
};

/** Two cherries anywhere on the payline. */
export const TWO_CHERRIES = 2;

export const SYMBOL_EMOJI: Record<SlotSymbol, string> = {
  cherry: "🍒",
  lemon: "🍋",
  corn: "🌽",
  bell: "🔔",
  diamond: "💎",
  seven: "7️⃣",
};

export type Reel = [SlotSymbol, SlotSymbol, SlotSymbol];

export type SpinOutcome = {
  /** The three symbols on the payline, left to right. */
  line: Reel;
  /** Payout multiplier; 0 means the bet is lost. */
  multiplier: number;
  /** Human readable name of the winning combination, if any. */
  combo: string | null;
};

const TOTAL_WEIGHT = SYMBOLS.reduce((sum, s) => sum + REEL_WEIGHTS[s], 0);

export const randomSymbol = (rng: () => number = Math.random): SlotSymbol => {
  let roll = rng() * TOTAL_WEIGHT;
  for (const symbol of SYMBOLS) {
    roll -= REEL_WEIGHTS[symbol];
    if (roll < 0) {
      return symbol;
    }
  }
  return SYMBOLS[SYMBOLS.length - 1];
};

export const evaluate = (line: Reel): SpinOutcome => {
  const [a, b, c] = line;
  if (a === b && b === c) {
    return {
      line,
      multiplier: THREE_OF_A_KIND[a],
      combo: `Three ${a === "cherry" ? "cherrie" : a}s`,
    };
  }
  const cherries = line.filter((s) => s === "cherry").length;
  if (cherries === 2) {
    return { line, multiplier: TWO_CHERRIES, combo: "Two cherries" };
  }
  return { line, multiplier: 0, combo: null };
};

export const spin = (rng: () => number = Math.random): SpinOutcome =>
  evaluate([randomSymbol(rng), randomSymbol(rng), randomSymbol(rng)]);

/** Expected return per chip bet, computed exactly from the weights. */
export const returnToPlayer = (): number => {
  let expected = 0;
  for (const a of SYMBOLS) {
    for (const b of SYMBOLS) {
      for (const c of SYMBOLS) {
        const p =
          (REEL_WEIGHTS[a] * REEL_WEIGHTS[b] * REEL_WEIGHTS[c]) /
          TOTAL_WEIGHT ** 3;
        expected += p * evaluate([a, b, c]).multiplier;
      }
    }
  }
  return expected;
};

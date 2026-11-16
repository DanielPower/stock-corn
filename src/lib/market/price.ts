// Corn price simulation.
//
// Tuned for a casual game, not realism: the price swings hard (often +/-50% in
// a day) and wanders freely. The log price is a random walk (geometric
// Brownian motion) with a soft wall that only pulls back hard when the price
// gets ~10x away from basePrice, so it never runs off to zero or infinity but
// doesn't feel pinned either. On top of that:
//
//  - a wandering trend, so prices have bull and bear runs instead of pure
//    noise,
//  - a few jump events ("news") a day, which shock the price 8-30% (sometimes
//    double that) up or down,
//  - price impact from trades, so buying pushes the price up and selling
//    pushes it down.
//
// Everything here is pure so it can be tested and tuned without a database.

export type MarketState = {
  price: number;
  trend: number;
};

export type TickResult = MarketState & {
  event: string | null;
};

export const MARKET_PARAMS = {
  /** Price the market wanders around, in CropCoins per cob. */
  basePrice: 10,
  /**
   * Strength of the pull back towards basePrice. The pull grows with the cube
   * of the distance (in log space), so near the base price there is almost no
   * pull and the price wanders freely; only far-off prices (around 10x away)
   * get dragged back.
   */
  reversion: 2e-4,
  /** Volatility of the log price per minute (~25%/day before trends and news). */
  volatility: 0.25 / Math.sqrt(1440),
  /** Trend mean-reversion per minute. Trends last a few hours. */
  trendReversion: 1 / 180,
  /** Volatility of the trend per minute. Gives big bull and bear runs. */
  trendVolatility: 0.00004,
  /** Chance of a news event per minute (~3 per day). */
  eventChance: 1 / 480,
  /** Hard backstop; the soft pull should keep prices well inside this. */
  minPrice: 0.1,
  maxPrice: 1000,
  /** Log-price impact per unit traded. 100 cobs moves the price ~3%. */
  impact: 0.0003,
  /** Fee taken on each side of a trade. */
  spread: 0.01,
} as const;

type NewsEvent = { headline: string; shock: number };

const BULLISH_NEWS: string[] = [
  "Drought grips the corn belt",
  "Locust swarm sighted on the horizon",
  "Ethanol mandate doubled",
  "Popcorn craze sweeps the nation",
  "Corn Czar declares a feast day",
  "Blight hits neighbouring kingdom's fields",
];

const BEARISH_NEWS: string[] = [
  "Record harvest reported",
  "Perfect growing weather all season",
  "Royal granary overflowing",
  "Rival kingdom dumps cheap corn",
  "Scientists unveil miracle fertilizer",
  "Wheat is the new corn, say influencers",
];

/** Standard normal sample using Box–Muller. */
export const gaussian = (random: () => number = Math.random): number => {
  let u = 0;
  while (u === 0) u = random();
  const v = random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

const clampPrice = (price: number): number =>
  Math.min(MARKET_PARAMS.maxPrice, Math.max(MARKET_PARAMS.minPrice, price));

const pick = <T>(items: T[], random: () => number): T =>
  items[Math.floor(random() * items.length) % items.length];

const rollEvent = (random: () => number): NewsEvent | null => {
  if (random() >= MARKET_PARAMS.eventChance) return null;
  const bullish = random() < 0.5;
  // Shock between 8% and 30% in log space, occasionally doubled.
  const size = (0.08 + random() * 0.22) * (random() < 0.15 ? 2 : 1);
  return bullish
    ? { headline: pick(BULLISH_NEWS, random), shock: size }
    : { headline: pick(BEARISH_NEWS, random), shock: -size };
};

/** Advance the market by one minute. */
export const tick = (
  state: MarketState,
  random: () => number = Math.random,
): TickResult => {
  const p = MARKET_PARAMS;
  const logPrice = Math.log(state.price);
  const logBase = Math.log(p.basePrice);

  const trend =
    state.trend * (1 - p.trendReversion) +
    p.trendVolatility * gaussian(random);

  const event = rollEvent(random);

  const distance = logPrice - logBase;
  const nextLog =
    logPrice -
    p.reversion * distance ** 3 +
    trend +
    p.volatility * gaussian(random) +
    (event?.shock ?? 0);

  return {
    price: clampPrice(Math.exp(nextLog)),
    trend,
    event: event?.headline ?? null,
  };
};

export type Quote = {
  /** CropCoins the user pays (buy) or receives (sell). */
  total: number;
  /** Price after the trade's market impact. */
  newPrice: number;
};

/**
 * Price `amount` units against the market with price impact. The price moves
 * continuously as the order fills (p(q) = p0 * e^(k q)), so the order pays the
 * average price along the way. Buys round up and sells round down, plus a
 * small spread, so round trips never make money.
 */
export const quote = (
  price: number,
  side: "buy" | "sell",
  amount: number,
): Quote => {
  const k = MARKET_PARAMS.impact;
  if (side === "buy") {
    const newPrice = clampPrice(price * Math.exp(k * amount));
    const raw = (price * (Math.exp(k * amount) - 1)) / k;
    return {
      total: Math.ceil(raw * (1 + MARKET_PARAMS.spread)),
      newPrice,
    };
  }
  const newPrice = clampPrice(price * Math.exp(-k * amount));
  const raw = (price * (1 - Math.exp(-k * amount))) / k;
  return {
    total: Math.floor(raw * (1 - MARKET_PARAMS.spread)),
    newPrice,
  };
};

const SPARK_CHARS = "▁▂▃▄▅▆▇█";

/** Render a series of prices as a unicode sparkline. */
export const sparkline = (prices: number[], width = 30): string => {
  if (prices.length === 0) return "";
  const step = Math.max(1, prices.length / width);
  const samples: number[] = [];
  for (let i = 0; i < prices.length; i += step) {
    samples.push(prices[Math.floor(i)]);
  }
  samples[samples.length - 1] = prices[prices.length - 1];
  const min = Math.min(...samples);
  const max = Math.max(...samples);
  const range = max - min || 1;
  return samples
    .map(
      (p) =>
        SPARK_CHARS[
          Math.round(((p - min) / range) * (SPARK_CHARS.length - 1))
        ],
    )
    .join("");
};

export const formatPrice = (price: number): string => price.toFixed(2);

export const formatChange = (from: number, to: number): string => {
  if (!from) return "n/a";
  const pct = ((to - from) / from) * 100;
  const arrow = pct > 0 ? "▲" : pct < 0 ? "▼" : "■";
  return `${arrow} ${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`;
};

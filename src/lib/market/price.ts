// Corn price simulation.
//
// The log price follows a mean-reverting random walk (an Ornstein–Uhlenbeck
// process, i.e. geometric Brownian motion pulled back towards a long-run
// price) with three extra ingredients that make it feel like a market:
//
//  - a slowly wandering trend, so prices have bull and bear runs instead of
//    pure noise,
//  - rare jump events ("news"), which shock the price up or down,
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
  /** Long-run price the market reverts to, in CropCoins per cob. */
  basePrice: 10,
  /** Mean-reversion speed per minute. Half-life of about one day. */
  reversion: Math.LN2 / 1440,
  /** Volatility of the log price per minute (~10% per day). */
  volatility: 0.1 / Math.sqrt(1440),
  /** Trend mean-reversion per minute. Trends last a few hours. */
  trendReversion: 1 / 240,
  /** Volatility of the trend per minute. */
  trendVolatility: 0.00001,
  /** Chance of a news event per minute (~1 per day). */
  eventChance: 1 / 1440,
  /** Price never leaves this range. */
  minPrice: 0.5,
  maxPrice: 500,
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
  // Shock between 3% and 12% in log space.
  const size = 0.03 + random() * 0.09;
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

  const nextLog =
    logPrice +
    p.reversion * (logBase - logPrice) +
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

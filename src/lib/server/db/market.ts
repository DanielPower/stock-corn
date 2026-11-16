import { db } from "./db";
import { CREATE_TRADE, CREATE_TRANSFER, UPDATE_TRADE_STATUS } from "./statements";
import { Commodities, type Commodity } from "../../commodities";
import { quote, tick, type MarketState } from "../../market/price";

export const MARKET_FARMER = "MARKET";
/** Commodity used to pay for things on the market. */
export const MARKET_CURRENCY = Commodities.CropCoins;

const GET_MARKET = db.prepare<
  [{ commodity: Commodity }],
  { price: number; trend: number; updated_at: string }
>(`SELECT price, trend, updated_at FROM market WHERE commodity = $commodity`);

const GET_MARKETS = db.prepare<
  [],
  { commodity: Commodity; price: number; trend: number }
>(`SELECT commodity, price, trend FROM market`);

const SET_MARKET = db.prepare<
  [{ commodity: Commodity; price: number; trend: number }],
  []
>(`
  UPDATE market
  SET price = $price, trend = $trend, updated_at = CURRENT_TIMESTAMP
  WHERE commodity = $commodity
`);

const INSERT_PRICE = db.prepare<
  [
    {
      commodity: Commodity;
      price: number;
      event: string | null;
      shock: number | null;
    },
  ],
  { id: number }
>(`
  INSERT INTO market_price (commodity, price, event, shock)
  VALUES ($commodity, $price, $event, $shock)
  RETURNING id
`);

const SET_ARTICLE = db.prepare<
  [{ id: number; headline: string; article: string }],
  []
>(`UPDATE market_price SET event = $headline, article = $article WHERE id = $id`);

const GET_NEWS_HISTORY = db.prepare<
  [{ commodity: Commodity; limit: number; exclude: number }],
  { date: string; headline: string; article: string; shock: number | null }
>(`
  SELECT date, event AS headline, article, shock FROM market_price
  WHERE commodity = $commodity AND article IS NOT NULL AND id != $exclude
  ORDER BY id DESC
  LIMIT $limit
`);

const GET_RECENT_TRADERS = db.prepare<[{ since: string }], { username: string }>(`
  SELECT DISTINCT f.username FROM trade t
  JOIN farmer f ON f.id = t.source_farmer
  WHERE t.destination_farmer = 'MARKET' AND t.date >= $since
  AND f.username IS NOT NULL
  LIMIT 20
`);

const GET_PRICE_HISTORY = db.prepare<
  [{ commodity: Commodity; since: string }],
  { price: number; date: string; event: string | null }
>(`
  SELECT price, date, event FROM market_price
  WHERE commodity = $commodity AND date >= $since
  ORDER BY id
`);

const GET_RECENT_EVENTS = db.prepare<
  [{ commodity: Commodity; limit: number }],
  { price: number; date: string; event: string; article: string | null }
>(`
  SELECT price, date, event, article FROM market_price
  WHERE commodity = $commodity AND event IS NOT NULL
  ORDER BY id DESC
  LIMIT $limit
`);

const PRUNE_HISTORY = db.prepare<[{ before: string }], []>(`
  DELETE FROM market_price WHERE date < $before AND event IS NULL
`);

const GET_BALANCE = db.prepare<
  [{ farmer: string; commodity: Commodity }],
  { amount: number }
>(`SELECT amount FROM balance WHERE farmer = $farmer AND commodity = $commodity`);

/** SQLite CURRENT_TIMESTAMP format: "YYYY-MM-DD HH:MM:SS" in UTC. */
export const toSqlDate = (date: Date): string =>
  date.toISOString().replace("T", " ").slice(0, 19);

export const getMarket = (
  commodity: Commodity = Commodities.Corn,
): MarketState | undefined => GET_MARKET.get({ commodity });

export const getPriceHistory = (
  commodity: Commodity = Commodities.Corn,
  minutes = 24 * 60,
) =>
  GET_PRICE_HISTORY.all({
    commodity,
    since: toSqlDate(new Date(Date.now() - minutes * 60_000)),
  });

export const getRecentEvents = (
  commodity: Commodity = Commodities.Corn,
  limit = 5,
) => GET_RECENT_EVENTS.all({ commodity, limit });

export type NewsEvent = {
  id: number;
  commodity: Commodity;
  headline: string;
  shock: number;
  priceBefore: number;
  priceAfter: number;
};

/**
 * Advance every market by one minute and record the new prices. Returns the
 * news events that happened this tick so articles can be written for them.
 */
export const tickMarkets = db.transaction((): NewsEvent[] => {
  const events: NewsEvent[] = [];
  for (const market of GET_MARKETS.all()) {
    const next = tick(market);
    SET_MARKET.run({
      commodity: market.commodity,
      price: next.price,
      trend: next.trend,
    });
    const { id } = INSERT_PRICE.get({
      commodity: market.commodity,
      price: next.price,
      event: next.event,
      shock: next.event ? next.shock : null,
    })!;
    if (next.event) {
      events.push({
        id,
        commodity: market.commodity,
        headline: next.event,
        shock: next.shock,
        priceBefore: market.price,
        priceAfter: next.price,
      });
    }
  }
  return events;
});

export const setArticle = (id: number, headline: string, article: string) =>
  SET_ARTICLE.run({ id, headline, article });

/**
 * Past LLM-written news articles, oldest first, excluding the event with id
 * `exclude`. Used as the running storyline for new articles.
 */
export const getNewsHistory = (
  commodity: Commodity = Commodities.Corn,
  limit = 40,
  exclude = -1,
) => GET_NEWS_HISTORY.all({ commodity, limit, exclude }).reverse();

/** Usernames of farmers who traded on the market in the last few days. */
export const getRecentTraders = (days = 3) =>
  GET_RECENT_TRADERS.all({
    since: toSqlDate(new Date(Date.now() - days * 24 * 60 * 60_000)),
  }).map((r) => r.username);

/** Drop minute-by-minute history older than `days`. News events are kept. */
export const pruneHistory = (days = 30) =>
  PRUNE_HISTORY.run({
    before: toSqlDate(new Date(Date.now() - days * 24 * 60 * 60_000)),
  });

export type MarketOrderResult =
  | {
      value: {
        amount: number;
        total: number;
        price: number;
        newPrice: number;
        commodityBalance: number;
        currencyBalance: number;
      };
    }
  | {
      error:
        | "INVALID_AMOUNT"
        | "INSUFFICIENT_FUNDS"
        | "ORDER_TOO_SMALL"
        | "MARKET_CLOSED";
      needed?: number;
      have?: number;
    };

/**
 * Buy or sell `amount` of a commodity against the market, paying or receiving
 * CropCoins. Executes as a single two-sided trade between the farmer and the
 * MARKET so it shows up in the ledger like any other trade.
 */
export const marketOrder = db.transaction(
  (
    farmer: string,
    side: "buy" | "sell",
    amount: number,
    commodity: Commodity = Commodities.Corn,
  ): MarketOrderResult => {
    if (!Number.isInteger(amount) || amount <= 0) {
      return { error: "INVALID_AMOUNT" };
    }
    const market = GET_MARKET.get({ commodity });
    if (!market) {
      return { error: "MARKET_CLOSED" };
    }

    const { total, newPrice } = quote(market.price, side, amount);
    if (total <= 0) {
      return { error: "ORDER_TOO_SMALL" };
    }

    const balanceOf = (c: Commodity) =>
      GET_BALANCE.get({ farmer, commodity: c })?.amount ?? 0;

    // What the farmer gives up must be covered by their balance.
    const [payCommodity, payAmount] =
      side === "buy"
        ? [MARKET_CURRENCY, total]
        : ([commodity, amount] as const);
    const have = balanceOf(payCommodity);
    if (have < payAmount) {
      return { error: "INSUFFICIENT_FUNDS", needed: payAmount, have };
    }

    // Transfers flow from the trade's source (the farmer) to its destination
    // (the market); a negative amount flows the other way.
    const { id } = CREATE_TRADE.get({
      sourceFarmer: farmer,
      destinationFarmer: MARKET_FARMER,
    })!;
    if (side === "buy") {
      CREATE_TRANSFER.run({ tradeId: id, commodity: MARKET_CURRENCY, amount: total });
      CREATE_TRANSFER.run({ tradeId: id, commodity, amount: -amount });
    } else {
      CREATE_TRANSFER.run({ tradeId: id, commodity, amount });
      CREATE_TRANSFER.run({ tradeId: id, commodity: MARKET_CURRENCY, amount: -total });
    }
    UPDATE_TRADE_STATUS.run({ id, status: "accepted" });

    SET_MARKET.run({ commodity, price: newPrice, trend: market.trend });

    return {
      value: {
        amount,
        total,
        price: market.price,
        newPrice,
        commodityBalance: balanceOf(commodity),
        currencyBalance: balanceOf(MARKET_CURRENCY),
      },
    };
  },
);

import { pruneHistory, tickMarkets } from "../db/market";
import { publishNews } from "./news";

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

let started = false;

/**
 * Update market prices once a minute, on the minute. Old minute-by-minute
 * history is pruned daily so the database doesn't grow forever.
 */
export const startMarketTicker = () => {
  if (started) return;
  started = true;

  const runTick = () => {
    try {
      publishNews(tickMarkets());
    } catch (e) {
      console.error("Market tick failed", e);
    }
  };

  const runPrune = () => {
    try {
      pruneHistory();
    } catch (e) {
      console.error("Market history prune failed", e);
    }
  };

  setTimeout(
    () => {
      runTick();
      setInterval(runTick, MINUTE);
    },
    MINUTE - (Date.now() % MINUTE),
  );

  runPrune();
  setInterval(runPrune, DAY);

  console.log("Corn market ticker started");
};

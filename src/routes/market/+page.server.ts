import { Commodities } from "$lib/commodities";
import {
  getMarket,
  getPriceHistory,
  getRecentEvents,
} from "$lib/server/db/market";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async () => {
  return {
    market: getMarket(Commodities.Corn) ?? null,
    history: getPriceHistory(Commodities.Corn, 24 * 60),
    events: getRecentEvents(Commodities.Corn, 10),
  };
};

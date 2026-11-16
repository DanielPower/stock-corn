import type { ServerInit } from "@sveltejs/kit";

export const init: ServerInit = async () => {
  const { startMarketTicker } = await import("$lib/server/market/ticker");
  startMarketTicker();
  await import("$lib/server/discord");
};

import { Commodities, type Commodity } from "../../commodities";
import type { Farmer } from "$lib/types";
import { db } from "./db";
import { updateFarmer } from "./operations";
import {
  CREATE_TRADE,
  CREATE_TRANSFER,
  GET_BALANCE,
  UPDATE_TRADE_STATUS,
} from "./statements";
import type { SpinOutcome } from "../casino/slots";

export const CASINO = "CASINO";

/** Chips are bought and sold with CropCoins, one for one. */
export const CHIP_CURRENCY = Commodities.CropCoins;
export const CHIP_PRICE = 1;

export const MAX_BET = 1000;

type Result<T, E> = { value: T } | { error: E };

type ExchangeResult = Result<
  { chips: number; currency: number },
  "INVALID_AMOUNT" | "INSUFFICIENT_FUNDS"
>;

type SlotsResult = Result<
  { payout: number; chips: number },
  "INVALID_AMOUNT" | "INSUFFICIENT_FUNDS"
>;

const balanceOf = (farmer: string, commodity: Commodity) =>
  GET_BALANCE.get({ farmer, commodity })?.amount ?? 0;

/**
 * Records one accepted trade between a farmer and the casino. A positive
 * amount moves that commodity from the farmer to the casino, a negative
 * amount moves it from the casino to the farmer.
 */
const tradeWithCasino = (
  farmer: string,
  transfers: Array<{ commodity: Commodity; amount: number }>,
) => {
  const { id } = CREATE_TRADE.get({
    sourceFarmer: farmer,
    destinationFarmer: CASINO,
  })!;
  for (const { commodity, amount } of transfers) {
    CREATE_TRANSFER.run({ tradeId: id, commodity, amount });
  }
  UPDATE_TRADE_STATUS.run({ id, status: "accepted" });
};

const balances = (farmer: string) => ({
  chips: balanceOf(farmer, Commodities.Chips),
  currency: balanceOf(farmer, CHIP_CURRENCY),
});

const BUY = db.transaction((farmer: string, chips: number): ExchangeResult => {
  const cost = chips * CHIP_PRICE;
  if (balanceOf(farmer, CHIP_CURRENCY) < cost) {
    return { error: "INSUFFICIENT_FUNDS" };
  }
  tradeWithCasino(farmer, [
    { commodity: CHIP_CURRENCY, amount: cost },
    { commodity: Commodities.Chips, amount: -chips },
  ]);
  return { value: balances(farmer) };
});

const SELL = db.transaction((farmer: string, chips: number): ExchangeResult => {
  if (balanceOf(farmer, Commodities.Chips) < chips) {
    return { error: "INSUFFICIENT_FUNDS" };
  }
  tradeWithCasino(farmer, [
    { commodity: Commodities.Chips, amount: chips },
    { commodity: CHIP_CURRENCY, amount: -chips * CHIP_PRICE },
  ]);
  return { value: balances(farmer) };
});

const PLAY = db.transaction(
  (farmer: string, bet: number, outcome: SpinOutcome): SlotsResult => {
    if (balanceOf(farmer, Commodities.Chips) < bet) {
      return { error: "INSUFFICIENT_FUNDS" };
    }
    const payout = bet * outcome.multiplier;
    // Settle as one net transfer; the balance trigger can't apply two
    // transfers of the same commodity within a single trade.
    const net = bet - payout;
    if (net !== 0) {
      tradeWithCasino(farmer, [{ commodity: Commodities.Chips, amount: net }]);
    }
    return {
      value: { payout, chips: balanceOf(farmer, Commodities.Chips) },
    };
  },
);

const validAmount = (amount: number) =>
  Number.isInteger(amount) && amount > 0;

export const buyChips = (farmer: Farmer, chips: number): ExchangeResult => {
  if (!validAmount(chips)) return { error: "INVALID_AMOUNT" };
  updateFarmer(farmer);
  return BUY(farmer.id, chips);
};

export const sellChips = (farmer: Farmer, chips: number): ExchangeResult => {
  if (!validAmount(chips)) return { error: "INVALID_AMOUNT" };
  updateFarmer(farmer);
  return SELL(farmer.id, chips);
};

/** Charges the bet and pays out the outcome of an already decided spin. */
export const settleSlots = (
  farmer: Farmer,
  bet: number,
  outcome: SpinOutcome,
): SlotsResult => {
  if (!validAmount(bet) || bet > MAX_BET) return { error: "INVALID_AMOUNT" };
  updateFarmer(farmer);
  return PLAY(farmer.id, bet, outcome);
};

export const getChipBalances = (farmer: Farmer) => {
  updateFarmer(farmer);
  return balances(farmer.id);
};

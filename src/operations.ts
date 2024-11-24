import {
  addHours,
  interval,
  intervalToDuration,
  type Duration,
} from "date-fns";
import {
  ADJUST_BALANCE,
  ENSURE_USER,
  GET_BALANCE,
  GET_LAST_DOLED,
  LOG_TRANSFER,
  TOP_BALANCES,
} from "./statements";

type Result<T, E> = { value: T } | { error: E };

type TransferResult = Result<
  {
    sourceBalance: number;
    destinationBalance: number;
  },
  "INSUFFICIENT_FUNDS" | "SOURCE_USER_NOT_FOUND" | "INVALID_AMOUNT"
>;

type DoleResult = Result<
  { result: keyof typeof DOLE_RESULT; yield: number; balance: number },
  { type: "ALREADY_DOLED"; duration: Duration } | { type: "UNKNOWN_ERROR" }
>;

const DOLE_RESULT = {
  NORMAL: 100,
  LUCKY: 777,
  UNFORTUNATE: 5,
};

export const getBalance = (id: string): number => {
  ENSURE_USER.run(id);
  let balance = GET_BALANCE.get(id)!.balance;
  return balance;
};

export const transfer = (
  source: string,
  destination: string,
  amount: number,
): TransferResult => {
  ENSURE_USER.run(source);
  ENSURE_USER.run(destination);
  const sourceBalance = GET_BALANCE.get(source)!.balance;
  if (amount <= 0) {
    return { error: "INVALID_AMOUNT" };
  }
  if (sourceBalance < amount && source !== "BANK") {
    return { error: "INSUFFICIENT_FUNDS" };
  }
  ADJUST_BALANCE.run(-amount, source);
  ADJUST_BALANCE.run(amount, destination);
  LOG_TRANSFER.run(source, destination, amount);
  return {
    value: {
      sourceBalance: GET_BALANCE.get(source)!.balance,
      destinationBalance: GET_BALANCE.get(destination)!.balance,
    },
  };
};

export const dole = (id: string): DoleResult => {
  const lastDoled = GET_LAST_DOLED.get(id);
  if (lastDoled) {
    const lastDoledDate = new Date(lastDoled.date);
    const nextDoleDate = addHours(lastDoledDate, 23);
    const now = new Date();
    if (now < nextDoleDate) {
      return {
        error: {
          type: "ALREADY_DOLED",
          duration: intervalToDuration(interval(now, nextDoleDate)),
        },
      } as const;
    }
  }
  const luck = Math.random();
  let result: keyof typeof DOLE_RESULT;
  if (luck > 0.9) {
    result = "LUCKY";
  } else if (luck < 0.1) {
    result = "UNFORTUNATE";
  } else {
    result = "NORMAL";
  }

  const transferResult = transfer("BANK", id, DOLE_RESULT[result]);
  if ("error" in transferResult) {
    return { error: { type: "UNKNOWN_ERROR" } };
  }

  return {
    value: {
      result: result,
      yield: DOLE_RESULT[result],
      balance: transferResult.value.destinationBalance,
    },
  };
};

export const getTopBalances = () => {
  return TOP_BALANCES.all();
};

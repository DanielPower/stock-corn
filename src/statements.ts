import { db } from "./db";
import type { Commodity } from "./enum";

export const GET_BALANCE = db.prepare<
  { amount: number },
  [{ $farmer: string; $commodity: Commodity }]
>(
  `SELECT amount FROM balance WHERE farmer = $farmer AND commodity = $commodity`,
);

export const GET_BALANCES = db.prepare<
  { commodity: Commodity; amount: number },
  [{ $farmer: string }]
>(`SELECT commodity, amount FROM balance WHERE farmer = $farmer`);

export const CREATE_TRADE = db.prepare<
  undefined,
  {
    $sourceFarmer: string;
    $sourceCommodity: Commodity;
    $sourceAmount: number;
    $destinationFarmer: string;
    $destinationCommodity: Commodity;
    $destinationAmount: number;
  }
>(`
  INSERT INTO trade (
    source_farmer, 
    source_commodity,
    source_amount,
    destination_farmer, 
    destination_commodity,
    destination_amount,
    date) 
  VALUES (
    $sourceFarmer,
    $sourceCommodity,
    $sourceAmount,
    $destinationFarmer,
    $destinationCommodity,
    $destinationAmount,
    CURRENT_TIMESTAMP);
`);

export const ENSURE_FARMER = db.prepare<undefined, [string]>(
  "INSERT OR IGNORE INTO farmer (id, date_started) VALUES (?, CURRENT_TIMESTAMP)",
);

export const GET_LAST_DOLED = db.prepare<{ date: string }, [string]>(
  "SELECT date FROM trade WHERE source_farmer = 'BANK' AND destination_farmer = ? ORDER BY date DESC LIMIT 1",
);

export const TOP_BALANCES = db.prepare<{ farmer: string; amount: number }, []>(`
  SELECT farmer, amount
  FROM balance
  WHERE commodity = 1
  AND farmer NOT IN ('BANK', 'JAIL')
  ORDER BY amount DESC LIMIT 10
`);

export const EXILE = db.prepare<undefined, [string]>(`
  UPDATE farmer SET exiled = 1 WHERE id = ?
`);

export const IS_EXILED = db.prepare<{ exiled: boolean }, [string]>(`
  SELECT exiled FROM farmer WHERE id = ? LIMIT 1
`);

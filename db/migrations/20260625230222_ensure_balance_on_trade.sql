-- migrate:up

DROP TRIGGER IF EXISTS update_balance_after_trade_accepted;

CREATE TRIGGER update_balance_after_trade_accepted
AFTER UPDATE ON trade
WHEN NEW.status = 'accepted' AND OLD.status != 'accepted'
BEGIN
  INSERT OR IGNORE INTO balance (farmer, commodity, amount)
  SELECT NEW.source_farmer, t.commodity, 0
  FROM transfer t
  WHERE t.trade_id = NEW.id;

  INSERT OR IGNORE INTO balance (farmer, commodity, amount)
  SELECT NEW.destination_farmer, t.commodity, 0
  FROM transfer t
  WHERE t.trade_id = NEW.id;

  UPDATE balance
  SET amount = balance.amount + transfer.amount
  FROM transfer
  WHERE transfer.trade_id = NEW.id
  AND balance.farmer = NEW.destination_farmer
  AND balance.commodity = transfer.commodity;

  UPDATE balance
  SET amount = balance.amount - transfer.amount
  FROM transfer
  WHERE transfer.trade_id = NEW.id
  AND balance.farmer = NEW.source_farmer
  AND balance.commodity = transfer.commodity;
END;

-- migrate:down

DROP TRIGGER IF EXISTS update_balance_after_trade_accepted;

CREATE TRIGGER update_balance_after_trade_accepted
AFTER UPDATE ON trade
WHEN NEW.status = 'accepted' AND OLD.status != 'accepted'
BEGIN
  UPDATE balance
  SET amount = balance.amount + transfer.amount
  FROM transfer
  WHERE transfer.trade_id = NEW.id
  AND balance.farmer = NEW.destination_farmer
  AND balance.commodity = transfer.commodity;

  UPDATE balance
  SET amount = balance.amount - transfer.amount
  FROM transfer
  WHERE transfer.trade_id = NEW.id
  AND balance.farmer = NEW.source_farmer
  AND balance.commodity = transfer.commodity;
END;

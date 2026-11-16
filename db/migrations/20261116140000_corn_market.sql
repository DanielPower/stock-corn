-- migrate:up

-- The market is a counterparty with unlimited supply, like BANK.
INSERT OR IGNORE INTO farmer (id, date_started, username)
VALUES ('MARKET', CURRENT_TIMESTAMP, 'Corn Market');

-- Current simulator state for each commodity traded on the market.
-- price is quoted in CropCoins per unit; trend is the slowly varying drift
-- of the log price.
CREATE TABLE market (
  commodity INTEGER PRIMARY KEY,
  price REAL NOT NULL CHECK (price > 0),
  trend REAL NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- One row per simulator tick (every minute).
CREATE TABLE market_price (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  commodity INTEGER NOT NULL,
  price REAL NOT NULL CHECK (price > 0),
  date TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  event TEXT
);
CREATE INDEX market_price_commodity_date ON market_price (commodity, date);

-- Corn starts at 10 CropCoins per cob.
INSERT INTO market (commodity, price, trend) VALUES (1, 10.0, 0);
INSERT INTO market_price (commodity, price) VALUES (1, 10.0);

-- migrate:down
DROP INDEX market_price_commodity_date;
DROP TABLE market_price;
DROP TABLE market;
DELETE FROM farmer WHERE id = 'MARKET'
  AND NOT EXISTS (SELECT 1 FROM trade WHERE source_farmer = 'MARKET' OR destination_farmer = 'MARKET');

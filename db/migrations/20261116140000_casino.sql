-- migrate:up

-- The casino is the counterparty for chip exchanges and slot machine bets.
INSERT OR IGNORE INTO farmer (id, date_started, username)
VALUES ('CASINO', CURRENT_TIMESTAMP, 'Casino');

-- migrate:down

-- Left in place: removing it would orphan the casino's trade history.

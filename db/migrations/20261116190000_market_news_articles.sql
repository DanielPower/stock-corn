-- migrate:up
-- LLM-written article for a news event. NULL until (or unless) generated.
ALTER TABLE market_price ADD COLUMN article TEXT;
-- Log-price shock of the news event, so articles can scale their tone.
ALTER TABLE market_price ADD COLUMN shock REAL;

-- migrate:down
ALTER TABLE market_price DROP COLUMN shock;
ALTER TABLE market_price DROP COLUMN article;

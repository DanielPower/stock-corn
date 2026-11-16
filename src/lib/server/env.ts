import dotenv from "dotenv";

dotenv.config({
  path: [".env.development", ".env"],
  quiet: true,
});

export const {
  DISCORD_TOKEN,
  DATABASE_PATH,
  CORN_CZAR_ID,
  DISCORD_APPLICATION_ID,
  /** OpenAI-compatible base URL, e.g. http://llama-swap:8080/v1 */
  NEWS_LLM_URL,
  /** Channel to post market news articles in. */
  MARKET_NEWS_CHANNEL_ID,
} = process.env;

export const NEWS_LLM_MODEL = process.env.NEWS_LLM_MODEL || "qwen3.6-35b-a3b";

export const DISABLE_REGISTER = process.env.DISABLE_REGISTER === "true";

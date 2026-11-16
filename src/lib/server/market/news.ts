import { EmbedBuilder } from "discord.js";
import { buildNewsPrompt } from "../../market/newsPrompt";
import { formatChange, formatPrice } from "../../market/price";
import {
  getNewsHistory,
  getRecentTraders,
  setArticle,
  type NewsEvent,
} from "../db/market";
import { MARKET_NEWS_CHANNEL_ID, NEWS_LLM_MODEL, NEWS_LLM_URL } from "../env";

// llama-swap may need to load the model first, which can take a few minutes.
const LLM_TIMEOUT_MS = 6 * 60_000;

export type Article = { headline: string; article: string };

const ARTICLE_SCHEMA = {
  type: "object",
  properties: {
    headline: { type: "string" },
    article: { type: "string" },
  },
  required: ["headline", "article"],
};

/** Player names are user-controlled, so keep them short and plain. */
const cleanName = (name: string) =>
  name.replace(/[^\p{L}\p{N}_. -]/gu, "").slice(0, 32);

const parseArticle = (content: string): Article | null => {
  // Tolerate code fences or stray text around the JSON object.
  const match = content.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]);
    const headline = String(parsed.headline ?? "").trim();
    const article = String(parsed.article ?? "").trim();
    if (!headline || !article) return null;
    return {
      headline: headline.slice(0, 200),
      article: article.slice(0, 3000),
    };
  } catch {
    return null;
  }
};

export const writeArticle = async (
  event: NewsEvent,
): Promise<Article | null> => {
  if (!NEWS_LLM_URL) return null;

  const { system, user } = buildNewsPrompt({
    shock: event.shock,
    priceBefore: event.priceBefore,
    priceAfter: event.priceAfter,
    history: getNewsHistory(event.commodity, 40, event.id),
    recentTraders: getRecentTraders().map(cleanName).filter(Boolean),
  });

  const response = await fetch(
    `${NEWS_LLM_URL.replace(/\/$/, "")}/chat/completions`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(LLM_TIMEOUT_MS),
      body: JSON.stringify({
        model: NEWS_LLM_MODEL,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 1.0,
        top_p: 0.95,
        max_tokens: 800,
        response_format: {
          type: "json_schema",
          json_schema: { name: "article", schema: ARTICLE_SCHEMA },
        },
        // Qwen3: skip the thinking phase, we just want the article.
        chat_template_kwargs: { enable_thinking: false },
      }),
    },
  );
  if (!response.ok) {
    throw new Error(
      `News LLM returned ${response.status}: ${(await response.text()).slice(0, 200)}`,
    );
  }
  const body = await response.json();
  const content: string = body?.choices?.[0]?.message?.content ?? "";
  return parseArticle(content);
};

const postArticle = async (event: NewsEvent, article: Article) => {
  if (!MARKET_NEWS_CHANNEL_ID) return;
  const { bot } = await import("../discord");
  const channel = await bot.channels.fetch(MARKET_NEWS_CHANNEL_ID);
  if (!channel?.isSendable()) {
    console.error(`Market news channel ${MARKET_NEWS_CHANNEL_ID} not found`);
    return;
  }
  const embed = new EmbedBuilder()
    .setAuthor({ name: "📰 Corn Exchange News" })
    .setTitle(article.headline);
  if (article.article) embed.setDescription(article.article);
  await channel.send({
    embeds: [
      embed
        .setColor(event.shock > 0 ? 0x22c55e : 0xef4444)
        .setFooter({
          text: `Corn ${formatPrice(event.priceBefore)} → ${formatPrice(
            event.priceAfter,
          )} (${formatChange(event.priceBefore, event.priceAfter)})`,
        })
        .setTimestamp(new Date()),
    ],
  });
};

const handleEvent = async (event: NewsEvent) => {
  let article: Article | null = null;
  try {
    article = await writeArticle(event);
  } catch (e) {
    console.error("Failed to write market news article", e);
  }
  if (article) {
    // Replace the placeholder headline with the written one.
    setArticle(event.id, article.headline, article.article);
  }
  try {
    await postArticle(event, article ?? { headline: event.headline, article: "" });
  } catch (e) {
    console.error("Failed to post market news", e);
  }
};

// Write one article at a time so a slow model doesn't pile up requests.
let queue: Promise<void> = Promise.resolve();

export const publishNews = (events: NewsEvent[]) => {
  for (const event of events) {
    queue = queue.then(() => handleEvent(event));
  }
};

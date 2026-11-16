// Builds the prompt for an LLM-written market news article. Pure, so it can be
// tested and tuned without a model.
//
// The model invents the story itself. What keeps it fresh is the news
// history: every past article is passed in as a running storyline, so the
// model can avoid repeating itself and sometimes write a follow-up to an
// earlier story. The tone scales with the size of the price swing, from
// deadpan for small moves to fully absurd for huge ones.

export type PastArticle = {
  date: string;
  headline: string;
  article: string;
  shock: number | null;
};

export type NewsPromptInput = {
  /** Log-price shock; positive is bullish. */
  shock: number;
  priceBefore: number;
  priceAfter: number;
  /** Past articles, oldest first. */
  history: PastArticle[];
  recentTraders: string[];
  now?: Date;
};

/** How many of the latest articles are shown in full; older ones are headlines only. */
const FULL_ARTICLES = 6;
/** Chance of asking for a follow-up to a past story, when there is one. */
const FOLLOW_UP_CHANCE = 0.35;

export const toneFor = (shock: number): string => {
  const size = Math.abs(shock);
  if (size < 0.15) {
    return "Mostly plausible, like real commodities news, but with deadpan humour and one odd detail.";
  }
  if (size < 0.3) {
    return "Clearly silly. Play the ridiculous premise completely straight, like a serious journalist.";
  }
  return "Completely unhinged and absurd. This is a historic, once-in-a-generation market move; the cause should be outrageous and escalate as the article goes on.";
};

const describeMove = (shock: number | null) => {
  if (shock == null) return "";
  const pct = Math.round((Math.exp(shock) - 1) * 100);
  return ` (corn ${pct >= 0 ? "+" : ""}${pct}%)`;
};

const pick = <T>(items: T[], random: () => number): T =>
  items[Math.floor(random() * items.length) % items.length];

export const buildNewsPrompt = (
  input: NewsPromptInput,
  random: () => number = Math.random,
): { system: string; user: string } => {
  const up = input.shock > 0;
  const pct = Math.round(
    ((input.priceAfter - input.priceBefore) / input.priceBefore) * 100,
  );
  const now = input.now ?? new Date();
  const followUp =
    input.history.length > 0 && random() < FOLLOW_UP_CHANCE;
  const player =
    input.recentTraders.length > 0 && random() < 0.35
      ? pick(input.recentTraders, random)
      : null;

  const system = [
    "You write short, funny news articles for the Corn Exchange, the corn market in a Discord game called Stock Corn.",
    "The world is a whimsical medieval-ish farming kingdom ruled by the Corn Czar, where corn is traded for CropCoins.",
    "Invent the cause yourself. Be inventive: anything from weather, wizards, guilds and royal decrees to cryptids, aliens, time travel or one very specific goose.",
    "Write in English. Keep it PG-13. Never break character or mention that this is a game or that you are an AI.",
    'Reply with JSON only: {"headline": string, "article": string}.',
    "The headline is at most 12 words. The article is 2 short paragraphs, under 120 words in total, with no markdown headings.",
  ].join("\n");

  const lines: string[] = [];

  if (input.history.length > 0) {
    const older = input.history.slice(0, -FULL_ARTICLES);
    const recent = input.history.slice(-FULL_ARTICLES);
    lines.push("The Corn Exchange news so far, oldest first:");
    for (const a of older) {
      lines.push(`- [${a.date}]${describeMove(a.shock)} ${a.headline}`);
    }
    for (const a of recent) {
      lines.push(
        `- [${a.date}]${describeMove(a.shock)} ${a.headline}`,
        `  ${a.article.replace(/\s*\n+\s*/g, " ")}`,
      );
    }
    lines.push("");
  }

  lines.push(
    `BREAKING, ${now.toUTCString()}: corn just ${up ? "spiked" : "crashed"} ${up ? "+" : ""}${pct}%, from ${input.priceBefore.toFixed(2)} to ${input.priceAfter.toFixed(2)} CropCoins per cob. Write the article explaining why.`,
    `Tone: ${toneFor(input.shock)}`,
  );

  if (followUp) {
    lines.push(
      "Make this a follow-up to one of the earlier stories above: a consequence, twist, sequel or comeuppance that explains this move. Pick whichever story fits best and refer back to it.",
    );
  } else if (input.history.length > 0) {
    lines.push(
      "Start a brand new storyline. Do not reuse the causes, characters, jokes or wording of the stories above (a brief passing nod to one is fine).",
    );
  }

  if (player) {
    lines.push(
      `You may mention the farmer "${player}", who has been trading corn recently, as a minor character.`,
    );
  }

  return { system, user: lines.join("\n") };
};

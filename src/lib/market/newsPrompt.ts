// Builds the prompt for an LLM-written market news article. Pure, so it can be
// tested and tuned without a model.
//
// Variety comes from three places so the same story doesn't come up twice:
//  - random ingredients (a subject, a format and sometimes a real player name)
//    picked fresh for every article,
//  - the recent headlines, which the model is told not to repeat,
//  - the tone, which scales with the size of the price swing: small moves
//    get deadpan, plausible-ish news, huge moves get full absurdity.

export type NewsPromptInput = {
  /** Log-price shock; positive is bullish. */
  shock: number;
  priceBefore: number;
  priceAfter: number;
  recentHeadlines: string[];
  recentTraders: string[];
  now?: Date;
};

const SUBJECTS = [
  "the weather, but described in alarming detail",
  "a royal decree from the Corn Czar",
  "a wizard or alchemist",
  "a cryptid sighting in the fields",
  "a rival kingdom's scheme",
  "a scientific breakthrough of questionable merit",
  "a celebrity chef",
  "a popcorn-related incident",
  "a sentient scarecrow",
  "the guild of tax collectors",
  "an ill-advised festival",
  "crows unionising",
  "a prophecy from a village oracle",
  "a fashion trend involving corn husks",
  "a heist",
  "a malfunctioning windmill",
  "an influencer's viral video",
  "the discovery of an ancient corn-themed artifact",
  "a diplomatic incident",
  "a sporting event that went wrong",
  "a new religion",
  "an extraterrestrial visitor",
  "a court case",
  "a time traveller",
  "a dragon with dietary opinions",
  "a startup pitch",
  "a mysterious crop circle",
  "the royal astronomer's latest chart",
  "a goose. Just one goose.",
  "an economist who has clearly not slept",
  "a corn maze that nobody has come out of",
  "a bake-off scandal",
  "ghosts",
  "a bureaucratic form that changed one word",
  "a talking cob",
  "a pirate crew that only steals corn",
];

const FORMATS = [
  "a breaking news bulletin",
  "a dry wire-service report",
  "a tabloid exclusive",
  "an interview with a confused bystander",
  "a market analyst's note",
  "a press release from an obviously guilty party",
  "an opinion column by an elderly farmer",
  "a live-blog of events as they unfold",
  "an official royal proclamation",
  "a local town-crier announcement",
];

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
  const subject = pick(SUBJECTS, random);
  const format = pick(FORMATS, random);
  const player =
    input.recentTraders.length > 0 && random() < 0.35
      ? pick(input.recentTraders, random)
      : null;
  const now = input.now ?? new Date();

  const system = [
    "You write short, funny news articles for the Corn Exchange, the corn market in a Discord game called Stock Corn.",
    "The world is a whimsical medieval-ish farming kingdom ruled by the Corn Czar, where corn is traded for CropCoins.",
    "Write in English. Keep it PG-13. Never break character or mention that this is a game or that you are an AI.",
    'Reply with JSON only: {"headline": string, "article": string}.',
    "The headline is at most 12 words. The article is 2 short paragraphs, under 120 words in total, with no markdown headings.",
  ].join("\n");

  const lines = [
    `Corn just ${up ? "spiked" : "crashed"} ${up ? "+" : ""}${pct}%, from ${input.priceBefore.toFixed(2)} to ${input.priceAfter.toFixed(2)} CropCoins per cob.`,
    `Write ${format} explaining why. The story should involve ${subject}.`,
    `Tone: ${toneFor(input.shock)}`,
    `It is ${now.toUTCString()}.`,
  ];
  if (player) {
    lines.push(
      `You may mention the farmer "${player}", who has been trading corn recently, as a minor character.`,
    );
  }
  if (input.recentHeadlines.length > 0) {
    lines.push(
      "",
      "Recent headlines. Do NOT repeat their topics, jokes or wording:",
      ...input.recentHeadlines.map((h) => `- ${h}`),
    );
  }

  return { system, user: lines.join("\n") };
};

import {
  type ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from "discord.js";
import { Commodities } from "../../commodities";
import {
  formatChange,
  formatPrice,
  quote,
  sparkline,
} from "../../market/price";
import {
  getMarket,
  getPriceHistory,
  getRecentEvents,
  marketOrder,
} from "../db/market";
import { isExiled, updateFarmer } from "../db/operations";
import { userToFarmer } from "./utilities";

type Command = {
  data: SlashCommandBuilder;
  handler: (interaction: ChatInputCommandInteraction) => Promise<void>;
};

const GOLD = 0xfacc15;
const GREEN = 0x22c55e;
const RED = 0xef4444;

const priceEmbed = () => {
  const market = getMarket();
  if (!market) return null;

  const history = getPriceHistory(Commodities.Corn, 24 * 60);
  const prices = [...history.map((h) => h.price), market.price];
  const hourAgo = prices[Math.max(0, prices.length - 61)];
  const dayAgo = prices[0];
  const high = Math.max(...prices);
  const low = Math.min(...prices);
  const latestEvent = getRecentEvents(Commodities.Corn, 1)[0];

  const embed = new EmbedBuilder()
    .setTitle("🌽 Corn Exchange")
    .setColor(market.price >= dayAgo ? GREEN : RED)
    .setDescription(
      [
        `**${formatPrice(market.price)}** CropCoins per cob`,
        "```",
        sparkline(prices, 32),
        "```",
      ].join("\n"),
    )
    .addFields(
      { name: "1h", value: formatChange(hourAgo, market.price), inline: true },
      { name: "24h", value: formatChange(dayAgo, market.price), inline: true },
      {
        name: "24h range",
        value: `${formatPrice(low)} – ${formatPrice(high)}`,
        inline: true,
      },
    )
    .setFooter({ text: "Prices update every minute" });

  if (latestEvent) {
    embed.addFields({
      name: "📰 Latest news",
      value: `${latestEvent.event} (<t:${Math.floor(
        new Date(latestEvent.date + "Z").getTime() / 1000,
      )}:R>)`,
    });
  }
  return embed;
};

const order = async (
  interaction: ChatInputCommandInteraction,
  side: "buy" | "sell",
) => {
  if (isExiled(interaction.user.id)) {
    await interaction.reply("You are exiled from the kingdom.");
    return;
  }
  updateFarmer(userToFarmer(interaction.user));
  const amount = interaction.options.getInteger("amount", true);
  const result = marketOrder(interaction.user.id, side, amount);

  if ("error" in result) {
    switch (result.error) {
      case "INVALID_AMOUNT":
        await interaction.reply("The amount must be positive.");
        break;
      case "INSUFFICIENT_FUNDS":
        await interaction.reply(
          side === "buy"
            ? `That costs ${result.needed} CropCoins, but you only have ${result.have}.`
            : `You only have ${result.have} cobs to sell.`,
        );
        break;
      case "ORDER_TOO_SMALL":
        await interaction.reply(
          "That order is worth less than one CropCoin. Sell more cobs.",
        );
        break;
      case "MARKET_CLOSED":
        await interaction.reply("The corn market is closed.");
        break;
    }
    return;
  }

  const { total, price, newPrice, commodityBalance, currencyBalance } =
    result.value;
  await interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setTitle(side === "buy" ? "Corn purchased" : "Corn sold")
        .setColor(GOLD)
        .setDescription(
          side === "buy"
            ? `You bought **${amount}** cobs for **${total}** CropCoins.`
            : `You sold **${amount}** cobs for **${total}** CropCoins.`,
        )
        .addFields(
          {
            name: "Avg price",
            value: formatPrice(total / amount),
            inline: true,
          },
          {
            name: "Market price",
            value: `${formatPrice(price)} → ${formatPrice(newPrice)}`,
            inline: true,
          },
          { name: "​", value: "​", inline: true },
          { name: "Corn", value: `${commodityBalance} cobs`, inline: true },
          { name: "CropCoins", value: `${currencyBalance}`, inline: true },
        ),
    ],
  });
};

export const marketCommands: Command[] = [
  {
    data: new SlashCommandBuilder()
      .setName("market")
      .setDescription("Trade corn on the Corn Exchange")
      .addSubcommand((sub) =>
        sub.setName("price").setDescription("Check the current price of corn"),
      )
      .addSubcommand((sub) =>
        sub
          .setName("buy")
          .setDescription("Buy corn with CropCoins")
          .addIntegerOption((option) =>
            option
              .setName("amount")
              .setDescription("Cobs of corn to buy")
              .setMinValue(1)
              .setRequired(true),
          ),
      )
      .addSubcommand((sub) =>
        sub
          .setName("sell")
          .setDescription("Sell corn for CropCoins")
          .addIntegerOption((option) =>
            option
              .setName("amount")
              .setDescription("Cobs of corn to sell")
              .setMinValue(1)
              .setRequired(true),
          ),
      )
      .addSubcommand((sub) =>
        sub
          .setName("quote")
          .setDescription("See what an order would cost without trading")
          .addStringOption((option) =>
            option
              .setName("side")
              .setDescription("Buy or sell")
              .setRequired(true)
              .addChoices(
                { name: "buy", value: "buy" },
                { name: "sell", value: "sell" },
              ),
          )
          .addIntegerOption((option) =>
            option
              .setName("amount")
              .setDescription("Cobs of corn")
              .setMinValue(1)
              .setRequired(true),
          ),
      ) as unknown as SlashCommandBuilder,
    handler: async (interaction) => {
      switch (interaction.options.getSubcommand()) {
        case "buy":
          await order(interaction, "buy");
          return;
        case "sell":
          await order(interaction, "sell");
          return;
        case "quote": {
          const market = getMarket();
          if (!market) {
            await interaction.reply("The corn market is closed.");
            return;
          }
          const side = interaction.options.getString("side", true) as
            | "buy"
            | "sell";
          const amount = interaction.options.getInteger("amount", true);
          const { total } = quote(market.price, side, amount);
          await interaction.reply({
            content:
              side === "buy"
                ? `Buying ${amount} cobs right now would cost **${total}** CropCoins.`
                : `Selling ${amount} cobs right now would earn **${total}** CropCoins.`,
            flags: MessageFlags.Ephemeral,
          });
          return;
        }
        default: {
          const embed = priceEmbed();
          await interaction.reply(
            embed ? { embeds: [embed] } : "The corn market is closed.",
          );
        }
      }
    },
  },
];

import {
  AttachmentBuilder,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from "discord.js";
import { getCommodityName } from "../../commodities";
import { isExiled } from "../db/operations";
import {
  buyChips,
  CHIP_CURRENCY,
  getChipBalances,
  MAX_BET,
  sellChips,
  settleSlots,
} from "../db/casino";
import { renderSpinGif, SPIN_DURATION_MS } from "../casino/render";
import {
  SYMBOL_EMOJI,
  SYMBOLS,
  THREE_OF_A_KIND,
  TWO_CHERRIES,
  spin,
} from "../casino/slots";
import { userToFarmer } from "./utilities";
import type { Command } from "./handlers";

const CURRENCY = getCommodityName(CHIP_CURRENCY);
const DEFAULT_BET = 10;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const payTable = () =>
  [...SYMBOLS]
    .reverse()
    .map((s) => `${SYMBOL_EMOJI[s].repeat(3)} pays ${THREE_OF_A_KIND[s]}×`)
    .concat(`Any two ${SYMBOL_EMOJI.cherry} pays ${TWO_CHERRIES}×`)
    .join("\n");

export const casinoCommands: Array<Command> = [
  {
    data: new SlashCommandBuilder()
      .setName("chips")
      .setDescription("Buy or sell casino chips")
      .addSubcommand((sub) =>
        sub
          .setName("buy")
          .setDescription(`Buy chips with ${CURRENCY}`)
          .addIntegerOption((option) =>
            option
              .setName("amount")
              .setDescription("How many chips to buy")
              .setMinValue(1)
              .setRequired(true),
          ),
      )
      .addSubcommand((sub) =>
        sub
          .setName("sell")
          .setDescription(`Cash chips in for ${CURRENCY}`)
          .addIntegerOption((option) =>
            option
              .setName("amount")
              .setDescription("How many chips to sell")
              .setMinValue(1)
              .setRequired(true),
          ),
      )
      .addSubcommand((sub) =>
        sub.setName("balance").setDescription("Count your chips"),
      ),
    handler: async (interaction) => {
      if (isExiled(interaction.user.id)) {
        await interaction.reply("You are exiled from the kingdom.");
        return;
      }
      const farmer = userToFarmer(interaction.user);
      const subcommand = interaction.options.getSubcommand();

      if (subcommand === "balance") {
        const { chips, currency } = getChipBalances(farmer);
        await interaction.reply({
          embeds: [
            new EmbedBuilder().setTitle("Your chips").setFields([
              { name: "Chips", value: `${chips}`, inline: true },
              { name: CURRENCY, value: `${currency}`, inline: true },
            ]),
          ],
        });
        return;
      }

      const amount = interaction.options.getInteger("amount", true);
      const buying = subcommand === "buy";
      const result = buying
        ? buyChips(farmer, amount)
        : sellChips(farmer, amount);

      if ("error" in result) {
        await interaction.reply(
          result.error === "INSUFFICIENT_FUNDS"
            ? buying
              ? `You do not have enough ${CURRENCY}.`
              : "You do not have that many chips."
            : "The amount must be positive.",
        );
        return;
      }

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle(buying ? "Chips purchased" : "Chips cashed out")
            .setDescription(
              buying
                ? `You bought ${amount} chips for ${amount} ${CURRENCY}.`
                : `You sold ${amount} chips for ${amount} ${CURRENCY}.`,
            )
            .setFields([
              { name: "Chips", value: `${result.value.chips}`, inline: true },
              {
                name: CURRENCY,
                value: `${result.value.currency}`,
                inline: true,
              },
            ]),
        ],
      });
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName("slots")
      .setDescription("Pull the lever on the slot machine")
      .addIntegerOption((option) =>
        option
          .setName("bet")
          .setDescription(`Chips to bet (default ${DEFAULT_BET})`)
          .setMinValue(1)
          .setMaxValue(MAX_BET),
      ),
    handler: async (interaction) => {
      if (isExiled(interaction.user.id)) {
        await interaction.reply("You are exiled from the kingdom.");
        return;
      }
      const farmer = userToFarmer(interaction.user);
      const bet = interaction.options.getInteger("bet") ?? DEFAULT_BET;

      const outcome = spin();
      const result = settleSlots(farmer, bet, outcome);
      if ("error" in result) {
        await interaction.reply({
          content:
            result.error === "INSUFFICIENT_FUNDS"
              ? `You need ${bet} chips to play. Buy some with \`/chips buy\`.`
              : `Bets must be between 1 and ${MAX_BET} chips.`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const gif = new AttachmentBuilder(Buffer.from(renderSpinGif(outcome)), {
        name: "slots.gif",
      });
      const embed = new EmbedBuilder()
        .setTitle("🎰 Spinning...")
        .setDescription(`<@${interaction.user.id}> bet ${bet} chips`)
        .setImage("attachment://slots.gif");
      await interaction.reply({ embeds: [embed], files: [gif] });

      // Let the reels stop before revealing the result.
      await sleep(SPIN_DURATION_MS);

      const { payout, chips } = result.value;
      const line = outcome.line.map((s) => SYMBOL_EMOJI[s]).join(" ");
      embed
        .setTitle(
          payout > 0 ? `🎰 ${outcome.combo}! You win ${payout} chips` : "🎰 No luck",
        )
        .setColor(payout > 0 ? 0xffc428 : 0x6e1e8c)
        .setFields([
          { name: "Line", value: line, inline: true },
          { name: "Payout", value: `${payout}`, inline: true },
          { name: "Chips", value: `${chips}`, inline: true },
        ])
        .setFooter({ text: payTable().replaceAll("\n", " · ") });
      await interaction.editReply({ embeds: [embed] });
    },
  },
];

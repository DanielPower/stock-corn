import { formatDuration } from "date-fns";
import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
} from "discord.js";
import { Commodity } from "./enum.ts";
import {
  dole,
  exile,
  getBalances,
  getTopBalances,
  isExiled,
  trade,
} from "./operations.ts";

type Handler = (interaction: ChatInputCommandInteraction) => Promise<void>;
type Command = { data: SlashCommandBuilder; handler: Handler };

export const commands: Array<Command> = [
  {
    data: new SlashCommandBuilder()
      .setName("balance")
      .setDescription("Check your stockpile"),
    handler: async (interaction) => {
      if (isExiled(interaction.user.id)) {
        await interaction.reply("You are exiled from the kingdom.");
        return;
      }

      const balances = getBalances(interaction.user.id);
      await interaction.reply({
        embeds: [
          new EmbedBuilder({
            title: "Your stockpile",
            fields: balances.map(({ commodity, amount }) => ({
              name: Commodity[commodity],
              value: `${amount}`,
            })),
          }),
        ],
      });
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName("harvest")
      .setDescription("Reap the golden bounty"),
    handler: async (interaction) => {
      if (isExiled(interaction.user.id)) {
        await interaction.reply("You are exiled from the kingdom.");
        return;
      }

      const doleResult = dole(interaction.user.id);
      if ("error" in doleResult) {
        switch (doleResult.error.type) {
          case "ALREADY_DOLED":
            await interaction.reply(
              `You have already harvested today. You can harvest again in ${formatDuration(
                doleResult.error.duration,
              )}.`,
            );
            break;
          default:
            await interaction.reply("An unknown error occurred.");
            break;
        }
        return;
      }
      switch (doleResult.value.result) {
        case "LUCKY":
          await interaction.reply({
            embeds: [
              new EmbedBuilder().setTitle("Lucky harvest!").setFields([
                {
                  name: "yield",
                  value: `${doleResult.value.yield} cobs`,
                  inline: true,
                },
                {
                  name: "balance",
                  value: `${doleResult.value.balance} cobs`,
                  inline: true,
                },
              ]),
            ],
          });
          break;
        case "UNFORTUNATE":
          await interaction.reply({
            embeds: [
              new EmbedBuilder()
                .setTitle("But the field was barren")
                .setDescription("Your family may go hungry")
                .setFields([
                  {
                    name: "yield",
                    value: `${doleResult.value.yield} cobs`,
                    inline: true,
                  },
                  {
                    name: "balance",
                    value: `${doleResult.value.balance} cobs`,
                    inline: true,
                  },
                ]),
            ],
          });
          break;
        default:
          await interaction.reply({
            embeds: [
              new EmbedBuilder()
                .setTitle("You harvested your field")
                .setFields([
                  {
                    name: "yield",
                    value: `${doleResult.value.yield} cobs`,
                    inline: true,
                  },
                  {
                    name: "balance",
                    value: `${doleResult.value.balance} cobs`,
                    inline: true,
                  },
                ]),
            ],
          });
          break;
      }
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName("send")
      .setDescription("Send money to another user")
      .addUserOption((option) =>
        option
          .setName("user")
          .setDescription("The user to send corn to")
          .setRequired(true),
      )
      .addIntegerOption((option) =>
        option
          .setName("amount")
          .setDescription("The amount of corn to send")
          .setRequired(true),
      ) as SlashCommandBuilder,
    handler: async (interaction) => {
      if (isExiled(interaction.user.id)) {
        await interaction.reply("You are exiled from the kingdom.");
        return;
      }

      const source = interaction.user.id;
      const destinationUser = interaction.options.getUser("user")!;

      if (isExiled(destinationUser.id)) {
        await interaction.reply(
          "The recipient is exiled from the kingdom. They will not receive the corn.",
        );
        return;
      }

      const amount = interaction.options.getInteger("amount")!;
      const tradeResult = trade(
        source,
        Commodity.Corn,
        amount,
        destinationUser.id,
        Commodity.Corn,
        amount,
      );
      if ("error" in tradeResult) {
        switch (tradeResult.error) {
          case "INSUFFICIENT_FUNDS":
            await interaction.reply("You do not have enough cobs.");
            break;
          case "INVALID_AMOUNT":
            await interaction.reply("The amount must be positive");
            break;
          default:
            await interaction.reply("An unknown error occurred.");
            break;
        }
        return;
      }
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("Transfer successful")
            .setDescription(
              `You have sent ${amount} cobs of corn to <@${destinationUser.id}>.`,
            )
            .addFields([
              {
                name: interaction.user.displayName,
                value: `${tradeResult.value.sourceBalance} cobs`,
                inline: true,
              },
              {
                name: destinationUser.displayName,
                value: `${tradeResult.value.destinationBalance} cobs`,
                inline: true,
              },
            ]),
        ],
      });
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName("leaderboard")
      .setDescription("Check the top corn barons"),
    handler: async (interaction) => {
      const topBalances = getTopBalances();
      const balances = topBalances
        .map(({ amount }) => amount);
      const leaderboard = (
        await Promise.all(
          topBalances
            .map(async (entry) => {
              const user = await interaction.client.users.fetch(entry.farmer);
              return `${balances.indexOf(entry.amount) + 1}\\. ${
                user.username
              }: ${entry.amount}`;
            }),
        )
      ).join("\n");
      await interaction.reply(`The top corn barons are:\n${leaderboard}`);
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName("exile")
      .setDescription("Exile a user from the kingdom")
      .addUserOption((option) =>
        option
          .setName("user")
          .setDescription("The user to exile")
          .setRequired(true),
      ) as SlashCommandBuilder,
    handler: async (interaction) => {
      if (interaction.user.id !== Bun.env.CORN_CZAR_ID) {
        await interaction.reply("You are not authorized to exile users.");
        return;
      }

      const user = interaction.options.getUser("user")!;
      const exileResult = exile(user.id);

      if ("error" in exileResult) {
        switch (exileResult.error.type) {
          case "ALREADY_EXILED":
            await interaction.reply("The user is already exiled.");
            break;
          case "UNKNOWN_ERROR":
            await interaction.reply("An unknown error occurred.");
            break;
        }
        return;
      }

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle(`${user.username} has been exiled.`)
            .setDescription(
              `All ${exileResult.value.jailed} cobs of corn have been sent to jail.`,
            ),
        ],
      });
    },
  },
];

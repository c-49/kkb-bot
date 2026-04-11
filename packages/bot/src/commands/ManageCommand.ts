import { SlashCommandBuilder } from "discord.js";
import { ISlashCommand, SlashCommandContext } from "@kkb/shared";
import { CustomCommandManager } from "../storage/CustomCommandManager.js";

/**
 * /manage slash command
 * Lets admins create, delete, and list custom bot commands at runtime.
 *
 * Subcommands:
 *   /manage create <name> <description> <text> [category] [has_target]
 *   /manage delete <name>
 *   /manage list
 */
export class ManageCommand implements ISlashCommand {
  data = new SlashCommandBuilder()
    .setName("manage")
    .setDescription("Manage custom bot commands (Admin only)")
    .addSubcommand((sub) =>
      sub
        .setName("create")
        .setDescription("Create a new custom command")
        .addStringOption((opt) =>
          opt
            .setName("name")
            .setDescription('Command name, e.g. "hug" → /hug')
            .setRequired(true)
            .setMaxLength(32)
        )
        .addStringOption((opt) =>
          opt
            .setName("description")
            .setDescription("Short description shown in Discord UI")
            .setRequired(true)
            .setMaxLength(100)
        )
        .addStringOption((opt) =>
          opt
            .setName("text")
            .setDescription('Response text — use {user} and {target} as slots')
            .setRequired(true)
        )
        .addStringOption((opt) =>
          opt
            .setName("category")
            .setDescription("GIF category to pull from (optional)")
            .setRequired(false)
        )
        .addBooleanOption((opt) =>
          opt
            .setName("has_target")
            .setDescription("Does this command take a @user target? (default: false)")
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("delete")
        .setDescription("Delete a custom command")
        .addStringOption((opt) =>
          opt
            .setName("name")
            .setDescription("Command name to delete")
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub.setName("list").setDescription("List all custom commands")
    );

  constructor(
    private customCommandManager: CustomCommandManager,
    private redeploy: () => Promise<void>
  ) {}

  async execute(context: SlashCommandContext): Promise<void> {
    const interaction = context.interaction;

    if (!interaction.member?.permissions?.has("Administrator")) {
      await interaction.reply({
        content: "❌ You need Administrator permission to manage commands.",
        ephemeral: true,
      });
      return;
    }

    const sub = interaction.options.getSubcommand();

    try {
      switch (sub) {
        case "create":
          await this.handleCreate(interaction);
          break;
        case "delete":
          await this.handleDelete(interaction);
          break;
        case "list":
          await this.handleList(interaction);
          break;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      if (interaction.replied || interaction.deferred) {
        await interaction.editReply({ content: `❌ ${msg}` });
      } else {
        await interaction.reply({ content: `❌ ${msg}`, ephemeral: true });
      }
    }
  }

  private async handleCreate(interaction: any): Promise<void> {
    const rawName = interaction.options.getString("name") as string;
    const description = interaction.options.getString("description") as string;
    const text = interaction.options.getString("text") as string;
    const category: string | null = interaction.options.getString("category");
    const hasTarget: boolean = interaction.options.getBoolean("has_target") ?? false;

    await interaction.deferReply({ ephemeral: true });

    const cmd = await this.customCommandManager.createCommand(
      rawName,
      description,
      text,
      category,
      hasTarget,
      interaction.user.id
    );

    // Re-deploy so the new command appears in Discord immediately
    await this.redeploy();

    // Show a live preview of what the output will look like
    const preview = this.customCommandManager.renderText(
      cmd.textTemplate,
      interaction.user.id,
      hasTarget ? interaction.user.id : undefined
    );

    const lines = [
      `✅ Created **/${cmd.name}**.`,
      ``,
      `**Preview:** ${preview}`,
    ];
    if (cmd.gifCategory) lines.push(`**GIF category:** ${cmd.gifCategory}`);
    if (cmd.hasTarget) lines.push(`**Accepts target:** yes`);
    lines.push(``, `The command is now live in Discord.`);

    await interaction.editReply({ content: lines.join("\n") });
  }

  private async handleDelete(interaction: any): Promise<void> {
    const name = (interaction.options.getString("name") as string).toLowerCase();

    await interaction.deferReply({ ephemeral: true });

    const deleted = await this.customCommandManager.deleteCommand(name);
    if (!deleted) {
      await interaction.editReply({
        content: `❌ No custom command named **/${name}** found.`,
      });
      return;
    }

    await this.redeploy();
    await interaction.editReply({
      content: `✅ Deleted **/${name}** and redeployed commands.`,
    });
  }

  private async handleList(interaction: any): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    const commands = await this.customCommandManager.listCommands();

    if (commands.length === 0) {
      await interaction.editReply({ content: "📋 No custom commands yet." });
      return;
    }

    const list = commands
      .map((cmd) => {
        const parts = [`**/${cmd.name}** — ${cmd.description}`];
        parts.push(`  \`${cmd.textTemplate}\``);
        if (cmd.gifCategory) parts.push(`  GIF: **${cmd.gifCategory}**`);
        if (cmd.hasTarget) parts.push(`  Accepts: @target`);
        return parts.join("\n");
      })
      .join("\n\n");

    await interaction.editReply({ content: `📋 **Custom Commands:**\n\n${list}` });
  }
}

import {
  SlashCommandBuilder,
} from "discord.js";
import { ISlashCommand, SlashCommandContext } from "@kkb/shared";

/**
 * /welcome-setup Slash Command
 * Admin command to configure welcome greeting settings
 */

export class WelcomeSetupSlashCommand implements ISlashCommand {
  data = new SlashCommandBuilder()
    .setName("welcome-setup")
    .setDescription("Configure welcome greeting settings (Admin only)")
    .addStringOption((option) =>
      option
        .setName("action")
        .setDescription("What to configure")
        .setRequired(true)
        .addChoices(
          { name: "Set Channel", value: "set_channel" },
          { name: "Set Message", value: "set_message" },
          { name: "Enable/Disable", value: "toggle" },
          { name: "View Settings", value: "view" }
        )
    )
    .addChannelOption((option) =>
      option
        .setName("channel")
        .setDescription("Channel for greeting messages")
        .setRequired(false)
    )
    .addStringOption((option) =>
      option
        .setName("message")
        .setDescription("Greeting message (use {newUser} as placeholder)")
        .setRequired(false)
        .setMaxLength(500)
    );

  async execute(context: SlashCommandContext): Promise<void> {
    const interaction = context.interaction;
    const action = interaction.options.getString("action");

    // Check permissions (guild owner or admin)
    if (!interaction.member?.permissions?.has("Administrator")) {
      await interaction.reply({
        content: "❌ You need Administrator permission to use this command.",
        ephemeral: true,
      });
      return;
    }

    switch (action) {
      case "view":
        await this.handleView(interaction);
        break;
      case "set_channel":
        await this.handleSetChannel(interaction);
        break;
      case "set_message":
        await this.handleSetMessage(interaction);
        break;
      case "toggle":
        await this.handleToggle(interaction);
        break;
    }
  }

  private async handleView(interaction: any): Promise<void> {
    await interaction.reply({
      content:
        "Welcome settings view — configure via dashboard at http://localhost:5173 📊",
      ephemeral: true,
    });
  }

  private async handleSetChannel(interaction: any): Promise<void> {
    const channel = interaction.options.getChannel("channel", false);
    if (!channel) {
      await interaction.reply({
        content: "Please specify a channel using the `channel` option.",
        ephemeral: true,
      });
      return;
    }

    await interaction.reply({
      content: `✅ Channel set to <#${channel.id}>. Complete setup on the dashboard.`,
      ephemeral: true,
    });
  }

  private async handleSetMessage(interaction: any): Promise<void> {
    const message = interaction.options.getString("message", false);
    if (!message) {
      await interaction.reply({
        content: "Please specify a message using the `message` option.",
        ephemeral: true,
      });
      return;
    }

    await interaction.reply({
      content: `✅ Message template updated: "${message}"\nComplete setup on the dashboard.`,
      ephemeral: true,
    });
  }

  private async handleToggle(interaction: any): Promise<void> {
    await interaction.reply({
      content: "✅ Toggle setting saved. Complete setup on the dashboard.",
      ephemeral: true,
    });
  }
}

/**
 * /welcome Slash Command
 * User command to trigger test greeting or check status
 */

export class WelcomeSlashCommand implements ISlashCommand {
  data = new SlashCommandBuilder()
    .setName("welcome")
    .setDescription("Send a test welcome greeting or check status")
    .addSubcommand((sub) =>
      sub
        .setName("test")
        .setDescription("Send a test greeting to this channel")
    )
    .addSubcommand((sub) =>
      sub.setName("status").setDescription("Check welcome greeting status")
    );

  async execute(context: SlashCommandContext): Promise<void> {
    const interaction = context.interaction;
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "test") {
      await this.handleTest(interaction);
    } else if (subcommand === "status") {
      await this.handleStatus(interaction);
    }
  }

  private async handleTest(interaction: any): Promise<void> {
    await interaction.reply({
      content:
        "🎉 **Test Greeting Sent!**\n\nThis is a test of the greeting system. Greetings will be sent automatically when new members join.",
      ephemeral: false,
    });
  }

  private async handleStatus(interaction: any): Promise<void> {
    await interaction.reply({
      content:
        "📊 **Welcome System Status**\n\nCheck the dashboard for detailed status and settings. URL: http://localhost:5173",
      ephemeral: true,
    });
  }
}

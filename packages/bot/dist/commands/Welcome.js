"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WelcomeSlashCommand = exports.WelcomeSetupSlashCommand = void 0;
const discord_js_1 = require("discord.js");
/**
 * /welcome-setup Slash Command
 * Admin command to configure welcome greeting settings
 */
class WelcomeSetupSlashCommand {
    constructor(welcomeManager) {
        Object.defineProperty(this, "welcomeManager", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: welcomeManager
        });
        Object.defineProperty(this, "data", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new discord_js_1.SlashCommandBuilder()
                .setName("welcome-setup")
                .setDescription("Configure welcome greeting settings (Admin only)")
                .addStringOption((option) => option
                .setName("action")
                .setDescription("What to configure")
                .setRequired(true)
                .addChoices({ name: "Set Channel", value: "set_channel" }, { name: "Set Message", value: "set_message" }, { name: "Enable/Disable", value: "toggle" }, { name: "View Settings", value: "view" }))
                .addChannelOption((option) => option
                .setName("channel")
                .setDescription("Channel for greeting messages")
                .setRequired(false))
                .addStringOption((option) => option
                .setName("message")
                .setDescription("Greeting message (use {newUser} as placeholder)")
                .setRequired(false)
                .setMaxLength(500))
        });
    }
    async execute(context) {
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
    async handleView(interaction) {
        const settings = this.welcomeManager.get();
        const channelInfo = settings.channelId ? `<#${settings.channelId}>` : "Not set";
        const status = settings.enabled ? "✅ Enabled" : "❌ Disabled";
        await interaction.reply({
            content: `📊 **Welcome Settings**\n\n**Status:** ${status}\n**Channel:** ${channelInfo}\n**Message:** ${settings.greetingMessage}`,
            ephemeral: true,
        });
    }
    async handleSetChannel(interaction) {
        const channel = interaction.options.getChannel("channel", false);
        if (!channel) {
            await interaction.reply({
                content: "❌ Please specify a channel using the `channel` option.",
                ephemeral: true,
            });
            return;
        }
        await this.welcomeManager.update({ channelId: channel.id });
        await interaction.reply({
            content: `✅ Welcome channel set to <#${channel.id}>!`,
            ephemeral: true,
        });
    }
    async handleSetMessage(interaction) {
        const message = interaction.options.getString("message", false);
        if (!message) {
            await interaction.reply({
                content: "❌ Please specify a message using the `message` option.",
                ephemeral: true,
            });
            return;
        }
        await this.welcomeManager.update({ greetingMessage: message });
        await interaction.reply({
            content: `✅ Welcome message updated!`,
            ephemeral: true,
        });
    }
    async handleToggle(interaction) {
        const settings = this.welcomeManager.get();
        const newState = !settings.enabled;
        await this.welcomeManager.update({ enabled: newState });
        await interaction.reply({
            content: `✅ Welcome system is now ${newState ? "**enabled**" : "**disabled**"}`,
            ephemeral: true,
        });
    }
}
exports.WelcomeSetupSlashCommand = WelcomeSetupSlashCommand;
/**
 * /welcome Slash Command
 * User command to trigger test greeting or check status
 */
class WelcomeSlashCommand {
    constructor() {
        Object.defineProperty(this, "data", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new discord_js_1.SlashCommandBuilder()
                .setName("welcome")
                .setDescription("Send a test welcome greeting or check status")
                .addSubcommand((sub) => sub
                .setName("test")
                .setDescription("Send a test greeting to this channel"))
                .addSubcommand((sub) => sub.setName("status").setDescription("Check welcome greeting status"))
        });
    }
    async execute(context) {
        const interaction = context.interaction;
        const subcommand = interaction.options.getSubcommand();
        if (subcommand === "test") {
            await this.handleTest(interaction);
        }
        else if (subcommand === "status") {
            await this.handleStatus(interaction);
        }
    }
    async handleTest(interaction) {
        await interaction.reply({
            content: "🎉 **Test Greeting Sent!**\n\nThis is a test of the greeting system. Greetings will be sent automatically when new members join.",
            ephemeral: false,
        });
    }
    async handleStatus(interaction) {
        await interaction.reply({
            content: "📊 **Welcome System Status**\n\nCheck the dashboard for detailed status and settings. URL: http://localhost:5173",
            ephemeral: true,
        });
    }
}
exports.WelcomeSlashCommand = WelcomeSlashCommand;

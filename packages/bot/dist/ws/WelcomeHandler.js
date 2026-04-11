"use strict";
/**
 * Welcome system handler
 * Manages greeting posts and GIF button responses
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.WelcomeHandler = void 0;
const promises_1 = require("fs/promises");
const discord_js_1 = require("discord.js");
class WelcomeHandler {
    constructor(client, welcomeManager, gifManager) {
        Object.defineProperty(this, "welcomeManager", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "gifManager", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "client", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.client = client;
        this.welcomeManager = welcomeManager;
        this.gifManager = gifManager;
    }
    /**
     * Post a greeting when a new user joins
     */
    async postGreeting(userId) {
        const settings = this.welcomeManager.get();
        if (!settings.enabled || !settings.channelId) {
            console.log("Welcome greeting disabled or channel not configured");
            return;
        }
        try {
            const channel = await this.client.channels.fetch(settings.channelId);
            if (!channel || channel.type !== discord_js_1.ChannelType.GuildText) {
                console.error("Welcome channel not found or not a text channel");
                return;
            }
            const user = await this.client.users.fetch(userId);
            const greeting = settings.greetingMessage.replace("{newUser}", `<@${userId}>`);
            // Get a random GIF from "welcome" category
            const gifData = await this.gifManager.getRandomGif("welcome");
            // Create button for others to send greeting GIFs
            const giftButton = new discord_js_1.ButtonBuilder()
                .setCustomId(`welcome_gif_${userId}`)
                .setLabel("Send a Welcome GIF! 🎁")
                .setStyle(discord_js_1.ButtonStyle.Primary);
            const row = new discord_js_1.ActionRowBuilder().addComponents(giftButton);
            // Send greeting with embed for GIF if available
            if (gifData.sourceUrl) {
                const embed = new discord_js_1.EmbedBuilder()
                    .setImage(gifData.sourceUrl)
                    .setColor(0x5865f2); // Discord blue
                await channel.send({
                    content: greeting,
                    embeds: [embed],
                    components: [row],
                });
                console.log(`✅ Posted greeting for ${user.tag} with GIF embed`);
            }
            else if (gifData.path) {
                try {
                    console.log(`[WelcomeHandler] Attempting to read GIF from: ${gifData.path}`);
                    // Check if file exists
                    const { stat: fileStat } = await Promise.resolve().then(() => __importStar(require("fs/promises")));
                    const fileExists = await fileStat(gifData.path).catch(() => null);
                    if (fileExists) {
                        // Read GIF file as buffer
                        const gifBuffer = await (0, promises_1.readFile)(gifData.path);
                        console.log(`[WelcomeHandler] Successfully read GIF: ${gifData.path} (${gifBuffer.length} bytes)`);
                        const fileName = gifData.path.split("/").pop() || "welcome.gif";
                        const attachment = new discord_js_1.AttachmentBuilder(gifBuffer, { name: fileName });
                        await channel.send({
                            content: greeting,
                            files: [attachment],
                            components: [row],
                        });
                        console.log(`✅ Posted greeting for ${user.tag} with GIF attachment`);
                    }
                    else {
                        throw new Error("File not found");
                    }
                }
                catch (fileErr) {
                    console.error(`[WelcomeHandler] Could not read GIF file, sending without image:`, fileErr);
                    await channel.send({
                        content: greeting,
                        components: [row],
                    });
                    console.log(`✅ Posted greeting for ${user.tag} (no GIF available)`);
                }
            }
            else {
                // Send without GIF if none available
                await channel.send({
                    content: greeting,
                    components: [row],
                });
                console.log(`✅ Posted greeting for ${user.tag} (no GIF found)`);
            }
        }
        catch (err) {
            console.error("Error posting greeting:", err);
        }
    }
    /**
     * Handle greeting GIF button click
     */
    async handleGreetingGifButton(userId, buttonInteraction) {
        try {
            await buttonInteraction.deferReply();
            const gifData = await this.gifManager.getRandomGif("welcome");
            if (!gifData.sourceUrl && !gifData.path) {
                return buttonInteraction.editReply({
                    content: "No greeting GIFs available right now! 😔",
                });
            }
            const newUser = await this.client.users.fetch(userId);
            // Prefer source URL for embedding
            if (gifData.sourceUrl) {
                const embed = new discord_js_1.EmbedBuilder()
                    .setImage(gifData.sourceUrl)
                    .setColor(0x5865f2); // Discord blue
                await buttonInteraction.editReply({
                    content: `${buttonInteraction.user} sent a warm welcome to ${newUser}! 🎁`,
                    embeds: [embed],
                });
            }
            else if (gifData.path) {
                try {
                    const gifBuffer = await (0, promises_1.readFile)(gifData.path);
                    const fileName = gifData.path.split("/").pop() || "welcome.gif";
                    const attachment = new discord_js_1.AttachmentBuilder(gifBuffer, { name: fileName });
                    await buttonInteraction.editReply({
                        content: `${buttonInteraction.user} sent a warm welcome to ${newUser}! 🎁`,
                        files: [attachment],
                    });
                }
                catch (fileErr) {
                    console.error("Error reading GIF file:", fileErr);
                    await buttonInteraction.editReply({
                        content: `${buttonInteraction.user} tried to send a welcome GIF to ${newUser}! 🎁 (file error)`,
                    });
                }
            }
            console.log(`${buttonInteraction.user.tag} sent a welcome GIF to ${newUser.tag}`);
        }
        catch (err) {
            console.error("Error handling welcome GIF button:", err);
            await buttonInteraction.editReply({
                content: "Error sending welcome GIF 😢",
            });
        }
    }
    /**
     * Reload settings from manager
     */
    reloadSettings() {
        const settings = this.welcomeManager.get();
        console.log("Welcome settings reloaded:", settings);
    }
}
exports.WelcomeHandler = WelcomeHandler;

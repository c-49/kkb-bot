/**
 * Welcome system handler
 * Manages greeting posts and GIF button responses
 */

import { Client, ChannelType, ButtonBuilder, ActionRowBuilder, ButtonStyle, EmbedBuilder } from "discord.js";
import { WelcomeManager } from "../storage/WelcomeManager.js";
import { GifManager } from "../storage/GifManager.js";

export class WelcomeHandler {
  private welcomeManager: WelcomeManager;
  private gifManager: GifManager;
  private client: Client;
  private httpBaseUrl: string;

  constructor(client: Client, welcomeManager: WelcomeManager, gifManager: GifManager) {
    this.client = client;
    this.welcomeManager = welcomeManager;
    this.gifManager = gifManager;
    // Build base URL from environment or use localhost
    const httpPort = process.env.HTTP_PORT || 3000;
    const httpHost = process.env.HTTP_HOST || "localhost";
    this.httpBaseUrl = `http://${httpHost}:${httpPort}`;
  }

  /**
   * Convert file path to HTTP URL
   */
  private getGifHttpUrl(filePath: string): string {
    // Extract category and filename from path
    // Path format: ./gifs/category/filename.gif
    const parts = filePath.split(/[\/\\]/);
    const category = parts[parts.length - 2];
    const filename = parts[parts.length - 1];
    return `${this.httpBaseUrl}/gifs/${category}/${filename}`;
  }

  /**
   * Post a greeting when a new user joins
   */
  async postGreeting(userId: string): Promise<void> {
    const settings = this.welcomeManager.get();

    if (!settings.enabled || !settings.channelId) {
      console.log("Welcome greeting disabled or channel not configured");
      return;
    }

    try {
      const channel = await this.client.channels.fetch(settings.channelId);

      if (!channel || channel.type !== ChannelType.GuildText) {
        console.error("Welcome channel not found or not a text channel");
        return;
      }

      const user = await this.client.users.fetch(userId);
      const greeting = settings.greetingMessage.replace("{newUser}", `<@${userId}>`);

      // Get config-defined width/height for GIFs
      let width = 256;
      let height = 256;
      try {
        const config = await import("../../config.json", { assert: { type: "json" } });
        if (config?.default?.gif) {
          width = config.default.gif.width || width;
          height = config.default.gif.height || height;
        }
      } catch (e) {
        // fallback to defaults
      }

      // Get a random resized GIF from "welcome" category
      const gifData = await this.gifManager.getRandomGif("welcome", width, height);

      // Create button for others to send greeting GIFs
      const giftButton = new ButtonBuilder()
        .setCustomId(`welcome_gif_${userId}`)
        .setLabel("Send a Welcome GIF! 🎁")
        .setStyle(ButtonStyle.Primary);

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(giftButton);

      // Send greeting with embed for GIF if available
      if (gifData.path) {
        try {
          const gifUrl = this.getGifHttpUrl(gifData.path);
          console.log(`[WelcomeHandler] Embedding GIF URL: ${gifUrl}`);
          
          const embed = new EmbedBuilder()
            .setImage(gifUrl)
            .setColor(0x5865f2); // Discord blue

          await channel.send({
            content: greeting,
            embeds: [embed],
            components: [row],
          });
          console.log(`✅ Posted greeting for ${user.tag} with GIF embed`);
        } catch (err) {
          console.error("[WelcomeHandler] Error creating embed:", err);
          // Send without GIF if embed creation fails
          await channel.send({
            content: greeting,
            components: [row],
          });
          console.log(`✅ Posted greeting for ${user.tag} (no GIF)`);
        }
      } else {
        // Send without GIF if none available
        await channel.send({
          content: greeting,
          components: [row],
        });
        console.log(`✅ Posted greeting for ${user.tag} (no GIF available)`);
      }
    } catch (err) {
      console.error("Error posting greeting:", err);
    }
  }

  /**
   * Handle greeting GIF button click
   */
  async handleGreetingGifButton(userId: string, buttonInteraction: any): Promise<void> {
    try {
      await buttonInteraction.deferReply();

      const gifData = await this.gifManager.getRandomGif("welcome");

      if (!gifData.path) {
        return buttonInteraction.editReply({
          content: "No greeting GIFs available right now! 😔",
        });
      }

      const newUser = await this.client.users.fetch(userId);

      try {
        const gifUrl = this.getGifHttpUrl(gifData.path);
        const embed = new EmbedBuilder()
          .setImage(gifUrl)
          .setColor(0x5865f2); // Discord blue

        await buttonInteraction.editReply({
          content: `${buttonInteraction.user} sent a warm welcome to ${newUser}! 🎁`,
          embeds: [embed],
        });

        console.log(`${buttonInteraction.user.tag} sent a welcome GIF to ${newUser.tag}`);
      } catch (err) {
        console.error("Error creating GIF embed:", err);
        await buttonInteraction.editReply({
          content: `${buttonInteraction.user} tried to send a welcome GIF to ${newUser}! 🎁`,
        });
      }
    } catch (err) {
      console.error("Error handling welcome GIF button:", err);
      await buttonInteraction.editReply({
        content: "Error sending welcome GIF 😢",
      });
    }
  }

  /**
   * Reload settings from manager
   */
  reloadSettings(): void {
    const settings = this.welcomeManager.get();
    console.log("Welcome settings reloaded:", settings);
  }
}

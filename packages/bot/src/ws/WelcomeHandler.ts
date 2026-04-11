/**
 * Welcome system handler
 * Manages greeting posts and GIF button responses
 */

import { readFile } from "fs/promises";
import { Client, ChannelType, AttachmentBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, EmbedBuilder } from "discord.js";
import { WelcomeManager } from "../storage/WelcomeManager.js";
import { GifManager } from "../storage/GifManager.js";

export class WelcomeHandler {
  private welcomeManager: WelcomeManager;
  private gifManager: GifManager;
  private client: Client;

  constructor(client: Client, welcomeManager: WelcomeManager, gifManager: GifManager) {
    this.client = client;
    this.welcomeManager = welcomeManager;
    this.gifManager = gifManager;
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

      // Get a random GIF from "welcome" category
      const gifData = await this.gifManager.getRandomGif("welcome");

      // Create button for others to send greeting GIFs
      const giftButton = new ButtonBuilder()
        .setCustomId(`welcome_gif_${userId}`)
        .setLabel("Send a Welcome GIF! 🎁")
        .setStyle(ButtonStyle.Primary);

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(giftButton);

      // Send greeting with embed for GIF if available
      if (gifData.sourceUrl) {
        const embed = new EmbedBuilder()
          .setImage(gifData.sourceUrl)
          .setColor(0x5865f2); // Discord blue

        await channel.send({
          content: greeting,
          embeds: [embed],
          components: [row],
        });
        console.log(`✅ Posted greeting for ${user.tag} with GIF embed`);
      } else if (gifData.path) {
        try {
          console.log(`[WelcomeHandler] Attempting to read GIF from: ${gifData.path}`);
          
          // Check if file exists
          const { stat: fileStat } = await import("fs/promises");
          const fileExists = await fileStat(gifData.path).catch(() => null);
          
          if (fileExists) {
            // Read GIF file as buffer
            const gifBuffer = await readFile(gifData.path);
            console.log(`[WelcomeHandler] Successfully read GIF: ${gifData.path} (${gifBuffer.length} bytes)`);
            
            const fileName = gifData.path.split("/").pop() || "welcome.gif";
            const attachment = new AttachmentBuilder(gifBuffer, { name: fileName });
            
            await channel.send({
              content: greeting,
              files: [attachment],
              components: [row],
            });
            console.log(`✅ Posted greeting for ${user.tag} with GIF attachment`);
          } else {
            throw new Error("File not found");
          }
        } catch (fileErr) {
          console.error(`[WelcomeHandler] Could not read GIF file, sending without image:`, fileErr);
          await channel.send({
            content: greeting,
            components: [row],
          });
          console.log(`✅ Posted greeting for ${user.tag} (no GIF available)`);
        }
      } else {
        // Send without GIF if none available
        await channel.send({
          content: greeting,
          components: [row],
        });
        console.log(`✅ Posted greeting for ${user.tag} (no GIF found)`);
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

      if (!gifData.sourceUrl && !gifData.path) {
        return buttonInteraction.editReply({
          content: "No greeting GIFs available right now! 😔",
        });
      }

      const newUser = await this.client.users.fetch(userId);

      // Prefer source URL for embedding
      if (gifData.sourceUrl) {
        const embed = new EmbedBuilder()
          .setImage(gifData.sourceUrl)
          .setColor(0x5865f2); // Discord blue

        await buttonInteraction.editReply({
          content: `${buttonInteraction.user} sent a warm welcome to ${newUser}! 🎁`,
          embeds: [embed],
        });
      } else if (gifData.path) {
        try {
          const gifBuffer = await readFile(gifData.path);
          const fileName = gifData.path.split("/").pop() || "welcome.gif";
          const attachment = new AttachmentBuilder(gifBuffer, { name: fileName });

          await buttonInteraction.editReply({
            content: `${buttonInteraction.user} sent a warm welcome to ${newUser}! 🎁`,
            files: [attachment],
          });
        } catch (fileErr) {
          console.error("Error reading GIF file:", fileErr);
          await buttonInteraction.editReply({
            content: `${buttonInteraction.user} tried to send a welcome GIF to ${newUser}! 🎁 (file error)`,
          });
        }
      }

      console.log(`${buttonInteraction.user.tag} sent a welcome GIF to ${newUser.tag}`);
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

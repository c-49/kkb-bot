/**
 * Welcome system handler
 * Manages greeting posts and GIF button responses
 */

import { Client, ChannelType, AttachmentBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle } from "discord.js";
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
      const gifPath = await this.gifManager.getRandomGif("welcome");

      // Create button for others to send greeting GIFs
      const giftButton = new ButtonBuilder()
        .setCustomId(`welcome_gif_${userId}`)
        .setLabel("Send a Welcome GIF! 🎁")
        .setStyle(ButtonStyle.Primary);

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(giftButton);

      // Send greeting
      if (gifPath) {
        // Send with GIF attachment
        const attachment = new AttachmentBuilder(gifPath);
        await channel.send({
          content: greeting,
          files: [attachment],
          components: [row],
        });
        console.log(`✅ Posted greeting for ${user.tag}`);
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

      const gifPath = await this.gifManager.getRandomGif("welcome");

      if (!gifPath) {
        return buttonInteraction.editReply({
          content: "No greeting GIFs available right now! 😔",
        });
      }

      const attachment = new AttachmentBuilder(gifPath);
      const newUser = await this.client.users.fetch(userId);

      await buttonInteraction.editReply({
        content: `${buttonInteraction.user} sent a warm welcome to ${newUser}! 🎁`,
        files: [attachment],
      });

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

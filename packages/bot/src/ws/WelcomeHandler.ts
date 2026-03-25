/**
 * Welcome system handler
 * Manages greeting posts and GIF button responses
 */

import { Client, ChannelType, AttachmentBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle } from "discord.js";
import { WelcomeManager } from "../storage/WelcomeManager.js";

export class WelcomeHandler {
  private welcomeManager: WelcomeManager;
  private client: Client;

  constructor(client: Client, welcomeManager: WelcomeManager) {
    this.client = client;
    this.welcomeManager = welcomeManager;
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

      // Get a random GIF
      const gifMeta = this.welcomeManager.getRandomGif();

      // Create button for others to send greeting GIFs
      const giftButton = new ButtonBuilder()
        .setCustomId(`welcome_gif_${userId}`)
        .setLabel("Send a Welcome GIF! 🎁")
        .setStyle(ButtonStyle.Primary);

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(giftButton);

      // Send greeting
      if (gifMeta) {
        // Send with GIF attachment
        const attachment = new AttachmentBuilder(gifMeta.path);
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

      const gifMeta = this.welcomeManager.getRandomGif();

      if (!gifMeta) {
        return buttonInteraction.editReply({
          content: "No greeting GIFs available right now! 😔",
        });
      }

      const attachment = new AttachmentBuilder(gifMeta.path);
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

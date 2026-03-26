/**
 * Welcome configuration panel for dashboard
 * Manages greeting message, channel, and GIF uploads
 */

import { BotClient } from "./BotClient.js";
import { byId, setText, on, createElement } from "./utils/dom.js";

export class WelcomePanel {
  private botClient: BotClient;
  private container: HTMLElement | null;

  constructor(botClient: BotClient) {
    this.botClient = botClient;
    this.container = byId("welcome-panel");
  }

  init(): void {
    if (!this.container) return;

    // Listen for welcome settings updates
    this.botClient.onEvent((event) => {
      if (event.type === "welcome:updated") {
        this.render(event.data);
      } else if (event.type === "gif:uploaded") {
        this.addGifToList(event.data);
      }
    });

    // Fetch initial settings
    this.botClient.fetchWelcomeSettings();

    this.attachEventListeners();
  }

  private attachEventListeners(): void {
    const saveBtn = byId("welcome-save-btn");
    const uploadBtn = byId("welcome-upload-btn");
    const enableToggle = byId("welcome-enabled");
    const messageInput = byId("welcome-message") as HTMLInputElement;
    const channelInput = byId("welcome-channel") as HTMLInputElement;
    const gifSizeInput = byId("welcome-gif-size") as HTMLInputElement;

    if (saveBtn) {
      on(saveBtn as HTMLElement, "click", () => {
        const enabled = (enableToggle as HTMLInputElement).checked;
        const message = messageInput?.value || "";
        const channel = channelInput?.value || "";
        const gifMaxSize = parseInt(gifSizeInput?.value || "10485760", 10);

        this.botClient.updateWelcomeSettings({
          enabled,
          greetingMessage: message,
          channelId: channel,
          gifMaxSize,
        });
      });
    }

    if (uploadBtn) {
      on(uploadBtn as HTMLElement, "click", () => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = ".gif,.png,.jpg,.jpeg";
        input.onchange = (e) => this.handleFileUpload(e);
        input.click();
      });
    }
  }

  private async handleFileUpload(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const files = input.files;
    if (!files || files.length === 0) return;

    // This would require a backend endpoint for actual file upload
    // For now, just show a placeholder
    const file = files[0];
    console.log("File selected for upload:", file.name, file.size);
    // TODO: Implement actual GIF upload to backend
  }

  private render(settings: any): void {
    const enableToggle = byId("welcome-enabled") as HTMLInputElement;
    const messageInput = byId("welcome-message") as HTMLInputElement;
    const channelInput = byId("welcome-channel") as HTMLInputElement;
    const gifSizeInput = byId("welcome-gif-size") as HTMLInputElement;

    if (enableToggle) enableToggle.checked = settings.enabled;
    if (messageInput) messageInput.value = settings.greetingMessage;
    if (channelInput) channelInput.value = settings.channelId;
    if (gifSizeInput)
      gifSizeInput.value = (settings.gifMaxSize / 1024 / 1024).toString();
  }

  private addGifToList(gif: any): void {
    const gifList = byId("welcome-gif-list");
    if (!gifList) return;

    const entry = createElement("div", {
      "class": "gif-entry",
    } as Record<string, string>);
    setText(entry, `🎬 ${gif.name} (${(gif.size / 1024).toFixed(2)} KB)`);

    gifList.appendChild(entry);
  }
}

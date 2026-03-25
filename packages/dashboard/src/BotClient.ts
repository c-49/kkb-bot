import {
  BotMessage,
  DashboardMessage,
  DashboardEvent,
  BotSettings,
} from "@kkb/shared";

/**
 * WebSocket client for dashboard
 * Handles connection to bot server and message routing
 */

type EventCallback = (event: DashboardEvent) => void;
type SettingsCallback = (settings: BotSettings) => void;

export class BotClient {
  private ws: WebSocket | null = null;
  private url: string;
  private eventListeners: Set<EventCallback> = new Set();
  private settingsListeners: Set<SettingsCallback> = new Set();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  constructor(url: string = "ws://localhost:8080") {
    this.url = url;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          console.log("✅ Connected to bot");
          this.reconnectAttempts = 0;
          resolve();
        };

        this.ws.onmessage = (event) => this.handleMessage(event.data);
        this.ws.onclose = () => this.handleDisconnect();
        this.ws.onerror = (err) => {
          console.error("WS Error:", err);
          reject(err);
        };
      } catch (err) {
        reject(err);
      }
    });
  }

  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data) as BotMessage;

      switch (message.type) {
        case "hello":
          console.log("👋 Bot says hello, version:", message.data.version);
          break;
        case "event":
          this.notifyEventListeners(message.data);
          break;
        case "error":
          console.error("Bot error:", message.data.message);
          break;
      }
    } catch (err) {
      console.error("Failed to parse bot message:", err);
    }
  }

  private handleDisconnect(): void {
    console.log("❌ Disconnected from bot");
    this.ws = null;

    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.pow(2, this.reconnectAttempts) * 1000;
      console.log(`🔄 Reconnecting in ${delay}ms...`);
      setTimeout(() => this.connect().catch(console.error), delay);
    }
  }

  private send(message: DashboardMessage): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error("Not connected to bot");
      return;
    }
    this.ws.send(JSON.stringify(message));
  }

  // Public API

  onEvent(callback: EventCallback): () => void {
    this.eventListeners.add(callback);
    return () => this.eventListeners.delete(callback);
  }

  onSettingsChange(callback: SettingsCallback): () => void {
    this.settingsListeners.add(callback);
    return () => this.settingsListeners.delete(callback);
  }

  private notifyEventListeners(event: DashboardEvent): void {
    this.eventListeners.forEach((cb) => cb(event));
  }

  fetchSettings(): void {
    this.send({ type: "settings:fetch" });
  }

  updateSettings(partial: Partial<BotSettings>): void {
    this.send({
      type: "settings:update",
      data: partial,
    });
  }

  fetchWelcomeSettings(): void {
    this.send({ type: "welcome:fetch" });
  }

  updateWelcomeSettings(partial: any): void {
    this.send({
      type: "welcome:update",
      data: partial,
    });
  }

  listGifs(): void {
    this.send({ type: "gif:list" });
  }

  ping(): void {
    this.send({ type: "ping" });
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
    }
  }
}

import { BotClient } from "./BotClient.js";
import { WelcomePanel } from "./WelcomePanel.js";
import { byId, setText, on, addClass, removeClass } from "./utils/dom.js";

const client = new BotClient();
let isConnected = false;

async function init(): Promise<void> {
  const statusEl = byId("status");
  const connectBtn = byId("connect-btn");
  const eventsContainer = byId("events");
  const eventLog: Array<{ time: string; message: string }> = [];

  function updateStatus(connected: boolean): void {
    isConnected = connected;
    if (statusEl) {
      setText(statusEl, connected ? "Connected ✅" : "Disconnected ❌");
      if (connected) {
        removeClass(statusEl, "error");
        addClass(statusEl, "success");
      } else {
        removeClass(statusEl, "success");
        addClass(statusEl, "error");
      }
    }
  }

  function logEvent(message: string): void {
    const time = new Date().toLocaleTimeString();
    eventLog.push({ time, message });

    if (eventsContainer) {
      const entry = document.createElement("div");
      entry.className = "event-entry";
      entry.textContent = `[${time}] ${message}`;
      eventsContainer.appendChild(entry);
      eventsContainer.scrollTop = eventsContainer.scrollHeight;
    }
  }

  if (connectBtn) {
    const button = connectBtn as HTMLButtonElement;
    on(button, "click", async () => {
      try {
        button.disabled = true;
        setText(button, "Connecting...");
        await client.connect();
        updateStatus(true);
        // Initialize welcome panel
        const welcomePanel = new WelcomePanel(client);
        welcomePanel.init();
        // Set up initial listeners
        client.onEvent((event: any) => {
          logEvent(`Event: ${event.type}`);
        });
      } catch (err) {
        console.error("Failed to connect:", err);
        logEvent(`Connection failed: ${err}`);
        updateStatus(false);
      } finally {
        button.disabled = false;
        setText(button, isConnected ? "Disconnect" : "Connect");
      }
    });
  }

  updateStatus(false);
}

document.addEventListener("DOMContentLoaded", init);

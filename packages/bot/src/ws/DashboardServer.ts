// @ts-ignore - ws types are properly installed but TypeScript has trouble with them
import { WebSocket, WebSocketServer } from "ws";
import { BotMessage, DashboardMessage, DashboardEvent } from "@kkb/shared";

/**
 * WebSocket server for dashboard communication
 * Handles real-time updates and settings management
 */

interface DashboardClient {
  id: string;
  ws: any; // WebSocket from ws package
  connectedAt: number;
}

export class DashboardServer {
  private wss: WebSocketServer;
  private clients: Map<string, DashboardClient> = new Map();
  private clientIdCounter = 0;

  constructor(port: number) {
    this.wss = new WebSocketServer({ port });
    this.wss.on("connection", (ws: WebSocket) => this.handleConnection(ws));
    console.log(`📡 Dashboard server listening on ws://localhost:${port}`);
  }

  private handleConnection(ws: WebSocket): void {
    const clientId = `client-${++this.clientIdCounter}`;
    const client: DashboardClient = {
      id: clientId,
      ws,
      connectedAt: Date.now(),
    };

    this.clients.set(clientId, client);

    // Send welcome message
    this.sendMessage(ws, {
      type: "hello",
      data: { version: "0.0.1" },
    });

    console.log(`✅ Dashboard connected: ${clientId}`);

    ws.on("message", (data: WebSocket.Data) => this.handleMessage(clientId, data));
    ws.on("close", () => this.handleDisconnect(clientId));
    ws.on("error", (err: Error) => console.error(`WS Error [${clientId}]:`, err));
  }

  private handleMessage(clientId: string, data: WebSocket.Data): void {
    try {
      const message = JSON.parse(data.toString()) as DashboardMessage;
      // Implement handlers for different message types
      // These will be connected to bot logic
      console.log(`📨 Message from ${clientId}:`, message.type);
    } catch (err) {
      console.error(`Failed to parse message from ${clientId}:`, err);
    }
  }

  private handleDisconnect(clientId: string): void {
    this.clients.delete(clientId);
    console.log(`❌ Dashboard disconnected: ${clientId}`);
  }

  private sendMessage(ws: WebSocket, message: BotMessage): void {
    ws.send(JSON.stringify(message));
  }

  /**
   * Broadcast event to all connected dashboards
   */
  broadcastEvent(event: DashboardEvent): void {
    const message: BotMessage = {
      type: "event",
      data: event,
    };

    this.clients.forEach(({ ws }) => {
      if (ws.readyState === WebSocket.OPEN) {
        this.sendMessage(ws, message);
      }
    });
  }

  close(): Promise<void> {
    return new Promise((resolve) => {
      this.wss.close(() => resolve());
    });
  }
}

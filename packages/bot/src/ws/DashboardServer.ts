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
  private messageHandlers: Map<string, (clientId: string, data: any) => void> = new Map();

  constructor(port: number) {
    this.wss = new WebSocketServer({ port });
    this.wss.on("connection", (ws: WebSocket) => this.handleConnection(ws));
    console.log(`📡 Dashboard server listening on ws://localhost:${port}`);
  }

  /**
   * Register a handler for a specific message type
   */
  onMessage(type: string, handler: (clientId: string, data: any) => void): void {
    this.messageHandlers.set(type, handler);
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

    ws.on("message", (data: string | Buffer) => this.handleMessage(clientId, data));
    ws.on("close", () => this.handleDisconnect(clientId));
    ws.on("error", (err: Error) => console.error(`WS Error [${clientId}]:`, err));
  }

  private handleMessage(clientId: string, data: string | Buffer): void {
    try {
      const messageStr = typeof data === 'string' ? data : data.toString();
      const message = JSON.parse(messageStr) as DashboardMessage;
      console.log(`📨 Message from ${clientId}:`, message.type);
      
      // Call registered handler for this message type
      const handler = this.messageHandlers.get(message.type as string);
      if (handler) {
        handler(clientId, (message as any).data);
      } else {
        console.warn(`No handler registered for message type: ${message.type}`);
      }
    } catch (err) {
      console.error(`Failed to parse message from ${clientId}:`, err);
    }
  }

  /**
   * Send a message to a specific client
   */
  sendToClient(clientId: string, message: BotMessage): boolean {
    const client = this.clients.get(clientId);
    if (!client) return false;
    this.sendMessage(client.ws, message);
    return true;
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

  /**
   * Get connected clients count
   */
  getClientCount(): number {
    return this.clients.size;
  }

  getClients(): Map<string, any> {
    return this.clients;
  }

  close(): Promise<void> {
    return new Promise((resolve) => {
      this.wss.close(() => resolve());
    });
  }
}

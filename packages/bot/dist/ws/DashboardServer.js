// @ts-ignore - ws types are properly installed but TypeScript has trouble with them
import { WebSocket, WebSocketServer } from "ws";
export class DashboardServer {
    constructor(port) {
        Object.defineProperty(this, "wss", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "clients", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
        Object.defineProperty(this, "clientIdCounter", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "messageHandlers", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
        this.wss = new WebSocketServer({ port });
        this.wss.on("connection", (ws) => this.handleConnection(ws));
        console.log(`📡 Dashboard server listening on ws://localhost:${port}`);
    }
    /**
     * Register a handler for a specific message type
     */
    onMessage(type, handler) {
        this.messageHandlers.set(type, handler);
    }
    handleConnection(ws) {
        const clientId = `client-${++this.clientIdCounter}`;
        const client = {
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
        ws.on("message", (data) => this.handleMessage(clientId, data));
        ws.on("close", () => this.handleDisconnect(clientId));
        ws.on("error", (err) => console.error(`WS Error [${clientId}]:`, err));
    }
    handleMessage(clientId, data) {
        try {
            const messageStr = typeof data === 'string' ? data : data.toString();
            const message = JSON.parse(messageStr);
            console.log(`📨 Message from ${clientId}:`, message.type);
            // Call registered handler for this message type
            const handler = this.messageHandlers.get(message.type);
            if (handler) {
                handler(clientId, message.data);
            }
            else {
                console.warn(`No handler registered for message type: ${message.type}`);
            }
        }
        catch (err) {
            console.error(`Failed to parse message from ${clientId}:`, err);
        }
    }
    /**
     * Send a message to a specific client
     */
    sendToClient(clientId, message) {
        const client = this.clients.get(clientId);
        if (!client)
            return false;
        this.sendMessage(client.ws, message);
        return true;
    }
    handleDisconnect(clientId) {
        this.clients.delete(clientId);
        console.log(`❌ Dashboard disconnected: ${clientId}`);
    }
    sendMessage(ws, message) {
        ws.send(JSON.stringify(message));
    }
    /**
     * Broadcast event to all connected dashboards
     */
    broadcastEvent(event) {
        const message = {
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
    getClientCount() {
        return this.clients.size;
    }
    getClients() {
        return this.clients;
    }
    close() {
        return new Promise((resolve) => {
            this.wss.close(() => resolve());
        });
    }
}

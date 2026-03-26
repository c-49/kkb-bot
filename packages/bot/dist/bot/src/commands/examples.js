import { createCommandName } from "@kkb/shared";
/**
 * Example ping command
 * Shows how to structure a simple command
 */
export class PingCommand {
    constructor() {
        Object.defineProperty(this, "name", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: createCommandName("ping")
        });
        Object.defineProperty(this, "description", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: "Responds with pong"
        });
        Object.defineProperty(this, "usage", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: "/ping"
        });
    }
    async execute(_args, _context) {
        return "Pong! 🏓";
    }
}
/**
 * Example hello command
 */
export class HelloCommand {
    constructor() {
        Object.defineProperty(this, "name", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: createCommandName("hello")
        });
        Object.defineProperty(this, "description", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: "Greets the user"
        });
        Object.defineProperty(this, "usage", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: "/hello [name]"
        });
    }
    async execute(args, _context) {
        const name = args[0] || "Friend";
        return `Hello, ${name}! 👋`;
    }
}

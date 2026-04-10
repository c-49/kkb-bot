"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HelloCommand = exports.PingCommand = void 0;
const shared_1 = require("@kkb/shared");
/**
 * Example ping command
 * Shows how to structure a simple command
 */
class PingCommand {
    constructor() {
        Object.defineProperty(this, "name", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: (0, shared_1.createCommandName)("ping")
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
exports.PingCommand = PingCommand;
/**
 * Example hello command
 */
class HelloCommand {
    constructor() {
        Object.defineProperty(this, "name", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: (0, shared_1.createCommandName)("hello")
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
exports.HelloCommand = HelloCommand;

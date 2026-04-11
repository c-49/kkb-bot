"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DefaultCommandRegistry = void 0;
/**
 * Default command registry implementation
 * Manages all registered commands for the bot
 */
class DefaultCommandRegistry {
    constructor() {
        Object.defineProperty(this, "commands", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
    }
    register(command) {
        if (this.commands.has(command.name)) {
            console.warn(`Command "${command.name}" already registered, overwriting`);
        }
        this.commands.set(command.name, command);
    }
    get(name) {
        var _a;
        return (_a = this.commands.get(name)) !== null && _a !== void 0 ? _a : null;
    }
    all() {
        return Array.from(this.commands.values());
    }
    has(name) {
        return this.commands.has(name);
    }
}
exports.DefaultCommandRegistry = DefaultCommandRegistry;

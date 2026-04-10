"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SlashCommandRegistry = void 0;
/**
 * Slash command registry
 * Manages all registered slash commands
 */
class SlashCommandRegistry {
    constructor() {
        Object.defineProperty(this, "commands", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
    }
    register(command) {
        const name = command.data.name;
        if (this.commands.has(name)) {
            console.warn(`Slash command "${name}" already registered, overwriting`);
        }
        this.commands.set(name, command);
    }
    get(name) {
        return this.commands.get(name) ?? null;
    }
    all() {
        return Array.from(this.commands.values());
    }
    has(name) {
        return this.commands.has(name);
    }
    /**
     * Get JSON array for Discord API registration
     */
    toJSON() {
        return this.all().map((cmd) => cmd.data.toJSON());
    }
}
exports.SlashCommandRegistry = SlashCommandRegistry;

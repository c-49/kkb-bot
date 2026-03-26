/**
 * Default command registry implementation
 * Manages all registered commands for the bot
 */
export class DefaultCommandRegistry {
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
        return this.commands.get(name) ?? null;
    }
    all() {
        return Array.from(this.commands.values());
    }
    has(name) {
        return this.commands.has(name);
    }
}

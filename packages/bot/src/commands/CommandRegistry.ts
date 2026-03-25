import { ICommand, CommandRegistry, CommandName } from "@kkb/shared";

/**
 * Default command registry implementation
 * Manages all registered commands for the bot
 */

export class DefaultCommandRegistry implements CommandRegistry {
  private commands: Map<CommandName, ICommand> = new Map();

  register(command: ICommand): void {
    if (this.commands.has(command.name)) {
      console.warn(`Command "${command.name}" already registered, overwriting`);
    }
    this.commands.set(command.name, command);
  }

  get(name: CommandName): ICommand | null {
    return this.commands.get(name) ?? null;
  }

  all(): ICommand[] {
    return Array.from(this.commands.values());
  }

  has(name: CommandName): boolean {
    return this.commands.has(name);
  }
}

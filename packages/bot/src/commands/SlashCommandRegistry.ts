import { ISlashCommand } from "@kkb/shared";

/**
 * Slash command registry
 * Manages all registered slash commands
 */

export class SlashCommandRegistry {
  private commands: Map<string, ISlashCommand> = new Map();

  register(command: ISlashCommand): void {
    const name = command.data.name;
    if (this.commands.has(name)) {
      console.warn(`Slash command "${name}" already registered, overwriting`);
    }
    this.commands.set(name, command);
  }

  get(name: string): ISlashCommand | null {
    return this.commands.get(name) ?? null;
  }

  all(): ISlashCommand[] {
    return Array.from(this.commands.values());
  }

  has(name: string): boolean {
    return this.commands.has(name);
  }

  /**
   * Get JSON array for Discord API registration
   */
  toJSON(): any[] {
    return this.all().map((cmd) => cmd.data.toJSON());
  }
}

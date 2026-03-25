import { ICommand, CommandContext, createCommandName } from "@kkb/shared";

/**
 * Example ping command
 * Shows how to structure a simple command
 */

export class PingCommand implements ICommand {
  readonly name = createCommandName("ping");
  readonly description = "Responds with pong";
  readonly usage = "/ping";

  async execute(_args: string[], _context: CommandContext): Promise<string> {
    return "Pong! 🏓";
  }
}

/**
 * Example hello command
 */

export class HelloCommand implements ICommand {
  readonly name = createCommandName("hello");
  readonly description = "Greets the user";
  readonly usage = "/hello [name]";

  async execute(args: string[], _context: CommandContext): Promise<string> {
    const name = args[0] || "Friend";
    return `Hello, ${name}! 👋`;
  }
}

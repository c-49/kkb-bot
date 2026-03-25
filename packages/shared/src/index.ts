/**
 * Command System
 * Base types and interfaces for the extensible command system
 */

export type CommandName = string & { readonly __brand: "CommandName" };

export function createCommandName(name: string): CommandName {
  if (!name.trim()) {
    throw new Error("Command name cannot be empty");
  }
  return name.toLowerCase() as CommandName;
}

export interface CommandContext {
  userId: string;
  guildId: string;
  timestamp: number;
}

export interface ICommand {
  name: CommandName;
  description: string;
  usage: string; // e.g., "/mycommand <arg1> <arg2>"
  execute(args: string[], context: CommandContext): Promise<string>;
}

export interface CommandRegistry {
  register(command: ICommand): void;
  get(name: CommandName): ICommand | null;
  all(): ICommand[];
  has(name: CommandName): boolean;
}

/**
 * Dashboard Events
 * Events emitted by the bot that the dashboard cares about
 */

export type DashboardEvent = 
  | { type: "settings:updated"; data: BotSettings }
  | { type: "image:uploaded"; data: ImageMeta }
  | { type: "image:deleted"; data: { id: string } }
  | { type: "command:executed"; data: { command: string; result: string; timestamp: number } };

/**
 * Bot Settings
 */

export interface BotSettings {
  prefix: string;
  enabledCommands: CommandName[];
  maxImageSize: number; // bytes
  imageUploadPath: string;
}

export const DEFAULT_BOT_SETTINGS: BotSettings = {
  prefix: "!",
  enabledCommands: [],
  maxImageSize: 5 * 1024 * 1024, // 5MB
  imageUploadPath: "./uploads",
};

/**
 * Image Management
 */

export interface ImageMeta {
  id: string;
  name: string;
  path: string;
  uploadedAt: number;
  size: number;
}

/**
 * WebSocket Messages
 * Communication protocol between bot and dashboard
 */

export type BotMessage = 
  | { type: "hello"; data: { version: string } }
  | { type: "event"; data: DashboardEvent }
  | { type: "error"; data: { message: string } };

export type DashboardMessage =
  | { type: "hello"; data: { clientId: string } }
  | { type: "settings:fetch" }
  | { type: "settings:update"; data: Partial<BotSettings> }
  | { type: "image:list" }
  | { type: "image:delete"; data: { id: string } }
  | { type: "ping" };

export type WSMessage = BotMessage | DashboardMessage;

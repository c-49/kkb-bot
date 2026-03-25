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

/**
 * Discord Slash Command
 * For Discord.js slash command handling
 */

export interface SlashCommandData {
  name: string;
  description: string;
  toJSON(): any; // Discord.js format
}

export interface SlashCommandContext {
  userId: string;
  guildId: string;
  interaction: any; // Discord.js Interaction
}

export interface ISlashCommand {
  data: SlashCommandData;
  execute(context: SlashCommandContext): Promise<void>;
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
  | { type: "welcome:updated"; data: WelcomeSettings }
  | { type: "image:uploaded"; data: ImageMeta }
  | { type: "image:deleted"; data: { id: string } }
  | { type: "gif:uploaded"; data: ImageMeta }
  | { type: "gif:deleted"; data: { id: string } }
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
 * Welcome/Greeting Settings
 */

export interface WelcomeSettings {
  enabled: boolean;
  channelId: string; // Discord channel ID where greetings post
  greetingMessage: string; // Template message for greeting
  gifMaxSize: number; // bytes - max size for GIF uploads
  gifFolderPath: string; // where to store gifs
}

export const DEFAULT_WELCOME_SETTINGS: WelcomeSettings = {
  enabled: false,
  channelId: "",
  greetingMessage: "Welcome {newUser}! 🎉",
  gifMaxSize: 10 * 1024 * 1024, // 10MB default
  gifFolderPath: "./gifs/welcome",
};

/**
 * Image Management
 */

export interface ImageMeta {
  id: string;
  name: string;
  path: string;
  uploadedAt: number;
  size: number;  // bytes
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
  | { type: "welcome:fetch" }
  | { type: "welcome:update"; data: Partial<WelcomeSettings> }
  | { type: "gif:list" }
  | { type: "gif:delete"; data: { id: string } }
  | { type: "ping" };

export type WSMessage = BotMessage | DashboardMessage;

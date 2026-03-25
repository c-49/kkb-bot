import "dotenv/config";
import { Client, GatewayIntentBits } from "discord.js";
import { DefaultCommandRegistry } from "./commands/CommandRegistry.js";
import { PingCommand, HelloCommand } from "./commands/examples.js";
import { SettingsManager } from "./storage/SettingsManager.js";
import { DashboardServer } from "./ws/DashboardServer.js";

/**
 * Main bot entry point
 * Initializes Discord.js client, command registry, and dashboard server
 */

const TOKEN = process.env.DISCORD_TOKEN;
const WS_PORT = parseInt(process.env.WS_PORT || "8080", 10);

if (!TOKEN) {
  throw new Error("DISCORD_TOKEN environment variable is required");
}

// Initialize systems
const commandRegistry = new DefaultCommandRegistry();
const bot = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});

let settingsManager: SettingsManager;
let dashboardServer: DashboardServer;

// Register default commands
function registerCommands(): void {
  commandRegistry.register(new PingCommand());
  commandRegistry.register(new HelloCommand());
  console.log(
    `📚 Registered ${commandRegistry.all().length} commands`
  );
}

bot.on("ready", async () => {
  console.log(`\n🤖 Bot ready as ${bot.user?.tag}`);

  // Load settings
  settingsManager = await SettingsManager.load();
  console.log("⚙️  Settings loaded");

  // Start dashboard server
  dashboardServer = new DashboardServer(WS_PORT);
});

bot.on("messageCreate", async (message: any) => {
  if (message.author.bot) return;

  const settings = settingsManager.get();
  if (!message.content.startsWith(settings.prefix)) return;

  const args = message.content.slice(settings.prefix.length).trim().split(/\s+/);
  const commandName = args.shift()?.toLowerCase();

  if (!commandName) return;

  const command = commandRegistry.get(commandName as any);
  if (!command) {
    await message.reply("❌ Command not found");
    return;
  }

  try {
    const result = await command.execute(args, {
      userId: message.author.id,
      guildId: message.guildId || "",
      timestamp: Date.now(),
    });

    await message.reply(result);

    // Notify dashboard of command execution
    dashboardServer?.broadcastEvent({
      type: "command:executed",
      data: {
        command: commandName,
        result,
        timestamp: Date.now(),
      },
    });
  } catch (err) {
    console.error(`Command error [${commandName}]:`, err);
    await message.reply("⚠️ An error occurred executing the command");
  }
});

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("\n🛑 Shutting down gracefully...");
  await bot.destroy();
  await dashboardServer?.close();
  process.exit(0);
});

// Register commands and start bot
registerCommands();
bot.login(TOKEN);

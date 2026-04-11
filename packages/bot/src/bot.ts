import dotenv from "dotenv";
// @ts-ignore - express types not yet installed
import express from "express";
import { Client, GatewayIntentBits, REST, Routes } from "discord.js";
import { DefaultCommandRegistry } from "./commands/CommandRegistry.js";
import { SlashCommandRegistry } from "./commands/SlashCommandRegistry.js";
import { PingCommand, HelloCommand } from "./commands/examples.js";
import { WelcomeSlashCommand, WelcomeSetupSlashCommand } from "./commands/Welcome.js";
import { GifCommand } from "./commands/GifCommand.js";

// Load environment variables
dotenv.config();
import { SettingsManager } from "./storage/SettingsManager.js";
import { WelcomeManager } from "./storage/WelcomeManager.js";
import { GifManager } from "./storage/GifManager.js";
import { DashboardServer } from "./ws/DashboardServer.js";
import { WelcomeHandler } from "./ws/WelcomeHandler.js";
import { createUploadRoutes } from "./routes/uploadRoutes.js";

/**
 * Main bot entry point
 * Initializes Discord.js client, command registry, dashboard server, and welcome system
 */

const TOKEN = process.env.DISCORD_TOKEN;
const WS_PORT = parseInt(process.env.WS_PORT || "8080", 10);
const HTTP_PORT = parseInt(process.env.HTTP_PORT || "3000", 10);

if (!TOKEN) {
  throw new Error("DISCORD_TOKEN environment variable is required");
}

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required for GIF storage");
}

// Initialize systems
const commandRegistry = new DefaultCommandRegistry();
const slashCommandRegistry = new SlashCommandRegistry();
const bot = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers, // for member join events
  ],
});

let settingsManager: SettingsManager;
let welcomeManager: WelcomeManager;
let welcomeHandler: WelcomeHandler;
let dashboardServer: DashboardServer;
let gifManager: GifManager;
let httpServer: any;

// Register default commands
function registerCommands(): void {
  commandRegistry.register(new PingCommand());
  commandRegistry.register(new HelloCommand());
  console.log(`📚 Registered ${commandRegistry.all().length} text commands`);
}

// Register slash commands
function registerSlashCommands(): void {
  slashCommandRegistry.register(new WelcomeSlashCommand());
  slashCommandRegistry.register(new WelcomeSetupSlashCommand(welcomeManager));
  // GifCommand will be registered after gifManager is available
  console.log(`⚡ Registered ${slashCommandRegistry.all().length} slash commands`);
}

/**
 * Deploy slash commands to Discord
 * Run once when bot starts in a guild
 */
async function deploySlashCommands(): Promise<void> {
  const token = process.env.DISCORD_TOKEN;
  const clientId = bot.user?.id;

  if (!token || !clientId) {
    console.warn("⚠️  Cannot deploy slash commands: missing token or clientId");
    return;
  }

  try {
    const rest = new REST({ version: "10" }).setToken(token);
    const commands = slashCommandRegistry.toJSON();

    console.log(`🔄 Deploying ${commands.length} slash commands...`);

    await rest.put(Routes.applicationCommands(clientId), { body: commands });

    console.log("✅ Slash commands deployed globally");
  } catch (err) {
    console.error("Failed to deploy slash commands:", err);
  }
}

bot.on("ready", async () => {
  console.log(`\n🤖 Bot ready as ${bot.user?.tag}`);

  // Load settings
  settingsManager = await SettingsManager.load();
  welcomeManager = await WelcomeManager.load();
  console.log("⚙️  Settings loaded");
  console.log("🎉 Welcome system loaded");

  // Initialize GIF manager with database
  gifManager = new GifManager();
  try {
    await gifManager.initDatabase();
    console.log("💾 GIF database initialized");
    
    // Ensure "welcome" category exists
    const welcomeCategory = await gifManager.getCategoryByName("welcome");
    if (!welcomeCategory) {
      await gifManager.createCategory(
        "welcome",
        "GIFs used for welcoming new members",
        "system"
      );
      console.log("📁 Created 'welcome' GIF category");
    }
  } catch (error) {
    console.error("Failed to initialize GIF database:", error);
  }

  // Initialize welcome handler
  welcomeHandler = new WelcomeHandler(bot, welcomeManager, gifManager);

  // Register slash commands
  registerSlashCommands();
  
  // Register GifCommand (needs gifManager)
  slashCommandRegistry.register(new GifCommand(gifManager));

  // Deploy slash commands to Discord
  await deploySlashCommands();

  // Start dashboard server
  dashboardServer = new DashboardServer(WS_PORT);

  // Setup dashboard message handlers
  setupDashboardHandlers();

  // Start HTTP server for file uploads
  startHttpServer();
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

/**
 * Start HTTP server for file uploads
 */
function startHttpServer(): void {
  const app = express();

  // Middleware
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // Health check
  app.get("/health", (_req: any, res: any) => {
    res.json({ status: "ok", service: "kkb-bot-upload" });
  });

  // Upload routes
  app.use("/api/upload", createUploadRoutes({
    gifManager,
    maxFileSize: welcomeManager.get().gifMaxSize || 10 * 1024 * 1024,
  }));

  // Error handling
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error("HTTP error:", err);
    res.status(err.status || 500).json({
      error: err.message || "Internal server error",
    });
  });

  // Start listening
  httpServer = app.listen(HTTP_PORT, () => {
    console.log(`🚀 HTTP server listening on http://localhost:${HTTP_PORT}`);
    console.log(`📁 Upload endpoint: POST http://localhost:${HTTP_PORT}/api/upload/gif`);
  });
}

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("\n🛑 Shutting down gracefully...");
  await bot.destroy();
  await dashboardServer?.close();
  await gifManager?.close();
  if (httpServer) {
    httpServer.close();
  }
  process.exit(0);
});

/**
 * Setup dashboard message handlers
 * Connects dashboard requests to bot systems
 */
function setupDashboardHandlers(): void {
  // Welcome settings fetch
  dashboardServer.onMessage("welcome:fetch", async (clientId: string) => {
    const settings = welcomeManager.get();
    dashboardServer.sendToClient(clientId, {
      type: "event",
      data: {
        type: "welcome:updated",
        data: settings,
      },
    });
  });

  // Welcome settings update
  dashboardServer.onMessage("welcome:update", async (_clientId: string, data: any) => {
    await welcomeManager.update(data);
    dashboardServer.broadcastEvent({
      type: "welcome:updated",
      data: welcomeManager.get(),
    });
    console.log("✅ Welcome settings updated from dashboard");
  });

  // GIF list
  dashboardServer.onMessage("gif:list", async (clientId: string) => {
    const gifs = welcomeManager.listGifs();
    // Send each GIF as a separate event
    gifs.forEach((gif) => {
      dashboardServer.sendToClient(clientId, {
        type: "event",
        data: {
          type: "gif:uploaded",
          data: gif,
        },
      });
    });
  });
}

// Handle new members joining
bot.on("guildMemberAdd", async (member) => {
  if (welcomeHandler) {
    console.log(`👤 New member joined: ${member.user.tag}`);
    await welcomeHandler.postGreeting(member.user.id);
  }
});

// Handle button interactions
bot.on("interactionCreate", async (interaction) => {
  // Handle autocomplete
  if (interaction.isAutocomplete()) {
    const { commandName, options } = interaction;
    
    if (commandName === "gif") {
      const focusedValue = options.getFocused(true);
      
      if (focusedValue.name === "category") {
        try {
          const categories = await gifManager.listCategories();
          const filtered = categories
            .filter(cat => cat.name.toLowerCase().includes(focusedValue.value.toLowerCase()))
            .slice(0, 25); // Discord limit
          
          await interaction.respond(
            filtered.map(cat => ({
              name: `${cat.name} (${cat.gifCount} GIFs)`,
              value: cat.name,
            }))
          );
        } catch (err) {
          console.error("Autocomplete error:", err);
          await interaction.respond([]);
        }
      }
    }
    return;
  }

  // Handle slash commands
  if (interaction.isCommand() || interaction.isChatInputCommand()) {
    const command = slashCommandRegistry.get(interaction.commandName);
    if (!command) {
      console.warn(`No slash command handler for: ${interaction.commandName}`);
      return;
    }

    try {
      await command.execute({
        userId: interaction.user.id,
        guildId: interaction.guildId || "",
        interaction,
      });
    } catch (err) {
      console.error(`Error executing slash command [${interaction.commandName}]:`, err);
      await interaction
        .reply({
          content: "⚠️ An error occurred executing the command",
          ephemeral: true,
        })
        .catch(() => {});
    }
  }

  // Handle button clicks
  if (interaction.isButton()) {
    if (interaction.customId.startsWith("welcome_gif_")) {
      const userId = interaction.customId.replace("welcome_gif_", "");
      if (welcomeHandler) {
        await welcomeHandler.handleGreetingGifButton(userId, interaction);
      }
    }
  }
});

// Register commands and start bot
registerCommands();
bot.login(TOKEN);

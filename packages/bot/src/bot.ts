import dotenv from "dotenv";
// @ts-ignore - express types not yet installed
import express from "express";
import path from "path";
import { Client, GatewayIntentBits, REST, Routes, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } from "discord.js";
import { DefaultCommandRegistry } from "./commands/CommandRegistry.js";
import { SlashCommandRegistry } from "./commands/SlashCommandRegistry.js";
import { PingCommand, HelloCommand } from "./commands/examples.js";
import { WelcomeSlashCommand, WelcomeSetupSlashCommand } from "./commands/Welcome.js";
import { GifCommand } from "./commands/GifCommand.js";
import { ManageCommand } from "./commands/ManageCommand.js";

// Load environment variables
dotenv.config();
import { SettingsManager } from "./storage/SettingsManager.js";
import { WelcomeManager } from "./storage/WelcomeManager.js";
import { GifManager } from "./storage/GifManager.js";
import { CustomCommandManager } from "./storage/CustomCommandManager.js";
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
    GatewayIntentBits.DirectMessages, // for DM-based GIF uploads
    GatewayIntentBits.MessageContent, // to read message content in DMs
  ],
});

// Pending DM GIF uploads awaiting category selection { userId -> attachment info }
const pendingGifUploads = new Map<string, {
  url: string;
  contentType: string;
  fileName: string;
  timeout: ReturnType<typeof setTimeout>;
}>();

let settingsManager: SettingsManager;
let welcomeManager: WelcomeManager;
let welcomeHandler: WelcomeHandler;
let dashboardServer: DashboardServer;
let gifManager: GifManager;
let customCommandManager: CustomCommandManager | undefined;
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
    const staticCommands = slashCommandRegistry.toJSON();
    const ccm = customCommandManager;
    const customCommands = ccm
      ? (await ccm.listCommands()).map((cmd) => ccm.toDiscordCommand(cmd))
      : [];
    const allCommands = [...staticCommands, ...customCommands];

    console.log(
      `🔄 Deploying ${allCommands.length} slash commands (${staticCommands.length} static, ${customCommands.length} custom)...`
    );

    await rest.put(Routes.applicationCommands(clientId), { body: allCommands });

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
    console.log("🔍 Checking for 'welcome' category...");
    const welcomeCategory = await gifManager.getCategoryByName("welcome");
    if (!welcomeCategory) {
      console.log("📁 Welcome category not found, creating...");
      await gifManager.createCategory(
        "welcome",
        "GIFs used for welcoming new members",
        "system"
      );
      console.log("✅ Created 'welcome' GIF category");
    } else {
      console.log(`✅ Welcome category already exists`);
    }
  } catch (error) {
    console.error("Failed to initialize GIF database:", error);
  }

  // Initialize welcome handler
  welcomeHandler = new WelcomeHandler(bot, welcomeManager, gifManager);

  // Initialize custom command manager
  customCommandManager = new CustomCommandManager();
  await customCommandManager.initDatabase();

  // Register slash commands
  registerSlashCommands();

  // Register commands that need runtime dependencies
  slashCommandRegistry.register(new GifCommand(gifManager));
  slashCommandRegistry.register(new ManageCommand(customCommandManager, deploySlashCommands));

  // Deploy all slash commands (static + custom from DB)
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

  // ── DM GIF upload flow ──────────────────────────────────────────────────
  if (!message.guild) {
    const imageAttachment = [...message.attachments.values()].find(
      (a: any) => a.contentType?.startsWith("image/")
    ) as any;

    if (imageAttachment) {
      const userId = message.author.id;
      const text = message.content.trim().toLowerCase();

      try {
        const categories = await gifManager.listCategories();

        // If they typed a category name in the message, upload straight away
        const matched = categories.find((c) => c.name === text);
        if (matched) {
          await uploadDmGif(message, imageAttachment, matched.name);
          return;
        }

        // No category — store the pending upload and ask
        if (categories.length === 0) {
          await message.reply("❌ No categories exist yet. Ask an admin to create one with `/gif create`.");
          return;
        }

        const existing = pendingGifUploads.get(userId);
        if (existing) clearTimeout(existing.timeout);

        const timeout = setTimeout(() => pendingGifUploads.delete(userId), 5 * 60 * 1000);
        pendingGifUploads.set(userId, {
          url: imageAttachment.url,
          contentType: imageAttachment.contentType ?? "image/gif",
          fileName: imageAttachment.name,
          timeout,
        });

        const select = new StringSelectMenuBuilder()
          .setCustomId("gif_category_select")
          .setPlaceholder("Pick a category")
          .addOptions(
            categories.slice(0, 25).map((c) => ({
              label: c.name,
              description: `${c.gifCount}/20 GIFs`,
              value: c.name,
            }))
          );

        const row = new ActionRowBuilder().addComponents(select);
        await message.reply({
          content: "📁 Which category should I add this to?",
          components: [row],
        });
      } catch (err) {
        console.error("[DM upload] Error:", err);
        await message.reply("❌ Something went wrong. Please try again.");
      }
      return;
    }

    // Ignore other DM messages
    return;
  }

  // ── Guild prefix commands ───────────────────────────────────────────────
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

    dashboardServer?.broadcastEvent({
      type: "command:executed",
      data: { command: commandName, result, timestamp: Date.now() },
    });
  } catch (err) {
    console.error(`Command error [${commandName}]:`, err);
    await message.reply("⚠️ An error occurred executing the command");
  }
});

async function uploadDmGif(message: any, attachment: any, category: string): Promise<void> {
  try {
    const response = await fetch(attachment.url);
    if (!response.ok) throw new Error(`Failed to download attachment: ${response.status}`);
    const buffer = Buffer.from(await response.arrayBuffer());

    const result = await gifManager.uploadGif(category, buffer, attachment.name, message.author.id);

    await message.reply(
      `✅ Uploaded **${result.name}** to **${category}**\n📊 Size: ${(result.size / 1024).toFixed(2)} KB\n☁️ Stored in Supabase`
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Upload failed";
    console.error("[DM upload] uploadDmGif error:", err);
    await message.reply(`❌ ${msg}`);
  }
}

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

  // Serve GIF files
  app.get("/gifs/:category/:filename", async (req: any, res: any, next: any) => {
    try {
      const { category, filename } = req.params;
      const filePath = path.join(process.env.GIF_STORAGE_PATH || "./gifs", category, filename);
      
      // Security: prevent directory traversal
      const normalizedPath = path.normalize(filePath);
      const basePath = path.normalize(process.env.GIF_STORAGE_PATH || "./gifs");
      
      if (!normalizedPath.startsWith(basePath)) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      res.setHeader("Cache-Control", "public, max-age=31536000"); // 1 year cache
      res.setHeader("Content-Type", "image/gif");
      res.sendFile(filePath);
    } catch (err) {
      next(err);
    }
  });

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
  await customCommandManager?.close();
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
          console.log(`[Autocomplete] Fetching categories for gif command, user input: "${focusedValue.value}"`);
          const categories = await gifManager.listCategories();
          console.log(`[Autocomplete] Retrieved ${categories.length} total categories:`, categories.map(c => c.name));
          
          const filtered = categories
            .filter(cat => cat.name.toLowerCase().includes(focusedValue.value.toLowerCase()))
            .slice(0, 25); // Discord limit
          
          console.log(`[Autocomplete] After filtering: ${filtered.length} categories match`);
          
          await interaction.respond(
            filtered.map(cat => ({
              name: `${cat.name} (${cat.gifCount} GIFs)`,
              value: cat.name,
            }))
          );
        } catch (err) {
          console.error("❌ Autocomplete error:", err);
          console.error("Stack:", (err as any).stack);
          await interaction.respond([]);
        }
      }
    }
    return;
  }

  // Handle slash commands
  if (interaction.isCommand() || interaction.isChatInputCommand()) {
    const command = slashCommandRegistry.get(interaction.commandName);

    if (command) {
      try {
        await command.execute({
          userId: interaction.user.id,
          guildId: interaction.guildId || "",
          interaction,
        });
      } catch (err) {
        console.error(`Error executing slash command [${interaction.commandName}]:`, err);
        await interaction
          .reply({ content: "⚠️ An error occurred executing the command", ephemeral: true })
          .catch(() => {});
      }
      return;
    }

    // Fall through to custom commands
    const customCmd = await customCommandManager?.getCommand(interaction.commandName);
    if (customCmd) {
      try {
        await interaction.deferReply();
        const userId = interaction.user.id;
        const targetId: string | undefined = customCmd.hasTarget
          ? (interaction as any).options.getUser("target")?.id
          : undefined;

        const text = customCommandManager!.renderText(customCmd.textTemplate, userId, targetId);

        if (customCmd.gifCategory) {
          const gifData = await gifManager.getRandomGif(customCmd.gifCategory);
          if (gifData.sourceUrl) {
            const embed = new EmbedBuilder().setImage(gifData.sourceUrl).setColor(0x5865f2);
            await interaction.editReply({ content: text, embeds: [embed] });
            return;
          }
        }

        await interaction.editReply({ content: text });
      } catch (err) {
        console.error(`Error executing custom command [${interaction.commandName}]:`, err);
        await interaction.editReply({ content: "⚠️ An error occurred." }).catch(() => {});
      }
      return;
    }

    console.warn(`No handler for slash command: ${interaction.commandName}`);
  }

  // Handle button clicks
  if (interaction.isButton()) {
    if (interaction.customId.startsWith("welcome_gif_")) {
      const userId = interaction.customId.replace("welcome_gif_", "");
      if (welcomeHandler) {
        await welcomeHandler.handleGreetingGifButton(userId, interaction);
      }
    }
    return;
  }

  // Handle category select menu from DM GIF upload
  if (interaction.isStringSelectMenu() && interaction.customId === "gif_category_select") {
    const userId = interaction.user.id;
    const pending = pendingGifUploads.get(userId);

    if (!pending) {
      await interaction.reply({ content: "❌ Upload expired — please resend the GIF.", ephemeral: true });
      return;
    }

    const category = interaction.values[0];
    await interaction.deferReply();

    try {
      clearTimeout(pending.timeout);
      pendingGifUploads.delete(userId);

      const response = await fetch(pending.url);
      if (!response.ok) throw new Error(`Failed to download: ${response.status}`);
      const buffer = Buffer.from(await response.arrayBuffer());

      const result = await gifManager.uploadGif(category, buffer, pending.fileName, userId);

      await interaction.editReply(
        `✅ Uploaded **${result.name}** to **${category}**\n📊 Size: ${(result.size / 1024).toFixed(2)} KB\n☁️ Stored in Supabase`
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      console.error("[DM upload] Select menu error:", err);
      await interaction.editReply(`❌ ${msg}`);
    }
    return;
  }
});

// Register commands and start bot
registerCommands();
bot.login(TOKEN);

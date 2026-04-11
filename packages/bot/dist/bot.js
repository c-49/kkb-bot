"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
// @ts-ignore - express types not yet installed
const express_1 = __importDefault(require("express"));
const discord_js_1 = require("discord.js");
const CommandRegistry_js_1 = require("./commands/CommandRegistry.js");
const SlashCommandRegistry_js_1 = require("./commands/SlashCommandRegistry.js");
const examples_js_1 = require("./commands/examples.js");
const Welcome_js_1 = require("./commands/Welcome.js");
const GifCommand_js_1 = require("./commands/GifCommand.js");
// Load environment variables
dotenv_1.default.config();
const SettingsManager_js_1 = require("./storage/SettingsManager.js");
const WelcomeManager_js_1 = require("./storage/WelcomeManager.js");
const GifManager_js_1 = require("./storage/GifManager.js");
const DashboardServer_js_1 = require("./ws/DashboardServer.js");
const WelcomeHandler_js_1 = require("./ws/WelcomeHandler.js");
const uploadRoutes_js_1 = require("./routes/uploadRoutes.js");
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
const commandRegistry = new CommandRegistry_js_1.DefaultCommandRegistry();
const slashCommandRegistry = new SlashCommandRegistry_js_1.SlashCommandRegistry();
const bot = new discord_js_1.Client({
    intents: [
        discord_js_1.GatewayIntentBits.Guilds,
        discord_js_1.GatewayIntentBits.GuildMessages,
        discord_js_1.GatewayIntentBits.GuildMembers, // for member join events
    ],
});
let settingsManager;
let welcomeManager;
let welcomeHandler;
let dashboardServer;
let gifManager;
let httpServer;
// Register default commands
function registerCommands() {
    commandRegistry.register(new examples_js_1.PingCommand());
    commandRegistry.register(new examples_js_1.HelloCommand());
    console.log(`📚 Registered ${commandRegistry.all().length} text commands`);
}
// Register slash commands
function registerSlashCommands() {
    slashCommandRegistry.register(new Welcome_js_1.WelcomeSlashCommand());
    slashCommandRegistry.register(new Welcome_js_1.WelcomeSetupSlashCommand(welcomeManager));
    // GifCommand will be registered after gifManager is available
    console.log(`⚡ Registered ${slashCommandRegistry.all().length} slash commands`);
}
/**
 * Deploy slash commands to Discord
 * Run once when bot starts in a guild
 */
async function deploySlashCommands() {
    const token = process.env.DISCORD_TOKEN;
    const clientId = bot.user?.id;
    if (!token || !clientId) {
        console.warn("⚠️  Cannot deploy slash commands: missing token or clientId");
        return;
    }
    try {
        const rest = new discord_js_1.REST({ version: "10" }).setToken(token);
        const commands = slashCommandRegistry.toJSON();
        console.log(`🔄 Deploying ${commands.length} slash commands...`);
        await rest.put(discord_js_1.Routes.applicationCommands(clientId), { body: commands });
        console.log("✅ Slash commands deployed globally");
    }
    catch (err) {
        console.error("Failed to deploy slash commands:", err);
    }
}
bot.on("ready", async () => {
    console.log(`\n🤖 Bot ready as ${bot.user?.tag}`);
    // Load settings
    settingsManager = await SettingsManager_js_1.SettingsManager.load();
    welcomeManager = await WelcomeManager_js_1.WelcomeManager.load();
    console.log("⚙️  Settings loaded");
    console.log("🎉 Welcome system loaded");
    // Initialize GIF manager with database
    gifManager = new GifManager_js_1.GifManager();
    try {
        await gifManager.initDatabase();
        console.log("💾 GIF database initialized");
        // Ensure "welcome" category exists
        const welcomeCategory = await gifManager.getCategoryByName("welcome");
        if (!welcomeCategory) {
            await gifManager.createCategory("welcome", "GIFs used for welcoming new members", "system");
            console.log("📁 Created 'welcome' GIF category");
        }
    }
    catch (error) {
        console.error("Failed to initialize GIF database:", error);
    }
    // Initialize welcome handler
    welcomeHandler = new WelcomeHandler_js_1.WelcomeHandler(bot, welcomeManager, gifManager);
    // Register slash commands
    registerSlashCommands();
    // Register GifCommand (needs gifManager)
    slashCommandRegistry.register(new GifCommand_js_1.GifCommand(gifManager));
    // Deploy slash commands to Discord
    await deploySlashCommands();
    // Start dashboard server
    dashboardServer = new DashboardServer_js_1.DashboardServer(WS_PORT);
    // Setup dashboard message handlers
    setupDashboardHandlers();
    // Start HTTP server for file uploads
    startHttpServer();
});
bot.on("messageCreate", async (message) => {
    if (message.author.bot)
        return;
    const settings = settingsManager.get();
    if (!message.content.startsWith(settings.prefix))
        return;
    const args = message.content.slice(settings.prefix.length).trim().split(/\s+/);
    const commandName = args.shift()?.toLowerCase();
    if (!commandName)
        return;
    const command = commandRegistry.get(commandName);
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
    }
    catch (err) {
        console.error(`Command error [${commandName}]:`, err);
        await message.reply("⚠️ An error occurred executing the command");
    }
});
/**
 * Start HTTP server for file uploads
 */
function startHttpServer() {
    const app = (0, express_1.default)();
    // Middleware
    app.use(express_1.default.json({ limit: "50mb" }));
    app.use(express_1.default.urlencoded({ limit: "50mb", extended: true }));
    // Health check
    app.get("/health", (_req, res) => {
        res.json({ status: "ok", service: "kkb-bot-upload" });
    });
    // Upload routes
    app.use("/api/upload", (0, uploadRoutes_js_1.createUploadRoutes)({
        gifManager,
        maxFileSize: welcomeManager.get().gifMaxSize || 10 * 1024 * 1024,
    }));
    // Error handling
    app.use((err, _req, res, _next) => {
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
function setupDashboardHandlers() {
    // Welcome settings fetch
    dashboardServer.onMessage("welcome:fetch", async (clientId) => {
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
    dashboardServer.onMessage("welcome:update", async (_clientId, data) => {
        await welcomeManager.update(data);
        dashboardServer.broadcastEvent({
            type: "welcome:updated",
            data: welcomeManager.get(),
        });
        console.log("✅ Welcome settings updated from dashboard");
    });
    // GIF list
    dashboardServer.onMessage("gif:list", async (clientId) => {
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
        }
        catch (err) {
            console.error(`Error executing slash command [${interaction.commandName}]:`, err);
            await interaction
                .reply({
                content: "⚠️ An error occurred executing the command",
                ephemeral: true,
            })
                .catch(() => { });
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

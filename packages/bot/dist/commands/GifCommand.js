"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GifCommand = void 0;
const discord_js_1 = require("discord.js");
/**
 * /gif Slash Command
 * Multi-purpose GIF management command with subcommands
 *
 * Subcommands:
 * - /gif create <name> - Create a new category (admin only)
 * - /gif upload <category> - Upload a GIF to a category (admin/mod DM-based)
 * - /gif show <category> - Show a random GIF from a category
 * - /gif list [category] - List all categories or GIFs in a category
 */
class GifCommand {
    constructor(gifManager) {
        Object.defineProperty(this, "gifManager", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: gifManager
        });
        Object.defineProperty(this, "data", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new discord_js_1.SlashCommandBuilder()
                .setName("gif")
                .setDescription("Manage and display GIFs by category")
                .addSubcommand((sub) => sub
                .setName("create")
                .setDescription("Create a new GIF category (Admin only)")
                .addStringOption((opt) => opt
                .setName("name")
                .setDescription("Category name (e.g., 'memes', 'reactions')")
                .setRequired(true)
                .setMaxLength(50))
                .addStringOption((opt) => opt
                .setName("description")
                .setDescription("Optional category description")
                .setRequired(false)
                .setMaxLength(200)))
                .addSubcommand((sub) => sub
                .setName("upload")
                .setDescription("Upload a GIF from Tenor to a category (use in DM)")
                .addStringOption((opt) => opt
                .setName("category")
                .setDescription("Category to upload to")
                .setRequired(true)
                .setAutocomplete(true))
                .addStringOption((opt) => opt
                .setName("url")
                .setDescription("Tenor GIF URL (e.g., https://tenor.com/view/...)")
                .setRequired(true)))
                .addSubcommand((sub) => sub
                .setName("show")
                .setDescription("Show a random GIF from a category")
                .addStringOption((opt) => opt
                .setName("category")
                .setDescription("Category to pick from")
                .setRequired(true)
                .setAutocomplete(true))
                .addIntegerOption((opt) => opt
                .setName("count")
                .setDescription("Number of GIFs to show (1-5)")
                .setRequired(false)
                .setMinValue(1)
                .setMaxValue(5)))
                .addSubcommand((sub) => sub
                .setName("list")
                .setDescription("List all categories or GIFs in a category")
                .addStringOption((opt) => opt
                .setName("category")
                .setDescription("Leave empty to list categories, or specify category to list its GIFs")
                .setRequired(false)
                .setAutocomplete(true)))
        });
    }
    async execute(context) {
        const interaction = context.interaction;
        const subcommand = interaction.options.getSubcommand();
        try {
            switch (subcommand) {
                case "create":
                    await this.handleCreate(interaction);
                    break;
                case "upload":
                    await this.handleUpload(interaction);
                    break;
                case "show":
                    await this.handleShow(interaction);
                    break;
                case "list":
                    await this.handleList(interaction);
                    break;
                default:
                    await interaction.reply({
                        content: "❌ Unknown subcommand",
                        ephemeral: true,
                    });
            }
        }
        catch (error) {
            console.error("Error in GifCommand:", error);
            const errorMsg = error instanceof Error ? error.message : "Unknown error";
            if (interaction.replied || interaction.deferred) {
                await interaction.editReply({
                    content: `❌ Error: ${errorMsg}`,
                });
            }
            else {
                await interaction.reply({
                    content: `❌ Error: ${errorMsg}`,
                    ephemeral: true,
                });
            }
        }
    }
    async handleCreate(interaction) {
        // Check permissions (admin only)
        if (!interaction.member?.permissions?.has("Administrator")) {
            await interaction.reply({
                content: "❌ You need Administrator permission to create categories.",
                ephemeral: true,
            });
            return;
        }
        const categoryName = interaction.options.getString("name");
        const description = interaction.options.getString("description");
        await interaction.deferReply({ ephemeral: true });
        const result = await this.gifManager.createCategory(categoryName, description, interaction.user.id);
        await interaction.editReply({
            content: `✅ Created category **${result.name}**${result.description ? `\n> ${result.description}` : ""}`,
        });
    }
    async handleUpload(interaction) {
        // Can only use in DM
        if (interaction.guild) {
            await interaction.reply({
                content: "📬 Please use this command in DMs with the bot. Type `/gif upload` in a DM!",
                ephemeral: true,
            });
            return;
        }
        const categoryName = interaction.options.getString("category");
        const gifUrl = interaction.options.getString("url");
        // Validate Tenor URL
        if (!gifUrl.includes("tenor.com")) {
            await interaction.reply({
                content: "❌ Invalid URL. Please use a Tenor GIF URL (e.g., https://tenor.com/view/...)",
                ephemeral: true,
            });
            return;
        }
        await interaction.deferReply({ ephemeral: true });
        try {
            // Extract GIF filename from URL
            const urlObj = new URL(gifUrl);
            const parts = urlObj.pathname.split("/");
            const gifName = parts[parts.length - 1] || "tenor-gif";
            console.log(`[GifCommand] Downloading GIF from Tenor: ${gifName}`);
            // Download the GIF
            const response = await fetch(gifUrl);
            if (!response.ok) {
                throw new Error(`Failed to download GIF: ${response.status} ${response.statusText}`);
            }
            const buffer = await response.arrayBuffer();
            // Validate file size (10MB)
            if (buffer.byteLength > 10 * 1024 * 1024) {
                await interaction.editReply({
                    content: `❌ File too large. Max 10MB, received ${(buffer.byteLength / 1024 / 1024).toFixed(2)}MB`,
                });
                return;
            }
            if (buffer.byteLength === 0) {
                await interaction.editReply({
                    content: "❌ Downloaded file is empty. Please try again with a different GIF.",
                });
                return;
            }
            console.log(`[GifCommand] Downloaded ${buffer.byteLength} bytes, uploading to category: ${categoryName}`);
            // Upload to GIF manager
            const uploadedGif = await this.gifManager.uploadGif(categoryName, Buffer.from(buffer), gifName.endsWith(".gif") ? gifName : `${gifName}.gif`, interaction.user.id, gifUrl);
            await interaction.editReply({
                content: `✅ Uploaded **${uploadedGif.name}** to **${categoryName}**\n\n📊 Size: ${(uploadedGif.size / 1024).toFixed(2)} KB\n🔗 [Original URL](${gifUrl})`,
            });
        }
        catch (error) {
            const errorMsg = error instanceof Error ? error.message : "Upload failed";
            console.error("[GifCommand] Upload error:", error);
            await interaction.editReply({
                content: `❌ Error: ${errorMsg}`,
            });
        }
    }
    async handleShow(interaction) {
        const categoryName = interaction.options.getString("category");
        const count = interaction.options.getInteger("count") || 1;
        await interaction.deferReply();
        // Check if category exists
        const category = await this.gifManager.getCategoryByName(categoryName);
        if (!category) {
            await interaction.editReply({
                content: `❌ Category **${categoryName}** not found.`,
            });
            return;
        }
        // Get random GIFs
        const gifs = await this.gifManager.listGifs(categoryName);
        if (gifs.length === 0) {
            await interaction.editReply({
                content: `❌ No GIFs available in **${categoryName}**. 😔`,
            });
            return;
        }
        // Shuffle and pick up to 'count' GIFs
        const shuffled = gifs.sort(() => Math.random() - 0.5);
        const selected = shuffled.slice(0, Math.min(count, gifs.length));
        // Send GIFs
        const files = selected.map((gif) => {
            const attachment = new discord_js_1.AttachmentBuilder(gif.path, { name: gif.name });
            return attachment;
        });
        const content = selected.length === 1
            ? `🎬 From **${categoryName}**:`
            : `🎬 ${selected.length} GIFs from **${categoryName}**:`;
        await interaction.editReply({
            content,
            files,
        });
    }
    async handleList(interaction) {
        const categoryName = interaction.options.getString("category");
        await interaction.deferReply();
        if (!categoryName) {
            // List all categories
            const categories = await this.gifManager.listCategories();
            if (categories.length === 0) {
                await interaction.editReply({
                    content: "📁 No categories created yet.",
                });
                return;
            }
            const list = categories
                .map((cat) => `• **${cat.name}** (${cat.gifCount} GIFs)${cat.description ? `\n  > ${cat.description}` : ""}`)
                .join("\n");
            await interaction.editReply({
                content: `📁 **GIF Categories:**\n\n${list}`,
            });
        }
        else {
            // List GIFs in category
            const category = await this.gifManager.getCategoryByName(categoryName);
            if (!category) {
                await interaction.editReply({
                    content: `❌ Category **${categoryName}** not found.`,
                });
                return;
            }
            const gifs = await this.gifManager.listGifs(categoryName);
            if (gifs.length === 0) {
                await interaction.editReply({
                    content: `📁 No GIFs in **${categoryName}** yet.`,
                });
                return;
            }
            const list = gifs
                .slice(0, 15) // Show first 15
                .map((gif, i) => `${i + 1}. **${gif.name}** (${(gif.size / 1024).toFixed(1)} KB)`)
                .join("\n");
            const moreText = gifs.length > 15 ? `\n\n... and ${gifs.length - 15} more` : "";
            await interaction.editReply({
                content: `📁 **${categoryName}** (${gifs.length} / 20 GIFs):\n\n${list}${moreText}`,
            });
        }
    }
}
exports.GifCommand = GifCommand;

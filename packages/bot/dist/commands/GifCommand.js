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
                .setDescription("Upload a GIF to a category (use in DM) - Attach file after using command")
                .addStringOption((opt) => opt
                .setName("category")
                .setDescription("Category to upload to")
                .setRequired(true)
                .setAutocomplete(true)))
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
        await interaction.reply({
            content: `📁 Uploading GIF to **${categoryName}**\n\n⏰ Please send the image file (GIF, PNG, or JPG - max 10MB) in your next message.`,
            ephemeral: false,
        });
        try {
            // Wait for user to send an image
            const messages = await interaction.channel.awaitMessages({
                filter: (msg) => msg.author.id === interaction.user.id && msg.attachments.size > 0,
                max: 1,
                time: 60000, // 60 seconds
            });
            if (messages.size === 0) {
                await interaction.followUp({
                    content: "❌ Timeout - No file received. Please try again.",
                    ephemeral: true,
                });
                return;
            }
            const message = messages.first();
            const attachment = message.attachments.first();
            if (!attachment) {
                await interaction.followUp({
                    content: "❌ No attachment found in message.",
                    ephemeral: true,
                });
                return;
            }
            // Validate file type
            const validTypes = [
                "image/gif",
                "image/png",
                "image/jpeg",
                "image/jpg",
            ];
            // Check by extension if contentType is missing
            const fileExtension = attachment.name?.split('.').pop()?.toLowerCase();
            const validExtensions = ['gif', 'png', 'jpg', 'jpeg'];
            const hasValidExtension = fileExtension && validExtensions.includes(fileExtension);
            const hasValidType = attachment.contentType && validTypes.includes(attachment.contentType);
            if (!hasValidExtension && !hasValidType) {
                await interaction.followUp({
                    content: `❌ Invalid file type. Only GIF, PNG, and JPG allowed. Received: ${attachment.name}`,
                    ephemeral: true,
                });
                return;
            }
            // Validate file size (10MB)
            if (attachment.size > 10 * 1024 * 1024) {
                await interaction.followUp({
                    content: `❌ File too large. Max 10MB, received ${(attachment.size / 1024 / 1024).toFixed(2)}MB`,
                    ephemeral: true,
                });
                return;
            }
            // Download and process file
            const response = await fetch(attachment.url);
            const buffer = await response.arrayBuffer();
            // Upload to GIF manager
            const uploadedGif = await this.gifManager.uploadGif(categoryName, Buffer.from(buffer), attachment.name || "unnamed", interaction.user.id);
            await interaction.followUp({
                content: `✅ Uploaded **${uploadedGif.name}** to **${categoryName}**\n\n📊 Size: ${(uploadedGif.size / 1024).toFixed(2)} KB`,
                ephemeral: true,
            });
            // Delete the user's file message to keep chat clean
            try {
                await message.delete();
            }
            catch (_) {
                // Ignore delete errors
            }
        }
        catch (error) {
            const errorMsg = error instanceof Error ? error.message : "Upload failed";
            await interaction.followUp({
                content: `❌ Error: ${errorMsg}`,
                ephemeral: true,
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

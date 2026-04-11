"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createUploadRoutes = createUploadRoutes;
// @ts-ignore - express types not yet installed
const express_1 = __importDefault(require("express"));
// @ts-ignore - multer types not yet installed
const multer_1 = __importDefault(require("multer"));
/**
 * Upload Routes
 * Handle file uploads from the dashboard
 */
// Configure multer for in-memory storage
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: {
        fileSize: 50 * 1024 * 1024, // 50MB hard limit
    },
    fileFilter: (_req, file, cb) => {
        const allowedMimes = ["image/gif", "image/png", "image/jpeg"];
        if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        }
        else {
            cb(new Error("Only GIF, PNG, and JPG files are allowed"));
        }
    },
});
/**
 * Create upload routes
 */
function createUploadRoutes(options) {
    const router = express_1.default.Router();
    const { gifManager, maxFileSize = 10 * 1024 * 1024 } = options;
    /**
     * POST /upload/gif
     * Upload a new GIF to a category (defaults to 'welcome')
     *
     * Expects: multipart/form-data with 'file' field and optional 'category' field
     * Returns: ImageMeta object
     */
    router.post("/gif", upload.single("file"), async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({ error: "No file provided" });
            }
            const { originalname, buffer, size } = req.file;
            const category = req.body?.category || "welcome";
            // Validate size
            if (size > maxFileSize) {
                return res.status(413).json({
                    error: `File size ${size} exceeds maximum ${maxFileSize}`,
                });
            }
            // Upload GIF to category
            const gifMeta = await gifManager.uploadGif(category, buffer, originalname, undefined, maxFileSize);
            return res.status(201).json(gifMeta);
        }
        catch (error) {
            console.error("Upload error:", error);
            return res.status(500).json({
                error: error instanceof Error ? error.message : "Upload failed",
            });
        }
    });
    /**
     * GET /upload/gifs
     * List all uploaded GIFs or GIFs from a specific category
     *
     * Query params: category?
     * Returns: Array of ImageMeta objects
     */
    router.get("/gifs", async (req, res) => {
        try {
            const category = req.query.category;
            const gifs = await gifManager.listGifs(category);
            return res.json(gifs);
        }
        catch (error) {
            console.error("List GIFs error:", error);
            return res.status(500).json({
                error: error instanceof Error ? error.message : "Failed to list GIFs",
            });
        }
    });
    /**
     * DELETE /upload/gif/:id
     * Delete a GIF by ID
     *
     * Returns: { success: true }
     */
    router.delete("/gif/:id", async (req, res) => {
        try {
            const { id } = req.params;
            await gifManager.deleteGif(id);
            return res.json({ success: true, id });
        }
        catch (error) {
            console.error("Delete GIF error:", error);
            return res.status(500).json({
                error: error instanceof Error ? error.message : "Failed to delete GIF",
            });
        }
    });
    /**
     * GET /upload/gif/random
     * Get a random GIF from a category (defaults to 'welcome')
     *
     * Query params: category?, width?, height?
     * Returns: file path to random GIF
     */
    router.get("/gif/random", async (req, res) => {
        try {
            const category = req.query.category || "welcome";
            const width = req.query.width ? parseInt(req.query.width) : undefined;
            const height = req.query.height ? parseInt(req.query.height) : undefined;
            const gifPath = await gifManager.getRandomGif(category, width, height);
            if (!gifPath) {
                return res.status(404).json({ error: `No GIFs found in category: ${category}` });
            }
            return res.sendFile(gifPath);
        }
        catch (error) {
            console.error("Get random GIF error:", error);
            return res.status(500).json({
                error: error instanceof Error ? error.message : "Failed to get GIF",
            });
        }
    });
    return router;
}

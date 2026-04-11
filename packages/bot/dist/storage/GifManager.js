"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GifManager = void 0;
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const crypto_1 = require("crypto");
// @ts-ignore - sharp types not yet installed
const sharp_1 = __importDefault(require("sharp"));
// @ts-ignore - mysql2 types not yet installed
const promise_1 = __importDefault(require("mysql2/promise"));
/**
 * GIF Manager
 * Handles GIF storage, resizing, and database persistence
 */
class GifManager {
    constructor(giftFolderPath) {
        Object.defineProperty(this, "pool", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "giftFolderPath", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "resizeCachePath", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "MAX_GIFS_PER_CATEGORY", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 20
        });
        // Use GIF_STORAGE_PATH env var (for Render disk), fall back to ./gifs
        this.giftFolderPath = giftFolderPath || process.env.GIF_STORAGE_PATH || "./gifs";
        this.resizeCachePath = path_1.default.join(this.giftFolderPath, "resized");
        this.pool = promise_1.default.createPool({
            uri: process.env.DATABASE_URL,
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0,
        });
        console.log(`📁 GIF storage path: ${this.giftFolderPath}`);
    }
    /**
     * Initialize database schema
     */
    async initDatabase() {
        try {
            const connection = await this.pool.getConnection();
            try {
                await connection.query(`
          CREATE TABLE IF NOT EXISTS gif_categories (
            id CHAR(36) PRIMARY KEY,
            name VARCHAR(100) UNIQUE NOT NULL,
            description TEXT,
            created_by VARCHAR(255),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `);
                await connection.query(`
          CREATE TABLE IF NOT EXISTS gifs (
            id CHAR(36) PRIMARY KEY,
            category_id CHAR(36) NOT NULL,
            name VARCHAR(255) NOT NULL,
            file_path TEXT NOT NULL,
            size INT NOT NULL,
            uploader_id VARCHAR(255),
            description TEXT,
            uploaded_at BIGINT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (category_id) REFERENCES gif_categories(id) ON DELETE CASCADE,
            KEY idx_gifs_category_id (category_id),
            KEY idx_gifs_uploaded_at (uploaded_at),
            KEY idx_categories_name (name)
          )
        `);
                console.log("✅ GIF database schema initialized");
            }
            finally {
                connection.release();
            }
        }
        catch (error) {
            console.error("Failed to initialize GIF database:", error);
            throw error;
        }
    }
    /**
     * Ensure a directory exists
     */
    async ensureDirectory(dirPath) {
        try {
            await promises_1.default.mkdir(dirPath, { recursive: true });
        }
        catch (error) {
            console.error(`Failed to create directory ${dirPath}:`, error);
            throw error;
        }
    }
    /**
     * Create a new GIF category
     */
    async createCategory(name, description, createdBy) {
        try {
            const id = (0, crypto_1.randomUUID)();
            const normalizedName = name.toLowerCase();
            const connection = await this.pool.getConnection();
            try {
                console.log(`[GifManager] Creating category: ${name} (normalized: ${normalizedName})`);
                await connection.query(`INSERT INTO gif_categories (id, name, description, created_by)
           VALUES (?, ?, ?, ?)`, [id, normalizedName, description || null, createdBy || null]);
                console.log(`✅ Created GIF category: ${normalizedName} (ID: ${id})`);
                // Create folder for category
                await this.ensureDirectory(path_1.default.join(this.giftFolderPath, normalizedName));
                return {
                    id,
                    name: normalizedName,
                    description,
                };
            }
            finally {
                connection.release();
            }
        }
        catch (error) {
            if (error.code === "ER_DUP_ENTRY") {
                // Unique constraint violation
                throw new Error(`Category "${name}" already exists`);
            }
            console.error("Failed to create category:", error);
            throw error;
        }
    }
    /**
     * Get category by name
     */
    async getCategoryByName(name) {
        try {
            const connection = await this.pool.getConnection();
            try {
                const [rows] = await connection.query(`SELECT id, name, description FROM gif_categories WHERE name = ?`, [name.toLowerCase()]);
                if (!rows || (Array.isArray(rows) && rows.length === 0)) {
                    return null;
                }
                const row = Array.isArray(rows) ? rows[0] : rows;
                return {
                    id: row.id,
                    name: row.name,
                    description: row.description,
                };
            }
            finally {
                connection.release();
            }
        }
        catch (error) {
            console.error("Failed to get category:", error);
            throw error;
        }
    }
    /**
     * List all categories
     */
    async listCategories() {
        try {
            const connection = await this.pool.getConnection();
            try {
                console.log("[GifManager] Querying all categories...");
                const [rows] = await connection.query(`
          SELECT 
            c.id, 
            c.name, 
            c.description,
            COUNT(g.id) as gif_count
          FROM gif_categories c
          LEFT JOIN gifs g ON c.id = g.category_id
          GROUP BY c.id, c.name, c.description
          ORDER BY c.name ASC
        `);
                const result = (Array.isArray(rows) ? rows : []).map((row) => ({
                    id: row.id,
                    name: row.name,
                    description: row.description,
                    gifCount: parseInt(row.gif_count, 10),
                }));
                console.log(`[GifManager] Found ${result.length} categories:`, result.map(c => `${c.name} (${c.gifCount} GIFs)`));
                return result;
            }
            finally {
                connection.release();
            }
        }
        catch (error) {
            console.error("Failed to list categories:", error);
            throw error;
        }
    }
    /**
     * Upload and store a GIF to a category
     */
    async uploadGif(category, fileBuffer, fileName, uploaderId, maxSizeBytes = 10 * 1024 * 1024) {
        // Validate size
        if (fileBuffer.length > maxSizeBytes) {
            throw new Error(`File size ${fileBuffer.length} exceeds maximum ${maxSizeBytes}`);
        }
        // Validate file type
        if (!fileName.toLowerCase().endsWith(".gif") &&
            !fileName.toLowerCase().endsWith(".png") &&
            !fileName.toLowerCase().endsWith(".jpg") &&
            !fileName.toLowerCase().endsWith(".jpeg")) {
            throw new Error("Only GIF, PNG, and JPG files are supported");
        }
        try {
            const connection = await this.pool.getConnection();
            try {
                // Get or create category
                let categoryData = await this.getCategoryByName(category);
                if (!categoryData) {
                    categoryData = await this.createCategory(category, undefined, uploaderId);
                }
                // Check GIF count for this category
                const [countRows] = await connection.query(`SELECT COUNT(*) as count FROM gifs WHERE category_id = ?`, [categoryData.id]);
                const gifCount = parseInt((countRows[0]).count, 10);
                if (gifCount >= this.MAX_GIFS_PER_CATEGORY) {
                    throw new Error(`Category "${category}" has reached the maximum of ${this.MAX_GIFS_PER_CATEGORY} GIFs`);
                }
                // Ensure category folder exists
                const categoryFolder = path_1.default.join(this.giftFolderPath, categoryData.name);
                await this.ensureDirectory(categoryFolder);
                // Generate unique filename
                const id = (0, crypto_1.randomUUID)();
                const ext = path_1.default.extname(fileName);
                const storedFileName = `${id}${ext}`;
                const filePath = path_1.default.join(categoryFolder, storedFileName);
                // Write file
                await promises_1.default.writeFile(filePath, fileBuffer);
                // Store in database
                await connection.query(`INSERT INTO gifs (id, category_id, name, file_path, size, uploader_id, uploaded_at, description)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [id, categoryData.id, fileName, filePath, fileBuffer.length, uploaderId || null, Date.now(), "User uploaded GIF"]);
                console.log(`✅ GIF uploaded to "${category}": ${fileName} (${id})`);
                return {
                    id,
                    name: fileName,
                    path: filePath,
                    uploadedAt: Date.now(),
                    size: fileBuffer.length,
                };
            }
            finally {
                connection.release();
            }
        }
        catch (error) {
            console.error("Failed to upload GIF:", error);
            throw error;
        }
    }
    /**
     * List GIFs in a category
     */
    async listGifs(category) {
        try {
            const connection = await this.pool.getConnection();
            try {
                let query = `SELECT id, name, file_path, size, uploaded_at FROM gifs`;
                const params = [];
                if (category) {
                    query += ` WHERE category_id IN (
            SELECT id FROM gif_categories WHERE name = ?
          )`;
                    params.push(category.toLowerCase());
                }
                query += ` ORDER BY uploaded_at DESC`;
                const [rows] = await connection.query(query, params);
                return (Array.isArray(rows) ? rows : []).map((row) => ({
                    id: row.id,
                    name: row.name,
                    path: row.file_path,
                    uploadedAt: row.uploaded_at,
                    size: row.size,
                }));
            }
            finally {
                connection.release();
            }
        }
        catch (error) {
            console.error("Failed to list GIFs:", error);
            throw error;
        }
    }
    /**
     * Get random GIF from a category, optionally resized
     */
    async getRandomGif(category, width, height) {
        try {
            const connection = await this.pool.getConnection();
            try {
                let query = `SELECT id, file_path FROM gifs`;
                const params = [];
                if (category) {
                    query += ` WHERE category_id IN (
            SELECT id FROM gif_categories WHERE name = ?
          )`;
                    params.push(category.toLowerCase());
                }
                query += ` ORDER BY RAND() LIMIT 1`;
                const [rows] = await connection.query(query, params);
                if (!rows || (Array.isArray(rows) && rows.length === 0)) {
                    return null;
                }
                const row = Array.isArray(rows) ? rows[0] : rows;
                const { id, file_path } = row;
                if (!width || !height) {
                    return file_path;
                }
                // Return resized version if available
                return await this.getResizedGif(id, file_path, width, height);
            }
            finally {
                connection.release();
            }
        }
        catch (error) {
            console.error("Failed to get random GIF:", error);
            return null;
        }
    }
    /**
     * Get resized GIF, creating cache if needed
     */
    async getResizedGif(id, originalPath, width, height) {
        const cacheDir = path_1.default.join(this.resizeCachePath, `${width}x${height}`);
        const cachedPath = path_1.default.join(cacheDir, `${id}.gif`);
        // Return cached version if it exists
        try {
            await promises_1.default.access(cachedPath);
            return cachedPath;
        }
        catch {
            // Cache miss, generate resized version
        }
        try {
            await this.ensureDirectory(cacheDir);
            // Resize GIF (sharp handles animated GIFs)
            await (0, sharp_1.default)(originalPath, { animated: true })
                .resize(width, height, { fit: "inside" })
                .toFile(cachedPath);
            console.log(`✅ Resized GIF created: ${cachedPath}`);
            return cachedPath;
        }
        catch (error) {
            console.error(`Failed to resize GIF ${id}:`, error);
            return originalPath; // Fallback to original
        }
    }
    /**
     * Delete a GIF
     */
    async deleteGif(id) {
        try {
            const connection = await this.pool.getConnection();
            try {
                // Get file path from database
                const [rows] = await connection.query(`SELECT file_path FROM gifs WHERE id = ?`, [id]);
                if (!rows || (Array.isArray(rows) && rows.length === 0)) {
                    throw new Error(`GIF not found: ${id}`);
                }
                const row = Array.isArray(rows) ? rows[0] : rows;
                const { file_path } = row;
                // Delete file
                try {
                    await promises_1.default.unlink(file_path);
                    console.log(`✅ GIF file deleted: ${file_path}`);
                }
                catch (error) {
                    console.warn(`Failed to delete GIF file: ${error}`);
                    // Continue with database deletion even if file deletion fails
                }
                // Delete from database
                await connection.query(`DELETE FROM gifs WHERE id = ?`, [id]);
                // Clean up resized versions
                await this.cleanupResizedVersions(id);
                console.log(`✅ GIF deleted from database: ${id}`);
                return true;
            }
            finally {
                connection.release();
            }
        }
        catch (error) {
            console.error("Failed to delete GIF:", error);
            throw error;
        }
    }
    /**
     * Clean up all resized versions of a GIF
     */
    async cleanupResizedVersions(id) {
        try {
            const resizedRoot = this.resizeCachePath;
            const entries = await promises_1.default.readdir(resizedRoot);
            for (const sizeDir of entries) {
                const sizeRootPath = path_1.default.join(resizedRoot, sizeDir);
                const stat = await promises_1.default.stat(sizeRootPath);
                if (stat.isDirectory()) {
                    const cachedFile = path_1.default.join(sizeRootPath, `${id}.gif`);
                    try {
                        await promises_1.default.unlink(cachedFile);
                        console.log(`✅ Cleaned up resized version: ${cachedFile}`);
                    }
                    catch {
                        // File doesn't exist, continue
                    }
                }
            }
        }
        catch (error) {
            console.warn(`Failed to cleanup resized versions for ${id}:`, error);
        }
    }
    /**
     * Close database connection
     */
    async close() {
        try {
            await this.pool.end();
        }
        catch (error) {
            console.error("Failed to close database connection:", error);
        }
    }
}
exports.GifManager = GifManager;

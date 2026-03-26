import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
// @ts-ignore - sharp types not yet installed
import sharp from "sharp";
// @ts-ignore - pg types not yet installed
import { Pool } from "pg";
/**
 * GIF Manager
 * Handles GIF storage, resizing, and database persistence
 */
export class GifManager {
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
        this.resizeCachePath = path.join(this.giftFolderPath, "resized");
        this.pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: process.env.NODE_ENV === "production"
                ? { rejectUnauthorized: false }
                : false,
        });
        console.log(`📁 GIF storage path: ${this.giftFolderPath}`);
    }
    /**
     * Initialize database schema
     */
    async initDatabase() {
        try {
            await this.pool.query(`
        CREATE TABLE IF NOT EXISTS gif_categories (
          id UUID PRIMARY KEY,
          name VARCHAR(100) UNIQUE NOT NULL,
          description TEXT,
          created_by VARCHAR(255),
          created_at TIMESTAMP DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS gifs (
          id UUID PRIMARY KEY,
          category_id UUID NOT NULL REFERENCES gif_categories(id) ON DELETE CASCADE,
          name VARCHAR(255) NOT NULL,
          file_path TEXT NOT NULL,
          size INTEGER NOT NULL,
          uploader_id VARCHAR(255),
          description TEXT,
          uploaded_at BIGINT NOT NULL,
          created_at TIMESTAMP DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_gifs_category_id ON gifs(category_id);
        CREATE INDEX IF NOT EXISTS idx_gifs_uploaded_at ON gifs(uploaded_at DESC);
        CREATE INDEX IF NOT EXISTS idx_categories_name ON gif_categories(name);
      `);
            console.log("✅ GIF database schema initialized");
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
            await fs.mkdir(dirPath, { recursive: true });
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
            const id = randomUUID();
            const result = await this.pool.query(`INSERT INTO gif_categories (id, name, description, created_by)
         VALUES ($1, $2, $3, $4)
         RETURNING id, name, description`, [id, name.toLowerCase(), description || null, createdBy || null]);
            const row = result.rows[0];
            console.log(`✅ Created GIF category: ${name}`);
            // Create folder for category
            await this.ensureDirectory(path.join(this.giftFolderPath, row.name));
            return {
                id: row.id,
                name: row.name,
                description: row.description,
            };
        }
        catch (error) {
            if (error.code === "23505") {
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
            const result = await this.pool.query(`SELECT id, name, description FROM gif_categories WHERE name = $1`, [name.toLowerCase()]);
            if (result.rows.length === 0) {
                return null;
            }
            const row = result.rows[0];
            return {
                id: row.id,
                name: row.name,
                description: row.description,
            };
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
            const result = await this.pool.query(`
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
            return result.rows.map((row) => ({
                id: row.id,
                name: row.name,
                description: row.description,
                gifCount: parseInt(row.gif_count, 10),
            }));
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
            // Get or create category
            let categoryData = await this.getCategoryByName(category);
            if (!categoryData) {
                categoryData = await this.createCategory(category, undefined, uploaderId);
            }
            // Check GIF count for this category
            const countResult = await this.pool.query(`SELECT COUNT(*) as count FROM gifs WHERE category_id = $1`, [categoryData.id]);
            const gifCount = parseInt(countResult.rows[0].count, 10);
            if (gifCount >= this.MAX_GIFS_PER_CATEGORY) {
                throw new Error(`Category "${category}" has reached the maximum of ${this.MAX_GIFS_PER_CATEGORY} GIFs`);
            }
            // Ensure category folder exists
            const categoryFolder = path.join(this.giftFolderPath, categoryData.name);
            await this.ensureDirectory(categoryFolder);
            // Generate unique filename
            const id = randomUUID();
            const ext = path.extname(fileName);
            const storedFileName = `${id}${ext}`;
            const filePath = path.join(categoryFolder, storedFileName);
            // Write file
            await fs.writeFile(filePath, fileBuffer);
            // Store in database
            const result = await this.pool.query(`INSERT INTO gifs (id, category_id, name, file_path, size, uploader_id, uploaded_at, description)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id, name, file_path, size, uploaded_at`, [id, categoryData.id, fileName, filePath, fileBuffer.length, uploaderId || null, Date.now(), "User uploaded GIF"]);
            const row = result.rows[0];
            console.log(`✅ GIF uploaded to "${category}": ${fileName} (${row.id})`);
            return {
                id: row.id,
                name: row.name,
                path: row.file_path,
                uploadedAt: row.uploaded_at,
                size: row.size,
            };
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
            let query = `SELECT id, name, file_path, size, uploaded_at FROM gifs`;
            const params = [];
            if (category) {
                query += ` WHERE category_id IN (
          SELECT id FROM gif_categories WHERE name = $1
        )`;
                params.push(category.toLowerCase());
            }
            query += ` ORDER BY uploaded_at DESC`;
            const result = await this.pool.query(query, params);
            return result.rows.map((row) => ({
                id: row.id,
                name: row.name,
                path: row.file_path,
                uploadedAt: row.uploaded_at,
                size: row.size,
            }));
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
            let query = `SELECT id, file_path FROM gifs`;
            const params = [];
            if (category) {
                query += ` WHERE category_id IN (
          SELECT id FROM gif_categories WHERE name = $1
        )`;
                params.push(category.toLowerCase());
            }
            query += ` ORDER BY RANDOM() LIMIT 1`;
            const result = await this.pool.query(query, params);
            if (result.rows.length === 0) {
                return null;
            }
            const { id, file_path } = result.rows[0];
            if (!width || !height) {
                return file_path;
            }
            // Return resized version if available
            return await this.getResizedGif(id, file_path, width, height);
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
        const cacheDir = path.join(this.resizeCachePath, `${width}x${height}`);
        const cachedPath = path.join(cacheDir, `${id}.gif`);
        // Return cached version if it exists
        try {
            await fs.access(cachedPath);
            return cachedPath;
        }
        catch {
            // Cache miss, generate resized version
        }
        try {
            await this.ensureDirectory(cacheDir);
            // Resize GIF (sharp handles animated GIFs)
            await sharp(originalPath, { animated: true })
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
            // Get file path from database
            const result = await this.pool.query(`SELECT file_path FROM gifs WHERE id = $1`, [id]);
            if (result.rows.length === 0) {
                throw new Error(`GIF not found: ${id}`);
            }
            const { file_path } = result.rows[0];
            // Delete file
            try {
                await fs.unlink(file_path);
                console.log(`✅ GIF file deleted: ${file_path}`);
            }
            catch (error) {
                console.warn(`Failed to delete GIF file: ${error}`);
                // Continue with database deletion even if file deletion fails
            }
            // Delete from database
            await this.pool.query(`DELETE FROM gifs WHERE id = $1`, [id]);
            // Clean up resized versions
            await this.cleanupResizedVersions(id);
            console.log(`✅ GIF deleted from database: ${id}`);
            return true;
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
            const entries = await fs.readdir(resizedRoot);
            for (const sizeDir of entries) {
                const sizeRootPath = path.join(resizedRoot, sizeDir);
                const stat = await fs.stat(sizeRootPath);
                if (stat.isDirectory()) {
                    const cachedFile = path.join(sizeRootPath, `${id}.gif`);
                    try {
                        await fs.unlink(cachedFile);
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
        await this.pool.end();
    }
}

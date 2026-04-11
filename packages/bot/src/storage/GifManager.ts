import fs from "fs/promises";
import fsSync from "fs";
import path from "path";
import { randomUUID } from "crypto";
// @ts-ignore - sharp types not yet installed
import sharp from "sharp";
// @ts-ignore - mysql2 types not yet installed
import mysql from "mysql2/promise";
import { ImageMeta } from "@kkb/shared";

/**
 * GIF Manager
 * Handles GIF storage, resizing, and database persistence
 */

export class GifManager {
  private pool: mysql.Pool;
  private giftFolderPath: string;
  private resizeCachePath: string;
  private readonly MAX_GIFS_PER_CATEGORY = 20;
  private displayWidth: number;
  private displayHeight: number;

  constructor(giftFolderPath?: string) {
    // Use GIF_STORAGE_PATH env var (for Render disk), fall back to ./gifs
    this.giftFolderPath = giftFolderPath || process.env.GIF_STORAGE_PATH || "./gifs";
    this.resizeCachePath = path.join(this.giftFolderPath, "resized");

    // Load display dimensions from config.json, fall back to 256×256
    try {
      const configPath = path.resolve(process.cwd(), "config.json");
      const raw = fsSync.readFileSync(configPath, "utf8");
      const config = JSON.parse(raw) as { gif?: { width?: number; height?: number } };
      this.displayWidth = config?.gif?.width ?? 256;
      this.displayHeight = config?.gif?.height ?? 256;
    } catch {
      this.displayWidth = 256;
      this.displayHeight = 256;
    }

    this.pool = mysql.createPool({
      uri: process.env.DATABASE_URL,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });

    console.log(`📁 GIF storage path: ${this.giftFolderPath}`);
    console.log(`🖼️  GIF display size: ${this.displayWidth}×${this.displayHeight}`);
  }

  /**
   * Initialize database schema
   */
  async initDatabase(): Promise<void> {
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
            source_url TEXT,
            uploaded_at BIGINT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (category_id) REFERENCES gif_categories(id) ON DELETE CASCADE,
            KEY idx_gifs_category_id (category_id),
            KEY idx_gifs_uploaded_at (uploaded_at),
            KEY idx_categories_name (name)
          )
        `);

        // Add source_url column if it doesn't exist (for existing databases)
        try {
          await connection.query(`
            ALTER TABLE gifs ADD COLUMN source_url TEXT AFTER description
          `);
        } catch (err: any) {
          // Column might already exist, that's fine
          if (!err.message?.includes("Duplicate column")) {
            console.warn("Could not add source_url column:", err.message);
          }
        }

        console.log("✅ GIF database schema initialized");
      } finally {
        connection.release();
      }
    } catch (error) {
      console.error("Failed to initialize GIF database:", error);
      throw error;
    }
  }

  /**
   * Ensure a directory exists
   */
  private async ensureDirectory(dirPath: string): Promise<void> {
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch (error) {
      console.error(`Failed to create directory ${dirPath}:`, error);
      throw error;
    }
  }

  /**
   * Create a new GIF category
   */
  async createCategory(
    name: string,
    description?: string,
    createdBy?: string
  ): Promise<{ id: string; name: string; description?: string }> {
    try {
      const id = randomUUID();
      const normalizedName = name.toLowerCase();
      const connection = await this.pool.getConnection();
      try {
        console.log(`[GifManager] Creating category: ${name} (normalized: ${normalizedName})`);
        await connection.query(
          `INSERT INTO gif_categories (id, name, description, created_by)
           VALUES (?, ?, ?, ?)`,
          [id, normalizedName, description || null, createdBy || null]
        );

        console.log(`✅ Created GIF category: ${normalizedName} (ID: ${id})`);

        // Create folder for category
        await this.ensureDirectory(path.join(this.giftFolderPath, normalizedName));

        return {
          id,
          name: normalizedName,
          description,
        };
      } finally {
        connection.release();
      }
    } catch (error: any) {
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
  async getCategoryByName(name: string): Promise<{ id: string; name: string; description?: string } | null> {
    try {
      const connection = await this.pool.getConnection();
      try {
        const [rows] = await connection.query(
          `SELECT id, name, description FROM gif_categories WHERE name = ?`,
          [name.toLowerCase()]
        );

        if (!rows || (Array.isArray(rows) && rows.length === 0)) {
          return null;
        }

        const row = Array.isArray(rows) ? rows[0] : rows;
        return {
          id: (row as any).id,
          name: (row as any).name,
          description: (row as any).description,
        };
      } finally {
        connection.release();
      }
    } catch (error) {
      console.error("Failed to get category:", error);
      throw error;
    }
  }

  /**
   * List all categories
   */
  async listCategories(): Promise<Array<{ id: string; name: string; description?: string; gifCount: number }>> {
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

        const result = (Array.isArray(rows) ? rows : []).map((row: any) => ({
          id: row.id,
          name: row.name,
          description: row.description,
          gifCount: parseInt(row.gif_count, 10),
        }));
        
        console.log(`[GifManager] Found ${result.length} categories:`, result.map(c => `${c.name} (${c.gifCount} GIFs)`));
        
        return result;
      } finally {
        connection.release();
      }
    } catch (error) {
      console.error("Failed to list categories:", error);
      throw error;
    }
  }

  /**
   * Upload and store a GIF to a category
   */
  async uploadGif(
    category: string,
    fileBuffer: Buffer,
    fileName: string,
    uploaderId?: string,
    sourceUrl?: string,
    maxSizeBytes: number = 10 * 1024 * 1024
  ): Promise<ImageMeta> {
    // Validate size
    if (fileBuffer.length > maxSizeBytes) {
      throw new Error(
        `File size ${fileBuffer.length} exceeds maximum ${maxSizeBytes}`
      );
    }

    // Validate file type
    if (
      !fileName.toLowerCase().endsWith(".gif") &&
      !fileName.toLowerCase().endsWith(".png") &&
      !fileName.toLowerCase().endsWith(".jpg") &&
      !fileName.toLowerCase().endsWith(".jpeg")
    ) {
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
        const [countRows] = await connection.query(
          `SELECT COUNT(*) as count FROM gifs WHERE category_id = ?`,
          [categoryData.id]
        );
        const gifCount = parseInt(((countRows as any)[0]).count, 10);

        if (gifCount >= this.MAX_GIFS_PER_CATEGORY) {
          throw new Error(
            `Category "${category}" has reached the maximum of ${this.MAX_GIFS_PER_CATEGORY} GIFs`
          );
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
        await connection.query(
          `INSERT INTO gifs (id, category_id, name, file_path, size, uploader_id, uploaded_at, source_url, description)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [id, categoryData.id, fileName, filePath, fileBuffer.length, uploaderId || null, Date.now(), sourceUrl || null, "User uploaded GIF"]
        );

        console.log(`✅ GIF uploaded to "${category}": ${fileName}`);
        console.log(`   File path: ${filePath}`);
        console.log(`   File size: ${fileBuffer.length} bytes`);
        return {
          id,
          name: fileName,
          path: filePath,
          uploadedAt: Date.now(),
          size: fileBuffer.length,
        };
      } finally {
        connection.release();
      }
    } catch (error) {
      console.error("Failed to upload GIF:", error);
      throw error;
    }
  }

  /**
   * List GIFs in a category
   */
  async listGifs(category?: string): Promise<ImageMeta[]> {
    try {
      const connection = await this.pool.getConnection();
      try {
        let query = `SELECT id, name, file_path, size, uploaded_at FROM gifs`;
        const params: any[] = [];

        if (category) {
          query += ` WHERE category_id IN (
            SELECT id FROM gif_categories WHERE name = ?
          )`;
          params.push(category.toLowerCase());
        }

        query += ` ORDER BY uploaded_at DESC`;

        const [rows] = await connection.query(query, params);

        return (Array.isArray(rows) ? rows : []).map((row: any) => ({
          id: row.id,
          name: row.name,
          path: row.file_path,
          uploadedAt: row.uploaded_at,
          size: row.size,
        }));
      } finally {
        connection.release();
      }
    } catch (error) {
      console.error("Failed to list GIFs:", error);
      throw error;
    }
  }

  /**
   * Get random GIF from a category, optionally resized
   */
  async getRandomGif(category?: string, width?: number, height?: number): Promise<{ path: string | null; sourceUrl: string | null }> {
    try {
      const connection = await this.pool.getConnection();
      try {
        let query = `SELECT id, file_path, source_url FROM gifs`;
        const params: any[] = [];

        if (category) {
          query += ` WHERE category_id IN (
            SELECT id FROM gif_categories WHERE name = ?
          )`;
          params.push(category.toLowerCase());
        }

        query += ` ORDER BY RAND() LIMIT 1`;

        const [rows] = await connection.query(query, params);

        if (!rows || (Array.isArray(rows) && rows.length === 0)) {
          return { path: null, sourceUrl: null };
        }

        const row = Array.isArray(rows) ? rows[0] : rows;
        const { id, file_path, source_url } = row as any;

        if (!width || !height) {
          return { path: file_path, sourceUrl: source_url };
        }

        // Return resized version if available
        const resizedPath = await this.getResizedGif(id, file_path, width, height);
        return { path: resizedPath, sourceUrl: source_url };
      } finally {
        connection.release();
      }
    } catch (error) {
      console.error("Failed to get random GIF:", error);
      return { path: null, sourceUrl: null };
    }
  }

  /**
   * Resize a GIF for Discord display using the dimensions from config.json.
   * Returns the path to the resized GIF, or the original path if resizing fails.
   */
  async resizeForDisplay(id: string, filePath: string): Promise<string> {
    return this.getResizedGif(id, filePath, this.displayWidth, this.displayHeight);
  }

  /**
   * Pre-resize all GIFs in the database and populate the cache.
   * Already-cached GIFs are skipped automatically.
   */
  async preResizeAll(): Promise<{ resized: number; failed: number }> {
    const gifs = await this.listGifs();
    let resized = 0;
    let failed = 0;

    for (const gif of gifs) {
      const cacheDir = path.join(this.resizeCachePath, `${this.displayWidth}x${this.displayHeight}`);
      const cachedPath = path.join(cacheDir, `${gif.id}.gif`);

      // Skip if already cached
      try {
        await fs.access(cachedPath);
        continue;
      } catch {
        // Not cached — resize it
      }

      try {
        await this.resizeForDisplay(gif.id, gif.path);
        resized++;
      } catch {
        failed++;
      }
    }

    return { resized, failed };
  }

  /**
   * Get resized GIF, creating cache if needed
   */
  private async getResizedGif(
    id: string,
    originalPath: string,
    width: number,
    height: number
  ): Promise<string> {
    const cacheDir = path.join(this.resizeCachePath, `${width}x${height}`);
    const cachedPath = path.join(cacheDir, `${id}.gif`);

    // Return cached version if it exists
    try {
      await fs.access(cachedPath);
      return cachedPath;
    } catch {
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
    } catch (error) {
      console.error(`Failed to resize GIF ${id}:`, error);
      return originalPath; // Fallback to original
    }
  }

  /**
   * Delete a GIF
   */
  async deleteGif(id: string): Promise<boolean> {
    try {
      const connection = await this.pool.getConnection();
      try {
        // Get file path from database
        const [rows] = await connection.query(
          `SELECT file_path FROM gifs WHERE id = ?`,
          [id]
        );

        if (!rows || (Array.isArray(rows) && rows.length === 0)) {
          throw new Error(`GIF not found: ${id}`);
        }

        const row = Array.isArray(rows) ? rows[0] : rows;
        const { file_path } = row as any;

        // Delete file
        try {
          await fs.unlink(file_path);
          console.log(`✅ GIF file deleted: ${file_path}`);
        } catch (error) {
          console.warn(`Failed to delete GIF file: ${error}`);
          // Continue with database deletion even if file deletion fails
        }

        // Delete from database
        await connection.query(`DELETE FROM gifs WHERE id = ?`, [id]);

        // Clean up resized versions
        await this.cleanupResizedVersions(id);

        console.log(`✅ GIF deleted from database: ${id}`);
        return true;
      } finally {
        connection.release();
      }
    } catch (error) {
      console.error("Failed to delete GIF:", error);
      throw error;
    }
  }

  /**
   * Clean up all resized versions of a GIF
   */
  private async cleanupResizedVersions(id: string): Promise<void> {
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
          } catch {
            // File doesn't exist, continue
          }
        }
      }
    } catch (error) {
      console.warn(`Failed to cleanup resized versions for ${id}:`, error);
    }
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    try {
      await this.pool.end();
    } catch (error) {
      console.error("Failed to close database connection:", error);
    }
  }
}

import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
// @ts-ignore - sharp types not yet installed
import sharp from "sharp";
// @ts-ignore - pg types not yet installed
import { Pool } from "pg";
import { ImageMeta } from "@kkb/shared";

/**
 * GIF Manager
 * Handles GIF storage, resizing, and database persistence
 */

export class GifManager {
  private pool: Pool;
  private giftFolderPath: string;
  private resizeCachePath: string;

  constructor(giftFolderPath: string = "./gifs/welcome") {
    this.giftFolderPath = giftFolderPath;
    this.resizeCachePath = path.join(giftFolderPath, "resized");

    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl:
        process.env.NODE_ENV === "production"
          ? { rejectUnauthorized: false }
          : false,
    });
  }

  /**
   * Initialize database schema
   */
  async initDatabase(): Promise<void> {
    try {
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS gifs (
          id UUID PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          file_path TEXT NOT NULL,
          size INTEGER NOT NULL,
          uploaded_at BIGINT NOT NULL,
          description TEXT,
          created_at TIMESTAMP DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_gifs_uploaded_at ON gifs(uploaded_at DESC);
      `);
      console.log("✅ GIF database schema initialized");
    } catch (error) {
      console.error("Failed to initialize GIF database:", error);
      throw error;
    }
  }

  /**
   * Ensure directory exists
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
   * Upload and store a GIF
   */
  async uploadGif(
    fileBuffer: Buffer,
    fileName: string,
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
      await this.ensureDirectory(this.giftFolderPath);

      // Generate unique filename
      const id = randomUUID();
      const ext = path.extname(fileName);
      const storedFileName = `${id}${ext}`;
      const filePath = path.join(this.giftFolderPath, storedFileName);

      // Write file
      await fs.writeFile(filePath, fileBuffer);

      // Store in database
      const result = await this.pool.query(
        `INSERT INTO gifs (id, name, file_path, size, uploaded_at, description)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, name, file_path, size, uploaded_at`,
        [id, fileName, filePath, fileBuffer.length, Date.now(), "User uploaded GIF"]
      );

      const row = result.rows[0];
      console.log(`✅ GIF uploaded: ${fileName} (${row.id})`);

      return {
        id: row.id,
        name: row.name,
        path: row.file_path,
        uploadedAt: row.uploaded_at,
        size: row.size,
      };
    } catch (error) {
      console.error("Failed to upload GIF:", error);
      throw error;
    }
  }

  /**
   * Get all uploaded GIFs
   */
  async listGifs(): Promise<ImageMeta[]> {
    try {
      const result = await this.pool.query(
        `SELECT id, name, file_path, size, uploaded_at 
         FROM gifs 
         ORDER BY uploaded_at DESC`
      );

      return result.rows.map((row: any) => ({
        id: row.id,
        name: row.name,
        path: row.file_path,
        uploadedAt: row.uploaded_at,
        size: row.size,
      }));
    } catch (error) {
      console.error("Failed to list GIFs:", error);
      throw error;
    }
  }

  /**
   * Get random GIF, optionally resized
   */
  async getRandomGif(width?: number, height?: number): Promise<string | null> {
    try {
      const result = await this.pool.query(
        `SELECT id, file_path FROM gifs ORDER BY RANDOM() LIMIT 1`
      );

      if (result.rows.length === 0) {
        return null;
      }

      const { id, file_path } = result.rows[0];

      if (!width || !height) {
        return file_path;
      }

      // Return resized version if available
      return await this.getResizedGif(id, file_path, width, height);
    } catch (error) {
      console.error("Failed to get random GIF:", error);
      return null;
    }
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
      // Get file path from database
      const result = await this.pool.query(
        `SELECT file_path FROM gifs WHERE id = $1`,
        [id]
      );

      if (result.rows.length === 0) {
        throw new Error(`GIF not found: ${id}`);
      }

      const { file_path } = result.rows[0];

      // Delete file
      try {
        await fs.unlink(file_path);
        console.log(`✅ GIF file deleted: ${file_path}`);
      } catch (error) {
        console.warn(`Failed to delete GIF file: ${error}`);
        // Continue with database deletion even if file deletion fails
      }

      // Delete from database
      await this.pool.query(`DELETE FROM gifs WHERE id = $1`, [id]);

      // Clean up resized versions
      await this.cleanupResizedVersions(id);

      console.log(`✅ GIF deleted from database: ${id}`);
      return true;
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
    await this.pool.end();
  }
}

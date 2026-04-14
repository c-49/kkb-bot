import { randomUUID } from "crypto";
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
// @ts-ignore - mysql2 types not yet installed
import mysql from "mysql2/promise";
import { ImageMeta } from "@kkb/shared";
import path from "path";

/**
 * GIF Manager
 * Handles GIF storage via Supabase S3-compatible storage and database persistence
 */

export class GifManager {
  private pool: mysql.Pool;
  private s3: S3Client;
  private bucket: string;
  private publicUrlBase: string;
  private readonly MAX_GIFS_PER_CATEGORY = 20;

  constructor() {
    const endpoint = process.env.SUPABASE_S3_ENDPOINT;
    const accessKeyId = process.env.SUPABASE_S3_ACCESS_KEY_ID;
    const secretAccessKey = process.env.SUPABASE_S3_SECRET_ACCESS_KEY;
    this.bucket = process.env.SUPABASE_S3_BUCKET ?? "gifs";
    this.publicUrlBase = process.env.SUPABASE_PUBLIC_URL ?? "";

    if (!endpoint || !accessKeyId || !secretAccessKey || !this.publicUrlBase) {
      throw new Error(
        "Missing required Supabase S3 env vars: SUPABASE_S3_ENDPOINT, SUPABASE_S3_ACCESS_KEY_ID, SUPABASE_S3_SECRET_ACCESS_KEY, SUPABASE_PUBLIC_URL"
      );
    }

    this.s3 = new S3Client({
      forcePathStyle: true,
      region: process.env.SUPABASE_S3_REGION ?? "us-east-1",
      endpoint,
      credentials: { accessKeyId, secretAccessKey },
    });

    this.pool = mysql.createPool({
      uri: process.env.DATABASE_URL,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });

    console.log(`☁️  Supabase S3 bucket: ${this.bucket}`);
    console.log(`🌐 Public URL base: ${this.publicUrlBase}`);
  }

  /**
   * Build the public URL for an object key
   */
  private publicUrl(key: string): string {
    return `${this.publicUrlBase}/storage/v1/object/public/${this.bucket}/${key}`;
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
          await connection.query(`ALTER TABLE gifs ADD COLUMN source_url TEXT AFTER description`);
        } catch (err: any) {
          if (!err.message?.includes("Duplicate column")) {
            console.warn("Could not add source_url column:", err.message);
          }
        }

        // Drop blob_data column if it exists — files now live in Supabase
        try {
          await connection.query(`ALTER TABLE gifs DROP COLUMN blob_data`);
          console.log("✅ Dropped blob_data column (files now in Supabase Storage)");
        } catch {
          // Column didn't exist, fine
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
        await connection.query(
          `INSERT INTO gif_categories (id, name, description, created_by) VALUES (?, ?, ?, ?)`,
          [id, normalizedName, description || null, createdBy || null]
        );
        console.log(`✅ Created GIF category: ${normalizedName} (ID: ${id})`);
        return { id, name: normalizedName, description };
      } finally {
        connection.release();
      }
    } catch (error: any) {
      if (error.code === "ER_DUP_ENTRY") {
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
        if (!rows || (Array.isArray(rows) && rows.length === 0)) return null;
        const row = Array.isArray(rows) ? rows[0] : rows;
        return { id: (row as any).id, name: (row as any).name, description: (row as any).description };
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
        const [rows] = await connection.query(`
          SELECT c.id, c.name, c.description, COUNT(g.id) as gif_count
          FROM gif_categories c
          LEFT JOIN gifs g ON c.id = g.category_id
          GROUP BY c.id, c.name, c.description
          ORDER BY c.name ASC
        `);
        return (Array.isArray(rows) ? rows : []).map((row: any) => ({
          id: row.id,
          name: row.name,
          description: row.description,
          gifCount: parseInt(row.gif_count, 10),
        }));
      } finally {
        connection.release();
      }
    } catch (error) {
      console.error("Failed to list categories:", error);
      throw error;
    }
  }

  /**
   * Upload and store a GIF to Supabase S3
   */
  async uploadGif(
    category: string,
    fileBuffer: Buffer,
    fileName: string,
    uploaderId?: string,
    sourceUrl?: string,
    maxSizeBytes: number = 10 * 1024 * 1024
  ): Promise<ImageMeta> {
    if (fileBuffer.length > maxSizeBytes) {
      throw new Error(`File size ${fileBuffer.length} exceeds maximum ${maxSizeBytes}`);
    }

    const ext = path.extname(fileName).toLowerCase();
    if (![".gif", ".png", ".jpg", ".jpeg"].includes(ext)) {
      throw new Error("Only GIF, PNG, and JPG files are supported");
    }

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
        throw new Error(`Category "${category}" has reached the maximum of ${this.MAX_GIFS_PER_CATEGORY} GIFs`);
      }

      // Upload to Supabase S3
      const id = randomUUID();
      const storedFileName = `${id}${ext}`;
      const key = `${categoryData.name}/${storedFileName}`;

      const contentType = ext === ".gif" ? "image/gif"
        : ext === ".png" ? "image/png"
        : "image/jpeg";

      await this.s3.send(new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: fileBuffer,
        ContentType: contentType,
      }));

      const fileUrl = this.publicUrl(key);

      // Store metadata in database
      await connection.query(
        `INSERT INTO gifs (id, category_id, name, file_path, size, uploader_id, uploaded_at, source_url, description)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, categoryData.id, fileName, fileUrl, fileBuffer.length, uploaderId || null, Date.now(), sourceUrl || null, "User uploaded GIF"]
      );

      console.log(`✅ GIF uploaded to Supabase "${category}": ${fileName}`);
      console.log(`   URL: ${fileUrl}`);
      return { id, name: fileName, path: fileUrl, uploadedAt: Date.now(), size: fileBuffer.length };
    } finally {
      connection.release();
    }
  }

  /**
   * List GIFs in a category
   */
  async listGifs(category?: string): Promise<ImageMeta[]> {
    try {
      const connection = await this.pool.getConnection();
      try {
        let query = `SELECT id, name, file_path, size, uploaded_at, source_url FROM gifs`;
        const params: any[] = [];
        if (category) {
          query += ` WHERE category_id IN (SELECT id FROM gif_categories WHERE name = ?)`;
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
          sourceUrl: row.source_url ?? undefined,
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
   * Get random GIF from a category
   * Returns sourceUrl (Tenor) if available, otherwise the Supabase storage URL
   */
  async getRandomGif(category?: string): Promise<{ url: string | null; sourceUrl: string | null }> {
    try {
      const connection = await this.pool.getConnection();
      try {
        let query = `SELECT id, file_path, source_url FROM gifs`;
        const params: any[] = [];
        if (category) {
          query += ` WHERE category_id IN (SELECT id FROM gif_categories WHERE name = ?)`;
          params.push(category.toLowerCase());
        }
        query += ` ORDER BY RAND() LIMIT 1`;
        const [rows] = await connection.query(query, params);
        if (!rows || (Array.isArray(rows) && rows.length === 0)) {
          return { url: null, sourceUrl: null };
        }
        const row = Array.isArray(rows) ? rows[0] : rows;
        return {
          url: (row as any).file_path,
          sourceUrl: (row as any).source_url ?? null,
        };
      } finally {
        connection.release();
      }
    } catch (error) {
      console.error("Failed to get random GIF:", error);
      return { url: null, sourceUrl: null };
    }
  }

  /**
   * Delete a GIF (from Supabase S3 and database)
   */
  async deleteGif(id: string): Promise<boolean> {
    const connection = await this.pool.getConnection();
    try {
      const [rows] = await connection.query(`SELECT file_path FROM gifs WHERE id = ?`, [id]);
      if (!rows || (Array.isArray(rows) && rows.length === 0)) {
        throw new Error(`GIF not found: ${id}`);
      }
      const row = Array.isArray(rows) ? rows[0] : rows;
      const fileUrl: string = (row as any).file_path;

      // Derive the S3 key from the stored public URL
      const publicPrefix = `${this.publicUrlBase}/storage/v1/object/public/${this.bucket}/`;
      if (fileUrl.startsWith(publicPrefix)) {
        const key = fileUrl.slice(publicPrefix.length);
        try {
          await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
          console.log(`✅ Deleted from Supabase S3: ${key}`);
        } catch (err) {
          console.warn(`Failed to delete S3 object: ${err}`);
        }
      }

      await connection.query(`DELETE FROM gifs WHERE id = ?`, [id]);
      console.log(`✅ GIF deleted from database: ${id}`);
      return true;
    } finally {
      connection.release();
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

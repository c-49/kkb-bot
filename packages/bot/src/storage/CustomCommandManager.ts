// @ts-ignore - mysql2 types not yet installed
import mysql from "mysql2/promise";
import { randomUUID } from "crypto";
import { SlashCommandBuilder } from "discord.js";

export interface CustomCommand {
  id: string;
  name: string;
  description: string;
  textTemplate: string; // e.g. "{user} hugged {target}! 🤗"
  gifCategory: string | null;
  hasTarget: boolean;
  createdBy: string | null;
  createdAt: number;
}

export class CustomCommandManager {
  private pool: mysql.Pool;

  constructor() {
    this.pool = mysql.createPool({
      uri: process.env.DATABASE_URL,
      waitForConnections: true,
      connectionLimit: 5,
      queueLimit: 0,
    });
  }

  async initDatabase(): Promise<void> {
    const connection = await this.pool.getConnection();
    try {
      await connection.query(`
        CREATE TABLE IF NOT EXISTS custom_commands (
          id CHAR(36) PRIMARY KEY,
          name VARCHAR(32) UNIQUE NOT NULL,
          description VARCHAR(100) NOT NULL,
          text_template TEXT NOT NULL,
          gif_category VARCHAR(100),
          has_target BOOLEAN NOT NULL DEFAULT FALSE,
          created_by VARCHAR(255),
          created_at BIGINT NOT NULL
        )
      `);
      console.log("✅ Custom commands table ready");
    } finally {
      connection.release();
    }
  }

  async createCommand(
    name: string,
    description: string,
    textTemplate: string,
    gifCategory: string | null,
    hasTarget: boolean,
    createdBy?: string
  ): Promise<CustomCommand> {
    const id = randomUUID();
    const now = Date.now();
    const safeName = name.toLowerCase().replace(/[^a-z0-9_-]/g, "");

    if (!safeName) {
      throw new Error("Command name must contain only letters, numbers, hyphens, or underscores.");
    }

    const connection = await this.pool.getConnection();
    try {
      await connection.query(
        `INSERT INTO custom_commands
           (id, name, description, text_template, gif_category, has_target, created_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, safeName, description, textTemplate, gifCategory ?? null, hasTarget, createdBy ?? null, now]
      );
      return { id, name: safeName, description, textTemplate, gifCategory, hasTarget, createdBy: createdBy ?? null, createdAt: now };
    } catch (err: any) {
      if (err.code === "ER_DUP_ENTRY") {
        throw new Error(`A command named "/${safeName}" already exists.`);
      }
      throw err;
    } finally {
      connection.release();
    }
  }

  async deleteCommand(name: string): Promise<boolean> {
    const connection = await this.pool.getConnection();
    try {
      const [result] = await connection.query(
        `DELETE FROM custom_commands WHERE name = ?`,
        [name.toLowerCase()]
      );
      return (result as any).affectedRows > 0;
    } finally {
      connection.release();
    }
  }

  async getCommand(name: string): Promise<CustomCommand | null> {
    const connection = await this.pool.getConnection();
    try {
      const [rows] = await connection.query(
        `SELECT * FROM custom_commands WHERE name = ?`,
        [name.toLowerCase()]
      );
      const row = Array.isArray(rows) && rows.length > 0 ? (rows[0] as any) : null;
      return row ? this.rowToCommand(row) : null;
    } finally {
      connection.release();
    }
  }

  async listCommands(): Promise<CustomCommand[]> {
    const connection = await this.pool.getConnection();
    try {
      const [rows] = await connection.query(
        `SELECT * FROM custom_commands ORDER BY name ASC`
      );
      return (Array.isArray(rows) ? rows : []).map((r: any) => this.rowToCommand(r));
    } finally {
      connection.release();
    }
  }

  /**
   * Replace {user} and {target} slots with Discord mentions.
   */
  renderText(template: string, userId: string, targetId?: string): string {
    let text = template.replace(/\{user\}/gi, `<@${userId}>`);
    if (targetId) {
      text = text.replace(/\{target\}/gi, `<@${targetId}>`);
    }
    return text;
  }

  /**
   * Build the Discord API JSON for this command.
   */
  toDiscordCommand(cmd: CustomCommand): any {
    const builder = new SlashCommandBuilder()
      .setName(cmd.name)
      .setDescription(cmd.description);

    if (cmd.hasTarget) {
      builder.addUserOption((opt) =>
        opt
          .setName("target")
          .setDescription("The user to target")
          .setRequired(true)
      );
    }

    return builder.toJSON();
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  private rowToCommand(row: any): CustomCommand {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      textTemplate: row.text_template,
      gifCategory: row.gif_category ?? null,
      hasTarget: Boolean(row.has_target),
      createdBy: row.created_by ?? null,
      createdAt: Number(row.created_at),
    };
  }
}

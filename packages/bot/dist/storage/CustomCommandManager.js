"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomCommandManager = void 0;
// @ts-ignore - mysql2 types not yet installed
const promise_1 = __importDefault(require("mysql2/promise"));
const crypto_1 = require("crypto");
const discord_js_1 = require("discord.js");
class CustomCommandManager {
    constructor() {
        Object.defineProperty(this, "pool", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.pool = promise_1.default.createPool({
            uri: process.env.DATABASE_URL,
            waitForConnections: true,
            connectionLimit: 5,
            queueLimit: 0,
        });
    }
    async initDatabase() {
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
        }
        finally {
            connection.release();
        }
    }
    async createCommand(name, description, textTemplate, gifCategory, hasTarget, createdBy) {
        const id = (0, crypto_1.randomUUID)();
        const now = Date.now();
        const safeName = name.toLowerCase().replace(/[^a-z0-9_-]/g, "");
        if (!safeName) {
            throw new Error("Command name must contain only letters, numbers, hyphens, or underscores.");
        }
        const connection = await this.pool.getConnection();
        try {
            await connection.query(`INSERT INTO custom_commands
           (id, name, description, text_template, gif_category, has_target, created_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [id, safeName, description, textTemplate, gifCategory ?? null, hasTarget, createdBy ?? null, now]);
            return { id, name: safeName, description, textTemplate, gifCategory, hasTarget, createdBy: createdBy ?? null, createdAt: now };
        }
        catch (err) {
            if (err.code === "ER_DUP_ENTRY") {
                throw new Error(`A command named "/${safeName}" already exists.`);
            }
            throw err;
        }
        finally {
            connection.release();
        }
    }
    async deleteCommand(name) {
        const connection = await this.pool.getConnection();
        try {
            const [result] = await connection.query(`DELETE FROM custom_commands WHERE name = ?`, [name.toLowerCase()]);
            return result.affectedRows > 0;
        }
        finally {
            connection.release();
        }
    }
    async getCommand(name) {
        const connection = await this.pool.getConnection();
        try {
            const [rows] = await connection.query(`SELECT * FROM custom_commands WHERE name = ?`, [name.toLowerCase()]);
            const row = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
            return row ? this.rowToCommand(row) : null;
        }
        finally {
            connection.release();
        }
    }
    async listCommands() {
        const connection = await this.pool.getConnection();
        try {
            const [rows] = await connection.query(`SELECT * FROM custom_commands ORDER BY name ASC`);
            return (Array.isArray(rows) ? rows : []).map((r) => this.rowToCommand(r));
        }
        finally {
            connection.release();
        }
    }
    /**
     * Replace {user} and {target} slots with Discord mentions.
     */
    renderText(template, userId, targetId) {
        let text = template.replace(/\{user\}/gi, `<@${userId}>`);
        if (targetId) {
            text = text.replace(/\{target\}/gi, `<@${targetId}>`);
        }
        return text;
    }
    /**
     * Build the Discord API JSON for this command.
     */
    toDiscordCommand(cmd) {
        const builder = new discord_js_1.SlashCommandBuilder()
            .setName(cmd.name)
            .setDescription(cmd.description);
        if (cmd.hasTarget) {
            builder.addUserOption((opt) => opt
                .setName("target")
                .setDescription("The user to target")
                .setRequired(true));
        }
        return builder.toJSON();
    }
    async close() {
        await this.pool.end();
    }
    rowToCommand(row) {
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
exports.CustomCommandManager = CustomCommandManager;

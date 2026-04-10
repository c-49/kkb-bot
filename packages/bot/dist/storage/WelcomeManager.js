import { DEFAULT_WELCOME_SETTINGS, } from "@kkb/shared";
import * as fs from "fs/promises";
import * as path from "path";
import { randomUUID } from "crypto";
const CONFIG_PATH = "./welcome-config.json";
export class WelcomeManager {
    constructor(initialSettings) {
        Object.defineProperty(this, "settings", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "gifs", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: {}
        });
        this.settings = {
            ...DEFAULT_WELCOME_SETTINGS,
            ...initialSettings,
        };
    }
    static async load() {
        try {
            const data = await fs.readFile(CONFIG_PATH, "utf-8");
            const config = JSON.parse(data);
            const manager = new WelcomeManager(config.settings);
            manager.gifs = config.gifs || {};
            return manager;
        }
        catch (err) {
            console.log("No existing welcome config found, using defaults");
            return new WelcomeManager();
        }
    }
    get() {
        return { ...this.settings };
    }
    async update(partial) {
        this.settings = {
            ...this.settings,
            ...partial,
        };
        await this.persist();
    }
    /**
     * Register an uploaded GIF
     */
    async addGif(filename, filepath, size) {
        const id = randomUUID();
        const meta = {
            id,
            name: filename,
            path: filepath,
            uploadedAt: Date.now(),
            size,
        };
        this.gifs[id] = meta;
        await this.persist();
        return meta;
    }
    /**
     * Delete a GIF
     */
    async deleteGif(id) {
        const gif = this.gifs[id];
        if (!gif)
            return false;
        try {
            await fs.unlink(gif.path);
        }
        catch (err) {
            console.warn(`Failed to delete GIF file at ${gif.path}:`, err);
        }
        delete this.gifs[id];
        await this.persist();
        return true;
    }
    /**
     * Get all GIFs
     */
    listGifs() {
        return Object.values(this.gifs);
    }
    /**
     * Get a random GIF (for greeting)
     */
    getRandomGif() {
        const gifs = this.listGifs();
        if (gifs.length === 0)
            return null;
        return gifs[Math.floor(Math.random() * gifs.length)];
    }
    async persist() {
        const dir = path.dirname(CONFIG_PATH);
        await fs.mkdir(dir, { recursive: true });
        const config = {
            settings: this.settings,
            gifs: this.gifs,
        };
        await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2));
    }
}

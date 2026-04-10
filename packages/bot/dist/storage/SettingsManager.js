import { DEFAULT_BOT_SETTINGS } from "@kkb/shared";
import * as fs from "fs/promises";
import * as path from "path";
const CONFIG_PATH = "./bot-config.json";
/**
 * Settings manager
 * Persists bot settings to disk
 */
export class SettingsManager {
    constructor(initialSettings) {
        Object.defineProperty(this, "settings", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.settings = {
            ...DEFAULT_BOT_SETTINGS,
            ...initialSettings,
        };
    }
    static async load() {
        try {
            const data = await fs.readFile(CONFIG_PATH, "utf-8");
            const settings = JSON.parse(data);
            return new SettingsManager(settings);
        }
        catch (err) {
            console.log("No existing config found, using defaults");
            return new SettingsManager();
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
    async persist() {
        const dir = path.dirname(CONFIG_PATH);
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(CONFIG_PATH, JSON.stringify(this.settings, null, 2));
    }
}

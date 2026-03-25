import { BotSettings, DEFAULT_BOT_SETTINGS } from "@kkb/shared";
import * as fs from "fs/promises";
import * as path from "path";

const CONFIG_PATH = "./bot-config.json";

/**
 * Settings manager
 * Persists bot settings to disk
 */

export class SettingsManager {
  private settings: BotSettings;

  constructor(initialSettings?: Partial<BotSettings>) {
    this.settings = {
      ...DEFAULT_BOT_SETTINGS,
      ...initialSettings,
    };
  }

  static async load(): Promise<SettingsManager> {
    try {
      const data = await fs.readFile(CONFIG_PATH, "utf-8");
      const settings = JSON.parse(data);
      return new SettingsManager(settings);
    } catch (err) {
      console.log("No existing config found, using defaults");
      return new SettingsManager();
    }
  }

  get(): BotSettings {
    return { ...this.settings };
  }

  async update(partial: Partial<BotSettings>): Promise<void> {
    this.settings = {
      ...this.settings,
      ...partial,
    };
    await this.persist();
  }

  private async persist(): Promise<void> {
    const dir = path.dirname(CONFIG_PATH);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(CONFIG_PATH, JSON.stringify(this.settings, null, 2));
  }
}

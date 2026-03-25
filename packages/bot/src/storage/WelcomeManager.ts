import {
  WelcomeSettings,
  DEFAULT_WELCOME_SETTINGS,
  ImageMeta,
} from "@kkb/shared";
import * as fs from "fs/promises";
import * as path from "path";
import { randomUUID } from "crypto";

const CONFIG_PATH = "./welcome-config.json";

/**
 * Welcome settings & GIF management
 * Handles greeting configuration and GIF uploads
 */

interface GifRegistry {
  [id: string]: ImageMeta;
}

export class WelcomeManager {
  private settings: WelcomeSettings;
  private gifs: GifRegistry = {};

  constructor(initialSettings?: Partial<WelcomeSettings>) {
    this.settings = {
      ...DEFAULT_WELCOME_SETTINGS,
      ...initialSettings,
    };
  }

  static async load(): Promise<WelcomeManager> {
    try {
      const data = await fs.readFile(CONFIG_PATH, "utf-8");
      const config = JSON.parse(data);
      const manager = new WelcomeManager(config.settings);
      manager.gifs = config.gifs || {};
      return manager;
    } catch (err) {
      console.log("No existing welcome config found, using defaults");
      return new WelcomeManager();
    }
  }

  get(): WelcomeSettings {
    return { ...this.settings };
  }

  async update(partial: Partial<WelcomeSettings>): Promise<void> {
    this.settings = {
      ...this.settings,
      ...partial,
    };
    await this.persist();
  }

  /**
   * Register an uploaded GIF
   */
  async addGif(filename: string, filepath: string, size: number): Promise<ImageMeta> {
    const id = randomUUID();
    const meta: ImageMeta = {
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
  async deleteGif(id: string): Promise<boolean> {
    const gif = this.gifs[id];
    if (!gif) return false;

    try {
      await fs.unlink(gif.path);
    } catch (err) {
      console.warn(`Failed to delete GIF file at ${gif.path}:`, err);
    }

    delete this.gifs[id];
    await this.persist();
    return true;
  }

  /**
   * Get all GIFs
   */
  listGifs(): ImageMeta[] {
    return Object.values(this.gifs);
  }

  /**
   * Get a random GIF (for greeting)
   */
  getRandomGif(): ImageMeta | null {
    const gifs = this.listGifs();
    if (gifs.length === 0) return null;
    return gifs[Math.floor(Math.random() * gifs.length)];
  }

  private async persist(): Promise<void> {
    const dir = path.dirname(CONFIG_PATH);
    await fs.mkdir(dir, { recursive: true });
    const config = {
      settings: this.settings,
      gifs: this.gifs,
    };
    await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2));
  }
}

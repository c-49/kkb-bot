"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.WelcomeManager = void 0;
const shared_1 = require("@kkb/shared");
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const crypto_1 = require("crypto");
const CONFIG_PATH = "./welcome-config.json";
class WelcomeManager {
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
            ...shared_1.DEFAULT_WELCOME_SETTINGS,
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
        const id = (0, crypto_1.randomUUID)();
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
exports.WelcomeManager = WelcomeManager;

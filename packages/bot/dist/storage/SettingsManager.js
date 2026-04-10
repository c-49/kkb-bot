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
exports.SettingsManager = void 0;
const shared_1 = require("@kkb/shared");
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const CONFIG_PATH = "./bot-config.json";
/**
 * Settings manager
 * Persists bot settings to disk
 */
class SettingsManager {
    constructor(initialSettings) {
        Object.defineProperty(this, "settings", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.settings = {
            ...shared_1.DEFAULT_BOT_SETTINGS,
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
exports.SettingsManager = SettingsManager;

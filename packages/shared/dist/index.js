"use strict";
/**
 * Command System
 * Base types and interfaces for the extensible command system
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_WELCOME_SETTINGS = exports.DEFAULT_BOT_SETTINGS = void 0;
exports.createCommandName = createCommandName;
function createCommandName(name) {
    if (!name.trim()) {
        throw new Error("Command name cannot be empty");
    }
    return name.toLowerCase();
}
exports.DEFAULT_BOT_SETTINGS = {
    prefix: "!",
    enabledCommands: [],
    maxImageSize: 5 * 1024 * 1024, // 5MB
    imageUploadPath: "./uploads",
};
exports.DEFAULT_WELCOME_SETTINGS = {
    enabled: false,
    channelId: "",
    greetingMessage: "Welcome {newUser}! 🎉",
    gifMaxSize: 10 * 1024 * 1024, // 10MB default
    gifFolderPath: "./gifs/welcome",
};
//# sourceMappingURL=index.js.map
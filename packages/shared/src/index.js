/**
 * Command System
 * Base types and interfaces for the extensible command system
 */
export function createCommandName(name) {
    if (!name.trim()) {
        throw new Error("Command name cannot be empty");
    }
    return name.toLowerCase();
}
export const DEFAULT_BOT_SETTINGS = {
    prefix: "!",
    enabledCommands: [],
    maxImageSize: 5 * 1024 * 1024, // 5MB
    imageUploadPath: "./uploads",
};
export const DEFAULT_WELCOME_SETTINGS = {
    enabled: false,
    channelId: "",
    greetingMessage: "Welcome {newUser}! 🎉",
    gifMaxSize: 10 * 1024 * 1024, // 10MB default
    gifFolderPath: "./gifs/welcome",
};

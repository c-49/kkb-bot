/**
 * Root entry point for Sparked Host
 * Bootstraps the bot from the built distribution
 */
import('./packages/bot/dist/index.js').catch((err) => {
  console.error('Failed to start bot:', err);
  process.exit(1);
});
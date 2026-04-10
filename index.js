/**
 * Root entry point for Pterodactyl Panel
 * Bootstraps the bot from the built distribution
 */
import fs from 'fs';
import { execSync } from 'child_process';

// Check if dist folder exists, if not build it
const distPath = './packages/bot/dist/index.js';
if (!fs.existsSync(distPath)) {
  console.log('📦 Building TypeScript files...');
  try {
    execSync('npm install', { stdio: 'inherit' });
    execSync('npm run build', { stdio: 'inherit' });
  } catch (error) {
    console.error('Build failed:', error.message);
    process.exit(1);
  }
}

// Start the bot
try {
  await import('./packages/bot/dist/index.js');
} catch (err) {
  console.error('Failed to start bot:', err);
  process.exit(1);
}
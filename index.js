/**
 * Root entry point for Pterodactyl Panel
 * Bootstraps the bot from the built distribution (CommonJS for Node v12 compatibility)
 */
const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

// Check if dist folder exists, if not build it
const distPath = path.join(__dirname, 'packages/bot/dist/index.js');
if (!fs.existsSync(distPath)) {
  console.log('📦 Building TypeScript files...');
  try {
    execSync('npm install', { stdio: 'inherit', cwd: __dirname });
    execSync('npm run build', { stdio: 'inherit', cwd: __dirname });
  } catch (error) {
    console.error('Build failed:', error.message);
    process.exit(1);
  }
}

// Start the bot using dynamic require (for CommonJS compatibility)
try {
  require(distPath);
} catch (err) {
  console.error('Failed to start bot:', err);
  process.exit(1);
}
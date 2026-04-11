/**
 * Root entry point for Pterodactyl Panel
 * Bootstraps the bot from the built distribution (CommonJS for Node v12 compatibility)
 */
const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

// Check if dist folder exists and critical dependencies are available
const distPath = path.join(__dirname, 'packages/bot/dist/index.js');
const dotenvPath = path.join(__dirname, 'node_modules', 'dotenv');
const lockFilePath = path.join(__dirname, 'package-lock.json');
const needsBuild = !fs.existsSync(distPath) || !fs.existsSync(dotenvPath);

if (needsBuild) {
  console.log('📦 Installing dependencies and building TypeScript files...');
  try {
    // If dotenv is missing but package.json has it, regenerate lock file
    if (!fs.existsSync(dotenvPath) && fs.existsSync(lockFilePath)) {
      console.log('⚠️  Removing stale package-lock.json to regenerate dependencies...');
      fs.unlinkSync(lockFilePath);
    }
    
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
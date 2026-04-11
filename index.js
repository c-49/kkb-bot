/**
 * Root entry point for Pterodactyl Panel
 * Bootstraps the bot from the built distribution (CommonJS for Node v12 compatibility)
 */
const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

// Check if dist folder exists and critical dependencies are available
const distPath = path.join(__dirname, 'packages/bot/dist/index.js');
const lockFilePath = path.join(__dirname, 'package-lock.json');

// Check if critical packages exist
const criticalModules = ['dotenv', 'discord.js', 'express'];
const missingModules = criticalModules.filter(mod => 
  !fs.existsSync(path.join(__dirname, 'node_modules', mod))
);

const needsBuild = !fs.existsSync(distPath) || missingModules.length > 0;

if (needsBuild) {
  console.log('📦 Installing dependencies and building TypeScript files...');
  
  if (missingModules.length > 0) {
    console.log(`⚠️  Missing modules: ${missingModules.join(', ')}`);
    console.log('⚠️  Removing stale package-lock.json to regenerate dependencies...');
    if (fs.existsSync(lockFilePath)) {
      fs.unlinkSync(lockFilePath);
    }
  }
  
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
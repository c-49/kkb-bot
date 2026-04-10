// index.js (at root)
const path = require('path');
const { execSync } = require('child_process');

// Build the bot
console.log('Building bot...');
try {
  execSync('npm run build', { 
    cwd: __dirname,
    stdio: 'inherit'
  });
  console.log('Build complete!');
} catch (error) {
  console.error('Build failed:', error);
  process.exit(1);
}

// Start the bot
console.log('Starting bot...');
require('./packages/bot/dist/bot.js');
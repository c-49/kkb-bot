// index.js at root
const { execSync } = require('child_process');

console.log('Installing dependencies and building...');
try {
  execSync('npm install', { stdio: 'inherit' });
  execSync('npm run build', { stdio: 'inherit' });
} catch (error) {
  console.error('Build failed:', error.message);
  process.exit(1);
}

console.log('Starting bot...');
require('./packages/bot/dist/bot.js');
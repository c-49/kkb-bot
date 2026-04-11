'use strict';

/**
 * Pre-resize build script
 * Runs as part of `npm run build` to populate the resize cache before the bot starts.
 * Mirrors the approach used in honey-bear-bot.
 *
 * Only processes GIFs not already in the cache — safe to run repeatedly.
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

// Load dimensions from config.json
const configPath = path.join(__dirname, '../config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const WIDTH = config?.gif?.width ?? 256;
const HEIGHT = config?.gif?.height ?? 256;
const ENABLED = config?.gif?.enabled !== false; // default true

if (!ENABLED) {
  console.log('[preresize] GIF resizing disabled in config.json — skipping.');
  process.exit(0);
}

// Resolve gifs directory — env var takes priority (for Render disk etc.)
const GIFS_DIR = process.env.GIF_STORAGE_PATH
  ? path.resolve(process.env.GIF_STORAGE_PATH)
  : path.join(__dirname, '../../../gifs');

const CACHE_DIR = path.join(GIFS_DIR, 'resized', `${WIDTH}x${HEIGHT}`);

async function resizeGif(srcPath, dstPath) {
  try {
    await sharp(srcPath, { animated: true })
      .resize(WIDTH, HEIGHT, { fit: 'inside' })
      .gif()
      .toFile(dstPath);
    return true;
  } catch (err) {
    console.error(`    ✗ ${err.message}`);
    return false;
  }
}

async function main() {
  if (!fs.existsSync(GIFS_DIR)) {
    console.log(`[preresize] GIFs directory not found at ${GIFS_DIR} — skipping.`);
    return;
  }

  fs.mkdirSync(CACHE_DIR, { recursive: true });

  console.log(`[preresize] Resizing GIFs to ${WIDTH}x${HEIGHT} → ${CACHE_DIR}`);

  let resized = 0;
  let skipped = 0;
  let failed = 0;

  const entries = fs.readdirSync(GIFS_DIR, { withFileTypes: true });

  for (const entry of entries) {
    // Skip the resized cache folder and non-directories
    if (!entry.isDirectory() || entry.name === 'resized') continue;

    const categoryDir = path.join(GIFS_DIR, entry.name);
    const files = fs.readdirSync(categoryDir).filter(f => f.toLowerCase().endsWith('.gif'));

    for (const file of files) {
      const srcPath = path.join(categoryDir, file);
      const dstPath = path.join(CACHE_DIR, file);

      if (fs.existsSync(dstPath)) {
        skipped++;
        continue;
      }

      process.stdout.write(`  ${entry.name}/${file} ... `);
      const ok = await resizeGif(srcPath, dstPath);
      if (ok) {
        console.log('✓');
        resized++;
      } else {
        failed++;
      }
    }
  }

  console.log(`[preresize] Done: ${resized} resized, ${skipped} already cached, ${failed} failed.`);
  if (failed > 0) process.exit(1);
}

main().catch(err => {
  console.error('[preresize] Fatal error:', err);
  process.exit(1);
});

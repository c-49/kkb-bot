#!/usr/bin/env node

/**
 * Pre-resize GIFs Script
 * Batch resizes all GIFs to cache directories for instant responses
 * 
 * Usage: node scripts/resizeGifs.ts
 */

import fs from "fs/promises";
import path from "path";
// @ts-ignore - sharp types not yet installed
import sharp from "sharp";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface Config {
  gif?: {
    width: number;
    height: number;
  };
}

// Load config
let config: Config = { gif: { width: 256, height: 256 } };

try {
  const configPath = path.join(__dirname, "..", "config.json");
  const configContent = await fs.readFile(configPath, "utf-8");
  config = JSON.parse(configContent);
} catch {
  console.warn("⚠️  No config.json found, using defaults");
}

const WIDTH = config.gif?.width || 256;
const HEIGHT = config.gif?.height || 256;
const GIF_FOLDERS = ["./gifs/welcome", "./gifs/bonk", "./gifs/hug", "./gifs/pet"];

interface GifFile {
  folder: string;
  fileName: string;
  fullPath: string;
}

/**
 * Find all GIF files
 */
async function findGifs(): Promise<GifFile[]> {
  const gifs: GifFile[] = [];

  for (const folder of GIF_FOLDERS) {
    try {
      await fs.access(folder);
      const files = await fs.readdir(folder);

      for (const file of files) {
        if (
          file.toLowerCase().endsWith(".gif") ||
          file.toLowerCase().endsWith(".png") ||
          file.toLowerCase().endsWith(".jpg") ||
          file.toLowerCase().endsWith(".jpeg")
        ) {
          gifs.push({
            folder,
            fileName: file,
            fullPath: path.join(folder, file),
          });
        }
      }
    } catch {
      // Folder doesn't exist yet, skip
    }
  }

  return gifs;
}

/**
 * Resize a single GIF
 */
async function resizeGif(srcPath: string, dstPath: string): Promise<boolean> {
  try {
    await sharp(srcPath, { animated: true })
      .resize(WIDTH, HEIGHT, { fit: "inside" })
      .toFile(dstPath);
    return true;
  } catch (error) {
    console.error(`  ❌ Error: ${error instanceof Error ? error.message : "Unknown error"}`);
    return false;
  }
}

/**
 * Main
 */
async function main(): Promise<void> {
  console.log("📦 GIF Pre-resize Script");
  console.log(`Target size: ${WIDTH}x${HEIGHT}`);
  console.log(`Using sharp for resizing`);
  console.log("");

  const gifs = await findGifs();

  if (gifs.length === 0) {
    console.warn("⚠️  No GIFs found in folders");
    process.exit(0);
  }

  console.log(`Found ${gifs.length} GIF(s). Processing...`);
  console.log("");

  let processed = 0;
  let skipped = 0;
  let failed = 0;

  for (const gif of gifs) {
    const cacheDir = path.join(gif.folder, "resized", `${WIDTH}x${HEIGHT}`);
    const dstPath = path.join(cacheDir, gif.fileName);

    try {
      await fs.mkdir(cacheDir, { recursive: true });
    } catch (error) {
      console.error(`❌ Failed to create cache dir: ${error}`);
      failed++;
      continue;
    }

    // Skip if already cached
    try {
      await fs.access(dstPath);
      console.log(`⊘ ${gif.folder}/${gif.fileName} (already cached)`);
      skipped++;
      continue;
    } catch {
      // File doesn't exist, proceed with resize
    }

    console.log(`⏳ ${gif.folder}/${gif.fileName}...`);
    if (await resizeGif(gif.fullPath, dstPath)) {
      console.log(
        `✓ ${gif.folder}/${gif.fileName} → ${WIDTH}x${HEIGHT}`
      );
      processed++;
    } else {
      failed++;
    }
  }

  console.log("");
  console.log(`Summary: ${processed} processed, ${skipped} skipped, ${failed} failed.`);

  if (failed === 0) {
    console.log("✓ Pre-resize complete!");
    process.exit(0);
  } else {
    console.warn("⚠️  Some GIFs failed to resize.");
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

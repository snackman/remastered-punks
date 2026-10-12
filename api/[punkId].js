import { createCanvas, loadImage } from '@napi-rs/canvas';
import { readFileSync } from 'fs';
import { join } from 'path';

import { createCompositor } from '../lib/compositor.js';
import { createStackCompositor } from '../lib/stack-compositor.js';
import { SPRITE_SIZE } from '../lib/constants.js';

// Cached data
let spriteSheet = null;
let punkData = null;
let eligiblePunks = null;

// Shared compositor bound to the napi canvas + the cached spritesheet.
const gfx = createCompositor({
  createCanvas: (w, h) => createCanvas(w, h),
  getSpriteSheet: () => spriteSheet,
});

// The stacking compositor needs the sprite sheet + full punk map up front, so it's
// built lazily on the first request once both are cached.
let stack = null;
function getStack() {
  if (!stack && spriteSheet && punkData) {
    stack = createStackCompositor({
      createCanvas: (w, h) => createCanvas(w, h),
      getSpriteSheet: () => spriteSheet,
      punks: punkData,
    });
  }
  return stack;
}

// Load sprite sheet
async function loadSpriteSheet(path) {
  if (!spriteSheet) {
    spriteSheet = await loadImage(path);
  }
  return spriteSheet;
}

// Load punk CSV data
function loadPunkData(csvPath) {
  if (punkData) return punkData;

  const text = readFileSync(csvPath, 'utf-8');
  const lines = text.trim().replace(/\r\n/g, '\n').split('\n');
  punkData = {};

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const match = line.match(/^(\d+),\s*(\w+),\s*(\w+),\s*(\w*),\s*(\d+),\s*(.*)$/);
    if (match) {
      const id = parseInt(match[1]);
      const type = match[2];
      const gender = match[3];
      const skinTone = match[4] || null;
      const accessoriesStr = match[6].trim();
      const accessories = accessoriesStr ? accessoriesStr.split(' / ').map(a => a.trim()) : [];
      punkData[id] = { id, type, gender, skinTone, accessories };
    }
  }
  return punkData;
}

// Load eligible punks
function loadEligiblePunks(jsonPath) {
  if (eligiblePunks) return eligiblePunks;
  const text = readFileSync(jsonPath, 'utf-8');
  eligiblePunks = new Set(JSON.parse(text));
  return eligiblePunks;
}

// Scale canvas with nearest neighbor
function scaleCanvas(sourceCanvas, targetSize) {
  const scaled = createCanvas(targetSize, targetSize);
  const ctx = scaled.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(sourceCanvas, 0, 0, targetSize, targetSize);
  return scaled;
}

// Vercel serverless handler
export default async function handler(req, res) {
  const { punkId, size } = req.query;
  const id = parseInt(punkId);

  // Validate punk ID
  if (isNaN(id) || id < 0 || id > 9999) {
    return res.status(400).json({ error: 'Invalid punk ID. Must be 0-9999.' });
  }

  // Load data (cached after first call)
  const dataDir = join(process.cwd(), 'data');
  await loadSpriteSheet(join(dataDir, 'cryptopunks-assets', 'punks', 'config', 'punks-24x24.png'));
  loadPunkData(join(dataDir, 'punks-attributes', 'original', 'cryptopunks.csv'));
  loadEligiblePunks(join(dataDir, 'all-eligible-punks.json'));

  const punk = punkData[id];
  if (!punk) {
    return res.status(404).json({ error: `Punk #${id} not found.` });
  }

  // Parse size - must be a multiple of 24 for clean pixel scaling
  let outputSize = parseInt(size) || SPRITE_SIZE;
  if (outputSize < 24) outputSize = 24;
  if (outputSize > 1024) outputSize = 1024;
  // Snap to nearest multiple of 24 for uniform pixel scaling
  outputSize = Math.round(outputSize / SPRITE_SIZE) * SPRITE_SIZE;
  if (outputSize < 24) outputSize = 24;

  // Check eligibility - only return images for punks that can be remastered
  const isEligible = eligiblePunks.has(id);
  if (!isEligible) {
    return res.status(404).json({
      error: `Punk #${id} is not eligible for remastering.`,
      eligible: false,
      punkId: id
    });
  }

  // Generate remastered image via the stacking compositor (falls back to the old
  // compositor if the stack couldn't be built).
  const stackGfx = getStack();
  const canvas = stackGfx ? stackGfx.stackPunk(punk) : gfx.compositePunk(punk, true);
  const outputCanvas = outputSize === SPRITE_SIZE ? canvas : scaleCanvas(canvas, outputSize);

  // Send PNG
  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Cache-Control', 'public, max-age=315360000, immutable');
  res.send(outputCanvas.toBuffer('image/png'));
}

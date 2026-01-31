import express from 'express';
import { createCanvas } from '@napi-rs/canvas';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import { loadSpriteSheet } from './sprites.js';
import { loadPunkData, loadEligiblePunks } from './data.js';
import { compositePunk, hasRemasters } from './remaster.js';
import { SPRITE_SIZE } from './constants.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const dataDir = join(__dirname, '..', 'data');

const app = express();
const PORT = process.env.PORT || 3001;

let punkData = null;
let eligiblePunks = null;

// Initialize data on startup
async function init() {
  console.log('Loading sprite sheet...');
  await loadSpriteSheet(join(dataDir, 'cryptopunks-assets', 'punks', 'config', 'punks-24x24.png'));

  console.log('Loading punk data...');
  punkData = loadPunkData(join(dataDir, 'punks-attributes', 'original', 'cryptopunks.csv'));

  console.log('Loading eligible punks...');
  eligiblePunks = new Set(loadEligiblePunks(join(dataDir, 'all-eligible-punks.json')));

  console.log(`Loaded ${Object.keys(punkData).length} punks, ${eligiblePunks.size} eligible for remaster`);
}

// Scale a canvas to a new size using nearest neighbor (pixel-perfect) scaling
function scaleCanvas(sourceCanvas, targetSize) {
  const scaled = createCanvas(targetSize, targetSize);
  const ctx = scaled.getContext('2d');

  // Disable image smoothing for pixel-perfect scaling
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(sourceCanvas, 0, 0, targetSize, targetSize);

  return scaled;
}

// GET /:punkId - Get remastered punk image
app.get('/:punkId', (req, res) => {
  const punkId = parseInt(req.params.punkId);

  // Validate punk ID
  if (isNaN(punkId) || punkId < 0 || punkId > 9999) {
    return res.status(400).json({ error: 'Invalid punk ID. Must be 0-9999.' });
  }

  const punk = punkData[punkId];
  if (!punk) {
    return res.status(404).json({ error: `Punk #${punkId} not found.` });
  }

  // Parse size parameter (default to 24, the native size)
  let size = parseInt(req.query.size) || SPRITE_SIZE;

  // Clamp size to reasonable bounds
  if (size < 24) size = 24;
  if (size > 1024) size = 1024;

  // Check if punk is eligible for remaster
  const isEligible = eligiblePunks.has(punkId);
  const applyRemasters = isEligible && hasRemasters(punk);

  // Generate the punk image
  const canvas = compositePunk(punk, applyRemasters);

  // Scale if needed
  const outputCanvas = size === SPRITE_SIZE ? canvas : scaleCanvas(canvas, size);

  // Send as PNG
  res.set('Content-Type', 'image/png');
  res.set('Cache-Control', 'public, max-age=315360000, immutable');

  const buffer = outputCanvas.toBuffer('image/png');
  res.send(buffer);
});

// Health check endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Remastered Punks API',
    usage: 'GET /:punkId?size=N',
    example: '/1234?size=96',
    totalPunks: Object.keys(punkData || {}).length,
    eligibleForRemaster: eligiblePunks?.size || 0
  });
});

// Start server
init().then(() => {
  app.listen(PORT, () => {
    console.log(`Remastered Punks API running on http://localhost:${PORT}`);
    console.log(`Try: http://localhost:${PORT}/1234?size=96`);
  });
}).catch(err => {
  console.error('Failed to initialize:', err);
  process.exit(1);
});

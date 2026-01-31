import { createCanvas, loadImage } from '@napi-rs/canvas';
import { readFileSync } from 'fs';
import { join } from 'path';

import {
  SPRITE_SIZE,
  SPRITESHEET_COLS,
  FEMALE_SPRITE_IDS,
  MALE_SPRITE_IDS,
  LAYER_ORDER,
  TRAIT_TO_LAYER,
  SKIN_COLORS,
  TRAIT_FILL_COLORS,
} from './constants.js';

import { getRemasters } from './remaster-logic.js';

// Cached data
let spriteSheet = null;
let punksComposite = null;
let punkData = null;
let eligiblePunks = null;

const PUNKS_COLS = 100;

// Load sprite sheet
async function loadSpriteSheet(path) {
  if (!spriteSheet) {
    spriteSheet = await loadImage(path);
  }
  return spriteSheet;
}

// Load pre-rendered punks composite
async function loadPunksComposite(path) {
  if (!punksComposite) {
    punksComposite = await loadImage(path);
  }
  return punksComposite;
}

// Extract a punk from the pre-rendered composite
function extractPunk(punkId) {
  const row = Math.floor(punkId / PUNKS_COLS);
  const col = punkId % PUNKS_COLS;
  const canvas = createCanvas(SPRITE_SIZE, SPRITE_SIZE);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(punksComposite, col * SPRITE_SIZE, row * SPRITE_SIZE, SPRITE_SIZE, SPRITE_SIZE, 0, 0, SPRITE_SIZE, SPRITE_SIZE);
  return canvas;
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

// Extract sprite from sheet
function extractSprite(spriteId) {
  const row = Math.floor(spriteId / SPRITESHEET_COLS);
  const col = spriteId % SPRITESHEET_COLS;
  const canvas = createCanvas(SPRITE_SIZE, SPRITE_SIZE);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(spriteSheet, col * SPRITE_SIZE, row * SPRITE_SIZE, SPRITE_SIZE, SPRITE_SIZE, 0, 0, SPRITE_SIZE, SPRITE_SIZE);
  return canvas;
}

// Shift sprite down by pixels
function shiftSpriteDown(canvas, pixels) {
  const ctx = canvas.getContext('2d');
  const imageData = ctx.getImageData(0, 0, SPRITE_SIZE, SPRITE_SIZE);
  const shifted = ctx.createImageData(SPRITE_SIZE, SPRITE_SIZE);

  for (let y = 0; y < SPRITE_SIZE - pixels; y++) {
    for (let x = 0; x < SPRITE_SIZE; x++) {
      const srcIdx = (y * SPRITE_SIZE + x) * 4;
      const dstIdx = ((y + pixels) * SPRITE_SIZE + x) * 4;
      shifted.data[dstIdx] = imageData.data[srcIdx];
      shifted.data[dstIdx + 1] = imageData.data[srcIdx + 1];
      shifted.data[dstIdx + 2] = imageData.data[srcIdx + 2];
      shifted.data[dstIdx + 3] = imageData.data[srcIdx + 3];
    }
  }

  const result = createCanvas(SPRITE_SIZE, SPRITE_SIZE);
  result.getContext('2d').putImageData(shifted, 0, 0);
  return result;
}

// Shift single pixel down
function shiftSinglePixel(spriteCanvas, px, py) {
  const canvas = createCanvas(SPRITE_SIZE, SPRITE_SIZE);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(spriteCanvas, 0, 0);

  const imageData = ctx.getImageData(0, 0, SPRITE_SIZE, SPRITE_SIZE);
  const data = imageData.data;

  const srcIdx = (py * SPRITE_SIZE + px) * 4;
  const r = data[srcIdx], g = data[srcIdx + 1], b = data[srcIdx + 2], a = data[srcIdx + 3];

  data[srcIdx] = data[srcIdx + 1] = data[srcIdx + 2] = data[srcIdx + 3] = 0;

  const dstIdx = ((py + 1) * SPRITE_SIZE + px) * 4;
  data[dstIdx] = r; data[dstIdx + 1] = g; data[dstIdx + 2] = b; data[dstIdx + 3] = a;

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

// Shift ear on base sprite
function shiftEarOnBase(baseCanvas, fillColor = {r: 0, g: 0, b: 0, x: 7}) {
  const canvas = createCanvas(SPRITE_SIZE, SPRITE_SIZE);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(baseCanvas, 0, 0);

  const imageData = ctx.getImageData(0, 0, SPRITE_SIZE, SPRITE_SIZE);
  const data = imageData.data;

  const BG = {r: 99, g: 133, b: 150};
  const earPixels = [];
  let topEarY = 24;

  for (let x = 6; x <= 7; x++) {
    for (let y = 11; y <= 14; y++) {
      const idx = (y * SPRITE_SIZE + x) * 4;
      const r = data[idx], g = data[idx+1], b = data[idx+2], a = data[idx+3];

      if (a === 0) continue;
      if (Math.abs(r - BG.r) < 10 && Math.abs(g - BG.g) < 10 && Math.abs(b - BG.b) < 10) continue;
      if (x === 7 && y !== 12 && y !== 13 && y !== 14) continue;

      earPixels.push({x, y, r, g, b, a});
      if (x === 6 && y < topEarY) topEarY = y;
    }
  }

  for (const p of earPixels) {
    const idx = (p.y * SPRITE_SIZE + p.x) * 4;
    data[idx] = BG.r; data[idx+1] = BG.g; data[idx+2] = BG.b; data[idx+3] = 255;
  }

  for (const p of earPixels) {
    const newY = p.y + 1;
    if (newY < SPRITE_SIZE) {
      const idx = (newY * SPRITE_SIZE + p.x) * 4;
      data[idx] = p.r; data[idx+1] = p.g; data[idx+2] = p.b; data[idx+3] = p.a;
    }
  }

  if (topEarY < 24 && !fillColor.noFill) {
    if (fillColor.fills) {
      for (const fill of fillColor.fills) {
        const fillY = fill.y !== undefined ? topEarY + fill.y : topEarY;
        const idx = (fillY * SPRITE_SIZE + fill.x) * 4;
        data[idx] = fill.r; data[idx+1] = fill.g; data[idx+2] = fill.b; data[idx+3] = 255;
      }
    } else {
      const fillX = fillColor.x !== undefined ? fillColor.x : 7;
      const idx = (topEarY * SPRITE_SIZE + fillX) * 4;
      data[idx] = fillColor.r; data[idx+1] = fillColor.g; data[idx+2] = fillColor.b; data[idx+3] = 255;
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

// Composite punk image
function compositePunk(punk, applyRemasters = false) {
  const canvas = createCanvas(SPRITE_SIZE, SPRITE_SIZE);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#638596';
  ctx.fillRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);

  const isFemale = punk.gender === 'Female';
  const spriteIds = isFemale ? FEMALE_SPRITE_IDS : MALE_SPRITE_IDS;
  const isNonHuman = ['Zombie', 'Ape', 'Alien'].includes(punk.type);
  const baseKey = isNonHuman ? `base_${punk.type}` : `base_${punk.skinTone}`;
  let baseSprite = extractSprite(spriteIds[baseKey]);

  // Fix eye shadow for female
  if (isFemale && SKIN_COLORS[punk.skinTone]) {
    const baseCtx = baseSprite.getContext('2d');
    const imageData = baseCtx.getImageData(0, 0, SPRITE_SIZE, SPRITE_SIZE);
    const shadow = SKIN_COLORS[punk.skinTone];

    for (const x of [10, 15]) {
      const idx = (13 * SPRITE_SIZE + x) * 4;
      imageData.data[idx] = shadow.shadowR;
      imageData.data[idx + 1] = shadow.shadowG;
      imageData.data[idx + 2] = shadow.shadowB;
      imageData.data[idx + 3] = 255;
    }
    baseCtx.putImageData(imageData, 0, 0);
  }

  const remasters = applyRemasters ? getRemasters(punk) : [];
  const earRemaster = remasters.find(r => r.type === 'ear');

  // Apply ear shift
  if (earRemaster && isFemale) {
    let fillColor = TRAIT_FILL_COLORS[earRemaster.trait] || {r: 0, g: 0, b: 0};

    if (fillColor.fills && SKIN_COLORS[punk.skinTone]) {
      const skin = SKIN_COLORS[punk.skinTone];
      fillColor = {...fillColor, fills: fillColor.fills.map(fill =>
        fill.useSkinColor ? {...fill, r: skin.r, g: skin.g, b: skin.b} : fill
      )};
    }

    baseSprite = shiftEarOnBase(baseSprite, fillColor);

    if (fillColor.extraEarSkin && SKIN_COLORS[punk.skinTone]) {
      const baseCtx = baseSprite.getContext('2d');
      const skin = SKIN_COLORS[punk.skinTone];
      const imageData = baseCtx.getImageData(0, 0, SPRITE_SIZE, SPRITE_SIZE);
      for (const y of [15, 16]) {
        const idx = (y * SPRITE_SIZE + 7) * 4;
        imageData.data[idx] = skin.r;
        imageData.data[idx + 1] = skin.g;
        imageData.data[idx + 2] = skin.b;
        imageData.data[idx + 3] = 255;
      }
      baseCtx.putImageData(imageData, 0, 0);
    }
  }

  ctx.drawImage(baseSprite, 0, 0);

  // Sort and draw accessories
  const sortedAccessories = [...punk.accessories].sort((a, b) => {
    const layerA = TRAIT_TO_LAYER[a] || 'unknown';
    const layerB = TRAIT_TO_LAYER[b] || 'unknown';
    return LAYER_ORDER.indexOf(layerA) - LAYER_ORDER.indexOf(layerB);
  });

  for (const acc of sortedAccessories) {
    if (applyRemasters && acc === 'Choker' && remasters.find(r => r.type === 'choker')) continue;

    let spriteId = spriteIds[acc];
    if (!spriteId) continue;

    let sprite = extractSprite(spriteId);

    if (applyRemasters) {
      if (acc === 'Regular Shades' && remasters.find(r => r.type === 'shades')) {
        sprite = shiftSpriteDown(sprite, 1);
      }
      if (acc === 'Earring' && remasters.find(r => r.type === 'earring')) {
        sprite = shiftSpriteDown(sprite, 1);
      }
      if (acc === 'Small Shades' && remasters.find(r => r.type === 'smallShades')) {
        const spriteCtx = sprite.getContext('2d');
        const imageData = spriteCtx.getImageData(0, 0, SPRITE_SIZE, SPRITE_SIZE);
        for (const y of [12, 13]) {
          const idx = (y * SPRITE_SIZE + 11) * 4;
          imageData.data[idx] = imageData.data[idx + 1] = imageData.data[idx + 2] = 0;
          imageData.data[idx + 3] = 255;
        }
        spriteCtx.putImageData(imageData, 0, 0);
      }
      if ((acc === 'Front Beard' && remasters.find(r => r.type === 'frontBeard')) ||
          (acc === 'Front Beard Dark' && remasters.find(r => r.type === 'frontBeardDark'))) {
        const spriteCtx = sprite.getContext('2d');
        const imageData = spriteCtx.getImageData(0, 0, SPRITE_SIZE, SPRITE_SIZE);
        const beardColor = acc === 'Front Beard Dark' ? {r: 53, g: 31, b: 12} : {r: 168, g: 103, b: 55};
        for (const x of [10, 14]) {
          const idx = (20 * SPRITE_SIZE + x) * 4;
          imageData.data[idx] = beardColor.r;
          imageData.data[idx + 1] = beardColor.g;
          imageData.data[idx + 2] = beardColor.b;
          imageData.data[idx + 3] = 255;
        }
        spriteCtx.putImageData(imageData, 0, 0);
      }

      const fillConfig = TRAIT_FILL_COLORS[acc];
      if (fillConfig && fillConfig.shiftPixel && earRemaster) {
        sprite = shiftSinglePixel(sprite, fillConfig.shiftPixel.x, fillConfig.shiftPixel.y);
      }
    }

    ctx.drawImage(sprite, 0, 0);
  }

  // Post-sprite fills
  if (applyRemasters && earRemaster && TRAIT_FILL_COLORS[earRemaster.trait]) {
    const fillColor = TRAIT_FILL_COLORS[earRemaster.trait];
    if (fillColor.fills) {
      const imageData = ctx.getImageData(0, 0, SPRITE_SIZE, SPRITE_SIZE);
      const topEarY = 11;
      for (const fill of fillColor.fills) {
        if (fill.y !== undefined && fill.y !== 0) {
          const fillY = topEarY + fill.y;
          let r = fill.r, g = fill.g, b = fill.b;
          if (fill.useSkinColor && SKIN_COLORS[punk.skinTone]) {
            const skin = SKIN_COLORS[punk.skinTone];
            r = skin.r; g = skin.g; b = skin.b;
          }
          const idx = (fillY * SPRITE_SIZE + fill.x) * 4;
          imageData.data[idx] = r;
          imageData.data[idx + 1] = g;
          imageData.data[idx + 2] = b;
          imageData.data[idx + 3] = 255;
        }
      }
      ctx.putImageData(imageData, 0, 0);
    }
  }

  // Remastered Choker
  if (applyRemasters && remasters.find(r => r.type === 'choker')) {
    const imageData = ctx.getImageData(0, 0, SPRITE_SIZE, SPRITE_SIZE);
    for (const x of [9, 10, 11]) {
      const idx = (22 * SPRITE_SIZE + x) * 4;
      imageData.data[idx] = imageData.data[idx + 1] = imageData.data[idx + 2] = 0;
      imageData.data[idx + 3] = 255;
    }
    ctx.putImageData(imageData, 0, 0);
  }

  return canvas;
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
  await loadPunksComposite(join(dataDir, 'punks.png'));
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

  // Generate remastered image
  const canvas = compositePunk(punk, true);
  const outputCanvas = outputSize === SPRITE_SIZE ? canvas : scaleCanvas(canvas, outputSize);

  // Send PNG
  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Cache-Control', 'public, max-age=315360000, immutable');
  res.send(outputCanvas.toBuffer('image/png'));
}

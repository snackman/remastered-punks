import { SPRITE_SIZE, SPRITESHEET_COLS, PUNKS_COLS } from './constants';

let spriteSheet = null;
let punksComposite = null;

export async function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export async function loadAssets(spriteSheetPath, punksCompositePath) {
  [spriteSheet, punksComposite] = await Promise.all([
    loadImage(spriteSheetPath),
    loadImage(punksCompositePath)
  ]);
  return { spriteSheet, punksComposite };
}

export function getSpriteSheet() {
  return spriteSheet;
}

export function getPunksComposite() {
  return punksComposite;
}

export function extractSprite(spriteId) {
  if (!spriteSheet) throw new Error('Sprite sheet not loaded');

  const row = Math.floor(spriteId / SPRITESHEET_COLS);
  const col = spriteId % SPRITESHEET_COLS;
  const canvas = document.createElement('canvas');
  canvas.width = SPRITE_SIZE;
  canvas.height = SPRITE_SIZE;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(spriteSheet, col * SPRITE_SIZE, row * SPRITE_SIZE, SPRITE_SIZE, SPRITE_SIZE, 0, 0, SPRITE_SIZE, SPRITE_SIZE);
  return canvas;
}

export function extractPunk(punkId) {
  if (!punksComposite) throw new Error('Punks composite not loaded');

  const row = Math.floor(punkId / PUNKS_COLS);
  const col = punkId % PUNKS_COLS;
  const canvas = document.createElement('canvas');
  canvas.width = SPRITE_SIZE;
  canvas.height = SPRITE_SIZE;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(punksComposite, col * SPRITE_SIZE, row * SPRITE_SIZE, SPRITE_SIZE, SPRITE_SIZE, 0, 0, SPRITE_SIZE, SPRITE_SIZE);
  return canvas;
}

export function shiftSpriteDown(canvas, pixels) {
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

  const result = document.createElement('canvas');
  result.width = SPRITE_SIZE;
  result.height = SPRITE_SIZE;
  result.getContext('2d').putImageData(shifted, 0, 0);
  return result;
}

export function shiftSinglePixel(spriteCanvas, px, py) {
  const canvas = document.createElement('canvas');
  canvas.width = SPRITE_SIZE;
  canvas.height = SPRITE_SIZE;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(spriteCanvas, 0, 0);

  const imageData = ctx.getImageData(0, 0, SPRITE_SIZE, SPRITE_SIZE);
  const data = imageData.data;

  const srcIdx = (py * SPRITE_SIZE + px) * 4;
  const r = data[srcIdx], g = data[srcIdx + 1], b = data[srcIdx + 2], a = data[srcIdx + 3];

  data[srcIdx] = 0;
  data[srcIdx + 1] = 0;
  data[srcIdx + 2] = 0;
  data[srcIdx + 3] = 0;

  const dstIdx = ((py + 1) * SPRITE_SIZE + px) * 4;
  data[dstIdx] = r;
  data[dstIdx + 1] = g;
  data[dstIdx + 2] = b;
  data[dstIdx + 3] = a;

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

export function shiftEarOnBase(baseCanvas, fillColor = {r: 0, g: 0, b: 0, x: 7}) {
  const canvas = document.createElement('canvas');
  canvas.width = SPRITE_SIZE;
  canvas.height = SPRITE_SIZE;
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

      if (x === 7) {
        if (y !== 12 && y !== 13 && y !== 14) continue;
      }

      earPixels.push({x, y, r, g, b, a});
      if (x === 6 && y < topEarY) topEarY = y;
    }
  }

  for (const p of earPixels) {
    const idx = (p.y * SPRITE_SIZE + p.x) * 4;
    data[idx] = BG.r;
    data[idx+1] = BG.g;
    data[idx+2] = BG.b;
    data[idx+3] = 255;
  }

  for (const p of earPixels) {
    const newY = p.y + 1;
    if (newY < SPRITE_SIZE) {
      const idx = (newY * SPRITE_SIZE + p.x) * 4;
      data[idx] = p.r;
      data[idx+1] = p.g;
      data[idx+2] = p.b;
      data[idx+3] = p.a;
    }
  }

  if (topEarY < 24 && !fillColor.noFill) {
    if (fillColor.fills) {
      for (const fill of fillColor.fills) {
        const fillY = fill.y !== undefined ? topEarY + fill.y : topEarY;
        const idx = (fillY * SPRITE_SIZE + fill.x) * 4;
        data[idx] = fill.r;
        data[idx+1] = fill.g;
        data[idx+2] = fill.b;
        data[idx+3] = 255;
      }
    } else {
      const fillX = fillColor.x !== undefined ? fillColor.x : 7;
      const idx = (topEarY * SPRITE_SIZE + fillX) * 4;
      data[idx] = fillColor.r;
      data[idx+1] = fillColor.g;
      data[idx+2] = fillColor.b;
      data[idx+3] = 255;
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

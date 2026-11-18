// Frontend asset loading for the browser <canvas>. The pixel/compositing
// primitives now live in the shared lib/compositor.js.
import { SPRITE_SIZE, PUNKS_COLS } from './constants';

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

// Load only the trait spritesheet (used by the traits preview page, which does
// not need the original punks.png composite, and by the app's critical path).
export async function loadSpriteSheet(spriteSheetPath) {
  spriteSheet = await loadImage(spriteSheetPath);
  return spriteSheet;
}

// Subscribers for "the punks.png composite finished loading" (see useOriginalsReady).
const originalsListeners = new Set();
export const originalsLoaded = () => punksComposite !== null;
export function subscribeOriginals(fn) {
  originalsListeners.add(fn);
  return () => originalsListeners.delete(fn);
}

// punks.png (848 KB) is only needed to draw ORIGINAL punks, so the app starts it in
// parallel with the critical files and never awaits it before first paint.
export async function loadPunksComposite(punksCompositePath) {
  punksComposite = await loadImage(punksCompositePath);
  originalsListeners.forEach((fn) => fn());
  return punksComposite;
}

export async function loadAssets(spriteSheetPath, punksCompositePath) {
  const [sheet] = await Promise.all([
    loadSpriteSheet(spriteSheetPath),
    loadPunksComposite(punksCompositePath),
  ]);
  return { spriteSheet: sheet, punksComposite };
}

export function getSpriteSheet() {
  return spriteSheet;
}

export function getPunksComposite() {
  return punksComposite;
}

// Extract an original punk from the pre-rendered punks.png composite.
// Returns null until punks.png has loaded (callers wait for useOriginalsReady()).
export function extractPunk(punkId) {
  if (!punksComposite) return null;

  const row = Math.floor(punkId / PUNKS_COLS);
  const col = punkId % PUNKS_COLS;
  const canvas = document.createElement('canvas');
  canvas.width = SPRITE_SIZE;
  canvas.height = SPRITE_SIZE;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(punksComposite, col * SPRITE_SIZE, row * SPRITE_SIZE, SPRITE_SIZE, SPRITE_SIZE, 0, 0, SPRITE_SIZE, SPRITE_SIZE);
  return canvas;
}

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

export async function loadAssets(spriteSheetPath, punksCompositePath) {
  [spriteSheet, punksComposite] = await Promise.all([
    loadImage(spriteSheetPath),
    loadImage(punksCompositePath)
  ]);
  return { spriteSheet, punksComposite };
}

// Load only the trait spritesheet (used by the traits preview page, which does
// not need the original punks.png composite).
export async function loadSpriteSheet(spriteSheetPath) {
  spriteSheet = await loadImage(spriteSheetPath);
  return spriteSheet;
}

export function getSpriteSheet() {
  return spriteSheet;
}

export function getPunksComposite() {
  return punksComposite;
}

// Extract an original punk from the pre-rendered punks.png composite.
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

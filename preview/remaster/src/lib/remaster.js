// Frontend compositor: the shared compositor bound to the browser <canvas>.
import { createCompositor } from '@lib/compositor.js';
import { createStackCompositor } from '@lib/stack-compositor.js';
import { getSpriteSheet } from './sprites';

// Re-export shared remaster logic
export { getRemasters, hasRemasters } from '@lib/remaster-logic.js';

const createCanvas = (w, h) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
};

const gfx = createCompositor({ createCanvas, getSpriteSheet });

// The stacking compositor derives its base + hair sprites up front and needs both
// the sprite sheet AND the full punk map, so it can't be built at import time.
// initStacking() is called once by App.jsx after assets + punk data have loaded.
let stack = null;
export function initStacking(punks) {
  if (stack || !getSpriteSheet() || !punks || !Object.keys(punks).length) return;
  stack = createStackCompositor({ createCanvas, getSpriteSheet, punks });
}
export function isStackingReady() {
  return !!stack;
}

// The remastered sprite the stacking compositor uses for a trait (for preview
// pages), or null if the trait's sprite isn't edited / the stack isn't ready.
export function remasteredSprite(name) {
  return stack ? stack.remasteredSprite(name) : null;
}

// Remastered composites go through the stacking model when it's ready; the
// original (applyRemasters === false, e.g. the flip-to-original view) always uses
// the plain composite, which is identical either way.
export function compositePunk(punk, applyRemasters = true) {
  if (applyRemasters && stack) return stack.stackPunk(punk);
  return gfx.compositePunk(punk, applyRemasters);
}

export const compositeOnBase = gfx.compositeOnBase;
export const compositeOnMaleBase = gfx.compositeOnMaleBase;

// Primitives (used by the traits preview page to build individual trait sprites).
export const extractSprite = gfx.extractSprite;
export const recolorSprite = gfx.recolorSprite;
export const shiftSpriteDown = gfx.shiftSpriteDown;
export const shiftSinglePixel = gfx.shiftSinglePixel;

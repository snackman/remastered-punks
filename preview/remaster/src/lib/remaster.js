// Frontend compositor: the shared compositor bound to the browser <canvas>.
import { createCompositor } from '@lib/compositor.js';
import { getSpriteSheet } from './sprites';

// Re-export shared remaster logic
export { getRemasters, hasRemasters } from '@lib/remaster-logic.js';

const gfx = createCompositor({
  createCanvas: (w, h) => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  },
  getSpriteSheet,
});

export const compositePunk = gfx.compositePunk;
export const compositeOnBase = gfx.compositeOnBase;
export const compositeOnMaleBase = gfx.compositeOnMaleBase;

// Primitives (used by the traits preview page to build individual trait sprites).
export const extractSprite = gfx.extractSprite;
export const recolorSprite = gfx.recolorSprite;
export const shiftSpriteDown = gfx.shiftSpriteDown;
export const shiftSinglePixel = gfx.shiftSinglePixel;

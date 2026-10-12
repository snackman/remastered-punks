// Server-side compositor: the shared compositor bound to @napi-rs/canvas.
// Used by the local Express dev server (server.js). The Vercel image endpoint
// ([punkId].js) builds its own instance the same way.
import { createCanvas } from '@napi-rs/canvas';
import { createCompositor } from '../lib/compositor.js';
import { getSpriteSheet } from './sprites.js';

export { getRemasters, hasRemasters } from '../lib/remaster-logic.js';

const gfx = createCompositor({
  createCanvas: (w, h) => createCanvas(w, h),
  getSpriteSheet,
});

export const compositePunk = gfx.compositePunk;
export const compositeOnBase = gfx.compositeOnBase;
export const compositeOnMaleBase = gfx.compositeOnMaleBase;

// Server-side spritesheet loading for @napi-rs/canvas. The pixel/compositing
// primitives now live in the shared lib/compositor.js.
import { loadImage } from '@napi-rs/canvas';

let spriteSheet = null;

export async function loadSpriteSheet(path) {
  spriteSheet = await loadImage(path);
  return spriteSheet;
}

export function getSpriteSheet() {
  return spriteSheet;
}

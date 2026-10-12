// Precompute how many pixels each remastered punk changes vs the original, so
// the "All Remasters" gallery can sort by it without compositing 3500+ punks in
// the browser. Output: data/remaster-pixel-counts.json = [{ id, pixels }, ...]
// sorted by pixels descending. Run with viem/canvas on NODE_PATH, e.g.:
//   NODE_PATH=preview/remaster/node_modules node scripts/generate-pixel-counts.js
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync, writeFileSync } from 'fs';
import { loadImage, createCanvas } from '@napi-rs/canvas';
import { createCompositor } from '../lib/compositor.js';
import { getRemasters } from '../lib/remaster-logic.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = join(root, 'data');
const BG = { r: 99, g: 133, b: 150 };

const sheet = await loadImage(join(dataDir, 'cryptopunks-assets', 'punks', 'config', 'punks-24x24.png'));
const composite = await loadImage(join(dataDir, 'punks.png'));
const COLS = 100;
const gfx = createCompositor({ createCanvas: (w, h) => createCanvas(w, h), getSpriteSheet: () => sheet });

const csv = readFileSync(join(dataDir, 'punks-attributes', 'original', 'cryptopunks.csv'), 'utf8');
const punks = {};
for (const line of csv.trim().replace(/\r\n/g, '\n').split('\n').slice(1)) {
  const m = line.match(/^(\d+),\s*(\w+),\s*(\w+),\s*(\w*),\s*(\d+),\s*(.*)$/);
  if (m) punks[+m[1]] = { id: +m[1], type: m[2], gender: m[3], skinTone: m[4] || null,
    accessories: m[6].trim() ? m[6].split(' / ').map(a => a.trim()) : [] };
}

// The original punk, composited onto the remaster background so only real pixel
// changes count (not transparent-vs-grey background).
function originalOnBg(id) {
  const c = createCanvas(24, 24);
  const ctx = c.getContext('2d');
  ctx.fillStyle = `rgb(${BG.r},${BG.g},${BG.b})`;
  ctx.fillRect(0, 0, 24, 24);
  const col = id % COLS, row = Math.floor(id / COLS);
  ctx.drawImage(composite, col * 24, row * 24, 24, 24, 0, 0, 24, 24);
  return ctx.getImageData(0, 0, 24, 24).data;
}

const out = [];
for (const id in punks) {
  const p = punks[id];
  if (!getRemasters(p).length) continue;
  const orig = originalOnBg(+id);
  const rem = gfx.compositePunk(p, true).getContext('2d').getImageData(0, 0, 24, 24).data;
  let pixels = 0;
  for (let i = 0; i < orig.length; i += 4) {
    if (orig[i] !== rem[i] || orig[i + 1] !== rem[i + 1] || orig[i + 2] !== rem[i + 2]) pixels++;
  }
  out.push({ id: +id, pixels });
}

out.sort((a, b) => b.pixels - a.pixels || a.id - b.id);
writeFileSync(join(dataDir, 'remaster-pixel-counts.json'), JSON.stringify(out));
console.log(`Wrote ${out.length} remaster pixel counts. Max ${out[0].pixels}, min ${out[out.length - 1].pixels}.`);

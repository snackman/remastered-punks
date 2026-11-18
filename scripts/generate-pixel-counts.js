// Precompute how many pixels each remastered punk changes vs the original, so
// the "All Remasters" gallery can sort by it without compositing 3500+ punks in
// the browser. Output: data/remaster-pixel-counts.json = [{ id, pixels }, ...]
// sorted by pixels descending then id. Covers exactly data/all-eligible-punks.json,
// rendered by the stacking compositor (the same one the API and app use).
//   node scripts/generate-pixel-counts.js
import { join } from 'path';
import { readFileSync, writeFileSync } from 'fs';
import { ROOT, canvasLib } from './_deps.mjs';
import { createStackCompositor } from '../lib/stack-compositor.js';

const { loadImage, createCanvas } = canvasLib();
const dataDir = join(ROOT, 'data');
const BG = { r: 99, g: 133, b: 150 };

const sheet = await loadImage(join(dataDir, 'cryptopunks-assets', 'punks', 'config', 'punks-24x24.png'));
const composite = await loadImage(join(dataDir, 'punks.png'));
const COLS = 100;

const csv = readFileSync(join(dataDir, 'punks-attributes', 'original', 'cryptopunks.csv'), 'utf8');
const punks = {};
for (const line of csv.trim().replace(/\r\n/g, '\n').split('\n').slice(1)) {
  const m = line.match(/^(\d+),\s*(\w+),\s*(\w+),\s*(\w*),\s*(\d+),\s*(.*)$/);
  if (m) punks[+m[1]] = { id: +m[1], type: m[2], gender: m[3], skinTone: m[4] || null,
    accessories: m[6].trim() ? m[6].split(' / ').map(a => a.trim()) : [] };
}
const { stackPunk } = createStackCompositor({ createCanvas: (w, h) => createCanvas(w, h), getSpriteSheet: () => sheet, punks });

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

function computeCounts(eligible) {
  const out = [];
  for (const id of eligible) {
    const orig = originalOnBg(id);
    const rem = stackPunk(punks[id]).getContext('2d').getImageData(0, 0, 24, 24).data;
    let pixels = 0;
    for (let i = 0; i < orig.length; i += 4) {
      if (orig[i] !== rem[i] || orig[i + 1] !== rem[i + 1] || orig[i + 2] !== rem[i + 2]) pixels++;
    }
    out.push({ id, pixels });
  }
  out.sort((a, b) => b.pixels - a.pixels || a.id - b.id);
  return out;
}

const eligible = JSON.parse(readFileSync(join(dataDir, 'all-eligible-punks.json'), 'utf8'));
const out = computeCounts(eligible);
writeFileSync(join(dataDir, 'remaster-pixel-counts.json'), JSON.stringify(out));
console.log(`Wrote ${out.length} remaster pixel counts. Max ${out[0].pixels}, min ${out[out.length - 1].pixels}.`);

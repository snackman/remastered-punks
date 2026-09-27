// Regenerate data/all-eligible-punks.json by pixel comparison: a punk is
// remastered/eligible if its stacking render (remastered base + remastered traits)
// differs from its un-remastered original.
//
// Run where @napi-rs/canvas resolves (copy into ./api and run there):
//   cp scripts/generate-eligible.mjs api/ && (cd api && node generate-eligible.mjs) && rm api/generate-eligible.mjs
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { loadImage, createCanvas } from '@napi-rs/canvas';
import { readFileSync, writeFileSync } from 'fs';
import { createCompositor } from '../lib/compositor.js';
import { createStackCompositor } from '../lib/stack-compositor.js';
const S = 24;
const dataDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'data');
const sheet = await loadImage(join(dataDir, 'cryptopunks-assets', 'punks', 'config', 'punks-24x24.png'));
const csv = readFileSync(join(dataDir, 'punks-attributes', 'original', 'cryptopunks.csv'), 'utf8');
const punks = {};
for (const l of csv.trim().replace(/\r\n/g, '\n').split('\n').slice(1)) {
  const m = l.match(/^(\d+),\s*(\w+),\s*(\w+),\s*(\w*),\s*(\d+),\s*(.*)$/);
  if (m) punks[+m[1]] = { id: +m[1], type: m[2], gender: m[3], skinTone: m[4] || null, accessories: m[6].trim() ? m[6].split(' / ').map(a => a.trim()) : [] };
}
const gfx = createCompositor({ createCanvas: (w, h) => createCanvas(w, h), getSpriteSheet: () => sheet });
const { stackPunk } = createStackCompositor({ createCanvas: (w, h) => createCanvas(w, h), getSpriteSheet: () => sheet, punks });
const idd = c => c.getContext('2d').getImageData(0, 0, S, S).data;
const eligible = [];
for (const P of Object.values(punks)) {
  const o = idd(gfx.compositePunk(P, false)), r = idd(stackPunk(P));
  let diff = false;
  for (let i = 0; i < o.length; i += 4) if (o[i] !== r[i] || o[i + 1] !== r[i + 1] || o[i + 2] !== r[i + 2] || o[i + 3] !== r[i + 3]) { diff = true; break; }
  if (diff) eligible.push(P.id);
}
eligible.sort((a, b) => a - b);
writeFileSync(join(dataDir, 'all-eligible-punks.json'), JSON.stringify(eligible));
console.log('wrote', eligible.length, 'eligible punks to data/all-eligible-punks.json');

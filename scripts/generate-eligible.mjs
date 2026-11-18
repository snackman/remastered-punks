// Regenerate data/all-eligible-punks.json by pixel comparison: a punk is
// remastered/eligible if its stacking render differs from the SAME pipeline rendered
// with remasters off (`stackPunk(P, { raw: true })`). Using the same pipeline means
// layer-order fixes in the stack never change the eligible set.
//
//   node scripts/generate-eligible.mjs            # rewrite data/all-eligible-punks.json
//   node scripts/generate-eligible.mjs --check    # exit 1 if it differs from the committed file
import { join } from 'path';
import { readFileSync, writeFileSync } from 'fs';
import { ROOT, canvasLib } from './_deps.mjs';
import { createStackCompositor } from '../lib/stack-compositor.js';

const { loadImage, createCanvas } = canvasLib();
const S = 24;
const dataDir = join(ROOT, 'data');
const outFile = join(dataDir, 'all-eligible-punks.json');
const check = process.argv.includes('--check');

const sheet = await loadImage(join(dataDir, 'cryptopunks-assets', 'punks', 'config', 'punks-24x24.png'));
const csv = readFileSync(join(dataDir, 'punks-attributes', 'original', 'cryptopunks.csv'), 'utf8');
const punks = {};
for (const l of csv.trim().replace(/\r\n/g, '\n').split('\n').slice(1)) {
  const m = l.match(/^(\d+),\s*(\w+),\s*(\w+),\s*(\w*),\s*(\d+),\s*(.*)$/);
  if (m) punks[+m[1]] = { id: +m[1], type: m[2], gender: m[3], skinTone: m[4] || null, accessories: m[6].trim() ? m[6].split(' / ').map(a => a.trim()) : [] };
}
const { stackPunk } = createStackCompositor({ createCanvas: (w, h) => createCanvas(w, h), getSpriteSheet: () => sheet, punks });
const idd = c => c.getContext('2d').getImageData(0, 0, S, S).data;
const eligible = [];
for (const P of Object.values(punks)) {
  const o = idd(stackPunk(P, { raw: true })), r = idd(stackPunk(P));
  let diff = false;
  for (let i = 0; i < o.length; i += 4) if (o[i] !== r[i] || o[i + 1] !== r[i + 1] || o[i + 2] !== r[i + 2] || o[i + 3] !== r[i + 3]) { diff = true; break; }
  if (diff) eligible.push(P.id);
}
eligible.sort((a, b) => a - b);

if (check) {
  const committed = JSON.parse(readFileSync(outFile, 'utf8'));
  const cs = new Set(committed), ns = new Set(eligible);
  const gained = eligible.filter(id => !cs.has(id)), lost = committed.filter(id => !ns.has(id));
  console.log(`computed ${eligible.length}, committed ${committed.length}, gained ${gained.length}, lost ${lost.length}`);
  if (gained.length || lost.length) { console.error('MISMATCH gained:', gained.join(','), 'lost:', lost.join(',')); process.exit(1); }
  console.log('OK: eligible set unchanged');
} else {
  writeFileSync(outFile, JSON.stringify(eligible));
  console.log('wrote', eligible.length, 'eligible punks to data/all-eligible-punks.json');
}

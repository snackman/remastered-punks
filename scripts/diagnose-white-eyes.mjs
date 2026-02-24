// Diagnose white eyes issue
// Compares eye pixels between original punks.png and spritesheet base sprites
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(resolve(dirname(fileURLToPath(import.meta.url)), '../preview/remaster/package.json'));
const { PNG } = require('pngjs');

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SPRITE_SIZE = 24;
const SPRITESHEET_COLS = 25;
const PUNKS_COLS = 100;

// Eye pixel positions to check
const EYE_PIXELS = [
  {x: 9, y: 12, label: 'L-eye left'},
  {x: 10, y: 12, label: 'L-eye center'},
  {x: 11, y: 12, label: 'L-eye right'},
  {x: 10, y: 13, label: 'L-eye below (shadow fix)'},
  {x: 13, y: 12, label: 'R-eye left'},
  {x: 14, y: 12, label: 'R-eye center'},
  {x: 15, y: 12, label: 'R-eye right'},
  {x: 15, y: 13, label: 'R-eye below (shadow fix)'},
];

const FEMALE_BASES = {'Dark': 22, 'Medium': 23, 'Light': 24, 'Albino': 25};
const MALE_BASES = {'Dark': 5, 'Medium': 6, 'Light': 7, 'Albino': 8};
const NON_HUMAN_BASES = {'Zombie': 30, 'Ape': 35, 'Alien': 41};

const EYE_OVERLAYS = {
  'Blue Eye Shadow (f,s)': 334,
  'Green Eye Shadow (f,s)': 335,
  'Purple Eye Shadow (f,s)': 337,
  'Clown Eyes Blue (u,l)': 338,
  'Clown Eyes Blue (f,s)': 339,
  'Clown Eyes Green (u,l)': 340,
  'Clown Eyes Green (f,s)': 341,
};

const SAMPLE_PUNKS = [
  {id: 70, gender: 'Female', skinTone: 'Dark', type: 'Human'},
  {id: 94, gender: 'Female', skinTone: 'Medium', type: 'Human'},
  {id: 176, gender: 'Female', skinTone: 'Light', type: 'Human'},
  {id: 1857, gender: 'Female', skinTone: 'Albino', type: 'Human'},
  {id: 0, gender: 'Male', skinTone: 'Medium', type: 'Human'},
  {id: 4, gender: 'Male', skinTone: 'Dark', type: 'Human'},
  {id: 1, gender: 'Male', skinTone: null, type: 'Ape'},
  {id: 2890, gender: 'Male', skinTone: null, type: 'Zombie'},
  {id: 635, gender: 'Male', skinTone: null, type: 'Alien'},
];

function loadPNG(path) {
  const buf = readFileSync(path);
  return PNG.sync.read(buf);
}

function getPixelFromSheet(png, spriteId, x, y) {
  const row = Math.floor(spriteId / SPRITESHEET_COLS);
  const col = spriteId % SPRITESHEET_COLS;
  const px = col * SPRITE_SIZE + x;
  const py = row * SPRITE_SIZE + y;
  const idx = (py * png.width + px) * 4;
  return { r: png.data[idx], g: png.data[idx+1], b: png.data[idx+2], a: png.data[idx+3] };
}

function getPixelFromPunks(png, punkId, x, y) {
  const row = Math.floor(punkId / PUNKS_COLS);
  const col = punkId % PUNKS_COLS;
  const px = col * SPRITE_SIZE + x;
  const py = row * SPRITE_SIZE + y;
  const idx = (py * png.width + px) * 4;
  return { r: png.data[idx], g: png.data[idx+1], b: png.data[idx+2], a: png.data[idx+3] };
}

function formatPixel(p) {
  const hex = '#' + [p.r, p.g, p.b].map(c => c.toString(16).padStart(2, '0')).join('');
  const isWhite = p.r > 240 && p.g > 240 && p.b > 240 && p.a > 0;
  const isBlack = p.r < 15 && p.g < 15 && p.b < 15 && p.a > 0;
  const isTransparent = p.a === 0;
  let tag = '';
  if (isWhite) tag = ' ⚠️  WHITE';
  else if (isBlack) tag = ' (black)';
  else if (isTransparent) tag = ' (transparent)';
  return `RGB(${String(p.r).padStart(3)},${String(p.g).padStart(3)},${String(p.b).padStart(3)}) a=${String(p.a).padStart(3)} ${hex}${tag}`;
}

const punks = loadPNG(resolve(ROOT, 'data/punks.png'));
const sheet = loadPNG(resolve(ROOT, 'data/cryptopunks-assets/punks/config/punks-24x24.png'));

// === PART 1: Base sprites ===
console.log('='.repeat(80));
console.log('PART 1: BASE SPRITE EYE PIXELS');
console.log('='.repeat(80));

console.log('\n--- Female Base Sprites (f,s) ---');
for (const [tone, id] of Object.entries(FEMALE_BASES)) {
  console.log(`\n  ${tone} (sprite #${id}):`);
  for (const pos of EYE_PIXELS) {
    const p = getPixelFromSheet(sheet, id, pos.x, pos.y);
    console.log(`    ${pos.label.padEnd(35)} ${formatPixel(p)}`);
  }
}

console.log('\n--- Male Base Sprites (m,l) ---');
for (const [tone, id] of Object.entries(MALE_BASES)) {
  console.log(`\n  ${tone} (sprite #${id}):`);
  for (const pos of EYE_PIXELS) {
    const p = getPixelFromSheet(sheet, id, pos.x, pos.y);
    console.log(`    ${pos.label.padEnd(35)} ${formatPixel(p)}`);
  }
}

console.log('\n--- Non-Human Base Sprites ---');
for (const [type, id] of Object.entries(NON_HUMAN_BASES)) {
  console.log(`\n  ${type} (sprite #${id}):`);
  for (const pos of EYE_PIXELS) {
    const p = getPixelFromSheet(sheet, id, pos.x, pos.y);
    console.log(`    ${pos.label.padEnd(35)} ${formatPixel(p)}`);
  }
}

// === PART 2: Generic Eyes overlay ===
console.log('\n' + '='.repeat(80));
console.log('PART 2: GENERIC "EYES" OVERLAY (sprite #283)');
console.log('='.repeat(80));
for (const pos of EYE_PIXELS) {
  const p = getPixelFromSheet(sheet, 283, pos.x, pos.y);
  console.log(`  ${pos.label.padEnd(35)} ${formatPixel(p)}`);
}

// === PART 3: Eye accessory overlays ===
console.log('\n' + '='.repeat(80));
console.log('PART 3: EYE ACCESSORY OVERLAY SPRITES');
console.log('='.repeat(80));
for (const [name, id] of Object.entries(EYE_OVERLAYS)) {
  console.log(`\n  ${name} (sprite #${id}):`);
  let hasOpaque = false;
  for (const pos of EYE_PIXELS) {
    const p = getPixelFromSheet(sheet, id, pos.x, pos.y);
    if (p.a > 0) {
      hasOpaque = true;
      console.log(`    ${pos.label.padEnd(35)} ${formatPixel(p)}`);
    }
  }
  if (!hasOpaque) {
    console.log(`    (all eye positions transparent - won't affect base eyes)`);
  }
}

// === PART 4: Compare original vs base sprite ===
console.log('\n' + '='.repeat(80));
console.log('PART 4: ORIGINAL PUNK vs BASE SPRITE COMPARISON');
console.log('='.repeat(80));

for (const punk of SAMPLE_PUNKS) {
  let baseId;
  if (punk.type !== 'Human') baseId = NON_HUMAN_BASES[punk.type];
  else if (punk.gender === 'Female') baseId = FEMALE_BASES[punk.skinTone];
  else baseId = MALE_BASES[punk.skinTone];

  console.log(`\n  Punk #${punk.id} (${punk.gender}, ${punk.type}, ${punk.skinTone || 'N/A'}) — base sprite #${baseId}:`);

  let diffs = 0;
  for (const pos of EYE_PIXELS) {
    const o = getPixelFromPunks(punks, punk.id, pos.x, pos.y);
    const b = getPixelFromSheet(sheet, baseId, pos.x, pos.y);
    const match = o.r === b.r && o.g === b.g && o.b === b.b;
    if (!match) {
      diffs++;
      console.log(`    ${pos.label.padEnd(35)}`);
      console.log(`      Original:    ${formatPixel(o)}`);
      console.log(`      Base sprite: ${formatPixel(b)}`);
    }
  }
  if (diffs === 0) {
    console.log(`    ✓ All eye pixels match`);
  } else {
    console.log(`    → ${diffs} pixel(s) differ`);
  }
}

console.log('\n' + '='.repeat(80));
console.log('DONE');
console.log('='.repeat(80));

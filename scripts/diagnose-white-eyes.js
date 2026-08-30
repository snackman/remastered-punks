// Diagnose white eyes issue
// Compares eye pixels between original punks.png and recomposited sprites
const fs = require('fs');
const { createCanvas, loadImage } = require('canvas');

const SPRITE_SIZE = 24;
const SPRITESHEET_COLS = 25;
const PUNKS_COLS = 100;

// Eye pixel positions to check (x, y) - the eye row and surrounding area
const EYE_PIXELS = [
  // Left eye area
  {x: 9, y: 12, label: 'L-eye left'},
  {x: 10, y: 12, label: 'L-eye center'},
  {x: 11, y: 12, label: 'L-eye right'},
  {x: 10, y: 13, label: 'L-eye below (shadow fix target)'},
  // Right eye area
  {x: 13, y: 12, label: 'R-eye left'},
  {x: 14, y: 12, label: 'R-eye center'},
  {x: 15, y: 12, label: 'R-eye right'},
  {x: 15, y: 13, label: 'R-eye below (shadow fix target)'},
];

// Female base sprite IDs by skin tone
const FEMALE_BASES = {
  'Dark': 22, 'Medium': 23, 'Light': 24, 'Albino': 25,
};

// Male base sprite IDs by skin tone
const MALE_BASES = {
  'Dark': 5, 'Medium': 6, 'Light': 7, 'Albino': 8,
};

// Non-human base sprite IDs
const NON_HUMAN_BASES = {
  'Zombie': 30, 'Ape': 35, 'Alien': 41,
};

// Generic feature overlays
const GENERIC_OVERLAYS = {
  'Eyes': 283, 'Eyebrows': 282, 'Mouth': 284, 'Nose': 285,
};

// Eye accessory overlays (female f,s / male u,l)
const EYE_OVERLAYS = {
  'Blue Eye Shadow (f,s)': 334,
  'Green Eye Shadow (f,s)': 335,
  'Purple Eye Shadow (f,s)': 337,
  'Clown Eyes Blue (u,l)': 338,
  'Clown Eyes Blue (f,s)': 339,
  'Clown Eyes Green (u,l)': 340,
  'Clown Eyes Green (f,s)': 341,
};

// Sample punks to compare (from eligible list + some males)
const SAMPLE_PUNKS = [
  {id: 70, gender: 'Female', skinTone: 'Dark', type: 'Human'},
  {id: 94, gender: 'Female', skinTone: 'Medium', type: 'Human'},
  {id: 176, gender: 'Female', skinTone: 'Light', type: 'Human'},
  {id: 1857, gender: 'Female', skinTone: 'Albino', type: 'Human'},
  // Males for comparison
  {id: 0, gender: 'Male', skinTone: 'Medium', type: 'Human'},
  {id: 4, gender: 'Male', skinTone: 'Dark', type: 'Human'},
  // Non-human
  {id: 1, gender: 'Male', skinTone: null, type: 'Ape'},
  {id: 2890, gender: 'Male', skinTone: null, type: 'Zombie'},
  {id: 635, gender: 'Male', skinTone: null, type: 'Alien'},
];

function getPixels(ctx, positions) {
  const imageData = ctx.getImageData(0, 0, SPRITE_SIZE, SPRITE_SIZE);
  return positions.map(pos => {
    const idx = (pos.y * SPRITE_SIZE + pos.x) * 4;
    return {
      ...pos,
      r: imageData.data[idx],
      g: imageData.data[idx + 1],
      b: imageData.data[idx + 2],
      a: imageData.data[idx + 3],
    };
  });
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
  return `RGB(${String(p.r).padStart(3)},${String(p.g).padStart(3)},${String(p.b).padStart(3)}) a=${p.a} ${hex}${tag}`;
}

async function main() {
  const punksImg = await loadImage('data/punks.png');
  const spritesheetImg = await loadImage('data/cryptopunks-assets/punks/config/punks-24x24.png');

  function extractFromPunks(punkId) {
    const row = Math.floor(punkId / PUNKS_COLS);
    const col = punkId % PUNKS_COLS;
    const canvas = createCanvas(SPRITE_SIZE, SPRITE_SIZE);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(punksImg, col * SPRITE_SIZE, row * SPRITE_SIZE, SPRITE_SIZE, SPRITE_SIZE, 0, 0, SPRITE_SIZE, SPRITE_SIZE);
    return ctx;
  }

  function extractSprite(spriteId) {
    const row = Math.floor(spriteId / SPRITESHEET_COLS);
    const col = spriteId % SPRITESHEET_COLS;
    const canvas = createCanvas(SPRITE_SIZE, SPRITE_SIZE);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(spritesheetImg, col * SPRITE_SIZE, row * SPRITE_SIZE, SPRITE_SIZE, SPRITE_SIZE, 0, 0, SPRITE_SIZE, SPRITE_SIZE);
    return ctx;
  }

  // === PART 1: Check base sprites for eye pixel content ===
  console.log('='.repeat(80));
  console.log('PART 1: BASE SPRITE EYE PIXELS');
  console.log('='.repeat(80));

  console.log('\n--- Female Base Sprites (f,s) ---');
  for (const [tone, id] of Object.entries(FEMALE_BASES)) {
    const ctx = extractSprite(id);
    const pixels = getPixels(ctx, EYE_PIXELS);
    console.log(`\n  ${tone} (sprite #${id}):`);
    for (const p of pixels) {
      console.log(`    ${p.label.padEnd(35)} ${formatPixel(p)}`);
    }
  }

  console.log('\n--- Male Base Sprites (m,l) ---');
  for (const [tone, id] of Object.entries(MALE_BASES)) {
    const ctx = extractSprite(id);
    const pixels = getPixels(ctx, EYE_PIXELS);
    console.log(`\n  ${tone} (sprite #${id}):`);
    for (const p of pixels) {
      console.log(`    ${p.label.padEnd(35)} ${formatPixel(p)}`);
    }
  }

  console.log('\n--- Non-Human Base Sprites ---');
  for (const [type, id] of Object.entries(NON_HUMAN_BASES)) {
    const ctx = extractSprite(id);
    const pixels = getPixels(ctx, EYE_PIXELS);
    console.log(`\n  ${type} (sprite #${id}):`);
    for (const p of pixels) {
      console.log(`    ${p.label.padEnd(35)} ${formatPixel(p)}`);
    }
  }

  // === PART 2: Check generic Eyes overlay ===
  console.log('\n' + '='.repeat(80));
  console.log('PART 2: GENERIC "EYES" OVERLAY (sprite #283)');
  console.log('='.repeat(80));
  const eyesCtx = extractSprite(GENERIC_OVERLAYS.Eyes);
  const eyesPixels = getPixels(eyesCtx, EYE_PIXELS);
  for (const p of eyesPixels) {
    console.log(`  ${p.label.padEnd(35)} ${formatPixel(p)}`);
  }

  // === PART 3: Check eye accessory overlays ===
  console.log('\n' + '='.repeat(80));
  console.log('PART 3: EYE ACCESSORY OVERLAY SPRITES');
  console.log('='.repeat(80));
  for (const [name, id] of Object.entries(EYE_OVERLAYS)) {
    const ctx = extractSprite(id);
    const pixels = getPixels(ctx, EYE_PIXELS);
    console.log(`\n  ${name} (sprite #${id}):`);
    for (const p of pixels) {
      if (p.a > 0) { // Only show non-transparent pixels
        console.log(`    ${p.label.padEnd(35)} ${formatPixel(p)}`);
      }
    }
    const allTransparent = pixels.every(p => p.a === 0);
    if (allTransparent) {
      console.log(`    (all eye positions are transparent)`);
    }
  }

  // === PART 4: Compare original punks.png vs base sprite at eye positions ===
  console.log('\n' + '='.repeat(80));
  console.log('PART 4: ORIGINAL vs BASE SPRITE COMPARISON');
  console.log('='.repeat(80));

  for (const punk of SAMPLE_PUNKS) {
    const originalCtx = extractFromPunks(punk.id);
    const originalPixels = getPixels(originalCtx, EYE_PIXELS);

    let baseId;
    if (punk.type !== 'Human') {
      baseId = NON_HUMAN_BASES[punk.type];
    } else if (punk.gender === 'Female') {
      baseId = FEMALE_BASES[punk.skinTone];
    } else {
      baseId = MALE_BASES[punk.skinTone];
    }

    const baseCtx = extractSprite(baseId);
    const basePixels = getPixels(baseCtx, EYE_PIXELS);

    console.log(`\n  Punk #${punk.id} (${punk.gender}, ${punk.type}, ${punk.skinTone || 'N/A'}) — base sprite #${baseId}:`);

    let diffs = 0;
    for (let i = 0; i < EYE_PIXELS.length; i++) {
      const o = originalPixels[i];
      const b = basePixels[i];
      const match = o.r === b.r && o.g === b.g && o.b === b.b;
      if (!match) {
        diffs++;
        console.log(`    ${o.label.padEnd(35)}`);
        console.log(`      Original:   ${formatPixel(o)}`);
        console.log(`      Base sprite: ${formatPixel(b)}`);
      }
    }
    if (diffs === 0) {
      console.log(`    ✓ All eye pixels match between original and base sprite`);
    } else {
      console.log(`    → ${diffs} pixel(s) differ`);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('DONE');
  console.log('='.repeat(80));
}

main().catch(console.error);

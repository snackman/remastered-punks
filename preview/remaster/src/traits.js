// All-Traits preview page. Uses the shared compositor (lib/compositor.js) via
// the frontend's browser-bound instance, so every remaster rule comes from the
// same single source as the app and the API.
import {
  SPRITE_SIZE,
  FEMALE_SPRITE_IDS,
  MALE_SPRITE_IDS,
  TRAIT_FILL_COLORS,
  SPRITE_COLOR_CORRECTIONS,
} from '@lib/constants.js';
import { loadSpriteSheet } from './lib/sprites';
import {
  extractSprite,
  recolorSprite,
  shiftSpriteDown,
  shiftSinglePixel,
  compositeOnBase,
  compositeOnMaleBase,
} from './lib/remaster';

const ZOOM = 6;

// Cropping settings: 2px from top, 0px from bottom, 1px from sides
const CROP_TOP = 2;
const CROP_LEFT = 1;
const CROPPED_SIZE = 22;

const SKIN_TONES = ['Light', 'Medium', 'Dark', 'Albino'];
const SKIN_LABELS = {
  'Light': 'Light',
  'Medium': 'Medium',
  'Dark': 'Dark',
  'Albino': 'Albino',
};

// Extract a trait sprite, applying any spritesheet colour correction (e.g. the
// brighter Clown Hair Green) so previews match the app.
function traitSprite(spriteId, traitName) {
  let sprite = extractSprite(spriteId);
  const correction = traitName && SPRITE_COLOR_CORRECTIONS[traitName];
  // The traits page renders the female sprites, so gender-gated corrections
  // (e.g. the male-only Crazy Hair ear pixel) resolve against 'Female'.
  if (correction) sprite = recolorSprite(sprite, correction, 'Female');
  return sprite;
}

function drawZoomed(sourceCanvas, targetCanvas) {
  targetCanvas.width = CROPPED_SIZE * ZOOM;
  targetCanvas.height = CROPPED_SIZE * ZOOM;
  const ctx = targetCanvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(sourceCanvas, CROP_LEFT, CROP_TOP, CROPPED_SIZE, CROPPED_SIZE, 0, 0, CROPPED_SIZE * ZOOM, CROPPED_SIZE * ZOOM);
}

function createPunkBox(label, sourceCanvas) {
  const box = document.createElement('div');
  box.className = 'punk-box';

  const labelDiv = document.createElement('div');
  labelDiv.className = 'label';
  labelDiv.textContent = label;
  box.appendChild(labelDiv);

  const container = document.createElement('div');
  container.className = 'canvas-container';

  const canvas = document.createElement('canvas');
  drawZoomed(sourceCanvas, canvas);
  container.appendChild(canvas);
  box.appendChild(container);

  return box;
}

function createArrow() {
  const arrow = document.createElement('div');
  arrow.className = 'arrow';
  arrow.textContent = '→';
  return arrow;
}

// Count pixels that differ (RGB) between two 24x24 source canvases - how many
// pixels this remaster actually changes.
function countPixelDiff(a, b) {
  const da = a.getContext('2d').getImageData(0, 0, SPRITE_SIZE, SPRITE_SIZE).data;
  const db = b.getContext('2d').getImageData(0, 0, SPRITE_SIZE, SPRITE_SIZE).data;
  let n = 0;
  for (let i = 0; i < da.length; i += 4) {
    if (da[i] !== db[i] || da[i + 1] !== db[i + 1] || da[i + 2] !== db[i + 2]) n++;
  }
  return n;
}

function createComparison(skinTone, originalCanvas, remasteredCanvas) {
  const group = document.createElement('div');
  group.className = 'skin-tone-group';
  group.dataset.pixelsChanged = String(countPixelDiff(originalCanvas, remasteredCanvas));

  const title = document.createElement('h4');
  title.textContent = SKIN_LABELS[skinTone];
  group.appendChild(title);

  const pair = document.createElement('div');
  pair.className = 'punk-pair';

  pair.appendChild(createPunkBox('Original', originalCanvas));
  pair.appendChild(createArrow());
  pair.appendChild(createPunkBox('Remastered', remasteredCanvas));

  group.appendChild(pair);
  return group;
}

function renderEarComparison() {
  const container = document.getElementById('earComparison');
  for (const skinTone of SKIN_TONES) {
    const original = compositeOnBase(skinTone, [], false);
    const remastered = compositeOnBase(skinTone, [], true);
    container.appendChild(createComparison(skinTone, original, remastered));
  }
}

function renderShadesComparison() {
  const container = document.getElementById('shadesComparison');
  for (const skinTone of SKIN_TONES) {
    const shades = extractSprite(FEMALE_SPRITE_IDS['Regular Shades']);
    const shadesShifted = shiftSpriteDown(extractSprite(FEMALE_SPRITE_IDS['Regular Shades']), 1);

    const original = compositeOnBase(skinTone, [shades], false);
    const remastered = compositeOnBase(skinTone, [shadesShifted], true);
    container.appendChild(createComparison(skinTone, original, remastered));
  }
}

function renderEarringComparison() {
  const container = document.getElementById('earringComparison');
  for (const skinTone of SKIN_TONES) {
    const earring = extractSprite(FEMALE_SPRITE_IDS['Earring']);
    const earringShifted = shiftSpriteDown(extractSprite(FEMALE_SPRITE_IDS['Earring']), 1);

    const original = compositeOnBase(skinTone, [earring], false);
    const remastered = compositeOnBase(skinTone, [earringShifted], true);
    container.appendChild(createComparison(skinTone, original, remastered));
  }
}

function renderCombinedComparison() {
  const container = document.getElementById('combinedComparison');
  for (const skinTone of SKIN_TONES) {
    const shades = extractSprite(FEMALE_SPRITE_IDS['Regular Shades']);
    const earring = extractSprite(FEMALE_SPRITE_IDS['Earring']);
    const shadesShifted = shiftSpriteDown(extractSprite(FEMALE_SPRITE_IDS['Regular Shades']), 1);
    const earringShifted = shiftSpriteDown(extractSprite(FEMALE_SPRITE_IDS['Earring']), 1);

    const original = compositeOnBase(skinTone, [shades, earring], false);
    const remastered = compositeOnBase(skinTone, [shadesShifted, earringShifted], true);
    container.appendChild(createComparison(skinTone, original, remastered));
  }
}

function renderTraitWithEar(containerId, traitName) {
  const container = document.getElementById(containerId);
  const fillConfig = TRAIT_FILL_COLORS[traitName];

  for (const skinTone of SKIN_TONES) {
    const trait = traitSprite(FEMALE_SPRITE_IDS[traitName], traitName);

    let remasteredTrait = traitSprite(FEMALE_SPRITE_IDS[traitName], traitName);
    if (fillConfig && fillConfig.shiftPixel) {
      remasteredTrait = shiftSinglePixel(remasteredTrait, fillConfig.shiftPixel.x, fillConfig.shiftPixel.y);
    }

    const original = compositeOnBase(skinTone, [trait], false, traitName);
    const remastered = compositeOnBase(skinTone, [remasteredTrait], true, traitName);
    container.appendChild(createComparison(skinTone, original, remastered));
  }
}

function renderFrontBeardComparison() {
  const container = document.getElementById('frontBeardComparison');

  for (const skinTone of SKIN_TONES) {
    const trait = extractSprite(MALE_SPRITE_IDS['Front Beard']);
    const original = compositeOnMaleBase(skinTone, [trait]);

    const remastered = compositeOnMaleBase(skinTone, [trait]);
    const ctx = remastered.getContext('2d');
    const imageData = ctx.getImageData(0, 0, SPRITE_SIZE, SPRITE_SIZE);
    const data = imageData.data;
    // Sample the beard's own colour so the added corners match exactly.
    const sampleIdx = (20 * SPRITE_SIZE + 12) * 4;
    const beard = { r: data[sampleIdx], g: data[sampleIdx + 1], b: data[sampleIdx + 2] };
    for (const x of [10, 14]) {
      const idx = (20 * SPRITE_SIZE + x) * 4;
      data[idx] = beard.r;
      data[idx + 1] = beard.g;
      data[idx + 2] = beard.b;
      data[idx + 3] = 255;
    }
    ctx.putImageData(imageData, 0, 0);

    container.appendChild(createComparison(skinTone, original, remastered));
  }
}

function renderChokerComparison() {
  const container = document.getElementById('chokerComparison');
  const CHOKER_COLOR = { r: 0, g: 0, b: 0 };

  for (const skinTone of SKIN_TONES) {
    const trait = extractSprite(FEMALE_SPRITE_IDS['Choker']);
    const original = compositeOnBase(skinTone, [trait], false);

    const remastered = compositeOnBase(skinTone, [], false);
    const ctx = remastered.getContext('2d');
    const imageData = ctx.getImageData(0, 0, SPRITE_SIZE, SPRITE_SIZE);
    const data = imageData.data;
    for (const x of [9, 10, 11]) {
      const idx = (22 * SPRITE_SIZE + x) * 4;
      data[idx] = CHOKER_COLOR.r;
      data[idx + 1] = CHOKER_COLOR.g;
      data[idx + 2] = CHOKER_COLOR.b;
      data[idx + 3] = 255;
    }
    ctx.putImageData(imageData, 0, 0);

    container.appendChild(createComparison(skinTone, original, remastered));
  }
}

function renderSmallShadesComparison() {
  const container = document.getElementById('smallShadesComparison');

  for (const skinTone of SKIN_TONES) {
    const trait = extractSprite(MALE_SPRITE_IDS['Small Shades']);
    const original = compositeOnMaleBase(skinTone, [trait]);

    const remasteredTrait = extractSprite(MALE_SPRITE_IDS['Small Shades']);
    const traitCtx = remasteredTrait.getContext('2d');
    const imageData = traitCtx.getImageData(0, 0, SPRITE_SIZE, SPRITE_SIZE);
    const data = imageData.data;
    for (const y of [12, 13]) {
      const idx = (y * SPRITE_SIZE + 11) * 4;
      data[idx] = 0;
      data[idx + 1] = 0;
      data[idx + 2] = 0;
      data[idx + 3] = 255;
    }
    traitCtx.putImageData(imageData, 0, 0);

    const remastered = compositeOnMaleBase(skinTone, [remasteredTrait]);
    container.appendChild(createComparison(skinTone, original, remastered));
  }
}

// Frown over a beard: in the original the beard is drawn over the frown (hiding
// it); the remaster keeps the frown on top. Same head, just the draw order of
// the two sprites flips.
function renderFrownBeardComparison() {
  const container = document.getElementById('frownBeardComparison');
  for (const skinTone of SKIN_TONES) {
    const beard = extractSprite(MALE_SPRITE_IDS['Normal Beard']);
    const frown = extractSprite(MALE_SPRITE_IDS['Frown']);
    const original = compositeOnMaleBase(skinTone, [frown, beard]);   // beard over frown
    const remastered = compositeOnMaleBase(skinTone, [beard, frown]); // frown over beard
    container.appendChild(createComparison(skinTone, original, remastered));
  }
}

// Show how many pixels each trait's remaster changes (max across skin tones,
// since the count is essentially the same for each).
function addPixelCounts() {
  document.querySelectorAll('.section').forEach(sec => {
    const groups = sec.querySelectorAll('.skin-tone-group[data-pixels-changed]');
    if (!groups.length) return;
    let max = 0;
    groups.forEach(g => { max = Math.max(max, parseInt(g.dataset.pixelsChanged, 10) || 0); });
    const content = sec.querySelector('.section-content');
    if (!content) return;
    const el = document.createElement('p');
    el.className = 'trait-pixels';
    el.textContent = `${max} pixel${max === 1 ? '' : 's'} changed`;
    content.insertBefore(el, content.firstChild);
  });
}

function setupCollapsible() {
  document.querySelectorAll('.section h2').forEach(h2 => {
    h2.addEventListener('click', () => {
      h2.parentElement.classList.toggle('collapsed');
    });
  });
}

// --- Order sections by number of eligible punks affected -----------------
// The CryptoPunks set is immutable, so these counts are fixed. They were
// derived from data/all-eligible-punks.json + cryptopunks.csv using the
// ear-visible/covering rules in lib/constants.js.
const SECTION_COUNTS = {
  earComparison: 2468,
  earringComparison: 629,
  smallShadesComparison: 378,
  frontBeardComparison: 276,
  frownBeardComparison: 29,
  crazyHairComparison: 160,
  stringyHairComparison: 158,
  bandanaComparison: 157,
  messyHairComparison: 153,
  mohawkComparison: 149,
  mohawkThinComparison: 147,
  mohawkDarkComparison: 143,
  blondeBobComparison: 143,
  redMohawkComparison: 141,
  wildBlondeComparison: 138,
  wildWhiteHairComparison: 131,
  blondeShortComparison: 123,
  knittedCapComparison: 97,
  pigtailsComparison: 93,
  capComparison: 91,
  headbandComparison: 90,
  weldingGogglesComparison: 86,
  shadesComparison: 81,
  orangeSideComparison: 65,
  clownHairGreenComparison: 61,
  tiaraComparison: 54,
  chokerComparison: 48,
  combinedComparison: 13,
};

function orderSectionsByCount() {
  const sections = Array.from(document.querySelectorAll('.section'));
  const ranked = sections.map(sec => {
    const cont = sec.querySelector('.skin-tones');
    const cid = cont && cont.id;
    return { sec, count: cid in SECTION_COUNTS ? SECTION_COUNTS[cid] : -1 };
  }).sort((a, b) => b.count - a.count);

  const parent = sections[0].parentNode;
  const anchor = sections[sections.length - 1].nextSibling;
  const frag = document.createDocumentFragment();
  ranked.forEach(({ sec, count }, i) => {
    const h2 = sec.querySelector('h2');
    const title = h2.textContent.replace(/^\s*\d+\.\s*/, '');
    const label = count >= 0 ? `${count.toLocaleString()} punk${count === 1 ? '' : 's'}` : '';
    h2.innerHTML = `${i + 1}. ${title}<span class="trait-count">${label}</span>`;
    frag.appendChild(sec);
  });
  parent.insertBefore(frag, anchor);
}

// Add a "View all remasters with X" link to each section, deep-linking into the
// main app's gallery filtered by that trait. Section titles are the trait names,
// except for the base-head/combined sections which have no single trait.
const SECTION_TRAIT_OVERRIDES = {
  'Ear Position (Base Head)': null,
  'Earring (with Ear Visible)': 'Earring',
  'Combined: Ear + Shades + Earring': null,
  'Frown (over beard)': 'Frown',
};
function addTraitLinks() {
  const base = import.meta.env.BASE_URL;
  document.querySelectorAll('.section').forEach(sec => {
    const h2 = sec.querySelector('h2');
    const content = sec.querySelector('.section-content');
    if (!h2 || !content) return;
    const title = h2.textContent.replace(/^\s*\d+\.\s*/, '').replace(/\d[\d,]*\s*punks?$/, '').trim();
    const trait = title in SECTION_TRAIT_OVERRIDES ? SECTION_TRAIT_OVERRIDES[title] : title;
    if (!trait) return;
    const href = `${base}?trait=${encodeURIComponent(trait)}#gallery`;

    const a = document.createElement('a');
    a.className = 'trait-view-all';
    a.href = href;
    a.textContent = `View all remasters with ${trait} →`;
    content.appendChild(a);

    // Also make the "N punks" count in the heading a link to the same gallery.
    const count = h2.querySelector('.trait-count');
    if (count && count.textContent.trim()) {
      const link = document.createElement('a');
      link.className = 'trait-count-link';
      link.href = href;
      link.textContent = count.textContent;
      link.addEventListener('click', (e) => e.stopPropagation()); // don't toggle collapse
      count.replaceWith(link);
    }
  });
}

async function init() {
  try {
    setupCollapsible();
    const basePath = import.meta.env.DEV ? '../..' : '';
    await loadSpriteSheet(`${basePath}/data/cryptopunks-assets/punks/config/punks-24x24.png`);

    renderEarComparison();
    renderShadesComparison();
    renderEarringComparison();
    renderCombinedComparison();
    // Ear-visible traits
    renderTraitWithEar('mohawkComparison', 'Mohawk');
    renderTraitWithEar('mohawkDarkComparison', 'Mohawk Dark');
    renderTraitWithEar('mohawkThinComparison', 'Mohawk Thin');
    renderTraitWithEar('redMohawkComparison', 'Red Mohawk');
    renderTraitWithEar('bandanaComparison', 'Bandana');
    renderTraitWithEar('headbandComparison', 'Headband');
    renderTraitWithEar('capComparison', 'Cap');
    renderTraitWithEar('knittedCapComparison', 'Knitted Cap');
    renderTraitWithEar('tiaraComparison', 'Tiara');
    renderTraitWithEar('weldingGogglesComparison', 'Welding Goggles');
    renderTraitWithEar('blondeBobComparison', 'Blonde Bob');
    renderTraitWithEar('blondeShortComparison', 'Blonde Short');
    renderTraitWithEar('crazyHairComparison', 'Crazy Hair');
    renderTraitWithEar('messyHairComparison', 'Messy Hair');
    renderTraitWithEar('orangeSideComparison', 'Orange Side');
    renderTraitWithEar('pigtailsComparison', 'Pigtails');
    renderTraitWithEar('stringyHairComparison', 'Stringy Hair');
    renderTraitWithEar('wildBlondeComparison', 'Wild Blonde');
    renderTraitWithEar('wildWhiteHairComparison', 'Wild White Hair');
    renderTraitWithEar('clownHairGreenComparison', 'Clown Hair Green');
    // Non-ear traits
    renderFrontBeardComparison();
    renderChokerComparison();
    renderSmallShadesComparison();
    renderFrownBeardComparison();

    // Reorder sections by how many eligible punks each remaster affects.
    orderSectionsByCount();
    addTraitLinks();
    addPixelCounts();
  } catch (err) {
    console.error('Init failed:', err);
    document.body.innerHTML = `<p style="color:red;text-align:center;padding:40px;">Error: ${err.message}</p>`;
  }
}

init();

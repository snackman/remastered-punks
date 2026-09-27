// All-Traits preview page. Uses the shared compositor (lib/compositor.js) via
// the frontend's browser-bound instance, so every remaster rule comes from the
// same single source as the app and the API.
import {
  SPRITE_SIZE,
  FEMALE_SPRITE_IDS,
  MALE_SPRITE_IDS,
  SPRITE_COLOR_CORRECTIONS,
} from '@lib/constants.js';
import { loadSpriteSheet } from './lib/sprites';
import { loadPunkData } from './lib/data';
import {
  extractSprite,
  recolorSprite,
  compositeOnMaleBase,
  compositePunk,
  initStacking,
  remasteredSprite,
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

// One source of truth for every section: the synthetic punk it renders (gender +
// accessories) and, where the section is a single trait, the trait/sprite-sheet
// used for the isolated view. Both the on-head comparison and the isolated sprite
// are driven from the stacking compositor, so the page never drifts from the app.
const SECTIONS = {
  earComparison:          { gender: 'Female', accessories: [] },
  shadesComparison:       { gender: 'Female', accessories: ['Regular Shades'], trait: 'Regular Shades' },
  earringComparison:      { gender: 'Female', accessories: ['Earring'], trait: 'Earring' },
  combinedComparison:     { gender: 'Female', accessories: ['Regular Shades', 'Earring'] },
  mohawkComparison:       { gender: 'Female', accessories: ['Mohawk'], trait: 'Mohawk' },
  redMohawkComparison:    { gender: 'Female', accessories: ['Red Mohawk'], trait: 'Red Mohawk' },
  bandanaComparison:      { gender: 'Female', accessories: ['Bandana'], trait: 'Bandana' },
  headbandComparison:     { gender: 'Female', accessories: ['Headband'], trait: 'Headband' },
  capComparison:          { gender: 'Female', accessories: ['Cap'], trait: 'Cap' },
  knittedCapComparison:   { gender: 'Female', accessories: ['Knitted Cap'], trait: 'Knitted Cap' },
  tiaraComparison:        { gender: 'Female', accessories: ['Tiara'], trait: 'Tiara' },
  weldingGogglesComparison: { gender: 'Female', accessories: ['Welding Goggles'], trait: 'Welding Goggles' },
  pilotHelmetComparison: { gender: 'Female', accessories: ['Pilot Helmet'], trait: 'Pilot Helmet' },
  eyeMaskComparison: { gender: 'Female', accessories: ['Eye Mask'], trait: 'Eye Mask' },
  bigShadesComparison: { gender: 'Female', accessories: ['Big Shades'], trait: 'Big Shades' },
  blondeBobComparison:    { gender: 'Female', accessories: ['Blonde Bob'], trait: 'Blonde Bob' },
  blondeShortComparison:  { gender: 'Female', accessories: ['Blonde Short'], trait: 'Blonde Short' },
  crazyHairComparison:    { gender: 'Female', accessories: ['Crazy Hair'], trait: 'Crazy Hair' },
  orangeSideComparison:   { gender: 'Female', accessories: ['Orange Side'], trait: 'Orange Side' },
  wildBlondeComparison:   { gender: 'Female', accessories: ['Wild Blonde'], trait: 'Wild Blonde' },
  wildWhiteHairComparison: { gender: 'Female', accessories: ['Wild White Hair'], trait: 'Wild White Hair' },
  clownHairGreenComparison: { gender: 'Female', accessories: ['Clown Hair Green'], trait: 'Clown Hair Green' },
  frontBeardComparison:   { gender: 'Male', accessories: ['Front Beard'], trait: 'Front Beard' },
  chokerComparison:       { gender: 'Female', accessories: ['Choker'], trait: 'Choker' },
  smallShadesComparison:  { gender: 'Male', accessories: ['Small Shades'], trait: 'Small Shades' },
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

// A labelled full-sprite box: the whole 24x24 sprite (uncropped) drawn on a
// checkerboard with 0-23 column/row numbers, so coordinates are easy to read off.
function createLabeledSpriteBox(label, sprite) {
  const box = document.createElement('div');
  box.className = 'punk-box';
  const labelDiv = document.createElement('div');
  labelDiv.className = 'label';
  labelDiv.textContent = label;
  box.appendChild(labelDiv);

  const N = SPRITE_SIZE, Z = 9, M = 14; // pixel zoom, margin for numbers
  const canvas = document.createElement('canvas');
  canvas.width = M + N * Z;
  canvas.height = M + N * Z;
  canvas.className = 'labeled-sprite';
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  // checkerboard behind the sprite so transparent pixels are visible
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    ctx.fillStyle = (x + y) % 2 ? '#e9e9e9' : '#f7f7f7';
    ctx.fillRect(M + x * Z, M + y * Z, Z, Z);
  }
  ctx.drawImage(sprite, 0, 0, N, N, M, M, N * Z, N * Z);
  // gridlines
  ctx.strokeStyle = 'rgba(0,0,0,0.07)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= N; i++) {
    ctx.beginPath(); ctx.moveTo(M + i * Z + 0.5, M); ctx.lineTo(M + i * Z + 0.5, M + N * Z); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(M, M + i * Z + 0.5); ctx.lineTo(M + N * Z, M + i * Z + 0.5); ctx.stroke();
  }
  // numbers (every other one to avoid crowding)
  ctx.fillStyle = '#8a8a8a';
  ctx.font = '7px monospace';
  for (let i = 0; i < N; i++) {
    if (i % 2 === 0) {
      ctx.textAlign = 'center'; ctx.fillText(i, M + i * Z + Z / 2, 9);
      ctx.textAlign = 'right'; ctx.fillText(i, M - 3, M + i * Z + Z / 2 + 3);
    }
  }
  const container = document.createElement('div');
  container.className = 'canvas-container';
  container.appendChild(canvas);
  box.appendChild(container);
  return box;
}

// --- Isolated trait sprites (the trait alone, no head behind it) ------------
function spritesEqual(a, b) {
  const da = a.getContext('2d').getImageData(0, 0, SPRITE_SIZE, SPRITE_SIZE).data;
  const db = b.getContext('2d').getImageData(0, 0, SPRITE_SIZE, SPRITE_SIZE).data;
  for (let i = 0; i < da.length; i++) if (da[i] !== db[i]) return false;
  return true;
}

// Prepend an "isolated sprite" row to a section: the trait sprite on its own,
// with no base head. Shows Original -> Remastered when the stacking sprite differs
// from the raw sprite, or a single sprite when it's unchanged.
function prependIsolated(containerId, orig, rem) {
  const container = document.getElementById(containerId);
  if (!container || !orig) return;
  const group = document.createElement('div');
  group.className = 'skin-tone-group isolated-group';

  const title = document.createElement('h4');
  title.textContent = 'Isolated sprite';
  group.appendChild(title);

  const pair = document.createElement('div');
  pair.className = 'punk-pair';
  if (!rem || spritesEqual(orig, rem)) {
    pair.appendChild(createLabeledSpriteBox('Trait sprite', orig));
  } else {
    pair.appendChild(createLabeledSpriteBox('Original', orig));
    pair.appendChild(createArrow());
    pair.appendChild(createLabeledSpriteBox('Remastered', rem));
  }
  group.appendChild(pair);
  container.insertBefore(group, container.firstChild);
}

// For each single-trait section, show the raw sprite vs the stacking compositor's
// remastered sprite (which is exactly what the app renders).
function renderIsolatedSprites() {
  for (const [cid, spec] of Object.entries(SECTIONS)) {
    if (!spec.trait) continue;
    const id = (spec.gender === 'Male' ? MALE_SPRITE_IDS : FEMALE_SPRITE_IDS)[spec.trait];
    if (id == null) continue;
    prependIsolated(cid, traitSprite(id, spec.trait), remasteredSprite(spec.trait));
  }
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

// Render a section as a synthetic punk wearing just the trait(s): Original is the
// un-remastered composite, Remastered is the stacking composite - the exact path
// the app renders, so the preview can never drift from production.
function renderPunkSection(containerId, gender, accessories) {
  const container = document.getElementById(containerId);
  if (!container) return;
  for (const skinTone of SKIN_TONES) {
    const punk = { id: 0, type: 'Human', gender, skinTone, accessories };
    const original = compositePunk(punk, false);
    const remastered = compositePunk(punk, true);
    container.appendChild(createComparison(skinTone, original, remastered));
  }
}

// Frown over a beard: the Original draws the beard over the frown (hiding it) via
// an explicit sprite order; the Remastered uses the stacking path (frown on top).
function renderFrownBeardComparison() {
  const container = document.getElementById('frownBeardComparison');
  for (const skinTone of SKIN_TONES) {
    const beard = extractSprite(MALE_SPRITE_IDS['Normal Beard']);
    const frown = extractSprite(MALE_SPRITE_IDS['Frown']);
    const original = compositeOnMaleBase(skinTone, [frown, beard]);   // beard over frown
    const remastered = compositePunk({ id: 0, type: 'Human', gender: 'Male', skinTone, accessories: ['Normal Beard', 'Frown'] }, true);
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
  bandanaComparison: 157,
  mohawkComparison: 149,
  blondeBobComparison: 143,
  redMohawkComparison: 141,
  wildBlondeComparison: 138,
  wildWhiteHairComparison: 131,
  blondeShortComparison: 123,
  knittedCapComparison: 97,
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

    // The whole page renders through the stacking compositor, so it needs the
    // punk map (to derive the remastered base + hair sprites) the same way the app
    // builds it in App.jsx.
    const punks = await loadPunkData(`${basePath}/data/punks-attributes/original/cryptopunks.csv`);
    initStacking(punks);

    // Every section is a synthetic punk wearing just its trait(s); frown-over-beard
    // needs an explicit original ordering so it's rendered on its own.
    for (const [cid, spec] of Object.entries(SECTIONS)) {
      renderPunkSection(cid, spec.gender, spec.accessories);
    }
    renderFrownBeardComparison();

    // Prepend the isolated trait sprite (no head) to each single-trait section.
    renderIsolatedSprites();

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

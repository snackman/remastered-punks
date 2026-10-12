// Prototype stacking compositor (branch only).
//
// Goal: compose a remastered punk as a pure STACK of edited trait sprites, with
// no composite-time fills / overpaints / guards. Remastered sprites are derived
// once from the current compositor's correct output (`current - base` in the
// trait's region) and then just stacked in layer order.
import { createCompositor } from './compositor.js';
import { getRemasters } from './remaster-logic.js';
import {
  SPRITE_SIZE, FEMALE_SPRITE_IDS, MALE_SPRITE_IDS, SPRITE_COLOR_CORRECTIONS,
  TRAIT_TO_LAYER, LAYER_ORDER,
} from './constants.js';

const EAR_HAIR = ['Blonde Bob', 'Blonde Short', 'Crazy Hair', 'Headband', 'Orange Side',
  'Wild Blonde', 'Clown Hair Green', 'Mohawk', 'Red Mohawk',
  'Bandana', 'Cap', 'Knitted Cap', 'Tiara', 'Wild White Hair'];
const BENIGN = new Set(['Hot Lipstick', 'Black Lipstick', 'Purple Lipstick', 'Mole',
  'Rosy Cheeks', 'Cigarette', 'Pipe']);
const TONES = ['Light', 'Medium', 'Dark', 'Albino'];
// Hairstyles whose hair covers the (6,12) head-side outline in the original.
const EAR_HIDING_AT_6_12 = ['Blonde Bob', 'Blonde Short', 'Wild White Hair', 'Orange Side'];
// Hairstyles that cover the earring in the original: the bead isn't re-asserted on
// top (the hair covers it).
const EARRING_COVERING_HAIR = ['Blonde Bob', 'Wild White Hair', 'Orange Side'];
// Hairstyles where the earring is drawn OVER the hair (bead + frame stay visible on
// top). Blonde Bob and Wild White Hair are NOT here - their hair covers the earring.
const EARRING_OVER_HAIR = ['Orange Side', 'Blonde Short'];

export function createStackCompositor({ createCanvas, getSpriteSheet, punks }) {
  const gfx = createCompositor({ createCanvas, getSpriteSheet });
  const all = Object.values(punks);
  const set = (ctx, x, y, r, g, b, a = 255) => {
    const im = ctx.getImageData(0, 0, SPRITE_SIZE, SPRITE_SIZE);
    const i = (y * SPRITE_SIZE + x) * 4;
    im.data[i] = r; im.data[i + 1] = g; im.data[i + 2] = b; im.data[i + 3] = a;
    ctx.putImageData(im, 0, 0);
  };
  const idData = (canvas) => canvas.getContext('2d').getImageData(0, 0, SPRITE_SIZE, SPRITE_SIZE).data;

  // --- Remastered bases: bg + eye-fixed base + ear shift (or raw for covered ears)
  const baseShift = {}, baseRaw = {};
  for (const t of TONES) { baseShift[t] = gfx.compositeOnBase(t, [], true); baseRaw[t] = gfx.compositeOnBase(t, [], false); }

  // The raw trait sprite (with any spritesheet colour correction applied).
  function rawHair(name) {
    let s = gfx.extractSprite(FEMALE_SPRITE_IDS[name]);
    if (SPRITE_COLOR_CORRECTIONS[name]) s = gfx.recolorSprite(s, SPRITE_COLOR_CORRECTIONS[name], 'Female');
    return s;
  }

  // A remastered female punk is simply the remastered base sprite (ear shifted down,
  // built once above) with the RAW trait sprites stacked on top - no per-punk shift and
  // no derivation. The ear shows through the hair's own gaps; where a hairstyle needs a
  // specific ear-cutout tweak it's applied as an explicit edit below.
  const hairSprites = {};
  for (const h of EAR_HAIR) hairSprites[h] = rawHair(h);
  // Per-hairstyle remastered-trait edits (dictated during visual review).
  const BLONDE = [255, 246, 142];
  const hairEdit = (name, fn) => { if (hairSprites[name]) fn(hairSprites[name].getContext('2d')); };
  // Orange Side's hair extends down 1px to follow the shifted ear, filling (6,15).
  hairEdit('Orange Side', c => set(c, 6, 15, 230, 87, 0));
  // Clown Hair Green: match the sprite live on prod ((7,11) & (6,12) green, (6,15) clear).
  hairEdit('Clown Hair Green', c => {
    set(c, 7, 11, 40, 177, 67); set(c, 6, 12, 40, 177, 67); set(c, 6, 15, 0, 0, 0, 0);
  });
  // Crazy Hair: red at (6,12) and (7,11); transparent at (6,15).
  hairEdit('Crazy Hair', c => { set(c, 6, 12, 226, 38, 38); set(c, 7, 11, 226, 38, 38); set(c, 6, 15, 0, 0, 0, 0); });
  // Blonde Bob (grid coords): blonde at (6,12),(7,12); transparent at (7,14).
  hairEdit('Blonde Bob', c => { set(c, 6, 12, ...BLONDE); set(c, 7, 12, ...BLONDE); set(c, 7, 14, 0, 0, 0, 0); });
  // Blonde Short (grid coords): blonde at (6,12),(7,12),(6,14),(7,15); transparent at (7,14).
  hairEdit('Blonde Short', c => {
    for (const [x, y] of [[6, 12], [7, 12], [6, 14], [7, 15]]) set(c, x, y, ...BLONDE);
    set(c, 7, 14, 0, 0, 0, 0);
  });
  // Wild Blonde: blonde at (6,12),(7,17); transparent at (7,12),(6,15),(7,16).
  hairEdit('Wild Blonde', c => {
    set(c, 6, 12, ...BLONDE); set(c, 7, 17, ...BLONDE);
    set(c, 7, 12, 0, 0, 0, 0); set(c, 6, 15, 0, 0, 0, 0); set(c, 7, 16, 0, 0, 0, 0);
  });
  // Headband: move the ear cutout down 1px (from (7,12)-(7,13) to (7,13)-(7,14)) to
  // follow the shifted ear, keeping (7,11) black and (7,13) transparent.
  if (hairSprites['Headband']) {
    const h = gfx.extractSprite(FEMALE_SPRITE_IDS['Headband']);
    const ctx = h.getContext('2d');
    set(ctx, 7, 12, 0, 0, 0);       // close the top of the old cutout
    set(ctx, 7, 14, 0, 0, 0, 0);    // open the bottom of the new cutout
    hairSprites['Headband'] = h;
  }

  // --- Standalone trait edits
  const edit = (id, fn) => { const c = gfx.extractSprite(id); fn(c.getContext('2d')); return c; };
  const sampleM = (id, x, y) => { const d = idData(gfx.extractSprite(id)); const i = (y * SPRITE_SIZE + x) * 4; return [d[i], d[i + 1], d[i + 2]]; };
  const FB = sampleM(MALE_SPRITE_IDS['Front Beard'], 12, 20), FBD = sampleM(MALE_SPRITE_IDS['Front Beard Dark'], 12, 20);
  const remTrait = {
    'Front Beard': edit(MALE_SPRITE_IDS['Front Beard'], c => { set(c, 10, 20, ...FB); set(c, 14, 20, ...FB); }),
    'Front Beard Dark': edit(MALE_SPRITE_IDS['Front Beard Dark'], c => { set(c, 10, 20, ...FBD); set(c, 14, 20, ...FBD); }),
    'Small Shades': edit(MALE_SPRITE_IDS['Small Shades'], c => { set(c, 11, 12, 0, 0, 0); set(c, 11, 13, 0, 0, 0); }),
  };
  const chokerSprite = (() => { const c = createCanvas(SPRITE_SIZE, SPRITE_SIZE); const x = c.getContext('2d'); for (const px of [9, 10, 11]) set(x, px, 22, 0, 0, 0); return c; })();
  const earringOf = (ids) => { const s = gfx.shiftSpriteDown(gfx.extractSprite(ids['Earring']), 1); set(s.getContext('2d'), 6, 15, 255, 217, 38); return s; };
  // Pilot Helmet: shift only the leftmost ear column (col 6, rows 11-14) down 1px -
  // (6,11) clears and (6,15) takes the helmet green.
  const pilotHelmet = edit(FEMALE_SPRITE_IDS['Pilot Helmet'], c => { set(c, 6, 11, 0, 0, 0, 0); set(c, 6, 15, 45, 107, 98); });
  // Eye Mask (female): remastered ear region - edits dictated during review.
  const eyeMask = edit(FEMALE_SPRITE_IDS['Eye Mask'], c => { /* pixel edits to be dictated */ });
  // Big Shades (female): black pixel at (6,12).
  const bigShades = edit(FEMALE_SPRITE_IDS['Big Shades'], c => { set(c, 6, 12, 0, 0, 0); });
  // Ear-covered hairstyles that leave a gap over the shifted ear get covering pixels
  // so they layer cleanly on the one remastered base. Dark Hair's only gap is (7,14),
  // black across all tones. (Purple Hair also has a gap but has no female punks.)
  const coveredHair = {
    'Dark Hair': edit(FEMALE_SPRITE_IDS['Dark Hair'], c => set(c, 7, 14, 0, 0, 0)),
  };

  function spriteFor(a, P, R, ids) {
    if (EAR_HAIR.includes(a) && R.some(r => r.type === 'ear') && hairSprites[a]) return hairSprites[a];
    if (a === 'Regular Shades' && R.some(r => r.type === 'shades')) return gfx.shiftSpriteDown(gfx.extractSprite(ids[a]), 1);
    if (a === 'Earring' && R.some(r => r.type === 'earring')) return earringOf(ids);
    if (a === 'Pilot Helmet') return pilotHelmet;
    if (a === 'Eye Mask' && P.gender === 'Female') return eyeMask;
    if (a === 'Big Shades' && P.gender === 'Female') return bigShades;
    if (coveredHair[a] && P.gender === 'Female') return coveredHair[a];
    if (remTrait[a] && R.some(r => r.trait === a)) return remTrait[a];
    let s = gfx.extractSprite(ids[a]);
    if (SPRITE_COLOR_CORRECTIONS[a]) s = gfx.recolorSprite(s, SPRITE_COLOR_CORRECTIONS[a], P.gender);
    return s;
  }

  function stackPunk(P) {
    // Non-human types (Zombie/Ape/Alien) use their own base sprites and never get
    // the female ear remaster; defer to the existing compositor for those.
    if (['Zombie', 'Ape', 'Alien'].includes(P.type)) return gfx.compositePunk(P, true);
    const R = getRemasters(P);
    const ids = P.gender === 'Female' ? FEMALE_SPRITE_IDS : MALE_SPRITE_IDS;
    let canvas;
    if (P.gender === 'Female') {
      // Every female sits on the one remastered base (ear shifted down). Ear-covered
      // hairstyles either fully hide the shifted ear or get covering pixels (see
      // coveredHair) so they layer cleanly over it - no dual base needed.
      canvas = createCanvas(SPRITE_SIZE, SPRITE_SIZE);
      canvas.getContext('2d').drawImage(baseShift[P.skinTone], 0, 0);
    } else canvas = gfx.compositeOnMaleBase(P.skinTone, []);
    const ctx = canvas.getContext('2d');
    // Vampire Hair's side strands sit OVER the beard, so bump it past the beard layer.
    // And for the ear-hiding hairstyles the earring is drawn OVER the hair so the
    // (shifted) earring stays visible instead of being buried by the hair.
    const earOverHair = P.accessories.some(h => EARRING_OVER_HAIR.includes(h));
    const layerIdx = (a) => {
      if (a === 'Vampire Hair') return LAYER_ORDER.indexOf('beard') + 0.5;
      if (a === 'Earring' && earOverHair) return LAYER_ORDER.indexOf('hair') + 0.5;
      return LAYER_ORDER.indexOf(TRAIT_TO_LAYER[a] || 'x');
    };
    const acc = [...P.accessories].sort((a, b) => layerIdx(a) - layerIdx(b));
    for (const a of acc) {
      if (a === 'Choker' && R.some(r => r.type === 'choker')) { ctx.drawImage(chokerSprite, 0, 0); continue; }
      if (!ids[a]) continue;
      ctx.drawImage(spriteFor(a, P, R, ids), 0, 0);
    }
    // Earring bead survives on top after the ear shift (hair gap doesn't move) -
    // except for hairstyles that cover the earring entirely in the original (those
    // use the unshifted earring above, so there's no shifted bead to re-assert).
    if (R.some(r => r.type === 'earring') && !P.accessories.some(a => EARRING_COVERING_HAIR.includes(a)))
      set(ctx, 6, 15, 255, 217, 38);
    return canvas;
  }

  // Expose the remastered sprite the compositor uses for a given trait, so preview
  // pages can show the actual stacking sprite (not a hand-rebuilt copy). Returns
  // null for traits whose sprite isn't edited by the remaster.
  function remasteredSprite(name) {
    if (hairSprites[name]) return hairSprites[name];
    if (name === 'Regular Shades') return gfx.shiftSpriteDown(gfx.extractSprite(FEMALE_SPRITE_IDS[name]), 1);
    if (name === 'Earring') return earringOf(FEMALE_SPRITE_IDS);
    if (name === 'Pilot Helmet') return pilotHelmet;
    if (name === 'Eye Mask') return eyeMask;
    if (name === 'Big Shades') return bigShades;
    if (remTrait[name]) return remTrait[name];
    if (name === 'Choker') return chokerSprite;
    return null;
  }

  return { stackPunk, hairSprites, remasteredSprite };
}

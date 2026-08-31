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
  'Wild Blonde', 'Clown Hair Green', 'Mohawk', 'Mohawk Dark', 'Mohawk Thin', 'Red Mohawk',
  'Bandana', 'Cap', 'Knitted Cap', 'Tiara', 'Messy Hair', 'Pigtails', 'Stringy Hair', 'Wild White Hair'];
const BENIGN = new Set(['Hot Lipstick', 'Black Lipstick', 'Purple Lipstick', 'Mole',
  'Rosy Cheeks', 'Cigarette', 'Pipe']);
const TONES = ['Light', 'Medium', 'Dark', 'Albino'];

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

  // --- Derive each ear-visible hairstyle sprite: current - base (transparent where equal)
  function deriveHair(name) {
    const cand = all.filter(p => p.gender === 'Female' && p.accessories.includes(name)
      && getRemasters(p).some(r => r.type === 'ear')
      && p.accessories.every(a => a === name || BENIGN.has(a)));
    if (!cand.length) return null;
    cand.sort((a, b) => a.accessories.length - b.accessories.length);
    const p = cand[0];
    const cur = idData(gfx.compositePunk(p, true));
    const base = idData(baseShift[p.skinTone]);
    const spr = gfx.extractSprite(FEMALE_SPRITE_IDS[name]);
    const im = spr.getContext('2d').getImageData(0, 0, SPRITE_SIZE, SPRITE_SIZE);
    for (let i = 0; i < im.data.length; i += 4) {
      if (cur[i] !== base[i] || cur[i + 1] !== base[i + 1] || cur[i + 2] !== base[i + 2]) {
        im.data[i] = cur[i]; im.data[i + 1] = cur[i + 1]; im.data[i + 2] = cur[i + 2]; im.data[i + 3] = 255;
      } else im.data[i + 3] = 0;
    }
    spr.getContext('2d').putImageData(im, 0, 0);
    return spr;
  }
  const hairSprites = {};
  for (const h of EAR_HAIR) hairSprites[h] = deriveHair(h);

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
  const glass = (name, ids) => edit(ids[name], c => { set(c, 6, 12, 0, 0, 0); if (name === 'Nerd Glasses') set(c, 7, 12, 0, 0, 0); });
  const earringOf = (ids) => { const s = gfx.shiftSpriteDown(gfx.extractSprite(ids['Earring']), 1); set(s.getContext('2d'), 6, 15, 255, 217, 38); return s; };

  function spriteFor(a, P, R, ids) {
    if (EAR_HAIR.includes(a) && R.some(r => r.type === 'ear') && hairSprites[a]) return hairSprites[a];
    if (a === 'Regular Shades' && R.some(r => r.type === 'shades')) return gfx.shiftSpriteDown(gfx.extractSprite(ids[a]), 1);
    if (a === 'Earring' && R.some(r => r.type === 'earring')) return earringOf(ids);
    if (remTrait[a] && R.some(r => r.trait === a)) return remTrait[a];
    if ((a === 'Nerd Glasses' || a === 'Horned Rim Glasses' || a === '3D Glasses') && R.some(r => r.type === 'ear') && P.gender === 'Female') return glass(a, ids);
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
      const src = R.some(r => r.type === 'ear') ? baseShift[P.skinTone] : baseRaw[P.skinTone];
      canvas = createCanvas(SPRITE_SIZE, SPRITE_SIZE);
      canvas.getContext('2d').drawImage(src, 0, 0);
    } else canvas = gfx.compositeOnMaleBase(P.skinTone, []);
    const ctx = canvas.getContext('2d');
    const acc = [...P.accessories].sort((a, b) =>
      LAYER_ORDER.indexOf(TRAIT_TO_LAYER[a] || 'x') - LAYER_ORDER.indexOf(TRAIT_TO_LAYER[b] || 'x'));
    for (const a of acc) {
      if (a === 'Choker' && R.some(r => r.type === 'choker')) { ctx.drawImage(chokerSprite, 0, 0); continue; }
      if (!ids[a]) continue;
      ctx.drawImage(spriteFor(a, P, R, ids), 0, 0);
    }
    // Earring bead survives on top after the ear shift (hair gap doesn't move).
    if (R.some(r => r.type === 'earring')) set(ctx, 6, 15, 255, 217, 38);
    return canvas;
  }

  return { stackPunk };
}

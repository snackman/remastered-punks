// Shared punk compositor — the single source of truth for all remaster rendering.
//
// The only thing that differs between environments is how a canvas is created
// (`document.createElement('canvas')` in the browser vs `createCanvas()` from
// @napi-rs/canvas on the server). Everything else — pixel manipulation via
// getImageData/putImageData, the ear shift, fills, eye fix, colour corrections —
// is identical, so it lives here once.
//
// Usage: const gfx = createCompositor({ createCanvas, getSpriteSheet })
//   createCanvas(w, h)  -> a canvas exposing getContext('2d')
//   getSpriteSheet()    -> the loaded 24x24 spritesheet image
//
// The frontend app, the traits preview page, and the API image endpoint all
// build one of these and share every remaster rule.

import {
  SPRITE_SIZE,
  SPRITESHEET_COLS,
  FEMALE_SPRITE_IDS,
  MALE_SPRITE_IDS,
  LAYER_ORDER,
  TRAIT_TO_LAYER,
  SKIN_COLORS,
  TRAIT_FILL_COLORS,
  SPRITE_COLOR_CORRECTIONS,
} from './constants.js';
import { getRemasters } from './remaster-logic.js';

const BG_FILL = '#638596';
const APE_EYE_SHADOW = { shadowR: 169, shadowG: 140, shadowB: 107 };

export function createCompositor({ createCanvas, getSpriteSheet }) {
  function makeCanvas() {
    return createCanvas(SPRITE_SIZE, SPRITE_SIZE);
  }

  function extractSprite(spriteId) {
    const sheet = getSpriteSheet();
    if (!sheet) throw new Error('Sprite sheet not loaded');
    const row = Math.floor(spriteId / SPRITESHEET_COLS);
    const col = spriteId % SPRITESHEET_COLS;
    const canvas = makeCanvas();
    const ctx = canvas.getContext('2d');
    ctx.drawImage(sheet, col * SPRITE_SIZE, row * SPRITE_SIZE, SPRITE_SIZE, SPRITE_SIZE, 0, 0, SPRITE_SIZE, SPRITE_SIZE);
    return canvas;
  }

  // Apply sprite corrections. Colour rules ({from,to}) recolor every matching
  // pixel; position rules ({at:[x,y],to}) paint a specific pixel regardless of
  // its colour. Colour rules run first so a position rule can override them.
  function recolorSprite(canvas, corrections, gender) {
    // A rule with a `gender` field only applies to that gender's sprite (some
    // spritesheet fixes differ between the male and female art).
    const applies = (rule) => !rule.gender || rule.gender === gender;
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, SPRITE_SIZE, SPRITE_SIZE);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] === 0) continue;
      for (const rule of corrections) {
        if (!rule.from || !applies(rule)) continue;
        if (data[i] === rule.from[0] && data[i + 1] === rule.from[1] && data[i + 2] === rule.from[2]) {
          data[i] = rule.to[0]; data[i + 1] = rule.to[1]; data[i + 2] = rule.to[2];
          break;
        }
      }
    }
    for (const rule of corrections) {
      if (!rule.at || !applies(rule)) continue;
      const idx = (rule.at[1] * SPRITE_SIZE + rule.at[0]) * 4;
      data[idx] = rule.to[0]; data[idx + 1] = rule.to[1]; data[idx + 2] = rule.to[2]; data[idx + 3] = 255;
    }
    ctx.putImageData(imageData, 0, 0);
    return canvas;
  }

  // Is (r,g,b) the punk's skin tone (base or shadow shade)? Used so the ear
  // reconstruction can tell "plain skin/background it may repaint" apart from a
  // feature (eyewear band, blemish) that must be preserved.
  function isSkinTone(r, g, b, tone) {
    const s = SKIN_COLORS[tone];
    if (!s) return false;
    const near = (a, e, f, d, h, i) =>
      Math.abs(a - d) <= 18 && Math.abs(e - h) <= 18 && Math.abs(f - i) <= 18;
    return near(r, g, b, s.r, s.g, s.b) || near(r, g, b, s.shadowR, s.shadowG, s.shadowB);
  }
  function isBackgroundColor(r, g, b) {
    return Math.abs(r - 99) <= 14 && Math.abs(g - 133) <= 14 && Math.abs(b - 150) <= 14;
  }

  function shiftSpriteDown(canvas, pixels) {
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, SPRITE_SIZE, SPRITE_SIZE);
    const shifted = ctx.createImageData(SPRITE_SIZE, SPRITE_SIZE);

    for (let y = 0; y < SPRITE_SIZE - pixels; y++) {
      for (let x = 0; x < SPRITE_SIZE; x++) {
        const srcIdx = (y * SPRITE_SIZE + x) * 4;
        const dstIdx = ((y + pixels) * SPRITE_SIZE + x) * 4;
        shifted.data[dstIdx] = imageData.data[srcIdx];
        shifted.data[dstIdx + 1] = imageData.data[srcIdx + 1];
        shifted.data[dstIdx + 2] = imageData.data[srcIdx + 2];
        shifted.data[dstIdx + 3] = imageData.data[srcIdx + 3];
      }
    }

    const result = makeCanvas();
    result.getContext('2d').putImageData(shifted, 0, 0);
    return result;
  }

  function shiftSinglePixel(spriteCanvas, px, py) {
    const canvas = makeCanvas();
    const ctx = canvas.getContext('2d');
    ctx.drawImage(spriteCanvas, 0, 0);

    const imageData = ctx.getImageData(0, 0, SPRITE_SIZE, SPRITE_SIZE);
    const data = imageData.data;

    const srcIdx = (py * SPRITE_SIZE + px) * 4;
    const r = data[srcIdx], g = data[srcIdx + 1], b = data[srcIdx + 2], a = data[srcIdx + 3];

    data[srcIdx] = 0;
    data[srcIdx + 1] = 0;
    data[srcIdx + 2] = 0;
    data[srcIdx + 3] = 0;

    const dstIdx = ((py + 1) * SPRITE_SIZE + px) * 4;
    data[dstIdx] = r;
    data[dstIdx + 1] = g;
    data[dstIdx + 2] = b;
    data[dstIdx + 3] = a;

    ctx.putImageData(imageData, 0, 0);
    return canvas;
  }

  function shiftEarOnBase(baseCanvas, fillColor = { r: 0, g: 0, b: 0, x: 7 }) {
    const canvas = makeCanvas();
    const ctx = canvas.getContext('2d');
    ctx.drawImage(baseCanvas, 0, 0);

    const imageData = ctx.getImageData(0, 0, SPRITE_SIZE, SPRITE_SIZE);
    const data = imageData.data;

    const BG = { r: 99, g: 133, b: 150 };
    const earPixels = [];
    let topEarY = 24;

    for (let x = 6; x <= 7; x++) {
      for (let y = 11; y <= 14; y++) {
        const idx = (y * SPRITE_SIZE + x) * 4;
        const r = data[idx], g = data[idx + 1], b = data[idx + 2], a = data[idx + 3];

        if (a === 0) continue;
        if (Math.abs(r - BG.r) < 10 && Math.abs(g - BG.g) < 10 && Math.abs(b - BG.b) < 10) continue;

        if (x === 7) {
          if (y !== 12 && y !== 13 && y !== 14) continue;
        }

        earPixels.push({ x, y, r, g, b, a });
        if (x === 6 && y < topEarY) topEarY = y;
      }
    }

    for (const p of earPixels) {
      const idx = (p.y * SPRITE_SIZE + p.x) * 4;
      data[idx] = BG.r;
      data[idx + 1] = BG.g;
      data[idx + 2] = BG.b;
      data[idx + 3] = 255;
    }

    for (const p of earPixels) {
      const newY = p.y + 1;
      if (newY < SPRITE_SIZE) {
        const idx = (newY * SPRITE_SIZE + p.x) * 4;
        data[idx] = p.r;
        data[idx + 1] = p.g;
        data[idx + 2] = p.b;
        data[idx + 3] = p.a;
      }
    }

    if (topEarY < 24 && !fillColor.noFill) {
      if (fillColor.fills) {
        for (const fill of fillColor.fills) {
          const fillY = fill.y !== undefined ? topEarY + fill.y : topEarY;
          const idx = (fillY * SPRITE_SIZE + fill.x) * 4;
          data[idx] = fill.r;
          data[idx + 1] = fill.g;
          data[idx + 2] = fill.b;
          data[idx + 3] = 255;
        }
      } else {
        const fillX = fillColor.x !== undefined ? fillColor.x : 7;
        const idx = (topEarY * SPRITE_SIZE + fillX) * 4;
        data[idx] = fillColor.r;
        data[idx + 1] = fillColor.g;
        data[idx + 2] = fillColor.b;
        data[idx + 3] = 255;
      }
    }

    ctx.putImageData(imageData, 0, 0);
    return canvas;
  }

  // Recolor the stray white sclera on a base sprite to the per-tone eye shadow.
  // Human females have eyes at y=13; human males and Apes one row up at y=12.
  function fixBaseEyes(baseSprite, punk, isFemale) {
    const humanShadow = SKIN_COLORS[punk.skinTone];
    const eyeShadow = humanShadow || (punk.type === 'Ape' ? APE_EYE_SHADOW : null);
    if (!eyeShadow) return;
    const baseCtx = baseSprite.getContext('2d');
    const imageData = baseCtx.getImageData(0, 0, SPRITE_SIZE, SPRITE_SIZE);
    const eyeRow = (humanShadow && isFemale) ? 13 : 12;
    for (const x of [10, 15]) {
      const idx = (eyeRow * SPRITE_SIZE + x) * 4;
      imageData.data[idx] = eyeShadow.shadowR;
      imageData.data[idx + 1] = eyeShadow.shadowG;
      imageData.data[idx + 2] = eyeShadow.shadowB;
      imageData.data[idx + 3] = 255;
    }
    baseCtx.putImageData(imageData, 0, 0);
  }

  // Wild Blonde: hand-tuned outline pixels below the ear. Done as a final
  // overpaint (rather than via TRAIT_FILL_COLORS) so they don't leave a stray
  // copy one row below in the base pass.
  function applyWildBlondeOutline(ctx) {
    const imageData = ctx.getImageData(0, 0, SPRITE_SIZE, SPRITE_SIZE);
    const data = imageData.data;
    const set = (x, y, r, g, b) => {
      const i = (y * SPRITE_SIZE + x) * 4;
      data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = 255;
    };
    set(6, 15, 0, 0, 0);         // extend head outline one pixel below the ear
    set(7, 16, 0, 0, 0);         // black
    set(7, 17, 255, 246, 142);   // blonde
    ctx.putImageData(imageData, 0, 0);
  }

  // Composite a full punk (base head + all its accessories), optionally applying
  // the remaster corrections. Used by the frontend app and the API endpoint.
  function compositePunk(punk, applyRemasters = false) {
    const canvas = makeCanvas();
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = BG_FILL;
    ctx.fillRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);

    const isFemale = punk.gender === 'Female';
    const spriteIds = isFemale ? FEMALE_SPRITE_IDS : MALE_SPRITE_IDS;
    const isNonHuman = ['Zombie', 'Ape', 'Alien'].includes(punk.type);
    const baseKey = isNonHuman ? `base_${punk.type}` : `base_${punk.skinTone}`;
    let baseSprite = extractSprite(spriteIds[baseKey]);

    fixBaseEyes(baseSprite, punk, isFemale);

    const remasters = applyRemasters ? getRemasters(punk) : [];
    const earRemaster = remasters.find(r => r.type === 'ear');

    // Apply ear shift if needed
    if (earRemaster && isFemale) {
      let fillColor = TRAIT_FILL_COLORS[earRemaster.trait] || { r: 0, g: 0, b: 0 };

      if (fillColor.fills && SKIN_COLORS[punk.skinTone]) {
        const skin = SKIN_COLORS[punk.skinTone];
        fillColor = { ...fillColor, fills: fillColor.fills.map(fill =>
          fill.useSkinColor ? { ...fill, r: skin.r, g: skin.g, b: skin.b } : fill
        ) };
      }

      baseSprite = shiftEarOnBase(baseSprite, fillColor);

      if (fillColor.extraEarSkin && SKIN_COLORS[punk.skinTone]) {
        const baseCtx = baseSprite.getContext('2d');
        const skin = SKIN_COLORS[punk.skinTone];
        const imageData = baseCtx.getImageData(0, 0, SPRITE_SIZE, SPRITE_SIZE);
        for (const y of [15, 16]) {
          const idx = (y * SPRITE_SIZE + 7) * 4;
          imageData.data[idx] = skin.r;
          imageData.data[idx + 1] = skin.g;
          imageData.data[idx + 2] = skin.b;
          imageData.data[idx + 3] = 255;
        }
        baseCtx.putImageData(imageData, 0, 0);
      }
    }

    ctx.drawImage(baseSprite, 0, 0);

    // Sort accessories by layer order
    const sortedAccessories = [...punk.accessories].sort((a, b) => {
      const layerA = TRAIT_TO_LAYER[a] || 'unknown';
      const layerB = TRAIT_TO_LAYER[b] || 'unknown';
      return LAYER_ORDER.indexOf(layerA) - LAYER_ORDER.indexOf(layerB);
    });

    for (const acc of sortedAccessories) {
      // Skip Choker if we're remastering it (we'll draw it differently)
      if (applyRemasters && acc === 'Choker' && remasters.find(r => r.type === 'choker')) {
        continue;
      }

      const spriteId = spriteIds[acc];
      if (!spriteId) {
        console.warn('No sprite found for:', acc, 'gender:', punk.gender);
        continue;
      }

      let sprite = extractSprite(spriteId);

      // Correct spritesheet colors that differ from the canonical punks.png art.
      const colorCorrection = SPRITE_COLOR_CORRECTIONS[acc];
      if (colorCorrection) {
        sprite = recolorSprite(sprite, colorCorrection, punk.gender);
      }

      if (applyRemasters) {
        // Shift the whole Regular Shades frame down 1px (top row included), so
        // the lowered frame doesn't leave a doubled top edge.
        if (acc === 'Regular Shades' && remasters.find(r => r.type === 'shades')) {
          sprite = shiftSpriteDown(sprite, 1);
        }

        // Shift Earring if ear is visible
        if (acc === 'Earring' && remasters.find(r => r.type === 'earring')) {
          sprite = shiftSpriteDown(sprite, 1);
        }

        // Add pixels to Small Shades
        if (acc === 'Small Shades' && remasters.find(r => r.type === 'smallShades')) {
          const spriteCtx = sprite.getContext('2d');
          const imageData = spriteCtx.getImageData(0, 0, SPRITE_SIZE, SPRITE_SIZE);
          const data = imageData.data;
          for (const y of [12, 13]) {
            const idx = (y * SPRITE_SIZE + 11) * 4;
            data[idx] = 0;
            data[idx + 1] = 0;
            data[idx + 2] = 0;
            data[idx + 3] = 255;
          }
          spriteCtx.putImageData(imageData, 0, 0);
        }

        // Extend the front beard down at its two bottom corners. Sample the
        // beard's own colour from a solid beard pixel so the added corners match
        // the rest of the beard exactly (works for both Front Beard variants).
        if ((acc === 'Front Beard' && remasters.find(r => r.type === 'frontBeard')) ||
            (acc === 'Front Beard Dark' && remasters.find(r => r.type === 'frontBeardDark'))) {
          const spriteCtx = sprite.getContext('2d');
          const imageData = spriteCtx.getImageData(0, 0, SPRITE_SIZE, SPRITE_SIZE);
          const data = imageData.data;
          const sampleIdx = (20 * SPRITE_SIZE + 12) * 4; // a solid beard pixel
          const beardColor = { r: data[sampleIdx], g: data[sampleIdx + 1], b: data[sampleIdx + 2] };
          for (const x of [10, 14]) {
            const idx = (20 * SPRITE_SIZE + x) * 4;
            data[idx] = beardColor.r;
            data[idx + 1] = beardColor.g;
            data[idx + 2] = beardColor.b;
            data[idx + 3] = 255;
          }
          spriteCtx.putImageData(imageData, 0, 0);
        }

        // Handle shifted pixel for certain hairstyles
        const fillConfig = TRAIT_FILL_COLORS[acc];
        if (fillConfig && fillConfig.shiftPixel && earRemaster) {
          sprite = shiftSinglePixel(sprite, fillConfig.shiftPixel.x, fillConfig.shiftPixel.y);
        }
      }

      ctx.drawImage(sprite, 0, 0);
    }

    // Vampire Hair: its lower side-strands hang over the beard in the original,
    // but the beard layer draws above hair, covering them. Re-draw the hair's
    // lower rows (below the hat line) on top when a beard is present.
    if (punk.accessories.includes('Vampire Hair')
        && punk.accessories.some(a => TRAIT_TO_LAYER[a] === 'beard')) {
      const vh = extractSprite(spriteIds['Vampire Hair']);
      const vd = vh.getContext('2d').getImageData(0, 0, SPRITE_SIZE, SPRITE_SIZE).data;
      const imageData = ctx.getImageData(0, 0, SPRITE_SIZE, SPRITE_SIZE);
      const data = imageData.data;
      for (let y = 14; y < SPRITE_SIZE; y++) {
        for (let x = 0; x < SPRITE_SIZE; x++) {
          const i = (y * SPRITE_SIZE + x) * 4;
          if (vd[i + 3] > 0) {
            data[i] = vd[i]; data[i + 1] = vd[i + 1]; data[i + 2] = vd[i + 2]; data[i + 3] = 255;
          }
        }
      }
      ctx.putImageData(imageData, 0, 0);
    }

    // Apply post-sprite fills for ear remaster
    if (applyRemasters && earRemaster && TRAIT_FILL_COLORS[earRemaster.trait]) {
      const fillColor = TRAIT_FILL_COLORS[earRemaster.trait];
      if (fillColor.fills) {
        const imageData = ctx.getImageData(0, 0, SPRITE_SIZE, SPRITE_SIZE);
        const data = imageData.data;
        // For skin-color ear fills, sample the un-remastered original so we can
        // preserve a non-skin feature that legitimately sits over the ear (VR
        // band on #8787, Spots blemish on #5339) instead of painting skin over
        // it. Only needed when at least one fill uses skin colour.
        let refData = null;
        if (fillColor.fills.some(f => f.useSkinColor)) {
          refData = compositePunk(punk, false)
            .getContext('2d').getImageData(0, 0, SPRITE_SIZE, SPRITE_SIZE).data;
        }
        const topEarY = 11;
        for (const fill of fillColor.fills) {
          if (fill.y !== undefined && fill.y !== 0) {
            const fillY = topEarY + fill.y;
            const idx = (fillY * SPRITE_SIZE + fill.x) * 4;
            let r = fill.r, g = fill.g, b = fill.b;
            if (fill.useSkinColor && SKIN_COLORS[punk.skinTone]) {
              const skin = SKIN_COLORS[punk.skinTone];
              r = skin.r; g = skin.g; b = skin.b;
              // Keep an original feature pixel here (opaque and neither skin nor
              // background) rather than repainting it as skin.
              if (refData && refData[idx + 3] > 0
                  && !isSkinTone(refData[idx], refData[idx + 1], refData[idx + 2], punk.skinTone)
                  && !isBackgroundColor(refData[idx], refData[idx + 1], refData[idx + 2])) {
                r = refData[idx]; g = refData[idx + 1]; b = refData[idx + 2];
              }
            }
            data[idx] = r;
            data[idx + 1] = g;
            data[idx + 2] = b;
            data[idx + 3] = 255;
          }
        }
        ctx.putImageData(imageData, 0, 0);
      }
    }

    // Draw remastered Choker
    if (applyRemasters && remasters.find(r => r.type === 'choker')) {
      const imageData = ctx.getImageData(0, 0, SPRITE_SIZE, SPRITE_SIZE);
      const data = imageData.data;
      for (const x of [9, 10, 11]) {
        const idx = (22 * SPRITE_SIZE + x) * 4;
        data[idx] = 0;
        data[idx + 1] = 0;
        data[idx + 2] = 0;
        data[idx + 3] = 255;
      }
      ctx.putImageData(imageData, 0, 0);
    }

    // Wild Blonde: hand-tuned outline pixels below the ear (shared with the
    // traits preview so both stay identical). Runs before the earring re-assert
    // so the earring bead wins where they overlap (at 6,15).
    if (applyRemasters && earRemaster && earRemaster.trait === 'Wild Blonde') {
      applyWildBlondeOutline(ctx);
    }

    // Re-assert the earring's gold bead and the black frame pixel below it. When
    // the ear shifts down, some hairstyle reconstruction fills (e.g. Blonde Short,
    // Headband) paint over where the shifted earring hangs, hiding the gold and its
    // bottom outline. Runs last so the earring survives the Wild Blonde outline too.
    if (applyRemasters && remasters.find(r => r.type === 'earring')) {
      const imageData = ctx.getImageData(0, 0, SPRITE_SIZE, SPRITE_SIZE);
      const data = imageData.data;
      const goldIdx = (15 * SPRITE_SIZE + 6) * 4;
      data[goldIdx] = 255; data[goldIdx + 1] = 217; data[goldIdx + 2] = 38; data[goldIdx + 3] = 255;
      const blackIdx = (16 * SPRITE_SIZE + 6) * 4;
      data[blackIdx] = 0; data[blackIdx + 1] = 0; data[blackIdx + 2] = 0; data[blackIdx + 3] = 255;
      ctx.putImageData(imageData, 0, 0);
    }

    // Nerd Glasses / Horned Rim Glasses / 3D Glasses (female): the ear shift
    // drops the pixel above the three black pixels to the left of the ear/glasses
    // (6,12). Restore it from the un-remastered original - black where it's the
    // ear outline or glasses frame, hair where a hairstyle covers it.
    if (applyRemasters && earRemaster
        && (punk.accessories.includes('Nerd Glasses')
            || punk.accessories.includes('Horned Rim Glasses')
            || punk.accessories.includes('3D Glasses'))) {
      const orig = compositePunk(punk, false)
        .getContext('2d').getImageData(0, 0, SPRITE_SIZE, SPRITE_SIZE).data;
      const imageData = ctx.getImageData(0, 0, SPRITE_SIZE, SPRITE_SIZE);
      const data = imageData.data;
      // (6,12): pixel above the three black frame pixels to the left of the ear.
      // (7,12): Nerd Glasses frame arm directly above the ear - a hair fill
      // (Blonde Short) can overpaint it, so restore it from the original too.
      const restore = punk.accessories.includes('Nerd Glasses') ? [[6, 12], [7, 12]] : [[6, 12]];
      for (const [x, y] of restore) {
        const idx = (y * SPRITE_SIZE + x) * 4;
        data[idx] = orig[idx]; data[idx + 1] = orig[idx + 1];
        data[idx + 2] = orig[idx + 2]; data[idx + 3] = 255;
      }
      ctx.putImageData(imageData, 0, 0);
    }

    // Earring over a coloured hairstyle: the earring's left (5,15) and bottom
    // (6,16) frame pixels sit in the hair, so tint them the hair colour (keeping
    // the gold bead at 6,15). Matches the original for each hairstyle.
    const EARRING_HAIR_TINT = {
      'Wild Blonde': [255, 246, 142],
      'Crazy Hair': [226, 38, 38],
      'Clown Hair Green': [40, 177, 67],
    };
    if (applyRemasters && earRemaster && remasters.find(r => r.type === 'earring')
        && EARRING_HAIR_TINT[earRemaster.trait]) {
      const [tr, tg, tb] = EARRING_HAIR_TINT[earRemaster.trait];
      const imageData = ctx.getImageData(0, 0, SPRITE_SIZE, SPRITE_SIZE);
      const data = imageData.data;
      for (const [x, y] of [[5, 15], [6, 16]]) {
        const idx = (y * SPRITE_SIZE + x) * 4;
        data[idx] = tr; data[idx + 1] = tg; data[idx + 2] = tb; data[idx + 3] = 255;
      }
      ctx.putImageData(imageData, 0, 0);
    }

    // Blonde Bob + Earring: the earring reconstruction leaves a black pixel
    // diagonally up-right of the gold bead (7,14). Show ear skin there instead.
    // Gated on the pixel being black, so a feature (VR band on #8787) is kept;
    // Eye Mask (#7180) has its own black strap there, so skip it.
    if (applyRemasters && earRemaster && earRemaster.trait === 'Blonde Bob'
        && remasters.find(r => r.type === 'earring') && SKIN_COLORS[punk.skinTone]
        && !punk.accessories.includes('Eye Mask')) {
      const idx = (14 * SPRITE_SIZE + 7) * 4;
      const imageData = ctx.getImageData(0, 0, SPRITE_SIZE, SPRITE_SIZE);
      const data = imageData.data;
      if (data[idx] < 45 && data[idx + 1] < 45 && data[idx + 2] < 45) {
        const skin = SKIN_COLORS[punk.skinTone];
        data[idx] = skin.r; data[idx + 1] = skin.g; data[idx + 2] = skin.b; data[idx + 3] = 255;
        ctx.putImageData(imageData, 0, 0);
      }
    }

    // Headband: the ear remaster shifts the whole ear down 1px. The two visible
    // ear-skin pixels move from (7,12),(7,13) to (7,13),(7,14); the pixel above
    // becomes head outline. Skip when the ear is covered (e.g. Eye Mask leaves
    // it black).
    if (applyRemasters && earRemaster && earRemaster.trait === 'Headband' && SKIN_COLORS[punk.skinTone]) {
      const skin = SKIN_COLORS[punk.skinTone];
      const imageData = ctx.getImageData(0, 0, SPRITE_SIZE, SPRITE_SIZE);
      const data = imageData.data;
      const at = (x, y) => (y * SPRITE_SIZE + x) * 4;
      const earVisible = isSkinTone(data[at(7,12)], data[at(7,12)+1], data[at(7,12)+2], punk.skinTone)
        || isSkinTone(data[at(7,13)], data[at(7,13)+1], data[at(7,13)+2], punk.skinTone);
      if (earVisible) {
        const setPix = (x, y, r, g, b) => { const i = at(x, y); data[i]=r; data[i+1]=g; data[i+2]=b; data[i+3]=255; };
        setPix(7, 12, 0, 0, 0);
        setPix(7, 13, skin.r, skin.g, skin.b);
        setPix(7, 14, skin.r, skin.g, skin.b);
        ctx.putImageData(imageData, 0, 0);
      }
    }

    // Blonde Bob: shift the whole ear down 1px too. The two ear-skin pixels move
    // from (7,12),(7,13) to (7,13),(7,14); blonde hair fills the pixel above.
    if (applyRemasters && earRemaster && earRemaster.trait === 'Blonde Bob' && SKIN_COLORS[punk.skinTone]) {
      const skin = SKIN_COLORS[punk.skinTone];
      const imageData = ctx.getImageData(0, 0, SPRITE_SIZE, SPRITE_SIZE);
      const data = imageData.data;
      const at = (x, y) => (y * SPRITE_SIZE + x) * 4;
      const earVisible = isSkinTone(data[at(7,12)], data[at(7,12)+1], data[at(7,12)+2], punk.skinTone)
        || isSkinTone(data[at(7,13)], data[at(7,13)+1], data[at(7,13)+2], punk.skinTone);
      if (earVisible) {
        const setPix = (x, y, r, g, b) => { const i = at(x, y); data[i]=r; data[i+1]=g; data[i+2]=b; data[i+3]=255; };
        setPix(7, 12, 255, 246, 142);
        setPix(7, 13, skin.r, skin.g, skin.b);
        setPix(7, 14, skin.r, skin.g, skin.b);
        ctx.putImageData(imageData, 0, 0);
      }
    }

    // Regular Shades (shifted down): the frame's top row moves from row 11 to
    // row 12, but the ear-skin reconstruction lands on (7,12) and paints over
    // the frame there. Re-assert that frame pixel black (runs after the ear
    // shifts so it wins on Blonde Bob/Short/Headband + Regular Shades).
    if (applyRemasters && remasters.find(r => r.type === 'shades')) {
      const imageData = ctx.getImageData(0, 0, SPRITE_SIZE, SPRITE_SIZE);
      const data = imageData.data;
      const idx = (12 * SPRITE_SIZE + 7) * 4;
      data[idx] = 0; data[idx + 1] = 0; data[idx + 2] = 0; data[idx + 3] = 255;
      ctx.putImageData(imageData, 0, 0);
    }

    return canvas;
  }

  // --- Traits-preview compositors (single trait on a plain head) -------------

  // Composite one or more pre-extracted trait sprites on a female base head.
  // `traitName` selects the ear-reconstruction fills; `shiftEar` applies the
  // ear-down remaster. Used by the All-Traits preview page.
  function compositeOnBase(skinTone, sprites, shiftEar = false, traitName = null) {
    const canvas = makeCanvas();
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = BG_FILL;
    ctx.fillRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);

    let base = extractSprite(FEMALE_SPRITE_IDS[`base_${skinTone}`]);
    fixBaseEyes(base, { skinTone }, true);

    if (shiftEar) {
      let fillColor = (traitName && TRAIT_FILL_COLORS[traitName]) || { r: 0, g: 0, b: 0 };
      if (fillColor.useSkinColor && SKIN_COLORS[skinTone]) {
        const skin = SKIN_COLORS[skinTone];
        fillColor = { ...fillColor, r: skin.r, g: skin.g, b: skin.b };
      }
      if (fillColor.fills && SKIN_COLORS[skinTone]) {
        const skin = SKIN_COLORS[skinTone];
        fillColor = { ...fillColor, fills: fillColor.fills.map(fill =>
          fill.useSkinColor ? { ...fill, r: skin.r, g: skin.g, b: skin.b } : fill
        ) };
      }
      base = shiftEarOnBase(base, fillColor);

      if (fillColor.extraEarSkin && SKIN_COLORS[skinTone]) {
        const baseCtx = base.getContext('2d');
        const skin = SKIN_COLORS[skinTone];
        const imageData = baseCtx.getImageData(0, 0, SPRITE_SIZE, SPRITE_SIZE);
        for (const y of [15, 16]) {
          const idx = (y * SPRITE_SIZE + 7) * 4;
          imageData.data[idx] = skin.r;
          imageData.data[idx + 1] = skin.g;
          imageData.data[idx + 2] = skin.b;
          imageData.data[idx + 3] = 255;
        }
        baseCtx.putImageData(imageData, 0, 0);
      }
    }
    ctx.drawImage(base, 0, 0);

    for (const sprite of sprites) {
      ctx.drawImage(sprite, 0, 0);
    }

    // Post-sprite fills (explicit y offset that must override the trait sprite).
    if (shiftEar && traitName && TRAIT_FILL_COLORS[traitName] && TRAIT_FILL_COLORS[traitName].fills) {
      const imageData = ctx.getImageData(0, 0, SPRITE_SIZE, SPRITE_SIZE);
      const data = imageData.data;
      const topEarY = 11;
      for (const fill of TRAIT_FILL_COLORS[traitName].fills) {
        if (fill.y !== undefined && fill.y !== 0) {
          const fillY = topEarY + fill.y;
          let r = fill.r, g = fill.g, b = fill.b;
          if (fill.useSkinColor && SKIN_COLORS[skinTone]) {
            const skin = SKIN_COLORS[skinTone];
            r = skin.r; g = skin.g; b = skin.b;
          }
          const idx = (fillY * SPRITE_SIZE + fill.x) * 4;
          data[idx] = r;
          data[idx + 1] = g;
          data[idx + 2] = b;
          data[idx + 3] = 255;
        }
      }
      ctx.putImageData(imageData, 0, 0);
    }

    if (shiftEar && traitName === 'Wild Blonde') {
      applyWildBlondeOutline(ctx);
    }

    return canvas;
  }

  // Composite pre-extracted trait sprites on a male base head.
  function compositeOnMaleBase(skinTone, sprites) {
    const canvas = makeCanvas();
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = BG_FILL;
    ctx.fillRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);

    const base = extractSprite(MALE_SPRITE_IDS[`base_${skinTone}`]);
    // Fix male eyes: recolor the stray white sclera at (10,12)/(15,12).
    if (SKIN_COLORS[skinTone]) {
      const bctx = base.getContext('2d');
      const imageData = bctx.getImageData(0, 0, SPRITE_SIZE, SPRITE_SIZE);
      const shadow = SKIN_COLORS[skinTone];
      for (const x of [10, 15]) {
        const idx = (12 * SPRITE_SIZE + x) * 4;
        imageData.data[idx] = shadow.shadowR;
        imageData.data[idx + 1] = shadow.shadowG;
        imageData.data[idx + 2] = shadow.shadowB;
        imageData.data[idx + 3] = 255;
      }
      bctx.putImageData(imageData, 0, 0);
    }
    ctx.drawImage(base, 0, 0);

    for (const sprite of sprites) {
      ctx.drawImage(sprite, 0, 0);
    }

    return canvas;
  }

  return {
    extractSprite,
    recolorSprite,
    shiftSpriteDown,
    shiftSinglePixel,
    shiftEarOnBase,
    compositePunk,
    compositeOnBase,
    compositeOnMaleBase,
  };
}

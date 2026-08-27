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

  // Recolor exact-match pixels in a sprite. `corrections` is a list of
  // {from:[r,g,b], to:[r,g,b]} rules; the first matching rule per pixel wins.
  function recolorSprite(canvas, corrections) {
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, SPRITE_SIZE, SPRITE_SIZE);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] === 0) continue;
      for (const { from, to } of corrections) {
        if (data[i] === from[0] && data[i + 1] === from[1] && data[i + 2] === from[2]) {
          data[i] = to[0]; data[i + 1] = to[1]; data[i + 2] = to[2];
          break;
        }
      }
    }
    ctx.putImageData(imageData, 0, 0);
    return canvas;
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
        sprite = recolorSprite(sprite, colorCorrection);
      }

      if (applyRemasters) {
        // Shift Regular Shades if ear is visible
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

        // Add pixels to Front Beard
        if ((acc === 'Front Beard' && remasters.find(r => r.type === 'frontBeard')) ||
            (acc === 'Front Beard Dark' && remasters.find(r => r.type === 'frontBeardDark'))) {
          const spriteCtx = sprite.getContext('2d');
          const imageData = spriteCtx.getImageData(0, 0, SPRITE_SIZE, SPRITE_SIZE);
          const data = imageData.data;
          const beardColor = acc === 'Front Beard Dark'
            ? { r: 53, g: 31, b: 12 }   // Dark beard color
            : { r: 168, g: 103, b: 55 }; // Regular beard color
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

    // Apply post-sprite fills for ear remaster
    if (applyRemasters && earRemaster && TRAIT_FILL_COLORS[earRemaster.trait]) {
      const fillColor = TRAIT_FILL_COLORS[earRemaster.trait];
      if (fillColor.fills) {
        const imageData = ctx.getImageData(0, 0, SPRITE_SIZE, SPRITE_SIZE);
        const data = imageData.data;
        const topEarY = 11;
        for (const fill of fillColor.fills) {
          if (fill.y !== undefined && fill.y !== 0) {
            const fillY = topEarY + fill.y;
            let r = fill.r, g = fill.g, b = fill.b;
            if (fill.useSkinColor && SKIN_COLORS[punk.skinTone]) {
              const skin = SKIN_COLORS[punk.skinTone];
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

    // Re-assert the earring's gold bead. When the ear shifts down, some hairstyle
    // reconstruction fills (e.g. Blonde Short, Headband) paint over the pixel where
    // the shifted earring hangs, hiding the gold. Redraw it so the earring stays
    // visible to the left of the lowest hair pixel.
    if (applyRemasters && remasters.find(r => r.type === 'earring')) {
      const imageData = ctx.getImageData(0, 0, SPRITE_SIZE, SPRITE_SIZE);
      const data = imageData.data;
      const idx = (15 * SPRITE_SIZE + 6) * 4;
      data[idx] = 255; data[idx + 1] = 217; data[idx + 2] = 38; data[idx + 3] = 255;
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

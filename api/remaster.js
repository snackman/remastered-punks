import { createCanvas } from '@napi-rs/canvas';
import {
  SPRITE_SIZE,
  FEMALE_SPRITE_IDS,
  MALE_SPRITE_IDS,
  LAYER_ORDER,
  TRAIT_TO_LAYER,
  SKIN_COLORS,
  TRAIT_FILL_COLORS,
} from '../lib/constants.js';

import {
  extractSprite,
  shiftSpriteDown,
  shiftSinglePixel,
  shiftEarOnBase,
} from './sprites.js';

// Re-export shared logic from lib
export { getRemasters, hasRemasters } from '../lib/remaster-logic.js';
import { getRemasters } from '../lib/remaster-logic.js';

// Composite a punk with remastering
export function compositePunk(punk, applyRemasters = false) {
  const canvas = createCanvas(SPRITE_SIZE, SPRITE_SIZE);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#638596';
  ctx.fillRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);

  const isFemale = punk.gender === 'Female';
  const spriteIds = isFemale ? FEMALE_SPRITE_IDS : MALE_SPRITE_IDS;
  // Use type for non-human punks (Zombie, Ape, Alien), skin tone for humans
  const isNonHuman = ['Zombie', 'Ape', 'Alien'].includes(punk.type);
  const baseKey = isNonHuman ? `base_${punk.type}` : `base_${punk.skinTone}`;
  let baseSprite = extractSprite(spriteIds[baseKey]);

  // Fix eye shadow pixels for female
  if (isFemale && SKIN_COLORS[punk.skinTone]) {
    const baseCtx = baseSprite.getContext('2d');
    const imageData = baseCtx.getImageData(0, 0, SPRITE_SIZE, SPRITE_SIZE);
    const shadow = SKIN_COLORS[punk.skinTone];

    let idx = (13 * SPRITE_SIZE + 10) * 4;
    imageData.data[idx] = shadow.shadowR;
    imageData.data[idx + 1] = shadow.shadowG;
    imageData.data[idx + 2] = shadow.shadowB;
    imageData.data[idx + 3] = 255;

    idx = (13 * SPRITE_SIZE + 15) * 4;
    imageData.data[idx] = shadow.shadowR;
    imageData.data[idx + 1] = shadow.shadowG;
    imageData.data[idx + 2] = shadow.shadowB;
    imageData.data[idx + 3] = 255;

    baseCtx.putImageData(imageData, 0, 0);
  }

  const remasters = applyRemasters ? getRemasters(punk) : [];
  const earRemaster = remasters.find(r => r.type === 'ear');

  // Apply ear shift if needed
  if (earRemaster && isFemale) {
    let fillColor = TRAIT_FILL_COLORS[earRemaster.trait] || {r: 0, g: 0, b: 0};

    if (fillColor.fills && SKIN_COLORS[punk.skinTone]) {
      const skin = SKIN_COLORS[punk.skinTone];
      fillColor = {...fillColor, fills: fillColor.fills.map(fill =>
        fill.useSkinColor ? {...fill, r: skin.r, g: skin.g, b: skin.b} : fill
      )};
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

  // Draw each accessory
  for (const acc of sortedAccessories) {
    // Skip Choker if we're remastering it (we'll draw it differently)
    if (applyRemasters && acc === 'Choker' && remasters.find(r => r.type === 'choker')) {
      continue;
    }

    // Get sprite ID from the appropriate gender-specific lookup
    let spriteId = spriteIds[acc];

    if (!spriteId) {
      console.warn('No sprite found for:', acc, 'gender:', punk.gender);
      continue;
    }

    let sprite = extractSprite(spriteId);

    // Apply remaster modifications
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
          ? {r: 53, g: 31, b: 12}  // Dark beard color
          : {r: 168, g: 103, b: 55}; // Regular beard color
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

  return canvas;
}

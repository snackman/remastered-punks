# Fix White Eyes on Female Punks

## Problem

The female `f,s` base sprites (IDs 22-25) have **no eyes** — just skin-toned shadow pixels at y=12 and pure white at y=13. The male `m,l` base sprites have proper eyes baked in (black pupil + white sclera). Our code never draws the generic "Eyes" overlay (sprite #283), so female punks render with missing eyes.

The existing "eye shadow fix" patches white at (10,13) and (15,13) with skin shadow color, but never adds the actual eye pixels at y=12.

## Diagnostic Evidence

From the generic Eyes overlay (#283), the correct eye pattern is:
- Left eye:  **black pupil** at (9,12), **white sclera** at (10,12)
- Right eye: **black pupil** at (14,12), **white sclera** at (15,12)

Female base sprites at those positions have only skin shadow colors — no pupils, no sclera.

## Fix

Paint the 4 missing eye pixels onto the female base sprite during compositing, alongside the existing shadow fix. This matches what the generic "Eyes" overlay provides.

### Files to change

1. **`api/remaster.js`** — server-side compositing (Vercel API)
2. **`preview/remaster/src/lib/remaster.js`** — frontend compositing (identical logic)

### Code change

In both files, expand the existing "Fix eye shadow pixels for female" block (~lines 38-57) to also paint the eye pixels at y=12:

```javascript
// Fix female eyes - the f,s base sprites don't include eyes
if (isFemale) {
  const baseCtx = baseSprite.getContext('2d');
  const imageData = baseCtx.getImageData(0, 0, SPRITE_SIZE, SPRITE_SIZE);

  // Add eyes: pupil (black) + sclera (white) at y=12
  // Left eye
  let idx = (12 * SPRITE_SIZE + 9) * 4;
  imageData.data[idx] = 0; imageData.data[idx+1] = 0; imageData.data[idx+2] = 0; imageData.data[idx+3] = 255;
  idx = (12 * SPRITE_SIZE + 10) * 4;
  imageData.data[idx] = 255; imageData.data[idx+1] = 255; imageData.data[idx+2] = 255; imageData.data[idx+3] = 255;
  // Right eye
  idx = (12 * SPRITE_SIZE + 14) * 4;
  imageData.data[idx] = 0; imageData.data[idx+1] = 0; imageData.data[idx+2] = 0; imageData.data[idx+3] = 255;
  idx = (12 * SPRITE_SIZE + 15) * 4;
  imageData.data[idx] = 255; imageData.data[idx+1] = 255; imageData.data[idx+2] = 255; imageData.data[idx+3] = 255;

  // Fix eye shadow below eyes at y=13 (white → skin shadow)
  if (SKIN_COLORS[punk.skinTone]) {
    const shadow = SKIN_COLORS[punk.skinTone];
    idx = (13 * SPRITE_SIZE + 10) * 4;
    imageData.data[idx] = shadow.shadowR; imageData.data[idx+1] = shadow.shadowG; imageData.data[idx+2] = shadow.shadowB; imageData.data[idx+3] = 255;
    idx = (13 * SPRITE_SIZE + 15) * 4;
    imageData.data[idx] = shadow.shadowR; imageData.data[idx+1] = shadow.shadowG; imageData.data[idx+2] = shadow.shadowB; imageData.data[idx+3] = 255;
  }

  baseCtx.putImageData(imageData, 0, 0);
}
```

### Why this works

- Eye accessories (Blue/Green/Purple Eye Shadow) are semi-transparent overlays drawn later in the 'eyes' layer — they'll correctly tint over the new pupils+sclera
- Clown Eyes are fully opaque and completely replace the eye area — unaffected
- Eyewear (Regular Shades, etc.) draws on top in the 'eyewear' layer — covers the eyes as expected
- The shadow fix at y=13 remains necessary since the base sprite has white there
- Male punks are unaffected (their bases already have eyes)

# fix-612-outline: restore (6,12) outline, fix layer-order artifacts, regenerate counts, cache-bust images

Base branch: `prototype/base-ear-shift` (prod deploys from it; `main` is behind). Work branch: `task/fix-612-outline`.
All numbers were measured on 2026-11-18 against canonical `data/punks.png` (composited on bg `#638596`),
NOT the recreation sheet. The repro scripts live in
`/private/tmp/claude-501/-Users-samweinrott-Code-snax-remastered-punks/f85e504e-4551-470f-828d-9e928842ffd5/scratchpad/plan/`
(`common.mjs` loader, `m612.mjs` (6,12) audit, `ne.mjs`/`order.mjs` layer diagnosis, `stack-sim.mjs` + `sim.mjs` patched-compositor sim).

## Goal

1. Restore the (6,12) head-side outline pixel to black on remastered human females, under the hair.
2. Remove the layer-order artifacts from the stacking compositor, without changing the eligible set.
3. Regenerate `data/remaster-pixel-counts.json` from the stacking compositor.
4. Version the image URL so the corrected PNGs get past the 10-year `immutable` caches.
5. Add a regression script that locks all of the above.

## Findings (verified)

### A. (6,12) outline

- The raw female base has (6,12) black: it is the top of the ear outline at column 6, rows 12-14.
- `shiftEarOnBase` (lib/compositor.js:138-209) moves column 6 down a row and paints bg at (6,12). Its only re-fill is (7,topEarY) (line 203).
- `stackPunk` draws every human female on `baseShift` (lib/stack-compositor.js:42, 141), so (6,12) stays bg unless a sprite covers it.
- `EAR_HIDING_AT_6_12` (lib/stack-compositor.js:21) is declared but never used.
- Current state: 720/2553 eligible human females match canonical at (6,12). 1424 are canonical black rendered as bg (confirms the audit, e.g. 10, 277, 532, 790, 1052, 1427, 1616). The other 409 differ for other reasons.
- **Fix: set (6,12) to black on `baseShift[t]` for all four tones, once, right after line 42.** Hair is drawn later, so:
  - Hair sprites opaque at (6,12) still cover it. Those are Blonde Bob, Blonde Short, Orange Side, Wild White Hair, Straight Hair, Straight Hair Blonde and Pink With Hat. Headband, Tassle Hat, Hoodie, Dark Hair, Frumpy, Half Shaved, Straight Hair Dark and Wild Hair are opaque black there, and Pilot Helmet is opaque in its own colour.
  - Hair that doesn't cover it is transparent there in the raw sprite, so the black shows. No hair-derivation step is needed.
- Measured with the fix: 1424 fixed, 0 regressions, 0 change to the eligible set.
  - Ear-remaster eligible females: 2070/2454 match at (6,12).
  - All eligible human females: 2144/2553.
- The remaining 409 mismatches all come from deliberate sprite edits:
  - 345 are the dictated hair edits that paint (6,12) in hair colour: Crazy Hair 155 (L67), Wild Blonde 130 (L77), Clown Hair Green 60 (L64). Canonical is black there.
  - 39 are Regular Shades remasters. The shifted frame's left pixel lands on (6,12) above Blonde Short/Bob/Wild White Hair/Orange Side, consistent with the frame sitting over hair at (6,11) in the original.
  - 25 are the Big Shades edit at L107 (black at (6,12)), drawn over Straight Hair/Straight Hair Blonde/Pink With Hat/Blonde Bob.
- The "2249/2270" target in memory predates the dictated hair edits at L62-79. With those edits kept, the ceiling is 2070/2454. See Decision D2.
- Do NOT drop the Big Shades (6,12) edit even though the base fix makes it look redundant. Removing it takes **34 punks out of the eligible set** (13, 53, 240, 985, 1477, ...). For them that pixel is their whole remaster.

### B. QA: layer-order artifacts (131 non-eligible plus 61 eligible)

- Root cause: the composite sorts traits by one global `LAYER_ORDER` (lib/constants.js:180; stack sort at lib/stack-compositor.js:148-153). The original artwork's draw order differs for specific trait pairs. Precedence derived from canonical (`order.mjs`), current order in parentheses:
  - beard over mouth: Smile, Buck Teeth, and Frown under non-frown beards (currently mouth over beard).
  - Purple Hair over Classic Shades, Eye Patch, Eye Mask, Horned Rim, Nerd Glasses and Big Beard. But Big Shades, Regular Shades, VR and 3D Glasses stay over Purple Hair.
  - Luxurious/Big Beard over Gold/Silver Chain (currently neck last).
  - Clown Nose over Medical Mask/VR. Medical Mask over Pilot Helmet/Tassle Hat. Earring over Headband.
- These artifacts mostly don't show on the site: non-eligible punks get a 404 from the API (api/[punkId].js:115-122), and the app shows originals from punks.png.
- But 61 eligible punks carry them in the served image, e.g.:
  - 467/2010/8304: black (6,10) instead of purple hair.
  - 5774/7332/8079/8908/9130/9600: Smile showing over the beard.
  - 2276: Buck Teeth over Shadow Beard.
  - 3871/7920: mask/VR over Clown Nose.
  - 9160: Pilot Helmet over Medical Mask.
- **Some pairs conflict pixel by pixel, so no single total order exists**:
  - Male Clown Hair Green with Classic Shades/Horned Rim/Nerd/Eye Patch/Eye Mask: the hair wins only at the outer columns (6,10), (6,11), (16,1x).
  - Vampire Hair vs Big Beard.
  - Earring vs the long female hairstyles (the code already handles this deliberately).
- **Frown over beard is an intended remaster**: `type:'frown'` with `FROWN_REMASTER_BEARDS` (lib/remaster-logic.js:75-82, lib/constants.js:335). It must stay drawn over those beards.
- Rejected alternative: "rebase onto canonical" (final = canonical plus the stack-vs-raw delta). It is wrong where the remaster moves a feature. For example, the 32 Headband+Earring females would get two earring beads, at (6,14) and (6,15). It also needs punks.png at render time.
- **Critical coupling**: eligibility is `stackPunk(P) != gfx.compositePunk(P,false)` (scripts/generate-eligible.mjs:27). Reordering only the stack would make up to 131 non-eligible punks newly eligible. So the raw reference must be rendered by the same stacking pipeline with remasters off.
- Simulated fix (`stack-sim.mjs`, ORDER=2):
  - Raw mode on the stack, plus a pairwise-aware layer rank.
  - Eligible set **unchanged: 3434, 0 gained, 0 lost**.
  - Non-eligible punks with artifacts drop from 131 to 37: 24 per-pixel conflicts (Clown Hair Green with eyewear, Vampire+Big Beard) and 13 frown-only punks.
  - Eligible punks with artifacts drop from 61 to 16. All 16 are intended frown-over-beard remasters.
  - Eligible renders changed: 1437, of which 1424 are (6,12) only and 13 are the layer fixes listed above.

### C. Pixel counts

- `scripts/generate-pixel-counts.js:10,45,47` still uses `createCompositor().compositePunk` and filters by `getRemasters`, not the eligible list.
- The committed file has 3434 entries; 61 are stale today. After A+B, **1472 entries change** (the (6,12) fix removes one diff pixel on each of the 1424). No entry goes to 0.
- These counts are served as the "Pixels Remastered" attribute (api/metadata/[id].js:73) and used for gallery sort (Gallery.jsx:56, zero.js:60).

### D. Cache

- api/[punkId].js:132 sends `public, max-age=315360000, immutable`. The metadata image is `${origin}/api/${id}?size=480` (api/metadata/[id].js:79), and `/<id>` is rewritten to the API (vercel.json).
- Vercel's edge cache is per deployment, but browsers, wallets and marketplaces (Sepolia testnets today) keep the old PNG for 10 years.
- The frontend renders client-side with `@lib/stack-compositor.js` (preview/remaster/src/lib/remaster.js:3,40) and never loads `/api/<id>` images (grep), so it picks up the fix on deploy. Only the hashed bundle and `/data/*.json` matter there.

## Changes

### 1. `lib/stack-compositor.js`

- **L21**: delete `EAR_HIDING_AT_6_12`. Replace it with a comment block naming the hair sprites that are opaque at (6,12) (list in A) and why the base fix is enough.
- **After L42**: add the base fix.
  ```js
  // Head-side outline above the shifted ear: the shift clears (6,12) to bg; the original keeps it black.
  // Drawn on the base so ear-covering hair (opaque at 6,12) still covers it.
  for (const t of TONES) set(baseShift[t].getContext('2d'), 6, 12, 0, 0, 0);
  ```
- **L115 `spriteFor(a, P, R, ids)`**: add a `raw` flag. When `raw` is set, return the plain extracted sprite with `SPRITE_COLOR_CORRECTIONS` applied, before any other branch. This skips `hairSprites`, `coveredHair`, `pilotHelmet`, `eyeMask`, `bigShades` and `remTrait`.
- **L129 `stackPunk(P)`** becomes `stackPunk(P, { raw = false } = {})`:
  - `R = raw ? [] : getRemasters(P)`.
  - Female base: `(raw ? baseRaw : baseShift)[tone]`. `baseRaw` is already built at L42 and currently unused.
  - Non-human types: `gfx.compositePunk(P, !raw)`.
  - The choker and bead branches are already gated on `R`.
- **L144-153**: replace `layerIdx` with `layerRank(a)` built on a local order
  `['base','cheeks','blemish','mouth','earring','hair','neck','beard','eyes','headgear','mouthprop','eyewear','nose','smoke']`
  plus these overrides (these are exactly what the sim validated):
  - `Vampire Hair` → beard + 0.5 (unchanged).
  - `Frown` → beard + 0.25 when the punk has any `FROWN_REMASTER_BEARDS` beard. This keeps the intended frown remaster and today's look. Under D1 option 2, apply it only when `!raw`.
  - `Purple Hair` → eyewear + 0.3. `Big Shades`, `Regular Shades`, `VR`, `3D Glasses` → eyewear + 0.6.
  - `Earring` → hair + 0.5 when the punk has `EARRING_OVER_HAIR` hair (unchanged). `Earring` → headgear + 0.5 when the punk has `Headband`.
  - Leave `LAYER_ORDER` in lib/constants.js untouched. The legacy `compositePunk` is still used for Ape/Zombie/Alien and the traits dev page, so changing it would widen the blast radius.
- Leave the per-pixel conflicts (male Clown Hair Green with eyewear, Vampire+Big Beard) as documented known issues. They only affect non-eligible punks, which are never served. Add a comment listing them.

### 2. `scripts/generate-eligible.mjs`

- L27: compare `stackPunk(P)` against `stackPunk(P, { raw: true })` instead of `gfx.compositePunk(P, false)`.
- Add a `--check` flag: compare against the committed `data/all-eligible-punks.json` and exit 1 on any difference, without writing the file.
- Resolve canvas the same way the scratch scripts do (`createRequire('<repo>/api/')`), so the script no longer has to be copied into api/ (L5-6).

### 3. `scripts/generate-pixel-counts.js` (rewrite)

- Iterate `data/all-eligible-punks.json`, not `getRemasters`.
- Render with `createStackCompositor(...).stackPunk`.
- Keep `originalOnBg` (L32-40) and the RGB diff.
- Output stays `[{id,pixels}]`, sorted by pixels desc then id asc.
- Use the same canvas resolution as step 2.
- Run it and commit the new `data/remaster-pixel-counts.json`. Expect 3434 entries, about 1472 changed.

### 4. Cache busting

- Add `export const RENDER_VERSION = 2;` to `lib/constants.js`. Bump it whenever compositor output changes.
- api/metadata/[id].js:79: change the image URL to `${origin}/api/${id}?size=480&v=${RENDER_VERSION}`.
- api/[punkId].js:131-132:
  - Send `immutable, max-age=315360000` only when `req.query.v === String(RENDER_VERSION)`.
  - Otherwise send `public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400`. Unversioned and old-version URLs, such as `/<id>` and caches of `?size=480`, then self-heal within hours.
- The PNG response ignores `v` beyond the header choice.
- Frontend: there are no `/api/<id>` image references today, so nothing to change. Note in the `og-tags-copy` task that any og:image must append `&v=${RENDER_VERSION}`.
- Sepolia: after deploy, request metadata refresh on the testnet marketplace for a few tokens (optional; mainnet isn't deployed yet).
- IPFS later: when baseURI moves to IPFS (mainnet-launch plan), pin images rendered from this version.

### 5. Regression script: new `scripts/verify-render.mjs`

Node script with no test framework, run as `node scripts/verify-render.mjs`. It exits non-zero on failure.

1. **(6,12) audit** over eligible human females:
   - Every (6,12) mismatch vs canonical must fall into one of the allowlisted causes: hair edit Crazy Hair/Wild Blonde/Clown Hair Green; Regular Shades remaster; female Big Shades edit.
   - Assert the match counts equal the expected values: 2070/2454 ear-remaster and 2144/2553 overall (with D2 = keep).
   - Spot-check that 10, 277, 532, 790, 1052, 1427, 1616 are black at (6,12).
2. **Eligibility lock**: recompute using step 2's logic and assert it equals `data/all-eligible-punks.json` (3434). Rebuild the merkle root in-process (same leaf/sort as contracts/script/generateMerkleTree.js) and assert it equals `data/merkle-tree.json.merkleRoot`, which must also equal the `MERKLE_ROOT` in contracts/script/Deploy.s.sol:18.
3. **Artifact lock**: for non-eligible punks, `stackPunk(P,{raw:true})` must equal canonical except a committed allowlist (the 37 ids in the sim, each with its expected pixels). For eligible punks, no pixel outside the stack-vs-raw delta may differ from canonical, except the 16 frown remasters.
4. **Pixel counts**: recompute and deep-equal `data/remaster-pixel-counts.json`.
5. **Golden snapshot**: write a sha256 of each eligible punk's 24x24 RGBA to `data/render-golden.json` (`--update` rewrites it). On a normal run, print every id whose hash changed. Any change without a `RENDER_VERSION` bump fails.

Also add `"verify:render"` to the root package.json scripts. Optionally add a playwright check on the preview (later).

## Downstream: eligible set and merkle (Decision D1 for Snax)

- With the default plan (changes 1-3, frown kept over beard in raw and remastered) the **eligible set is identical**: 3434 ids, root `0x9188c0…1324`. Nothing changes in `data/all-eligible-punks.json`, `data/merkle-tree.json`, Deploy.s.sol:14-18, the contract.js:11 description "3,434", or the rehearsed Sepolia contract. Only images, pixel counts and the image URL change. **No decision needed.**
- D1 option 2 (not recommended): make the frown remaster count toward eligibility (raw draws Frown under the beard, as canonical does). That adds 13 punks: 1303, 1851, 2763, 2961, 3017, 3852, 4730, 5276, 5423, 5935, 6724, 7740, 8700. Total becomes **3447**, and the following must follow:
  - Rerun generate-eligible.
  - Run `contracts/script/generateMerkleTree.js` (writes the new root plus `data/merkle-tree.json`).
  - Update Deploy.s.sol:14-18 (root and comment).
  - Update the contract.js:11 description ("3,447").
  - Regenerate pixel counts.
  - Delete or refresh the stale `preview/remaster/public/merkle-tree.json` (root 0xe9a0…, 2291).
  - Sepolia re-rehearsal: redeploy, then repoint the frontend contract address.
  - It also touches the `gate-ui-on-eligible` task: these 13 are among the "non-eligible but show a remaster" punks.
  - Snax must explicitly OK changing the "FINAL" root.
- D2 (visual, not eligibility): keep the dictated (6,12) hair colour on Crazy Hair, Wild Blonde and Clown Hair Green (L64/67/77; default), or drop those three `set(…6,12…)` calls so canonical black shows (+345 canonical matches). Measured: dropping them leaves the eligible set unchanged (3434, 0 gained, 0 lost). It changes 345 more renders. Expected verify counts would become 2415/2454 and 2489/2553.

## Risks

- **Eligibility drift**: any order change that isn't mirrored in raw mode changes the eligible set. Mitigations: verify-render step 2 plus `generate-eligible --check` in the implementer's checklist; never hand-edit the eligible json.
- The browser and @napi-rs/canvas could composite differently. Low risk: everything is opaque `drawImage` with integer alpha 0/255, and Shadow Beard alpha matched canonical in node. Check on the preview's stacking-compare page.
- Raw mode for Ape/Zombie/Alien uses `gfx.compositePunk(P,false)`, same as today. 1748 (Zombie, Frown over Front Beard) is unchanged.
- The 13 layer-fix renders change the look of punks Snax may already have reviewed (list above). Include them in the preview review.
- `api/server.js` and `api/remaster.js` are a stale local dev server on the old compositor. Out of scope (repo-cleanup); do not use it to verify.

## Verification

1. Locally: `node scripts/generate-eligible.mjs --check` passes with 3434 unchanged, and `node scripts/verify-render.mjs` passes.
2. `cd preview/remaster && npm run build && npm run lint`. Lint must show no new errors in the touched files.
3. `/ship` to get a Vercel preview, then on the preview:
   - Fetch `/api/{10,277,532,790,1052,1427,1616}?size=24&v=2` and diff them against `local stackPunk`; all should be black at (6,12). Adapt `scratchpad/api/px.mjs` to take a base URL.
   - Check 467, 2276, 3871, 7920, 9160, 9600 for the layer fixes.
   - Response headers: `immutable` with `v=2`, the 1h policy without it.
   - `/api/metadata/10.json`: image has `&v=2` and "Pixels Remastered" matches the new json.
   - In the app (Home/PunkCard/Gallery), punks 10 and 467 render the same as the API. The gallery sort still loads.
   - Mobile check per `/mobile-check` is not needed (pixel-only change).
4. After merge and deploy: rerun the px.mjs sample against punksremastered.com; expect 40/40 to match the local renderer.

## Decisions (Snax, 2026-11-18)
- **D2: A** — keep the dictated (6,12) hair colour on Crazy Hair, Wild Blonde, Clown Hair Green. Expected verify counts 2070/2454 and 2144/2553.
- **D1: leave out** — frown-only punks are NOT eligible; eligible set stays 3434, root 0x9188c0…1324.

# gallery-virtualize: windowed gallery, integer pixel scaling, bigger chips/captions

TASKS.md row `gallery-virtualize` (P2, perf/ui). Frontend: `preview/remaster` (React 19, Vite 7).

## Goal

1. The gallery (`#gallery`, 3,434 eligible punks) mounts at most a few hundred DOM nodes and scrolls smoothly at 390px.
   Today it mounts every tile and gives each one its own IntersectionObserver, which froze Chrome's renderer.
2. Sprite pixels are crisp and even: integer CSS scale, `image-rendering: pixelated` only.
3. Chips and captions are legible and easy to tap: text at least 12px, contrast at least 4.5:1, hit areas at least 24px tall.
4. `traits.html` draws its ~246 zoomed canvases lazily.
5. Lint is clean: drop the unused `extractPunk` import.

Behavior to keep: the trait filter (`?trait=X#gallery`, chip click goes to `selectTrait`), the sort (most pixels changed first, the order in `data/remaster-pixel-counts.json`), punk links (`?punk=<id>#home`), normal window scrolling, and keyboard reachability.

## Current state (file:line)

- `src/components/Gallery.jsx:3`: unused `extractPunk` import (lint error).
- `Gallery.jsx:10-49` `PunkTile`: one `IntersectionObserver` per tile (`:15-24`). It draws `compositePunk(punk, true)` into a 72px backing canvas (`ZOOM = 3`, `:6`, `:30-31`). Scrolling back re-mounts nothing, but every tile stays in the DOM.
- `Gallery.jsx:86-90`: `rows.map` renders all 3,434 tiles. Each tile is a div, a canvas, an `<a>`, a px div and 0-6 chip buttons. Eligible accessory counts: 0:4, 1:129, 2:1164, 3:1600, 4:479, 5:53, 6:5. The longest name is "Straight Hair Blonde".
- `src/App.css:516-519`: `.gallery-grid` is `repeat(auto-fill, minmax(84px, 1fr))`. The `1fr` stretch makes tiles about 84-90px wide, so a 24px sprite is scaled by about 3.6, a non-integer.
- `App.css:535-563`: id 11px, px 10px, chip 9px with `padding: 0` (about 11px tall hit area).
- `App.css:419-423` (`.punk-image-wrapper canvas`, lookup cards) and `traits.html:167-170`: `pixelated` followed by `crisp-edges`. The last declaration wins where it is supported, so remove `crisp-edges`.
- `src/lib/remaster.js:39-42` `compositePunk` → `stack.stackPunk(punk)`, which builds a new 24x24 canvas on every call and has no cache (`lib/stack-compositor.js:153`).
- `src/traits.js:82-110` `init()`: eagerly renders 25 sections x 4 skin tones x (original + remastered), plus the isolated sprites. Each one goes through `drawZoomed` (`:73-79`, 132px canvases). `countPixelDiff` (`:209-217`) needs the 24x24 composites but not the zoomed canvases.
- `App.jsx:169-175` mounts `<Gallery punkData filterTrait onFilterTrait={selectTrait}>`. `selectTrait` is at `App.jsx:88-95`.

## Approach

### A. Windowed grid, no new dependency (recommended)

Add a new hook, `src/hooks/useWindowedGrid.js` (about 60 lines), which scrolls with the **window**, not an inner scroller. That keeps the sticky header, mobile URL-bar collapse and scroll restoration working.

- Inputs: `count`, `colWidth` (96), `gap` (12), `rowHeight` (fixed, see C), `overscan` (3 rows).
- A `ResizeObserver` on the grid container gives the width. `cols = max(1, floor((width + gap) / (colWidth + gap)))`.
- One passive `scroll` listener plus `resize`, throttled with `requestAnimationFrame`. It reads `gridTop = container.getBoundingClientRect().top + scrollY`, which is recomputed when the container is resized (the head text changes with the filter).
- Visible rows: `first = floor((scrollY - gridTop) / rowPitch) - overscan`, and `last` from `innerHeight`, both clamped.
- Returns `{ containerRef, cols, totalHeight, startIndex, endIndex, offsetY }`.

Render in `Gallery.jsx`:

- An outer `div.gallery-grid` with `style={{ height: totalHeight, position: 'relative' }}`.
- An inner `div` with `transform: translateY(offsetY)px`, `display: grid`, `grid-template-columns: repeat(cols, 96px)`, `gap: 12px` and `justify-content: start`. Integer px columns and offsets keep every canvas on the device-pixel grid. Do not use `space-between` or `1fr`, which put tiles on subpixel positions.
- Only `rows.slice(startIndex, endIndex)` is rendered.
- Expected DOM: about 8-10 visible rows plus 6 overscan rows, times 3-11 columns, so roughly 50-180 tiles (about 1-2k nodes, down from about 22k).

Delete the per-tile IntersectionObserver. Visible tiles draw in `useLayoutEffect` straight from the tile cache (D). The window is the lazy boundary.

Filter change (`filterTrait` dep): if the grid top is above the viewport, `window.scrollTo({ top: gridTop - headerOffset })`. Otherwise leave the scroll position alone. Keys stay `c.id`, so React reuses tiles while scrolling.

Keyboard: tiles outside the window are not in the tab order. Mitigations:

- The 3-row overscan.
- An `onFocus` handler (bubbling capture) on the grid calls `el.scrollIntoView({ block: 'nearest' })`. The scroll then advances the window, so Tab keeps reaching new tiles. The browser already scrolls focused elements into view; this makes it explicit.
- Add `aria-rowcount` / `role="grid"` only if it is cheap. A plain list is fine: a short visually-hidden note ("Showing remasters N-M of T") is not needed.
- Find-in-page (Cmd-F) will not find punk ids that are not rendered. This is acceptable: there is no id search today, and lookup is on its own tab.

### Alternatives considered

- **`@tanstack/react-virtual`** (`useWindowVirtualizer`, about 5-6 KB gzip). It handles dynamic measurement, which we don't need because rows have a fixed height (C). Our grid case still needs a row virtualizer plus manual column chunking, so it saves little code. Rejected unless the hand-rolled hook gets flaky. It shares no code with the `@tanstack/react-query` that is already installed.
- **Paginated / infinite "load more"**: render 120 tiles, with one shared IntersectionObserver on a sentinel appending 120 more, plus `content-visibility: auto; contain-intrinsic-size: auto 96px 160px` on tiles. This is simpler and keeps native tab order and find-in-page. But the DOM still grows to 22k nodes if someone scrolls to the end, and 390px phones are exactly where that hurts. Keep it as the fallback if windowing causes scroll-anchoring bugs.
- **`content-visibility: auto` only**: cheapest, but it still creates 22k nodes and 3,434 observers at mount. That mount is what froze the renderer. Not enough on its own. `content-visibility` is still worth adding to the windowed tiles (cheap).

### B. Integer pixel scaling

- Tile canvas: **backing store is 24x24** (`width/height = SPRITE_SIZE`), and CSS `width/height: 96px` (4x) with `image-rendering: pixelated`. The browser does nearest-neighbor upscaling.
  - At device pixel ratios (dpr) of 1, 1.25, 1.5, 2 and 3, 96 CSS px is a whole number of device pixels per sprite pixel (4, 5, 6, 8, 12), so it is exact.
  - This removes per-tile scaling work and cuts canvas memory per tile from 72²·4 to 24²·4 bytes.
  - Arbitrary browser zoom (for example 110%) can't be made exact. That is acceptable.
  - Pick one size, 96px everywhere. At 390px viewport: content width is 390 - 48 (`.app` padding `0 24px`, App.css:9) = 342, so cols = floor(354/108) = 3. That gives 3 x 96 + 2 x 12 = 312, which fits.
  - Optional: on very narrow screens (<340 content width) drop to 72px (3x) through a matchMedia-driven `colWidth`, still an integer.
- Only if 24x24 backing plus pixelated looks soft on some browser (old Safari): fall back to `backing = 24 * round(4 * devicePixelRatio)` drawn with `imageSmoothingEnabled = false`. Note this in the code comment.
- Remove `image-rendering: crisp-edges` at `App.css:422` and `traits.html:169`, keeping `pixelated` only.
- Out of scope, mention to Snax: the hero canvas on mobile is `40vw` (`App.css:817-822`), which is also a non-integer scale. It is a Home-page item that could become `width: min(40vw, 216px)` snapped to a multiple of 24. Leave it for ux-states or a follow-up.

### C. Tile layout, tap targets, legibility (fixed row height)

Virtualization needs a fixed row height, but chips vary from 0 to 6 per punk. Options:

1. **(Recommended) Show at most 3 chips, plus a "+N" chip** linking to `?punk=<id>#home`, where the full trait list is shown. This covers 2,897 of 3,434 punks fully.
   - Row height = 96 (canvas) + 20 (id/px line) + 3 x 24 (chips) + 4 (padding) = **192px**, with a 16px row gap.
   - Chips are `white-space: nowrap; overflow: hidden; text-overflow: ellipsis; title={name}`, so "Straight Hair Blonde" truncates instead of wrapping and the height stays fixed.
2. Per-row variable height computed from data: row height = max chip count in that row (deterministic, no measuring), with prefix sums for offsets. This keeps all chips, but it is more code and gives tall ragged rows. **Snax to pick at plan review; default is 1.**

CSS (`App.css:516-563` rewrite):

- `.gallery-tile`: `width: 96px; height: 192px; content-visibility: auto; contain: layout paint`.
- `.gallery-tile canvas`: `width: 96px; height: 96px; image-rendering: pixelated`.
- Id and px on one line: `.gallery-tile-id` at 13px/700, `--ink` `#181818`, with `padding: 4px 6px` so the hit area is at least 24px tall. `.gallery-tile-px` at 12px, `--muted` `#6b6b6b` (5.3:1 on white, which passes).
- `.gallery-tile-trait`: 12px, `min-height: 24px`, `padding: 2px 8px`, `max-width: 96px`, color `--accent` `#1a43c8` (about 7:1 on white). Drop the light-blue-looking 9px.
- Do not add new `:focus-visible` rules here; **ux-states owns focus styles in App.css**. Just make sure chips and links are real `<button>`/`<a>` elements so they inherit its rules.

### D. Tile render cache

- New module `src/lib/tileCache.js`: `getRemasterTile(punk)` returns a 24x24 canvas from a `Map<id, HTMLCanvasElement>`, filled on first call by `compositePunk(punk, true)`. Keep it in the gallery-only module for now, not `remaster.js`, to avoid conflicts with fix/compositor branches.
- Memory: 3,434 x 2.3 KB, about 8 MB in the worst case. That is fine, so there is no LRU. Optionally cap it at 1,500 entries with insertion-order eviction.
- Only cache once `isStackingReady()` is true. Before then `compositePunk` returns the plain composite, which must never be cached as the remaster. If stacking isn't ready, render the canvas blank and retry.
- Tiles draw with `ctx.drawImage(cached, 0, 0)`, a 24x24 blit. Scrolling back is close to free.
- Skip ImageBitmap/dataURL. An offscreen canvas is already a cheap `drawImage` source, and `createImageBitmap` is async and complicates first paint.

### E. traits.html lazy render (`src/traits.js`)

- Keep composites and `countPixelDiff` eager: they are cheap 24x24 operations, and `addPixelCounts` / `orderSectionsByCount` need them.
- In `createPunkBox` / `createLabeledSpriteBox`, create the target canvas with its final `width/height`, so the layout is stable. Store the source canvas in a `WeakMap<canvas, drawFn>` and register it with **one shared** `IntersectionObserver` (`rootMargin: '400px'`). On intersect, call `drawZoomed` and `unobserve`.
- Collapsed sections (`.section.collapsed`) are hidden, so their canvases are never drawn until the section is expanded. Make sure the collapsed CSS uses `display: none` or zero height, so IntersectionObserver reports them as not intersecting.
- Keep `labeled-sprite` (`traits.js:117-160`) eager if it draws labels or grid lines that need a context. Otherwise wrap it the same way.

### F. Lint

- Remove `Gallery.jsx:3`. Run `npm run lint` in `preview/remaster`. Fix any new react-hooks v7 complaints in the new hook. For example, setState in an effect: derive values in the rAF callback, not in an effect body.

## Files to change

- `preview/remaster/src/components/Gallery.jsx`: rewrite the tile and grid, remove the import, add the windowing and cache use.
- `preview/remaster/src/hooks/useWindowedGrid.js` (new).
- `preview/remaster/src/lib/tileCache.js` (new).
- `preview/remaster/src/App.css`: gallery block `:478-563`; drop `crisp-edges` at `:422`.
- `preview/remaster/src/traits.js`: shared IntersectionObserver lazy draw, `:73-160`, `:240-260`.
- `preview/remaster/traits.html`: drop `crisp-edges` at `:169`.
- `scripts/perf-gallery.mjs` (new, repo root, uses the root `playwright` devDependency): the verification script (below).

No change to `App.jsx`: the Gallery props stay the same.

## Coordination / merge hotspots

- **ux-states**: edits App.css focus styles, `selectTab`/`?trait` clearing and pushState tabs in `App.jsx:66-95`. This task only touches the App.css gallery block and line 422. If ux-states moves to pushState, Gallery should keep reading `filterTrait` from props, so there is no conflict. Rebase whichever lands second; conflicts should be limited to App.css.
- **perf-caching-startup**: may `React.lazy` the Gallery import (`App.jsx:16`) and parallelize fetches. The `remaster-pixel-counts.json` fetch stays inside Gallery (`:54-60`), and Gallery keeps a default export so `lazy()` works. If that task hoists the counts fetch into App, accept a `counts` prop as an override.
- **og-tags-copy**: touches `index.html`/Home copy. No overlap except possibly `traits.html` `<head>`. This task only edits its `<style>` line 169.
- `prototype/base-ear-shift` and compositor branches touch `lib/stack-compositor.js` and `remaster.js`. This plan avoids both, which is why the cache lives in its own module.

## Risks

- **Scroll anchoring**: changing `totalHeight` when the filter changes, or a late-loading head, can jump the page. Fix with `overflow-anchor: none` on the grid container and by recomputing `gridTop` in the ResizeObserver.
- **Keyboard/Tab and find-in-page**: see A. If Snax finds tabbing broken in the preview, switch to the load-more fallback.
- **Truncated chips (option C1)**: hides traits 4-6 from the gallery on 537 punks, though they are still reachable on the punk page. This is a product call for Snax.
- **Stacking not ready**: covered in D. Never cache the non-stack composite.
- **The 24x24 backing canvas** depends on `pixelated` support: Chrome 41+, Safari 10+, Firefox 93+, all fine. The fallback is described in B.
- **iOS Safari** fires `scroll` during momentum scrolling, but tiles can lag one frame. Overscan of 3 rows (about 600px) hides this.

## Verification

1. `cd preview/remaster && npm run lint && npm test && npm run build`. The build runs the eligibility check.
2. `node scripts/verify-render.mjs` should be unchanged, since there are no compositor changes.
3. New `scripts/perf-gallery.mjs` (Playwright Chromium, run against `npm run preview` or a Vercel preview URL passed as argv):
   - Viewport 390x844, dpr 3, plus 1280x800, dpr 1.
   - Inject a `PerformanceObserver({type:'longtask'})` before navigation (`addInitScript`), then go to `/#gallery`.
   - Wait for `.gallery-tile canvas`. Record `document.querySelectorAll('*').length` and the `.gallery-tile` count.
   - Scroll in steps of 600px to the bottom with `mouse.wheel` and a rAF frame counter, then back to the top. Report average FPS, the number of long tasks and the max long task, and the node count at the bottom.
   - Pass criteria: tiles ≤ 250, total nodes < 4,000 at any point, no long task > 200ms after first paint, FPS ≥ 50 on desktop. At 390px, no renderer freeze, and the script finishes inside a 60s timeout.
   - Also load `/?trait=Earring#gallery` and assert that the subtitle count matches the expected number and that the first tile has an Earring chip. Click a chip and assert the URL becomes `?trait=<chip>#gallery`. Click an id and assert `?punk=<id>#home`.
   - Load `/traits.html` and assert that fewer than all canvases have been drawn before scrolling: keep a drawn flag (`data-drawn`) set on lazy draw, and count those.
   - Print the before/after numbers. Run it once on `main` first for a baseline (expect about 22k nodes).
4. Visual check of integer scaling: Playwright `page.screenshot` of one tile at dpr 2. In the script, sample the 8x8 device-pixel block for each sprite pixel and assert every pixel in each block is identical (no blended edges). Also eyeball it in the Vercel preview on iPhone (390px) and desktop: the pixels are even and the canvas is exactly 96 CSS px (DevTools computed).
5. Tap targets: in DevTools on the preview, chip and id boxes are at least 24px tall and text is at least 12px. The Lighthouse accessibility audit has no contrast failures in the gallery.
6. Vercel preview via `/ship`. Check `#gallery` at 390px and on desktop, `?trait=Headband#gallery` deep link, filter clear, Tab through tiles past the first screen, and `traits.html` sections still show pixel counts and order.

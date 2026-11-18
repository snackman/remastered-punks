# perf-caching-startup: cache headers, parallel startup, lazy wallet + merkle proofs

Task row: TASKS.md:11 (P2). Re-verified 2026-11-18 against `a388fec` (PRs #2-#6 merged). A local
`vite build` produces `assets/main-CM0ujAuW.js`, the same hash that is live, so the live site matches
the current code.

**Scope note:** this task also takes repo-cleanup (TASKS.md:13) items "delete stale
public/merkle-tree.json", "move api helpers out of api/", "cached 404s in API", "narrow includeFiles
and data copy". When this ships, strike those items from repo-cleanup. repo-cleanup keeps: try/catch
in the API, dropping dev pages from prod, generate-pixel-counts and lint fixes.

## Goal

The first paint of Home and Gallery should need only React, the app shell, the sprite sheet, the punk
data and the eligible list. Wallet code, the 3.2 MB merkle tree and the 848 KB `punks.png` should
load only when needed. Repeat visits should be served from browser and edge cache.

## Baseline (live, measured with curl 2026-11-18)

| Resource | raw | br (wire) | Cache-Control |
|---|---|---|---|
| `/assets/main-CM0ujAuW.js` | 875,687 | 273,500 | `public, max-age=0, must-revalidate` |
| `/assets/remaster-*.js` / `main-*.css` | 23.6K / 39.7K | 8.1K / 7.2K | max-age=0 |
| `/data/punks.png` | 848,174 | (png) | max-age=0 |
| `/data/.../punks-24x24.png` | 68,363 | (png) | max-age=0 |
| `/data/.../cryptopunks.csv` | 653,238 | 111,662 | max-age=0 |
| `/data/merkle-tree.json` | 3,200,273 | 406,516 | max-age=0 |
| `/data/all-eligible-punks.json` | 16,825 | 7,208 | max-age=0 |
| `/data/remaster-pixel-counts.json` | 78,722 | 9,676 | max-age=0 |
| `/merkle-tree.json` (stale, root 0xe9a0…, 2,291) | 200 OK | | max-age=0 |
| `/api/data`, `/api/sprites`, `/api/remaster`, `/api/constants` | **500** | | max-age=0 |
| `/1`, `/api/1`, `/api/metadata/1.json` (ineligible) | 404 | | max-age=0, not edge-cached |
| `/9999`, `/api/metadata/9999.json` | 200 | | max-age=3600 (+ s-maxage=86400 from code) |

Startup is serial (App.jsx:220-235): sprite sheet + punks.png (Promise.all inside `loadAssets`,
sprites.js:18), then the CSV, then the eligible list. Only after that does the shell render
(App.jsx:101 shows "Loading assets..." until `assetsLoaded`), and then the merkle tree starts
loading (App.jsx:241). The whole 870 KB main chunk (wagmi, viem, RainbowKit, react-query) has to be
parsed before anything renders.

Fonts: the Google CSS for `wght@400;500;600;700;800` gives 5 separate latin woff2 files (~17 KB each).
All five weights are used in CSS (500 x2, 600 x9, 700 x17, 800 x4, 400 is the body default).

## Findings that change the audit's suggestions

- **Originals cannot be drawn without punks.png.** `stackPunk(P,{raw:true})` is not pixel-identical
  to the canonical image. scripts/verify-render.mjs:39-51 lists 37 non-eligible punks
  (`NON_ELIGIBLE_ARTIFACTS`) and 16 eligible frown punks (`ELIGIBLE_FROWN_ARTIFACTS`) that differ by
  1-3 px. Decision: keep punks.png, but stop blocking on it. Optionally ship a lossless WebP:
  `cwebp -lossless -z 9 -exact` gives 485 KB vs 848 KB (-43%), but it must be checked
  pixel-identical (step 2e).
- **Gallery does not need punks.png.** Gallery.jsx:3 imports `extractPunk` but never uses it. Only
  Home.jsx:107,130 and PunkCard.jsx:112 use it.
- **Home uses no wallet hooks.** Gallery doesn't either. The wagmi users are App.jsx:23-25 (the
  `useAccount`/`useNetwork`/`useSwitchChain` calls for the header testnet / wrong-network buttons and
  the wallet tab), ConnectButton (App.jsx:152), PunkGrid, PunkCard (which ManualLookup uses), and
  useNetwork.js. `IS_MAINNET`/`TARGET_CHAIN` come from network.js, which imports
  `getDefaultConfig` from RainbowKit at the top level. networkEnv.js imports viem. So the shell must
  not import either module.
- **Brotli:** local brotli makes the CSV 72.7 KB, but Vercel serves it at 111.7 KB. A compact punk
  JSON is 118 KB raw / 32 KB br, and decoding it avoids the main-thread regex parse.
- **Merkle shards:** one proof per punk is about 829 B raw.
- **Vercel edge cache** is scoped per deployment. A long `s-maxage` is therefore safe for both static
  files and function responses: a deploy invalidates it. The real staleness risk is browser
  `max-age` on unhashed `/data/*` URLs.

## Approach (3 commits, one PR; ordered lowest risk first)

### Commit A: caching, API, data whitelist, deletions, fonts (no app logic)

A1. **vercel.json `headers`** (new top-level key):
- `/assets/(.*)` → `public, max-age=31536000, immutable` (these are Vite content-hashed).
- `/data/(.*)` → `public, max-age=86400, s-maxage=31536000, stale-while-revalidate=604800`. Deploys
  still propagate immediately because the app fetches `/data/*?v=__DATA_VERSION__` (step B1). Unversioned
  fetches (dev pages, external) are at most 1 day stale.
- Root images: `/(.*\\.(?:png|svg|webp))` → `public, max-age=86400, stale-while-revalidate=604800`.
  Confirm on the preview that this pattern doesn't match `/api/*` or the `/:punkId` rewrite. Those
  paths have no extension, but the image endpoint sets its own header, so check it isn't overridden.
- `/` and `/(.*)\\.html` → `public, max-age=0, must-revalidate` (explicit; same as the current default).

A2. **API cached errors:**
- `api/[punkId].js:92`: on 400, set `Cache-Control: public, max-age=3600, s-maxage=86400`.
- `api/[punkId].js:103`: same on 404.
- `api/[punkId].js:117`: same on 404 (ineligible).
- `api/metadata/[id].js:53,63`: same on 400 and 404.

These are safe because eligibility changes only on deploy, and the edge cache is purged per deploy.

A3. **Narrow `includeFiles`** (vercel.json `functions`). Replace the `api/*.js` / `api/metadata/*.js`
globs with per-file entries:
- `api/[punkId].js` (reads lines 97-99): `{data/cryptopunks-assets/punks/config/punks-24x24.png,data/punks-attributes/original/cryptopunks.csv,data/all-eligible-punks.json}`
- `api/metadata/[id].js` (reads lines 57-59): `{data/punks-attributes/original/cryptopunks.csv,data/all-eligible-punks.json,data/remaster-pixel-counts.json}`
- `api/metadata/contract.js` reads no files. Give it no `includeFiles`.

A4. **Delete the dev-only API helpers:** api/server.js, data.js, sprites.js, remaster.js,
constants.js, remaster-logic.js. They are only reachable from the stale Express dev server
(api/package.json:6-7), which plans/done/fix-612-outline.md:169 already calls stale. The real
functions import from `../lib` only. Also:
- Remove `express` and the `start`/`dev` scripts from api/package.json, and refresh
  api/package-lock.json with `cd api && npm install`.
- Alternative: move them to `api/_lib/` (Vercel ignores `_`-prefixed paths). Deleting is preferred
  because nothing uses them.
- plans/fix-white-eyes.md:23 references api/remaster.js. It is a stale plan; leave it alone.

A5. **Delete `preview/remaster/public/merkle-tree.json`.** grep shows nothing references it. The app
reads `/data/merkle-tree.json` (App.jsx:241), and the scripts read `data/merkle-tree.json`.

A6. **Data copy whitelist:**
- New `scripts/build-public-data.mjs <outDir>`. It copies only what the browser fetches:
  - `cryptopunks-assets/punks/config/punks-24x24.png`
  - `punks.png`
  - `punks-attributes/original/cryptopunks.csv` (still used by traits.js:390 and zero.js:59)
  - `all-eligible-punks.json`
  - `remaster-pixel-counts.json`
  - plus the generated `proofs/` and `punks-compact.json` (Commit B)
- Exit non-zero if a source file is missing.
- vercel.json `buildCommand`: replace `cp -r ../../data dist/data` with
  `node ../../scripts/build-public-data.mjs dist/data`.
- Delete or fix `build:win` (package.json:9), which uses xcopy of all of data/.
- `/data/merkle-tree.json` stops being public. Grep found no external consumers. Mention this in the
  PR. If Snax wants the full tree public for transparency, keep copying it: nothing in the app
  fetches it any more.

A7. **Fonts (index.html:9):**
- Trimming weights is a visual call, so ask Snax. Option 1: map 500 to 600 (2 rules) and 800 to 700
  (4 rules) and load `wght@400;600;700`, which removes 2 font files (~34 KB).
- Do NOT switch to the `400..800` range: it is one 84 KB variable file, no smaller.
- Default if no answer: keep the weights and only make the font CSS non-render-blocking:
  `media="print" onload="this.media='all'"` plus a `<noscript>` fallback.
- This edits the index.html `<head>` (og-tags-copy hotspot; see the merge notes below).

### Commit B: data loading (startup in parallel, deferred punks.png, merkle on demand)

B1. **Data version + URL helper:**
- vite.config.js: `define: { __DATA_VERSION__ }`, set to the first 10 chars of a sha256 over the
  whitelisted data files plus data/merkle-tree.json. Read them with fs at config time.
- New `src/lib/dataUrl.js`: `dataUrl(p)` returns `${basePath}/data/${p}?v=${__DATA_VERSION__}`.
  basePath is `'../..'` in DEV, otherwise `''`, as in App.jsx:217 and Gallery.jsx:55.
- Use it everywhere the app fetches `/data`: App.jsx init, Gallery.jsx:56, traits.js:385,390, zero.js:56-60.
- ESLint: add `__DATA_VERSION__` to globals.

B2. **Parallel startup (App.jsx:212-264, fetch logic only):**
- `Promise.all([loadSpriteSheet(sheet), loadPunkData(), loadEligiblePunks()])`, then `initStacking`
  and `initEligibility`, then `setAssetsLoaded(true)`.
- Start `loadPunksComposite(dataUrl('punks.png'))` (new, in sprites.js) in parallel, but don't await
  it. When it resolves, set an `originalsReady` state.
- sprites.js: split `loadAssets` into `loadSpriteSheet` (already exists, line 27) and
  `loadPunksComposite`. Keep `loadAssets` for zero.js.
- `extractPunk` returns `null` when the composite isn't loaded, instead of throwing (sprites.js:42).

B3. **Original-view consumers:**
- Home.jsx:107 and :130: skip drawing the original while `!originalsReady`, and add `originalsReady`
  as an effect dependency so it redraws once loaded. Reveal mode needs the original for the diff
  count, so hold off on it (show "…") until ready.
- PunkCard.jsx:112: same pattern. Get `originalsReady` from a tiny `useOriginalsReady()` hook in
  sprites.js (a module-level promise plus a subscriber set), so no prop drilling through PunkGrid or
  ManualLookup. Home can use the same hook.
- Gallery.jsx:3: remove the unused `extractPunk` import (a one-line touch; gallery-virtualize owns
  the file).

B4. **Compact punk data:**
- `build-public-data.mjs` also writes `punks-compact.json` with the shape
  `{bases:["Female|Female|Light",…], accessories:[…], punks:[[baseIdx, accIdx…], …]}`.
  The prototype above measured 118 KB raw / 32 KB br.
- data.js gets `loadPunkDataCompact(url)` that decodes to the exact same `{id,type,gender,skinTone,accessories}` objects.
- Prod: App uses the compact file. DEV: the CSV, since there is no build step in `vite dev`.
- Add `src/lib/data.test.mjs` (picked up by `npm test`, package.json:12). It builds the compact data
  from the CSV in-process and asserts `deepEqual` with the CSV parse for all 10k punks. Put the
  encode/decode functions in a pure module (`src/lib/punkCodec.js`) that the script and the test
  share.

B5. **Merkle proofs on demand:**
- `build-public-data.mjs` writes `proofs/<id>.json` (one array per eligible id, 3,434 files of about
  829 B each) from data/merkle-tree.json. It asserts the count equals `totalEligible`.
- Alternative: 100 shards bucketed by `floor(id/100)` (11 KB br max each). That means fewer requests
  for wallets that own many punks, but every single-card view downloads about 13x more. Per-punk is
  the default; switch if PunkGrid request counts look bad.
- New `src/lib/merkle.js`:
  - A module cache `Map<id, Promise<proof|null>>`.
  - `useMerkleProof(id, eligible)` returns `{proof, status}`. Status is `'loading'` until the fetch
    resolves, then `'ready'` (proof present), or `'error'` on HTTP or parse failure.
  - Non-eligible ids return `{proof: undefined, status: 'ready'}` and never fetch.
  - DEV: fetch `../../data/merkle-tree.json` once and index into it.
- PunkCard.jsx:16,34: call `useMerkleProof(punk.id, isEligibleId(punk.id))` instead of the props.
  `remasterState(id, proof, status)` (eligibility.js:14) is unchanged, so `proofPending` and
  `proofMissing` keep their meaning ("Loading proof…" / "Proof unavailable", PunkCard.jsx:185-186).
- Remove `merkleProofs`/`merkleStatus` state and props from:
  - App.jsx:209-210, 237-251, 180-181, 191, 275-276
  - PunkGrid.jsx:19, 148-149
  - ManualLookup.jsx:4, 50
- scripts/check-ui-eligibility.mjs:23 keeps reading the full tree. Add an assertion there, or in
  build-public-data, that the reassembled shards equal `proofs`.

B6. **Preloads (index.html `<head>`):**
- A small Vite plugin in vite.config.js (`transformIndexHtml`, main entry only) injects:
  - `<link rel="preload" as="image" href="/data/cryptopunks-assets/punks/config/punks-24x24.png?v=…">`
    (no `crossorigin`, matching `new Image()`)
  - `<link rel="preload" as="fetch" crossorigin href="/data/punks-compact.json?v=…">`
  - the same for `all-eligible-punks.json`
- The URLs must match `dataUrl()` byte for byte, or the browser fetches twice.
- Do not preload punks.png: it would compete with the critical files.

### Commit C: lazy wallet stack + vendor chunks

C1. **Shell / wallet split:**
- New `src/lib/netFlag.js` exports `IS_MAINNET` (the same `import.meta.env.VITE_NETWORK === 'mainnet'`
  expression) and the chain id/name constants that need no imports. network.js re-exports
  `IS_MAINNET` from it.
- App.jsx then imports nothing from wagmi, rainbowkit, react-query, network.js, contracts.js or
  networkEnv.js. Its line-1 to line-16 imports and the line-270 providers move out.
- New `src/wallet/WalletIslands.jsx` (lazy chunk):
  - Imports `@rainbow-me/rainbowkit/styles.css` (moved from App.jsx:2).
  - Renders `WagmiProvider` > `QueryClientProvider` > `RainbowKitProvider` once.
  - Inside them, two portals: `createPortal(<WalletHeader/>, headerSlot)` and, when the tab is
    `wallet` or `lookup`, `createPortal(<WalletMain tab=… punkData eligiblePunks/>, mainSlot)`.
  - `WalletHeader` holds the addTestnet logic (App.jsx:28-62), the testnet / wrong-network buttons
    (App.jsx:133-151) and `<ConnectButton/>`.
  - `WalletMain` holds the PunkGrid / connect-prompt / ManualLookup branch (App.jsx:173-192).
- App renders the shell (header, nav, Home, Gallery, footer) with two slot elements, captured via
  `useState` callback refs:
  - `<span className="wallet-slot" style="display:contents">` inside `.connect-wrapper`
  - `<div>` in `<main>` for wallet/lookup
- App renders `<Suspense fallback={null}><WalletIslands …/></Suspense>` as a sibling of the shell, so
  the shell never remounts when the chunk arrives.
- Fallbacks while the chunk loads:
  - Header: a static `Connect Wallet` button with RainbowKit-like size, to avoid layout shift. A
    click awaits the chunk, and the real ConnectButton then appears.
  - wallet/lookup tab: "Loading wallet…".
- Start `import('./wallet/WalletIslands')` right after first paint (`requestIdleCallback`, falling
  back to `setTimeout`) so returning connected users reconnect quickly. Load it immediately if the
  initial hash is `#wallet` or `#lookup`.
- Rejected alternative: a lazy provider wrapper around the whole shell. Swapping a Fragment for
  providers remounts the subtree, which loses Home's shuffle history (Home.jsx:30) and redraws the
  canvases. Two separate provider instances would double the reconnect and RainbowKit modals.

C2. **manualChunks (vite.config.js `build.rollupOptions.output`):**
- `vendor-react` for react, react-dom and scheduler.
- `vendor-wallet` for wagmi, @wagmi, viem, @rainbow-me, @tanstack, and any wallet-connector deps that
  aren't already split.
- Check in the built `dist/index.html` that only main, vendor-react and remaster are
  `modulepreload`ed, and that vendor-wallet is not. A manualChunks function can pull lazy code into
  the eager graph if a shared module (e.g. `src/lib/constants.js`) lands in vendor-wallet. Keep the
  function matching only `node_modules` paths.

## Files to change

- vercel.json (headers, functions, buildCommand)
- api/[punkId].js, api/metadata/[id].js (error Cache-Control)
- Delete: api/server.js, data.js, sprites.js, remaster.js, constants.js, remaster-logic.js
- api/package.json and api/package-lock.json (drop express)
- Delete: preview/remaster/public/merkle-tree.json
- New: scripts/build-public-data.mjs
- preview/remaster/package.json (build:win)
- preview/remaster/vite.config.js (define, preload plugin, manualChunks)
- preview/remaster/eslint.config.js (global)
- preview/remaster/index.html (fonts, injected preloads)
- preview/remaster/src/App.jsx (init + shell split)
- New: src/wallet/WalletIslands.jsx, WalletHeader.jsx, WalletMain.jsx
- src/lib: sprites.js, data.js, new dataUrl.js, punkCodec.js, merkle.js, netFlag.js; network.js (re-export)
- src/components: Home.jsx, PunkCard.jsx, PunkGrid.jsx, ManualLookup.jsx, Gallery.jsx (import + dataUrl only)
- src/traits.js, src/zero.js (dataUrl)
- New: src/lib/data.test.mjs
- scripts/check-ui-eligibility.mjs (shard parity)
- TASKS.md (strike the items taken over from repo-cleanup) when marking done

## Merge hotspots / coordination

- **App.jsx** (ux-states):
  - ux-states owns the loading/error UI (App.jsx:101 "Loading assets...", App.jsx:266 error). This
    task owns init (App.jsx:212-264).
  - ux-states' "Connect button in My Punks empty state" (App.jsx:185-187), "compact mobile header"
    (App.jsx:115-153) and "pushState tabs" (`selectTab`, App.jsx:79-85) all touch code that Commit C
    moves into `src/wallet/*`.
  - Recommend landing this task first. ux-states then puts its ConnectButton-in-empty-state inside
    `WalletMain` (the only place ConnectButton can live now).
  - If ux-states lands first, rebase Commit C by hand. Don't resolve conflicts by re-importing
    wagmi in App.jsx.
- **index.html `<head>`** (og-tags-copy): this task only adds the font line change and
  plugin-injected preloads (injected at build, so there is no source conflict beyond index.html:9).
  Expect a trivial conflict at most.
- **Gallery.jsx** (gallery-virtualize): only lines 3 (remove import) and 55-56 (`dataUrl`). Whichever
  lands second keeps both.
- **vercel.json / api/** (repo-cleanup): items taken here, as noted at the top.
- **Mainnet config:** `netFlag.js` must keep the exact `import.meta.env.VITE_NETWORK === 'mainnet'`
  expression so dead-code elimination still drops Sepolia code (network.js:8 comment).
  vite.config.js:12-26 network validation stays untouched.

## Risks

- **Stale data on deploy:** if any `/data` fetch skips `dataUrl()`, browsers can keep yesterday's
  eligible list for 1 day. Verify by grepping for `/data/` in `src` and checking that everything
  goes through `dataUrl`.
- **Merkle per-punk 404 vs real error:** an eligible id whose shard 404s must report `'error'`
  ("Proof unavailable"), never a silent success. B5's count assertion prevents missing files.
- **Portal wallet islands:** RainbowKit's modal portals to `body`, which is fine. Event bubbling from
  portal content goes to WalletIslands, not the header. No handlers depend on that today.
- **CSS order:** RainbowKit styles now load with the lazy chunk. Check that App.css overrides for
  `.connect-wrapper` still win.
- **manualChunks** can silently re-eagerize wallet code, so do the C2 check.
- **includeFiles brace glob:** if Vercel doesn't expand `{a,b}`, the function 500s. Check `/9999` and
  `/api/metadata/9999.json` on the preview. The fallback is `data/{cryptopunks-assets/punks/config,punks-attributes/original}/**`
  plus the explicit json files.
- **Header patterns on Vercel:** the PNG regex could also apply to the `/api/:punkId` image response
  and override its versioned immutable header. Verify `/9999?v=<RENDER_VERSION>` still returns
  `immutable`.
- **WebP option (2e):** browsers decode lossless WebP exactly, but this needs proof. Only switch if
  the pixel diff below is 0 for all 2400x2400 pixels, including fully transparent pixels (`-exact`).

## Verification

Unit / scripts (run locally):
- `cd preview/remaster && npm test`: existing tests plus the new data.test.mjs (compact = CSV for 10k
  punks). Also a merkle.js unit test for the status transitions, using a fetch mock.
- `node scripts/check-ui-eligibility.mjs`: includes shard parity.
- `npm run verify:render` (root): must still pass. No render changes are expected and RENDER_VERSION
  is unchanged.
- `npm run lint` (preview/remaster): no new errors.
- `npm run build`, then `node scripts/build-public-data.mjs /tmp/x`:
  - lists the files and asserts 3,434 proofs.
  - `du -sh dist/data` should drop from ~11 MB to ~1.6 MB.
- (2e, optional) A node script with `@napi-rs/canvas` decodes punks.png and punks.webp and asserts
  identical RGBA.

Bundle (before → expected after), from `vite build` output:
- Entry JS, br. Before: main 273.5 KB (one chunk). After: main + vendor-react + remaster should be
  about 70-90 KB br, with vendor-wallet (~190 KB br) lazy.
- `dist/index.html` modulepreloads exclude vendor-wallet.
- Record exact numbers in the PR.

Request waterfall (before/after):
- A Playwright script in the scratchpad loads the preview with cache disabled and a 4G throttle
  (CDP `Network.emulateNetworkConditions`).
- It logs each request's start/end and the time until the Home remaster canvas has non-background
  pixels.
- Before: csv starts after punks.png ends, the merkle tree is 3.2 MB, and the first canvas paints
  late. After:
  - sprite sheet, compact data and eligible list start at about the same time (preloaded).
  - punks.png does not block the remaster canvas.
  - no merkle-tree.json request on Home or Gallery; one `proofs/<id>.json` per mintable card on
    Lookup/My Punks.
  - no vendor-wallet request before first paint.
- Run it 3x and report the median.

Vercel preview checks (`vercel-deploy`, then curl; if preview protection blocks curl, use
`VERCEL_TOKEN="$(vercel-token)" vercel curl`):
- `curl -sI <preview>/assets/<main>.js` → `max-age=31536000, immutable`.
- `/data/punks-compact.json?v=…` → `max-age=86400, s-maxage…` header; a second request → `x-vercel-cache: HIT`.
- `/favicon.png` → max-age=86400. `/` → max-age=0.
- `/1`, `/api/1`, `/api/metadata/1.json` → 404 with `s-maxage=86400` (second hit `HIT`).
  `/api/abc` → 400 cached.
- `/9999` → 200 png. `/9999?v=<RENDER_VERSION>` → immutable. `/api/metadata/9999.json` and
  `/api/metadata/contract.json` → 200.
- `/api/data`, `/api/sprites`, `/api/remaster`, `/api/constants`, `/api/server` → 404 (not 500).
- `/merkle-tree.json` and `/data/merkle-tree.json` → 404 (unless kept per A6).
  `/data/punks-attributes/expansion/…` → 404.
- Vercel function size, via `vercel inspect <url> --logs` or the dashboard Functions tab: well under
  the old ~11 MB of included data.
- In the browser:
  - Home renders and shuffles, and the original appears once punks.png arrives.
  - Gallery and `?trait=` work.
  - All Traits page and zero.html still load.
  - Connect a wallet: header buttons work, including Add Testnet / Wrong network.
  - My Punks lists punks and shows "Loading proof…" then Mint enabled.
  - Lookup: an eligible id gets a proof and can mint (Sepolia); an ineligible id shows no mint.
  - Deep links `#wallet` and `#lookup` load directly.
  - Mobile width, via /mobile-check.

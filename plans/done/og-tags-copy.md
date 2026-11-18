# Plan: og-tags-copy

Task (TASKS.md:9): add OG/twitter tags, an og:image and per-page titles. Add a Home explainer
(soulbound, eligibility, cost) and use one verb for minting. Also covers the audit's footer and 404 items.

## Goal

1. Link shares of punksremastered.com show a branded card: title, description, and a 1200x630
   image of a real original next to its remaster. Every page and every SPA tab has its own `<title>`.
2. Home tells a first-time visitor in about 15 seconds what this is, how to mint, what it costs,
   and who is eligible.
3. The footer links to the contract on Etherscan for the target chain, instead of repeating the nav.
4. Unknown URLs get a branded 404 page instead of Vercel's default.

## Facts checked

- `activate(uint256,bytes32[])` is **not payable** (contracts/src/RemasteredPunks.sol:73), so minting
  costs gas only. `ownerOf` returns `cryptoPunks.punkIndexToAddress` (:144-148). `syncOwnership` is
  permissionless and only re-emits Transfer so log-based indexers catch up (:125-131). EIP-5192
  `locked()` is always true (:211). `deactivate` exists (:104) but has no UI, so the FAQ does not mention it.
- The UI already says "Mint" everywhere: PunkCard.jsx:180-184 ("Mint Remaster" / "Already Minted"),
  mintErrors.js:5,7. The only "activate" is the contract fn name. **Decision: keep "Mint"**, and never
  say "activate" in copy.
- SPA tabs (App.jsx:66): `home`, `wallet` (label "My Punks"), `lookup`, `gallery` (label "All
  Remasters", optional `?trait=`). Hash is set in `selectTab` (:79-85) and `selectTrait` (:88-95).
- Target chain: `TARGET_CHAIN` in src/lib/network.js:13 (viem chain object, which has
  `.blockExplorers.default.url`: `https://etherscan.io` or `https://sepolia.etherscan.io`). Address:
  `getContractAddress(TARGET_CHAIN.id)` in src/lib/contracts.js:102. On Sepolia it returns
  `0x7bfc…117B`; in a mainnet build it returns `VITE_REMASTERED_PUNKS_MAINNET`.
- Vercel: `framework: null`, output `preview/remaster/dist`, no 404 config (vercel.json). With
  static output, Vercel serves `/404.html` from the output root for unmatched paths (status 404).
  `/:punkId(\d+)` is rewritten to the API (vercel.json:22-25), so numeric paths never reach the 404 page.
- favicon.png is 302x302 pixel-art. There is no apple-touch-icon. `@napi-rs/canvas` resolves via
  scripts/_deps.mjs `canvasLib()`. The compositor is used from Node the same way as in
  scripts/verify-render.mjs:56-75: `createStackCompositor({createCanvas, getSpriteSheet, punks})`,
  then `stackPunk(P)` for the remaster. The original comes from `data/punks.png` on BG `#638596`
  (`canon()` there).
- Montserrat: only Regular is installed locally (~/Library/Fonts). The OG script needs bold weights,
  so we vendor the font files.

## Files to change

| File | Change | Conflict risk |
|---|---|---|
| `preview/remaster/index.html` | add meta/OG/twitter/canonical/apple-touch-icon block after `<title>` (line 10); new title | **perf-caching-startup** edits lines 7-9 (fonts/preloads). Our block goes *after* line 10, so a textual merge is trivial |
| `preview/remaster/traits.html` | title + description + canonical + OG block (line 10) | repo-cleanup (low) |
| `preview/remaster/{zero,leaks,stacking-compare,remaster-sprites}.html` | title suffix ` · Punks Remastered` + `<meta name="robots" content="noindex">` (line 8). No OG on these dev pages | repo-cleanup may delete them from prod; then just drop our hunk |
| `preview/remaster/src/App.jsx` | (a) one `useEffect` for `document.title`, (b) replace footer at :195-201 | **ux-states** (pushState tabs rewrites `selectTab`/`selectTrait` :79-95, compact header :116-157). **perf-caching-startup** rewrites `App()` init :214-261. Keep our edits to: the import line 11-ish, a new effect placed *after* `selectTrait` (just before `const base` at :97), and the footer block :195-201. Don't touch `selectTab`, `selectTrait`, the header or `App()` |
| `preview/remaster/src/components/Home.jsx` | 1 import + 1 JSX line before `</section>` (:254) rendering `<HomeExplainer …/>` | **ux-states** edits Home copy. Our touch is 2 lines at the file's top and bottom, so keep the `home-sub` text at :167-169 unchanged |
| `preview/remaster/src/components/HomeExplainer.jsx` (new) | 3 steps + FAQ | none |
| `preview/remaster/src/components/HomeExplainer.css` (new) | styles using existing CSS vars, imported by the component | none (App.css untouched) |
| `preview/remaster/src/App.css` | footer tweak only if needed (e.g. `.site-footer code`); prefer none | low |
| `preview/remaster/public/og.png` (new, generated) | 1200x630 | none |
| `preview/remaster/public/apple-touch-icon.png` (new, generated) | 180x180 | none |
| `preview/remaster/public/404.html` (new) | static 404 | none |
| `scripts/generate-og.mjs` (new) | renders og.png + apple-touch-icon.png | none |
| `scripts/assets/fonts/Montserrat-{ExtraBold,SemiBold}.ttf` + `OFL.txt` (new) | vendored font (SIL OFL) for the script | none |

Gallery.jsx is not touched (gallery-virtualize owns it).

## Steps

### 1. og:image generator: `scripts/generate-og.mjs`

Usage: `node scripts/generate-og.mjs [--id 3763]`. Writes `preview/remaster/public/og.png` and
`preview/remaster/public/apple-touch-icon.png`.

- Load deps with `import { ROOT, canvasLib } from './_deps.mjs'`, then
  `const { createCanvas, loadImage, GlobalFonts } = canvasLib()`.
- Register fonts: `GlobalFonts.registerFromPath(join(ROOT,'scripts/assets/fonts/Montserrat-ExtraBold.ttf'), 'Montserrat')`
  (plus SemiBold). Get the TTFs from github.com/google/fonts `ofl/montserrat` (static instances,
  or the variable font if static files aren't available) and commit them with OFL.txt.
- Load the sprite sheet, CSV and punks.png. Copy the CSV parse, the `createStackCompositor` call
  and the `canon(id)` logic from verify-render.mjs:50-75; don't refactor verify-render.
- Hero punk: default to an id passed via `--id`; otherwise use the first entry of
  `data/remaster-pixel-counts.json` (sorted by pixels desc, currently #3763 with 30 px) that is in
  `all-eligible-punks.json`. Hard-fail if the id is not eligible. Snax picks the final id by
  looking at 3-4 candidates: run with `--id` for each and keep the best. Record the chosen id in a
  comment at the top of the script so the image can be reproduced.
- Layout (1200x630, white `#ffffff` bg, all pixel art drawn with `imageSmoothingEnabled=false` at
  **integer scale 12**, so 24px becomes 288px):
  - Left column (x=72): favicon at 64px (nearest-neighbor), then "Punks Remastered" in Montserrat
    800 at 64px, colour `#181818` (`--ink`). Below it, 2 lines in 600 weight, 30px, `#6b6b6b`:
    "Soulbound remasters of 3,434 CryptoPunks." / "Mint free (gas only). Follows your punk."
    At the bottom: "punksremastered.com" in `#1a43c8` (`--accent`).
  - Right block: original (288x288) → arrow (accent colour) → remaster (288x288), vertically
    centred, with small labels "Original" / "Remaster" under them (600 weight, 22px, muted).
    Each sprite sits on the punk BG `#638596` with 8px radius corners.
  - Keep the important content inside the central ~1080x566 area: some apps crop to 1.91:1 or
    to a square centre.
- Compression: `canvas.encode('png')`. The PNG should be well under 300 KB; check the size.
- apple-touch-icon: 180x180, background `#1a43c8`. Draw favicon.png scaled with nearest-neighbor.
  The logo is a blocky grid, so if 180 doesn't divide evenly, draw it at the largest size where
  the source grid lands on an integer multiple and centre it on the blue bg. Check it by eye.
- Determinism: same inputs give the same bytes. Commit the outputs. The script runs by hand and
  is not part of the build.

### 2. `index.html` head (insert after line 10; title changes)

```html
<title>Punks Remastered: soulbound remasters of CryptoPunks</title>
<meta name="description" content="Soulbound remasters of 3,434 eligible CryptoPunks. Mint is free apart from gas, and the remaster always follows the original punk onchain." />
<link rel="canonical" href="https://punksremastered.com/" />
<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
<meta name="theme-color" content="#1a43c8" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="Punks Remastered" />
<meta property="og:title" content="Punks Remastered" />
<meta property="og:description" content="(same as description)" />
<meta property="og:url" content="https://punksremastered.com/" />
<meta property="og:image" content="https://punksremastered.com/og.png" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:image:alt" content="A CryptoPunk next to its remaster" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="Punks Remastered" />
<meta name="twitter:description" content="(same)" />
<meta name="twitter:image" content="https://punksremastered.com/og.png" />
```

Keep the description at 160 characters or fewer. The URLs are absolute and hardcoded to prod on purpose:
canonical must always point at prod. Alternative considered: a tiny Vite `transformIndexHtml` plugin
that swaps in `VERCEL_URL` for previews. Rejected because it touches vite.config.js (repo-cleanup is
editing its inputs) and needs per-env logic for little gain. Downside: a preview's card points at
prod `/og.png`, which doesn't exist until the prod deploy. Verify the preview image directly
instead (see Verification).

### 3. `traits.html` and side pages

- traits.html:10: `<title>All traits · Punks Remastered</title>`, plus description ("Every
  CryptoPunk trait and how the remaster changes it."), canonical `https://punksremastered.com/traits.html`,
  apple-touch-icon, and the same og/twitter block with og:url/og:title adjusted (reuse og.png).
- zero.html:8, leaks.html:8, stacking-compare.html:8, remaster-sprites.html:8: change the titles to
  `Zero-pixel remasters · Punks Remastered`, `Type-B ear leaks · Punks Remastered`,
  `Prod vs stacking · Punks Remastered`, `Remastered traits (isolated) · Punks Remastered`, and add
  `<meta name="robots" content="noindex" />`. These are dev/prototype pages, so they get no OG tags.

### 4. Per-tab `document.title` (App.jsx)

Add one effect in `AppContent`, placed after `selectTrait` (before `const base`, App.jsx:97).
It depends only on `activeTab`/`filterTrait`, so it keeps working whatever ux-states does to
`selectTab`:

```js
useEffect(() => {
  const SITE = 'Punks Remastered';
  const page = { wallet: 'My Punks', lookup: 'Lookup', gallery: filterTrait ? `${filterTrait} remasters` : 'All Remasters' }[activeTab];
  document.title = page ? `${page} · ${SITE}` : `${SITE}: soulbound remasters of CryptoPunks`;
}, [activeTab, filterTrait]);
```

The home string must match index.html's `<title>`. `useEffect` is already imported (line 1).
Hooks must run before the `if (!assetsLoaded) return` at :101. The insertion point (~:96) is above
it, so the order is correct. Don't add titles for `?punk=` on Home (out of scope).

### 5. Home explainer: `HomeExplainer.jsx` + `.css`

Props: `{ onNavigate, onTrait }`. Home passes its own props through. Insert
`<HomeExplainer onNavigate={onNavigate} onTrait={onTrait} />` right before `</section>` at
Home.jsx:254, and add the import after line 5.

Markup (plain, no hype; `IS_MAINNET` from `../lib/network` for the one network-dependent line):

**How it works** (an `<ol class="explainer-steps">`, 3 cards in a row on desktop, stacked under 560px)
1. **Connect** the wallet that holds your punk.
2. **Mint** the remaster from My Punks. It's free apart from gas.
3. **It stays with your punk.** The remaster is soulbound: it can't be sold or sent on its own,
   and whoever owns the punk owns the remaster.

Primary CTA under the steps: `<button className="btn" onClick={() => onNavigate('wallet')}>Go to My Punks</button>`
(existing `.btn` class).

**FAQ** (`<details>`/`<summary>`, all closed by default, no JS):
- *What is a remaster?* A cleaned-up version of your punk's pixel art that fixes small drawing
  quirks in some traits. Same punk, same traits. Use "Can't see the difference?" above to spot
  the changed pixels.
- *What does soulbound mean here?* The remaster can't be transferred. Its owner is read straight
  from the CryptoPunks contract, so when the punk sells, the remaster goes with it automatically.
- *What does it cost?* Nothing apart from the Ethereum gas for the mint transaction.
- *Which punks are eligible?* 3,434 of 10,000: the ones with a trait the remaster changes. Browse
  [all remasters] (`onTrait(null)`) or [look up a punk] (`onNavigate('lookup')`).
- *My punk is wrapped.* Wrapped punks are held by the wrapper contract, so unwrap it first, then mint.
- *What does "Sync to marketplaces" do?* After a punk changes hands, marketplaces can keep showing
  the old remaster owner. Sync records the current owner onchain so they update. It's optional, and
  anyone can do it (gas only).
- If `!IS_MAINNET`: one muted line above the FAQ: "Minting is live on the Sepolia testnet for now.
  Mainnet is coming soon."

CSS (`HomeExplainer.css`): reuse `var(--ink|--text|--muted|--line|--panel|--accent)`; the font is
inherited (Montserrat via index.css:15). Max width about 760px, centred like `.home`. Steps: number
badge in `--accent`, 14-15px text. `summary`: 600 weight, cursor pointer, 1px `--line` dividers.
Add a 560px media query matching App.css:801.

Copy check: grep the diff for "activate"/"Activate". It must not appear in UI strings.

### 6. Footer (App.jsx:195-201)

Replace the brand button and the "All Traits" link (both duplicate the header nav):

```jsx
const contractAddress = getContractAddress(TARGET_CHAIN.id);
const explorer = TARGET_CHAIN.blockExplorers?.default?.url;
...
<footer className="site-footer">
  {contractAddress && explorer
    ? <a href={`${explorer}/address/${contractAddress}`} target="_blank" rel="noreferrer">
        Contract on Etherscan{IS_MAINNET ? '' : ' (Sepolia)'}
      </a>
    : <span>Contract: coming soon</span>}
  <a href="https://cryptopunks.app" target="_blank" rel="noreferrer">CryptoPunks</a>
</footer>
```

Import `getContractAddress` from `./lib/contracts` (App.jsx doesn't import it yet). `TARGET_CHAIN`
and `IS_MAINNET` are already imported (:11). Mainnet builds automatically link
`etherscan.io/address/<VITE_REMASTERED_PUNKS_MAINNET>`. Compute the two consts near `const base`
(:97), not in the JSX, to keep the footer hunk small.

### 7. 404 page: `public/404.html`

A static, self-contained file (Vite copies `public/` to `dist/` as-is). It uses inline styles like
zero.html: favicon, the Montserrat link, and `<meta name="robots" content="noindex">`. Title is
`Page not found · Punks Remastered`. Body has an h1 "Page not found", one muted line, and links:
Home `/`, All Remasters `/#gallery`, Lookup `/#lookup`. Use absolute root paths.
Alternative considered: a Rollup input `404.html` (processed by Vite, could import App.css).
Rejected: it adds a vite.config.js edit (repo-cleanup hotspot) for no real benefit. No vercel.json
change is needed.

## Risks

- **Preview OG cards** point at prod og.png until this ships to prod. Check the image at
  `<preview>/og.png` directly.
- **Social caches**: X/Telegram/Discord cache cards. After prod deploy, re-scrape with the
  Facebook Sharing Debugger and opengraph.xyz. If og.png changes later, version it (`og.png?v=2`).
- **Font licensing**: Montserrat is OFL, so committing it with OFL.txt is fine.
- **Hook ordering**: the title effect must sit above the `if (!assetsLoaded) return` at App.jsx:101.
- **Merge order**: if ux-states lands first and moves the footer/header, rebase and re-apply step 6
  by hand. If perf-caching-startup lands first, keep its font/preload lines and re-insert our
  block after `<title>`.
- **Copy accuracy**: "free apart from gas" is true only while `activate` stays non-payable. If the
  mainnet contract changes, update the FAQ and description.
- `/12345` (numeric) goes to the API, not the 404 page. That's expected and out of scope.

## Verification

1. `node scripts/generate-og.mjs`, then open both PNGs. Check: 1200x630 / 180x180, crisp pixels
   (no blur, integer scale), text not clipped, under 300 KB. `file preview/remaster/public/og.png`.
2. `cd preview/remaster && npm run lint && npm test && npm run build`.
3. Built HTML:
   ```bash
   grep -o '<title>[^<]*</title>' dist/*.html
   grep -c 'og:image\|twitter:card\|rel="canonical"\|name="description"' dist/index.html dist/traits.html
   ls dist/og.png dist/apple-touch-icon.png dist/404.html
   ```
   Every page title should be distinct. index and traits each have all 4 kinds of tag.
4. `npm run dev` (or `vite preview`):
   - Switch tabs and check the tab title changes for Home, My Punks, Lookup, All Remasters, and a
     trait chip ("Headband remasters · …").
   - Home shows the steps and FAQ. Links go to the gallery and lookup. "Go to My Punks" works.
   - Check at 390px wide (`/mobile-check`).
   - Footer links to `https://sepolia.etherscan.io/address/0x7bfc1458fD8BC7D176b2D3B8020f07C335fe117B`.
5. Vercel preview (`/ship`):
   ```bash
   curl -s https://<preview>/ | grep -E 'og:|twitter:|canonical|description'
   curl -sI https://<preview>/og.png              # 200, image/png
   curl -sI https://<preview>/no-such-page        # 404
   curl -s  https://<preview>/no-such-page | grep 'Page not found'
   curl -sI https://<preview>/123                 # still API (unchanged)
   ```
   Paste the preview URL into https://www.opengraph.xyz. Title and description should render; the
   image will be missing until prod (expected).
6. After the prod deploy: opengraph.xyz and the Facebook Sharing Debugger on
   `https://punksremastered.com/` and `/traits.html`. Post the link in a private Telegram/Discord
   chat to see the large card. Check the iOS "Add to Home Screen" icon.

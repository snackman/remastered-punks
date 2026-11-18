# ux-states — empty/loading/error states, Lookup copy + validation, compact mobile header, real Back button, focus + tap targets

Base branch: `prototype/base-ear-shift`. Branch: `task/ux-states`. Frontend only (`preview/remaster`). No contract or API changes.

## Goal

1. My Punks while disconnected shows a Connect button and a link to Lookup.
2. Initial load shows a spinner. A fatal load error is styled and has a Retry button.
3. Lookup has a label, accessible errors and integer-only validation, plus a "Random eligible punk" button. On the eligible card, the disconnected button reads "Connect wallet to mint" and says only the owner can mint.
4. At 390px the header is two rows: brand + Connect, then one horizontally scrollable nav row.
5. Each tab is a history entry. Browser Back and Forward move between tabs. Stale `?trait=` / `?punk=` never survive a tab switch.
6. Visible `:focus-visible` rings everywhere. Canvases are labelled images. The traits.html section toggles are real buttons with `aria-expanded`.
7. Interactive hit areas are at least 32px (40px where layout allows). Small labels meet 4.5:1 contrast.
8. Clear the lint errors in the files this task touches.

## Findings (checked against the code on 2026-11-18)

Line refs are `preview/remaster/src/...` unless noted.

| # | Audit claim | Status on current code |
|---|---|---|
| 1 | No connect button in My Punks | **Applies.** `App.jsx:184-188` renders only `<p>Connect your wallet to view your CryptoPunks.</p>` inside `.connect-prompt` (grey panel, `App.css:288-302`). |
| 2 | Plain loading text, unstyled error, no Retry | **Applies.** `App.jsx:101-103` shows `<div className="loading">Loading assets...</div>`, which renders *instead of* the header. `App.jsx:263-265` shows `<div className="error">Error loading: {error}</div>` outside the providers, with no Retry. The init effect is at `App.jsx:214-261`. `.error` is styled as a red panel (`App.css:311-315`), so "unstyled" really means no layout, no header and no action. |
| 3 | Lookup a11y + parseInt truncation | **Applies.** `ManualLookup.jsx:34-41` is a `type="number"` input with a placeholder and no label. `:46` is the error with no `role`. `:14` uses `parseInt(inputValue.trim())`, so "12.7" becomes 12 and "1e3" becomes 1. ManualLookup doesn't get `eligiblePunks` (`App.jsx:191`), so the random button needs that prop. `PunkCard.jsx:181` shows a disabled "Connect Wallet" button when disconnected: it does nothing and doesn't say why. |
| 4 | Mobile header wraps to ~217px | **Applies.** `.site-header` has `flex-wrap: wrap` (`App.css:13-21`), `.site-nav` has `flex-wrap: wrap` (`:49-55`), and at <=560px `.connect-wrapper` gets `width:100%` (`:805-808`), which forces Connect onto its own row. `.app` padding is 24px (`:9`). |
| 5 | replaceState tabs, stale query | **Applies.** `selectTab` (`App.jsx:79-85`) and `selectTrait` (`:88-95`) use `replaceState`. `selectTab` writes only `#id`, so it relies on the relative URL. `?punk=`/`?trait=` survive because a bare-hash URL keeps the search string. `Home.jsx:40` `urlFor` writes `?punk=…` with `replaceState` (`:50`). The comment at `Home.jsx:29` mentions a "popstate handler", but none exists anywhere (`grep popstate src` finds only that comment). |
| 6 | Focus/canvas/traits toggles | **Applies.** There are no `:focus-visible` rules. `App.css:614-617` removes the input outline. The canvases have no role or label: `PunkCard.jsx:230,241` and `Home.jsx:173,187,198`. In traits.html the toggle is a click handler on `<h2>` (`src/traits.js:283-289`) with no keyboard support or aria. `orderSectionsByCount` rewrites `h2.innerHTML` (`traits.js:336`) and `addTraitLinks` swaps in an `<a>` inside the h2 (`:369-377`). |
| 7 | Tap targets / contrast | **Applies.** Home chips are `.remaster-badge` with 10px text and 3px padding (`App.css:457-476`), about 18px tall. `.reveal-toggle` has 4px padding (`:221-234`). Footer links are bare 12px text (`:780-799`). Nav pills have 8px padding (`:57-71`). Filter buttons are 11px (`:350-363`). Contrast: `--muted #6b6b6b` on white is 5.3:1, which passes on its own. But `.punk-card.not-eligible { opacity: .65 }` (`:570-572`) fades the "#N has no remaster…" copy and the labels to about 2.7:1. `.mint-note #7a7a7a` (`:749-753`) is 4.3:1. The card label is 10px (`:425-432`). |
| 8 | Lint | **Applies.** `npx eslint src` gives 3 errors. `Home.jsx:18` has an unused `onNavigate`. `Home.jsx:139` calls `setChangedCount` inside an effect (react-hooks/set-state-in-effect). `Gallery.jsx:3` has an unused `extractPunk`, which is **not ours** (gallery-virtualize). |

Other facts:
- `eligibility.js:10-11` `noRemasterCopy` is already clear ("#N has no remaster — only 3,434 punks are eligible"). Keep it.
- `npm test` runs `node --test src/lib/*.test.mjs` (`package.json`), so a new pure `src/lib/urlState.js` can be unit-tested with no new tooling.
- `PunkGrid.jsx:13-17` reads the dev-only `?as=` from `window.location.search` on every render. The URL builder must keep `as` in DEV, or switching tabs drops it.
- RainbowKit exports `useConnectModal` and `ConnectButton.Custom`. Both are already available via `@rainbow-me/rainbowkit` ^2.2.10.

## Scope boundaries / coordination

- **gallery-virtualize** owns `Gallery.jsx` and gallery CSS (`.gallery-*`). Don't touch them. The `Gallery.jsx:3` lint error stays.
- **og-tags-copy** owns OG tags, the Home explainer copy, the footer markup and the 404 page. This task makes **CSS-only** tap-target changes to `.site-footer a` / `.site-footer .brand`. It doesn't touch the footer JSX (`App.jsx:195-201`).
- **perf-caching-startup** owns the *fetch logic* inside `App()`'s init (`App.jsx:214-261`). This task owns the *loading/error UI* and the retry plumbing. The contract between them:
  - `App()` exposes `loadState: 'loading' | 'ready' | 'error'`, `loadError: string|null` and `retry()`. `retry()` bumps a `loadAttempt` counter that is the init effect's only dependency.
  - This task changes only: the `loadAttempt` state and dependency, `setError(null)` inside `retry()` (not in the effect body, which would trip the lint rule), and moving the two render branches into `AppContent`.
  - perf-caching-startup can rewrite the body of `init()` freely, as long as it ends with `setAssetsLoaded(true)` or `setError(msg)`. Whichever PR lands second rebases. The conflict is limited to `App.jsx:206-265`.
- State merge hotspots (`App.jsx` header/nav, `App.css` header + mobile block) are shared with og-tags-copy. Keep the edits there tight and in one place.

## Files to change

| File | Change |
|---|---|
| `src/lib/urlState.js` (new) | Pure `parseUrl({search, hash})` and `buildUrl({pathname, search, tab, trait, punk, keepDev})` |
| `src/lib/urlState.test.mjs` (new) | `node --test` cases for the above |
| `src/App.jsx` | pushState tabs, popstate listener, loading/error UI inside the header shell, Retry, My Punks connect prompt, pass `eligiblePunks` + `onNavigate` to ManualLookup, drop `onNavigate` from Home, ConnectButton props for small screens |
| `src/components/Home.jsx` | Use `buildUrl` for `?punk=`, fix the stale comment, remove the unused prop, fix the set-state-in-effect, canvas `role="img"`/`aria-label` |
| `src/components/ManualLookup.jsx` | Label, strict integer validation, `role="alert"`, random eligible button, optional "Lookup" link target |
| `src/components/PunkCard.jsx` | Disconnected state opens the connect modal ("Connect wallet to mint") plus an owner hint. Canvas labels. |
| `src/App.css` | Mobile header, spinner, connect-prompt actions, focus rings, tap targets, contrast fixes, `.sr-only` |
| `src/index.css` | Global `:focus-visible` rule |
| `traits.html` (inline `<style>`) + `src/traits.js` | Section toggle `<button>` with `aria-expanded`/`aria-controls`, bigger hit area, focus ring |

## Implementation steps

### 1. URL state helper (`src/lib/urlState.js`, new)

```js
export const VALID_TABS = ['home', 'wallet', 'lookup', 'gallery'];
// search/hash are raw location strings ("?trait=Cap", "#gallery").
export function parseUrl({ search, hash }) {
  const h = (hash || '').replace(/^#/, '');
  const q = new URLSearchParams(search || '');
  const tab = VALID_TABS.includes(h) ? h : 'home';
  const punkN = Number(q.get('punk'));
  return {
    tab,
    trait: tab === 'gallery' ? q.get('trait') || null : null,
    punk: tab === 'home' && q.get('punk') && Number.isInteger(punkN) ? punkN : null,
  };
}
// Rebuilds the query from scratch so stale ?trait/?punk never leak across tabs.
// keepDev: carry the dev-only ?as= param (PunkGrid useViewAs).
export function buildUrl({ pathname, search = '', tab, trait = null, punk = null, keepDev = false }) {
  const out = new URLSearchParams();
  if (keepDev) { const as = new URLSearchParams(search).get('as'); if (as) out.set('as', as); }
  if (tab === 'gallery' && trait) out.set('trait', trait);
  if (tab === 'home' && punk != null) out.set('punk', String(punk));
  const s = out.toString();
  return `${pathname}${s ? `?${s}` : ''}#${tab}`;
}
```

Tests (`urlState.test.mjs`) should cover:
- `buildUrl` from `?trait=Cap&punk=3#gallery` to wallet gives `/#wallet`.
- trait encoding (`Clown Hair Green`).
- punk only on home.
- `keepDev` keeps `as`.
- `parseUrl` on garbage hash gives home.
- `?punk=12.7` gives null.

### 2. Navigation (`App.jsx:66-95`)

- Initialise `activeTab`/`filterTrait` from `parseUrl(window.location)`. This replaces `:66-75`. Drop the `typeof window` guards: this is a client-only SPA.
- Add a helper `nav(tab, trait = null)`:
  - Set the state.
  - Compute `url = buildUrl({ pathname: location.pathname, search: location.search, tab, trait, keepDev: import.meta.env.DEV })`.
  - `if (url !== location.pathname + location.search + location.hash) history.pushState({ tab, trait }, '', url)`.
  - `window.scrollTo(0, 0)`.
- `selectTab(id)` becomes `nav(id)`. `selectTrait(t)` becomes `nav('gallery', t)`. Both now push a history entry. A gallery chip click is a navigation too.
- Add `useEffect(() => { const on = () => { const s = parseUrl(location); setActiveTab(s.tab); setFilterTrait(s.trait); }; addEventListener('popstate', on); return () => removeEventListener('popstate', on); }, [])`. setState inside an event callback is lint-clean.
- Home keeps **replaceState** for shuffle (its own Back/Next handle punk history, so shuffles don't flood browser history). Change `Home.jsx:40` to `buildUrl({ pathname: location.pathname, search: location.search, tab: 'home', punk: id, keepDev: import.meta.env.DEV })`. Don't use `location.hash`: Home only ever renders on the home tab. Rewrite the `Home.jsx:29` comment ("Refs so callbacks always see current values"). Home remounts on each visit, and its init effect (`:74-87`) reads `?punk=`. So "Home, shuffle to #42, All Remasters, Back" shows #42 again.

### 3. Loading and fatal error UI (`App.jsx:101-103, 206-265`)

- In `App()`, add `const [loadAttempt, setLoadAttempt] = useState(0)` and `retry = () => { setError(null); setLoadAttempt(n => n + 1); }`. The init effect depends on `[loadAttempt]`. `loadAssets` / `loadPunkData` / `initStacking` / `initEligibility` just reassign module state, so re-running them is safe.
- Remove the early `if (error) return …` (`:263-265`). Always render the providers and pass `loadError={error}` and `onRetry={retry}` to `AppContent`.
- In `AppContent`, remove the early return at `:101-103`. The header always renders. Branding and Connect then show immediately and the page doesn't jump when data arrives. Inside `<main>`:
  - `loadError`:
    ```jsx
    <div className="error" role="alert">
      <p>Couldn't load punk data. {loadError}</p>
      <button className="btn" onClick={onRetry}>Retry</button>
    </div>
    ```
  - `!assetsLoaded`:
    ```jsx
    <div className="loading" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      <p>Loading punks…</p>
    </div>
    ```
  - otherwise the current tab content.
- CSS:
  - Add `.spinner`: a 28px ring, `border: 3px solid var(--line); border-top-color: var(--accent); animation: spin .8s linear infinite`.
  - Under `@media (prefers-reduced-motion: reduce)`, drop the animation (`animation: none`) and keep the static ring.
  - Add `.error .btn, .connect-prompt .btn { margin-top: 14px; }`. `.btn` has `margin: 0 auto 40px` (`App.css:115+`), so override the margin.
- Optional: reuse the same spinner in `PunkGrid.jsx:95-101`. Use a one-line `<span className="spinner" />` and don't touch the query logic.

### 4. My Punks disconnected state (`App.jsx:184-188`)

```jsx
<div className="connect-prompt">
  <p>Connect your wallet to see which of your CryptoPunks can mint a remaster.</p>
  <div className="connect-prompt-actions">
    <ConnectButton.Custom>{({ openConnectModal, mounted }) => (
      <button className="btn" onClick={openConnectModal} disabled={!mounted}>Connect wallet</button>
    )}</ConnectButton.Custom>
    <button className="link-button" onClick={() => selectTab('lookup')}>or look up any punk</button>
  </div>
</div>
```

Add `.connect-prompt-actions` (flex column, centered, gap 10px). Add `.link-button`: no background, accent colour, underline, `min-height: 40px`, 10px padding. `.reveal-toggle` reuses the same look.

### 5. Lookup (`ManualLookup.jsx`) and PunkCard copy

- Props: `({ punkData, eligiblePunks = [], merkleProofs, merkleStatus })`. In `App.jsx:191`, pass `eligiblePunks`.
- Input: change to `type="text" inputMode="numeric" autoComplete="off" id="punk-id-input" aria-describedby={error ? 'lookup-error' : undefined} aria-invalid={!!error}`. Add a `<label htmlFor="punk-id-input" className="sr-only">Punk ID (0–9999)</label>`. Keep the placeholder. `type=number` lets "e", "." and "-" through and hides the raw value, which is why it changes to text.
- Validation: `const raw = inputValue.trim().replace(/^#/, ''); if (!/^\d{1,4}$/.test(raw)) { setError('Enter a whole-number punk ID from 0 to 9999'); return; }`, then `const punkId = Number(raw)`. "12.7", "1e3", "-1" and "10000" are all rejected. "#42" is accepted.
- Error: `<div id="lookup-error" className="lookup-error" role="alert">`.
- Random: a `<button type="button" className="link-button">Random eligible punk</button>` under the input row. It picks `eligiblePunks[Math.floor(Math.random()*eligiblePunks.length)]`, sets `inputValue` to that id and sets `punk`. Disable it when the list is empty.
- PunkCard disconnected (`PunkCard.jsx:177-181, 274-280`):
  - `const { openConnectModal } = useConnectModal()`.
  - When `!isConnected`, render `<button className="mint-button" onClick={openConnectModal}>Connect wallet to mint</button>` (enabled), followed by `<p className="mint-hint">Only the punk's current owner can mint its remaster.</p>`.
  - Keep `buttonDisabled` logic for every other state. The simplest way is to branch before the existing `<button>`.
  - `.mint-hint` is 12px, `var(--muted)`, margin-top 6px.
  - Only Lookup can show this state: PunkGrid renders only when connected.

### 6. Compact mobile header (`App.css:13-90, 801-827`; `App.jsx:155`)

Inside `@media (max-width: 560px)`, replace the `.connect-wrapper { width:100% }` rule:

```css
.app { padding: 0 16px 56px; }
.site-header { gap: 10px 12px; padding: 12px 0; margin-bottom: 20px; }
.brand-logo { width: 28px; height: 28px; }
.brand-name { font-size: 14px; }
.connect-wrapper { margin-left: auto; width: auto; }
.site-nav {
  order: 3; width: 100%; margin: 0 -16px; padding: 0 16px;  /* bleed to edges */
  flex-wrap: nowrap; overflow-x: auto; scrollbar-width: none;
  -webkit-overflow-scrolling: touch; scroll-snap-type: x proximity;
}
.site-nav::-webkit-scrollbar { display: none; }
.site-nav a, .site-nav button { white-space: nowrap; flex: 0 0 auto; }
```

- `margin: 0 -16px` with `width:100%` can overflow. Use `width: calc(100% + 32px)` instead, and check `scrollWidth` (see Verify).
- `.site-nav` gets `aria-label="Main"` in JSX.
- `App.jsx:155`: change to `<ConnectButton showBalance={false} chainStatus={{ smallScreen: 'icon', largeScreen: 'full' }} accountStatus={{ smallScreen: 'avatar', largeScreen: 'full' }} />` so a connected wallet fits on row 1.
- The testnet/"Wrong network" pill (`:134-154`) will wrap row 1 when it shows. Accept this: it only shows in a transient error state. At <=560px give `.testnet-switch` `padding: 6px 12px; font-size: 11px` to limit the overflow.
- Target: header ≤ ~110px tall at 390px when disconnected and when connected on the right chain.
- On the active tab, `scrollIntoView({ inline: 'nearest', block: 'nearest' })`. This is optional, for deep links to `#gallery` on narrow screens.

### 7. Focus rings (`index.css`, `App.css`, `traits.html`)

In `index.css`:

```css
:where(a, button, input, select, textarea, [tabindex]):focus-visible {
  outline: 3px solid var(--accent); outline-offset: 2px; border-radius: 6px;
}
.site-nav button.active:focus-visible, .btn:focus-visible, .mint-button:focus-visible,
.remaster-badge-btn:focus-visible { outline-color: var(--ink); }
.sr-only { position:absolute; width:1px; height:1px; padding:0; margin:-1px; overflow:hidden; clip:rect(0 0 0 0); white-space:nowrap; border:0; }
```

- Accent-filled controls get an ink ring so the ring doesn't vanish against the blue fill.
- `App.css:614-617`: keep the border change and remove `outline: none` so the global rule applies. Alternatively scope it to `:focus:not(:focus-visible)`.
- RainbowKit buttons bring their own focus styles. Don't override them.
- On the scrollable nav, the outline gets clipped by `overflow-x:auto`. Use `outline-offset: -3px` for `.site-nav button:focus-visible`.

### 8. Canvas semantics

- `PunkCard.jsx:230`: `role="img" aria-label={`Punk #${punk.id}${eligible && showRemastered ? ', original' : ''}`}`.
- `PunkCard.jsx:241`: `aria-label={`Punk #${punk.id}, remastered`}`.
- `Home.jsx:187,198`: the same pattern, guarded with `punk ? … : 'Loading punk'`.
- `Home.jsx:173`: overlay `aria-label={`Punk #${id}, alternating between original and remaster`}`. Also add `aria-live="polite"` on `.hero-label` only when **not** flickering. Simpler: leave the label without aria-live, because a live region announcing every 380ms is hostile.

### 9. traits.html toggles (`src/traits.js:283-289`, `traits.html` `<style>` ~l.64-100)

- Drop the h2 click handler from `setupCollapsible()`. Add a new `wireToggles()` that runs **last** in `init()`, after `addTraitLinks()` and `addPixelCounts()`. Running it last means `orderSectionsByCount`'s `innerHTML` rewrite (`traits.js:336`) can't destroy the buttons.
- For each `.section`, do the following:
  - Give its `.section-content` an id `sec-${i}-content`.
  - Inside the h2, move every child node except `.trait-count` / `.trait-count-link` into a new `<button type="button" class="section-toggle" aria-expanded="true" aria-controls="sec-${i}-content">`. Make that button the h2's first child.
  - On click: toggle `collapsed` and set `aria-expanded` to the new value.
- A link nested inside a button is invalid, which is why the count link stays a sibling. Its `stopPropagation` (`:376`) becomes unnecessary but harmless.
- Because `wireToggles` runs after the async init, and the catch block (`traits.js:~404`) replaces `body` on error, toggles exist only on success. That's acceptable.
- CSS:
  - Move `cursor:pointer` and the `::before` triangle from `.section h2` to `.section-toggle`.
  - `.section-toggle` should be `all: unset; display:inline-flex; align-items:center; min-height:44px; padding: 4px 8px 4px 0; cursor:pointer; font: inherit; color: inherit;`.
  - Add `.section-toggle:focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; border-radius: 6px; }`. traits.html doesn't load `index.css`, so it needs its own rule.
  - Change the `.section.collapsed h2::before` selector to `.section.collapsed .section-toggle::before`.

### 10. Tap targets and contrast (`App.css`)

- `.site-nav a, .site-nav button`: `padding: 10px 14px; min-height: 40px; display:inline-flex; align-items:center`.
- `.remaster-badge-btn` (Home chips only; PunkCard badges are non-interactive spans): `padding: 8px 14px; font-size: 11px; min-height: 32px`. On mobile, `min-height: 36px`.
- `.reveal-toggle`: `padding: 10px 12px; min-height: 40px`.
- `.filter-buttons button`: `min-height: 36px`.
- `.site-footer a, .site-footer .brand`: `display:inline-flex; align-items:center; min-height: 40px; padding: 0 6px`. CSS only (see coordination).
- `.input-row` at <=400px: allow wrap so the 220px input and the button don't overflow. Use `flex-wrap: wrap` with `input { flex: 1 1 160px; width:auto }`.
- Contrast:
  - Replace `.punk-card.not-eligible { opacity: .65 }` with `.punk-card.not-eligible canvas { opacity: .7 }`. The images still read as "inactive" and the text keeps full contrast.
  - `.punk-image-wrapper .label` goes to 11px.
  - `.mint-note` goes to `color: var(--muted)` (5.3:1).
  - `.hero-label` stays muted on white (5.3:1).
  - `.no-remaster` stays muted (5.3:1 once the opacity is gone).
- `.grid-note` / `.wrapped-notice` have `opacity: .85` on `--panel`, giving `#272727` at 85% on `#f5f5f5`, about 11:1. That's fine; leave it.

### 11. Lint (`Home.jsx`)

- Remove `onNavigate` from `Home`'s signature (`:18`) and from `App.jsx:164`.
- Set-state-in-effect (`:139`): pull the diff into a pure helper `countChangedPixels(punk)`. The helper does the `orig`/`rem` composite and returns `{ orig, rem, changed }`. Call it in `const revealData = useMemo(() => (reveal && eligible && punk ? countChangedPixels(punk) : null), [reveal, eligible, punk])`. Render `revealData.changed`, delete the `changedCount` state, and have the effect only draw and flicker.
- The flicker's `setRevealShowing` currently runs once synchronously, via the first `flick()` in the effect body. Make the first call `drawImg(rem)` directly, schedule `flick` for the toggles, and reset `revealShowing` to `'remastered'` in the toggle button's onClick.
- Run `npx eslint src`. Expect exactly one remaining error, `Gallery.jsx:3`, owned by gallery-virtualize.

## Alternatives considered

- **Swap the hash router for a real router** (react-router, or path-based `/gallery`). Rejected: it adds a dependency and changes deep links already shared as `/#gallery` and `traits.html` → `?trait=X#gallery`. `pushState` plus `popstate` on the existing hash scheme fixes Back with about 40 lines.
- **pushState on every Home shuffle.** Rejected: 20 shuffles would mean 20 Back presses to leave Home, and Home already has Back/Next.
- **Keep the full-page loading screen.** Rejected: rendering the header shell first is cheap, removes layout jump, and gives the error state a place to live with branding.
- **Skeleton cards instead of a spinner.** Not worth it: the load is one dataset gate, and the Home hero layout depends on the data. A spinner plus copy is enough. perf-caching-startup will shorten the wait anyway.
- **`<details>/<summary>` for traits.html sections.** Cleaner semantics, but it needs the static HTML (26 sections) restructured and fights the h2 `innerHTML` rewrite plus the float-right count link. The JS-wrapped `<button>` keeps the h2 heading and is a smaller diff.
- **Plain `<ConnectButton />` in the My Punks prompt.** It works, but renders RainbowKit's small pill. `ConnectButton.Custom` with our `.btn` matches the page and still opens the same modal.

## Risks

- **History edge cases.** On first load at `/#wallet` there's no entry before it, so Back leaves the site. That's expected.
  - Make sure `nav()` skips the push when the URL is unchanged. Otherwise clicking the active tab adds duplicate entries.
  - popstate also fires for manual hash edits. `parseUrl` handles that.
- **perf-caching-startup merge conflict** in `App()`. It's mitigated by the contract above. The implementer should check whether that branch has landed first and rebase if so.
- **RainbowKit `chainStatus`/`accountStatus` responsive props.** RainbowKit's breakpoint is 768px, not our 560px. That's fine either way, but check the connected state at 390px on the preview with a real wallet.
- **Moving the error into the providers.** If `wagmiConfig` itself throws, the old out-of-provider error path doesn't cover it either, so no regression.
- **`all: unset` on `.section-toggle`** could inherit oddly in Safari. If it does, use explicit resets.
- **Horizontal-scroll nav discoverability.** Five items at about 11–12px may fit at 390px without scrolling at all. A scroll fade isn't needed if they fit. Measure.
- **Shared CSS hotspots** with og-tags-copy (footer) and gallery-virtualize (chips/captions in `.gallery-*`). Don't edit `.gallery-*` rules.

## Verify

Local (from `preview/remaster`):

1. `npm test`: the new `urlState.test.mjs` passes, and so do the existing `mintErrors`/`networkEnv` tests.
2. `npx eslint src`: only `Gallery.jsx:3 extractPunk` remains.
3. `npm run build`: the eligibility check plus the Vite build succeed.

Manual (dev server, then repeat on the Vercel preview via `/ship`):

4. **390px overflow** (DevTools, iPhone 12/13 390×844, disconnected and connected):
   - In the console, `document.documentElement.scrollWidth <= innerWidth` must be true.
   - `document.querySelector('.site-header').getBoundingClientRect().height` should be ≤ ~110.
   - Brand and Connect sit on row 1 and the nav is a single row that scrolls sideways.
   - Repeat on `#lookup` with a result card and on `#wallet`.
5. **Back button.**
   - Fresh tab at `/`, then click: My Punks → Lookup → All Remasters → (Home) chip "Cap" → Back ×4. The tabs must retrace in reverse with the correct URL each time. The final Back lands on Home with the same `?punk=` it had.
   - Forward retraces.
   - Click the active tab twice: no extra history entry (check `history.length`).
   - From `/?trait=Cap#gallery`, click My Punks: the URL is exactly `/#wallet`.
   - From Home `?punk=123#home`, click Lookup: the URL is `/#lookup`.
6. **Keyboard pass** (Tab only, no mouse):
   - brand → each nav pill (ring visible, including on the blue active pill) → Connect → main content → footer.
   - Lookup: the label is announced (VoiceOver: "Punk ID (0–9999), edit text").
   - Submit "12.7": the error is announced via `role="alert"` and no card shows.
   - "#42" works. "Random eligible punk" shows an eligible card.
   - Home: chips, "Can't see the difference?" and Back/Shuffle/Next all reachable with a visible ring.
   - traits.html: Tab reaches each section toggle, Enter/Space collapse it, `aria-expanded` flips (inspect), and the count link is still separately focusable.
7. **States.**
   - Disconnected `#wallet`: the Connect wallet button opens the RainbowKit modal, and "or look up any punk" switches to Lookup.
   - Disconnected Lookup of an eligible id (e.g. one from Random): the enabled "Connect wallet to mint" opens the modal, and the owner hint shows.
   - Non-eligible id: the `noRemasterCopy` text reads at full contrast.
   - Loading: DevTools Network "Slow 3G" shows the header plus the spinner.
   - Error: DevTools request blocking on `cryptopunks.csv` shows the red panel with Retry. Unblock, click Retry, and the app loads with no page reload.
8. **Contrast spot-check.** In the DevTools contrast picker, `.no-remaster` on a non-eligible card, `.label`, and `.mint-note` should each be ≥ 4.5:1.
9. **Tap targets.** In DevTools, inspect computed heights: nav pills ≥ 40, Home chips ≥ 32 (36 mobile), reveal toggle ≥ 40, footer links ≥ 40.
10. **Vercel preview.** Run steps 4–7 on the preview URL on a real phone (iOS Safari): connected wallet header fit, nav swipe, and Back via the edge-swipe gesture.

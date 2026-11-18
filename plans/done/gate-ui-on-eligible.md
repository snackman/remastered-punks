# gate-ui-on-eligible: gate remaster display, Mint and Home shuffle on the eligible set

Base branch: `prototype/base-ear-shift` (prod deploys from it). Branch: `task/gate-ui-on-eligible`.
All paths below are relative to the repo root; frontend = `preview/remaster/src/`.

## Goal

The UI has one definition of "this punk has a remaster / can mint": membership in
`data/all-eligible-punks.json` (3,434 ids, produced by the stacking-compositor pixel diff in
`scripts/generate-eligible.mjs`). That is the same set the server (`api/[punkId].js:115`,
`api/metadata/[id].js:61`), the merkle tree and the gallery use. `getRemasters()` stays an
internal compositor helper only and stops deciding anything user-visible.

## Verified findings (2026-11-18)

- `data/merkle-tree.json` `proofs` keys == `all-eligible-punks.json` exactly (3,434/3,434).
  `data/remaster-pixel-counts.json` ids == eligible set exactly (3,434, all `pixels > 0`). So
  the eligible set, the proof set and the gallery set already agree. Only `getRemasters`-based
  logic disagrees.
- PunkCard's rule (`PunkCard.jsx:70-72`: `accessories.length > 0 && getRemasters().length > 0`)
  is wrong for **113** ids:
  - 78 eligible, no `getRemasters` entry. All are Human/Female with **Pilot Helmet (53)** or
    **Big Shades (25)**, which are sprites the stack compositor edits (`lib/stack-compositor.js:103,107,120-121`)
    but `getRemasters` doesn't list. Examples: 13, 14, 22, 53, 180, 240, 382, 445, 501, 504.
  - 4 eligible bald females with no accessories (641, 1050, 2204, +1). `getRemasters` gives
    `Bald`, but `isEligible` at :70 needs `accessories.length > 0`.
  - 31 non-eligible with a `getRemasters` entry (65, 305, 573, 631, 1303, 1851, 2763, …). These are
    mostly Frown+beard males and Headband/VR females. Their stack render matches the original pixel
    for pixel, so the "Remastered" canvas shows an unchanged punk, and `/65` returns 404.
- Home `buildBuckets` (`Home.jsx:10-23`) only loops over eligible ids, but keys come from
  `getRemasters`, so the 78 never get a bucket and never come up in the shuffle. If
  `eligiblePunks` is empty, the fallback at :11-13 uses all 10k ids. The deep link
  `?punk=<id>` (:96-98) accepts any id and draws a "Remaster" of a non-eligible punk.
- Gallery (`Gallery.jsx:56-68`) uses `remaster-pixel-counts.json`, which is already correct.
  No logic change needed.
- PunkGrid already gates on `eligibleSet` (`PunkGrid.jsx:19,60`; on testnet only eligible ids are
  multicalled, :35). `hasRemasters` at :4 is imported but never used.
- Chips: PunkCard (:162-168), Home (:229-238) and Gallery (:44-46) all show `punk.accessories`,
  and so does the metadata API (`api/metadata/[id].js:73`). That's consistent, so **no** changed-trait
  derivation is needed for chips. Only Home's bucket keys need a remaster trait for the 78 (see step 2).
- Proofs load in the background (`App.jsx:237-241`, 3.2 MB). The eligible list loads **before**
  `assetsLoaded` (:232-235), so eligibility is always known by the time the UI renders. Only proof
  presence can lag. A failed fetch only `console.warn`s.

## Approach

Make eligibility a tiny pure module so the components and a Node check script share the same code:

1. **New `preview/remaster/src/lib/eligibility.js`** (no imports, so it's Node-importable):
   ```js
   let set = new Set();
   export function initEligibility(ids) { set = new Set(ids.map(Number)); }
   export const isEligibleId = (id) => set.has(Number(id));
   export const eligibleCount = () => set.size;
   export const noRemasterCopy = (id) =>
     `#${id} has no remaster — only ${set.size.toLocaleString('en-US')} punks are eligible`;
   // Pure view-state for a card; merkleStatus: 'loading' | 'ready' | 'error'
   export function remasterState(id, proof, merkleStatus) {
     const eligible = isEligibleId(id);
     const hasProof = Array.isArray(proof) && proof.length > 0;
     return { eligible, hasProof, showRemaster: eligible, showMint: eligible,
              proofPending: eligible && !hasProof && merkleStatus === 'loading',
              proofMissing: eligible && !hasProof && merkleStatus !== 'loading' };
   }
   // Home shuffle buckets: eligible ids only, keyed by remaster trait.
   export function buildBuckets(eligibleIds, punkData, traitsOf) { ... }
   ```
   `buildBuckets` moves here from `Home.jsx:10-23` and takes `traitsOf` as a parameter, so this
   file stays import-free. Drop the all-10k fallback: no eligible ids means no buckets. Add a
   fallback key `'Remaster'` for any eligible punk where `traitsOf` returns `[]`. That count is 0
   today, and the check script asserts it stays 0.

2. **`lib/remaster-logic.js`**: add `remasterTraits(punk)` = the `getRemasters(punk)` traits plus,
   for females, any of `['Pilot Helmet', 'Big Shades']` they have (the extra female sprite edits in
   `stack-compositor.js:103,107`; leave Eye Mask out, its edit is empty at :105). This is only used
   for Home bucket keys. The API doesn't import it, so server output is unchanged. Covers all
   3,434 (checked: 0 eligible ids without a key).

3. **`App.jsx`**
   - :232-233: call `initEligibility(eligible)` before `setEligiblePunks` / `setAssetsLoaded`. This
     follows the existing `initStacking` pattern at :229.
   - :208, 237-241: add `const [merkleStatus, setMerkleStatus] = useState('loading')`. Set it to
     `'ready'` in the `.then` and `'error'` in the `.catch`. Also treat `!res.ok` as an error. Pass
     `merkleStatus` to `PunkGrid` (:176) and `ManualLookup` (:190). Keep this minimal; the user-facing
     merkle-failure banner belongs to `wallet-state-bugs`.

4. **`components/PunkCard.jsx`** (new prop `merkleStatus = 'loading'`)
   - :5 drop `getRemasters` from the import. Import `remasterState` and `noRemasterCopy`.
   - :69-73 → `const { eligible, hasProof, proofPending, proofMissing } = remasterState(punk.id, merkleProof, merkleStatus);`
   - :86, :93, :140, :142: `hasRemasters` → `eligible`.
   - :107 `cardClass`: use `!eligible` instead of `punk.isEligible === false`.
   - :110 `canMint`: `... && eligible && hasProof && ...` (drop `hasRemasters`).
   - :113-120 button text: after the `isActivated` branch, add
     `else if (proofPending) 'Loading proof…'` and `else if (proofMissing) 'Proof unavailable'`.
     Both are disabled because `canMint` is false.
   - :169-174: replace both "Not eligible for remaster" and "No remaster needed" with one
     `{!eligible && <div className="no-remaster">{noRemasterCopy(punk.id)}</div>}`. Drop the
     `showEligibility` condition; keep the prop so the PunkGrid call site still works.
   - :177: `{eligible && (` (no longer needs `hasMerkleProof`, so the section shows right away with
     a "Loading proof…" button).
   - Leave :190-197 (error text) and the ownership logic alone. Those belong to `mint-errors-ownership`.

5. **`components/ManualLookup.jsx`**: accept and forward `merkleStatus` (:4, :50). Nothing else; the
   card handles the copy.

6. **`components/PunkGrid.jsx`**: accept and forward `merkleStatus` (:8, :159-164). Remove the
   dead `hasRemasters` import (:4). **Don't touch** `loadPunks` (:21-84); `owned-punks-multicall`
   rewrites it.

7. **`components/Home.jsx`**
   - :4, :10-23: import `buildBuckets` from `../lib/eligibility` and `remasterTraits` from
     `../lib/remaster`. Then :52 becomes `buildBuckets(eligiblePunks, punkData, remasterTraits)`.
   - `lib/remaster.js:7`: re-export `remasterTraits` alongside `getRemasters`.
   - Deep link (:96-98): still honor any valid id, but compute `const eligible = punk && isEligibleId(punk.id)`.
     When it's false, render only the original canvas (hide the arrow, remaster side and
     reveal toggle at :207-216 and :242-244) and show `noRemasterCopy(punk.id)` under the
     hero meta. The draw effect (:106-122) must guard `remasteredRef.current`, which it already does.
     The init effect at :94 still waits for `buckets.keys.length`, which is fine.

8. **Gallery**: no logic change, since the counts file already equals the eligible set. The check script
   enforces it (step 9). Don't intersect with the eligible set at runtime; that would hide a
   regeneration mismatch instead of failing CI.

9. **New `scripts/check-ui-eligibility.mjs`** (Node, no canvas needed). It loads the CSV (CRLF-safe,
   same regex as `lib/data.js:17`), `all-eligible-punks.json`, `merkle-tree.json` and
   `remaster-pixel-counts.json`, imports `preview/remaster/src/lib/eligibility.js` and
   `lib/remaster-logic.js`, then calls `initEligibility(ids)` and asserts:
   - For every id 0..9999: `remasterState(id, proofs[id], 'ready')` has `showRemaster === showMint === eligibleSet.has(id)`,
     `proofMissing === false`, and `!eligible` ⇒ `!hasProof`.
   - `remasterState(13, undefined, 'loading').proofPending === true` (proofs-not-loaded case).
   - The union of ids across `buildBuckets(ids, punkData, remasterTraits).map` == the eligible set,
     no non-eligible id is in any bucket, and 0 ids landed in the `'Remaster'` fallback.
   - Proof keys == eligible set; pixel-count ids (pixels > 0) == eligible set.
   - Spot checks: 13, 14, 22, 53, 641 eligible; 65, 305, 573, 1303 not.
   - Exit non-zero on failure and print counts (expect `3434 eligible, 0 mismatches`).
   Add `"check:eligibility": "node ../../scripts/check-ui-eligibility.mjs"` to
   `preview/remaster/package.json` scripts. Optionally chain it into `build` so a stale data
   regeneration fails the Vercel build. Recommended, since it's cheap (<1 s).

## Alternatives considered

- **Fix `getRemasters` to match the pixel diff** (add Pilot Helmet/Big Shades, drop the 31). Rejected:
  `getRemasters` drives the compositor (`stack-compositor.js:133`) and the server render. Changing it
  could change pixels and would need the eligible list, merkle root and pixel counts regenerated
  pre-mainnet. The eligible set is already canonical.
- **Gate on merkle-proof presence only.** Rejected as the *primary* signal because proofs load late
  or can fail, which would hide remasters for seconds or for good. They're equivalent once loaded
  (verified), so proofs only gate the Mint *click*.
- **Thread an `eligibleSet` prop or React context.** Workable, but it touches more call sites in files
  the sibling tasks are editing. The module singleton matches `initStacking` and is Node-testable.
- **Derive chip traits from a stackPunk diff.** Not needed. Chips list accessories everywhere and in
  metadata. Only bucket keys need a trait, and `remasterTraits` covers that statically.

## Risks

- **Merge conflicts with sibling tasks.** `mint-errors-ownership` edits PunkCard :48-67, :107-121 and
  :190-197. `owned-punks-multicall` edits PunkGrid :21-84 and `ownedPunks.js`. **Merge order: this task
  first** (smallest; it defines `eligible`/`hasProof`, which the others build on). Then
  `owned-punks-multicall` (no overlap except the PunkGrid props line), then `mint-errors-ownership`
  (rebase onto `canMint`/`buttonText` as changed here). `wallet-state-bugs` will build on the new
  `merkleStatus` state in App.jsx.
- `remasterTraits` duplicates knowledge from `stack-compositor.js`. If a new female sprite edit is
  added there, the check script's fallback-bucket assertion catches it (the eligible list must be
  regenerated anyway).
- Copy hard-codes nothing: the count comes from `eligibleCount()`, so it stays right after regeneration.
- `merkleStatus` stays `'loading'` forever if the fetch hangs. Acceptable (button just stays disabled);
  timeout and retry are out of scope (`wallet-state-bugs`).
- The em dash in the copy: keep the literal character. The file is UTF-8.

## Verification

1. `node scripts/check-ui-eligibility.mjs` → passes, `3434 eligible, 0 mismatches`, 0 fallback bucket ids.
   Run the original audit (`/private/tmp/claude-501/-Users-samweinrott-Code-snax-remastered-punks/f85e504e-4551-470f-828d-9e928842ffd5/scratchpad/elig.mjs`)
   for before/after context. Its getRemasters numbers won't change; that's expected.
2. `cd preview/remaster && npm run lint && npm run build`. There should be no new lint errors in touched files.
3. Local `npm run dev`, Lookup tab:
   - `13`, `22`, `641`: Original → Remastered canvases, Mint section visible ("Loading proof…" briefly,
     then the normal state; throttle the network in DevTools to watch it).
   - `65`, `305`, `1303`, `0`: original only, "#65 has no remaster — only 3,434 punks are eligible", no Mint section.
   - Block `merkle-tree.json` in DevTools → eligible card shows a disabled "Proof unavailable".
4. Home: shuffle ~50 times and confirm Pilot Helmet / Big Shades females turn up. `?punk=13#home` shows a
   remaster. `?punk=65#home` shows the original plus the no-remaster copy, without a Remaster side or reveal toggle.
5. Vercel preview (`/ship` → `vercel-deploy`): repeat 3-4 on the preview URL. Then confirm each
   eligible id with a Mint button gets `200` from `<preview>/13` and `<preview>/api/metadata/13.json`,
   and that `/65` returns 404 with the no-remaster card shown. On Sepolia (contract `0x7bfc…117B`), with
   a wallet that owns an assigned Pilot Helmet female, check that the Mint button is enabled and
   `activate` succeeds (merkle proof valid).
6. Gallery: count still reads 3,434. Unchanged.

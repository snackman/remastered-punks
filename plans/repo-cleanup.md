# repo-cleanup (P3)

Last item left from the 2026-11-18 audit (the rest of it went into #2 and #9), plus the
gallery link follow-up from #10. Branch `task/repo-cleanup`, PR base `prototype/base-ear-shift`.

## 1. API handlers: catch failures
`api/[punkId].js`, `api/metadata/[id].js`, `api/metadata/contract.js`.
- Wrap each handler body in try/catch. On error: `console.error('[api/<name>]', id, err)`,
  `Cache-Control: no-store` (a transient failure must not be cached at the edge for a day),
  `res.status(500).json({ error: 'Internal error' })`. Don't leak err.message to the client.
- If a load throws part-way through, the module caches must not stay half-built: assign
  `punkData` / `eligiblePunks` / `pixelCounts` only after parsing succeeds (build into a
  local, then assign). `spriteSheet` is already assigned only on success.
- Keep the 400 and 404 paths and their headers exactly as they are.

## 2. Dev pages out of the prod build
`preview/remaster/vite.config.js` `rollupOptions.input`: for `command === 'build'` keep
only `main` and `traits` (traits.html is linked from the app). `zero`, `leaks`,
`remasterSprites` and `stackingCompare` stay in the repo and keep working under `vite dev`
(dev serves any html file at the project root, so they need no input entry there).
After the build, check that `dist/` has no zero/leaks/remaster-sprites/stacking-compare
html and no chunks only they used.

## 3. Gallery links navigate in-app
`Gallery.jsx` `#id` and "+N more" anchors are plain `href="?punk=<id>#home"`, so clicking
reloads the whole app. Keep the href (open-in-new-tab, copy link), but on a plain left
click (no meta/ctrl/shift/alt, button 0) call `preventDefault()` and go through App's
`nav()` with the punk.
- Extend `nav(tab, trait, punk)` in App.jsx to pass `punk` into `buildUrl` and
  pushState `{ tab, trait, punk }`. Hold the selected punk in App state, set it from
  `parseUrl` at mount and on popstate, and pass it to Home so Home shows that punk
  when it changes, not only on mount. Check how Home reads `?punk=` today and switch it
  to the prop. Keep its existing behaviour on mount and on Back/Forward.
- Gallery gets an `onSelectPunk(id)` prop from App.
- Back from the punk view returns to the gallery with the same trait filter.

## 4. Untrack `.claude/settings.local.json`
Cherry-pick 93da354 (an orphaned commit on the worktree-agent-* branches): it removes the
file from the index and adds it to .gitignore. The local file stays on disk.

## Checks
- `npm run lint`, `npm test`, `npm run build` in preview/remaster.
- Local API smoke: hit the handlers through `vercel dev` or a direct node import with a
  mocked req/res. Give them a broken data path and confirm 500 + no-store. Normal ids
  still give 200 with the same headers.
- Playwright on a preview: on gallery `?trait=Earring#gallery`, click `#id` → Home shows
  that punk with no full reload (check a window marker survives), Back → filtered gallery.
  Cmd-click still opens a new tab (href intact).

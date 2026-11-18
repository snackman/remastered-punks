# Tasks

Stages: todo · doing · stuck · review · done · skip — Priority: P1 (highest) … P4

## Open

| ID | Task | Stage | Priority | Due | Lead | Tags | Plan | PR | Notes |
|----|------|-------|----------|-----|------|------|------|----|-------|
| fix-612-outline | Restore (6,12) head-outline black in stackPunk; QA non-eligible pixel artifacts (131 punks, e.g. 403/467); cache-bust image URL | review | P1 | | Snax | compositor, pre-mainnet | plans/fix-612-outline.md | #2 | 2026-11-18 audit: ~1424/2553 eligible females wrong live; EAR_HIDING_AT_6_12 unused (lib/stack-compositor.js:21). Images are immutable 10y — fix before launch |
| gate-ui-on-eligible | Gate remaster display, Mint button and Home shuffle on eligible set/merkle proof, not getRemasters | todo | P1 | | Snax | frontend, pre-mainnet | plans/gate-ui-on-eligible.md | | 2026-11-18 audit: 78 eligible unmintable (e.g. #13), 31 non-eligible show a remaster (PunkCard.jsx:72,110,177) |
| owned-punks-multicall | Replace Alchemy demo key + dead Reservoir fallback with punkIndexToAddress multicall over eligible ids (fixes >100-punk wallets) | todo | P1 | | Snax | frontend, pre-mainnet | plans/owned-punks-multicall.md | | 2026-11-18 audit: ownedPunks.js:5,44,79 |
| mint-errors-ownership | Add custom errors to ABI, handle wallet reject, surface reverted receipts, check punk ownership on mainnet too | todo | P1 | | Snax | frontend, pre-mainnet | plans/mint-errors-ownership.md | | 2026-11-18 audit: contracts.js:16-55, PunkCard.jsx:51,110,192 |
| mainnet-config | Fail prod build without mainnet contract address; hide Add Testnet/Sepolia; set dedicated mainnet RPC transport | todo | P1 | | Snax | frontend, pre-mainnet | plans/mainnet-config.md | | 2026-11-18 audit: contracts.js:10, App.jsx:22-26,142. Cutover checklist: handoff.md. Prod needs VITE_NETWORK=sepolia in Vercel before merge |
| wallet-state-bugs | Surface merkle-load failure (stale-fetch race, post-mint refetch, account chainId now covered by P1 plans) | todo | P2 | | Snax | frontend | | | 2026-11-18 audit: PunkGrid.jsx:21-101, App.jsx:238 |
| og-tags-copy | Add OG/twitter tags + og:image + per-page titles; Home explainer (soulbound, eligibility, cost) and one verb (Mint vs Activate) | todo | P2 | | Snax | ux, launch | | | 2026-11-18 audit |
| ux-states | Connect button in My Punks empty state, loading spinner + retry, clear eligible/non-eligible lookup copy, compact mobile header, pushState tabs, clear ?trait on reset | todo | P2 | | Snax | ux | | | 2026-11-18 audit |
| perf-caching-startup | Cache headers for /assets,/data,images; parallel startup fetches, defer punks.png; lazy-load wallet stack and merkle proofs | todo | P2 | | Snax | perf | | | 2026-11-18 audit: vercel.json, App.jsx:212-249 |
| gallery-virtualize | Virtualize/paginate 3,434-tile gallery; integer pixel scaling + pixelated; bigger chips/captions | todo | P2 | | Snax | perf, ui | | | 2026-11-18 audit: froze renderer at 390px (Gallery.jsx:73-81) |
| repo-cleanup | Delete stale public/merkle-tree.json; move api helpers to api/_lib; try/catch + cached 404s in API; narrow includeFiles and data copy; drop dev pages from prod; fix generate-pixel-counts + lint errors | todo | P3 | | Snax | cleanup | | | 2026-11-18 audit |

## Done

| ID | Task | Priority | Done | PR | Notes |
|----|------|----------|------|----|-------|

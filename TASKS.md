# Tasks

Stages: todo · doing · stuck · review · done · skip — Priority: P1 (highest) … P4

## Open

| ID | Task | Stage | Priority | Due | Lead | Tags | Plan | PR | Notes |
|----|------|-------|----------|-----|------|------|------|----|-------|
| gallery-virtualize | Virtualize/paginate 3,434-tile gallery; integer pixel scaling + pixelated; bigger chips/captions | todo | P2 | | Snax | perf, ui | | | 2026-11-18 audit: froze renderer at 390px (Gallery.jsx:73-81) |
| repo-cleanup | try/catch in API handlers; drop dev pages from prod (rest done in #2/#9) | todo | P3 | | Snax | cleanup | | | 2026-11-18 audit |

## Done

| ID | Task | Priority | Done | PR | Notes |
|----|------|----------|------|----|-------|
| perf-caching-startup | Cache headers, parallel startup, per-punk proofs, lazy wallet stack (236→65 KB initial JS) | P2 | 2026-11-18 | #9 | also covered repo-cleanup stale merkle/api helpers/cached 404s/data copy |
| ux-states | Back button, loading/Retry, Lookup validation, mobile header, a11y | P2 | 2026-11-18 | #8 | |
| og-tags-copy | Share tags + og image, per-page titles, Home explainer/FAQ, contract footer, 404 | P2 | 2026-11-18 | #7 | |
| wallet-state-bugs | Surface merkle-load failure (rest absorbed by P1 PRs) | P2 | 2026-11-18 | #5 | covered by merkleStatus / "Proof unavailable" in #5 |
| gate-ui-on-eligible | Gate remaster/Mint/Home shuffle on the eligible set | P1 | 2026-11-18 | #5 | |
| owned-punks-multicall | My Punks via onchain ownership multicall (no Alchemy/Reservoir, no 100 cap, wrapped notice) | P1 | 2026-11-18 | #4 | |
| mint-errors-ownership | Readable mint errors, mainnet ownership check, Sync to marketplaces | P1 | 2026-11-18 | #6 | |
| fix-612-outline | Restore (6,12) head outline + layer-order fixes; version image URL | P1 | 2026-11-18 | #2 | |
| mainnet-config | VITE_NETWORK launch flag, build guards, RPC transports, wallet-chain gating | P1 | 2026-11-18 | #3 | |

# owned-punks-multicall: find owned punks with an on-chain multicall instead of Alchemy/Reservoir

Base branch: `prototype/base-ear-shift`. Branch: `task/owned-punks-multicall`. App root: `preview/remaster/`.

## Goal

My Punks finds the connected wallet's **eligible** punks by calling `punkIndexToAddress` over the
3,434 eligible ids, using a multicall against the real CryptoPunks contract on mainnet and the mock
on Sepolia. This is the same check `RemasteredPunks.activate` does
(`contracts/src/RemasteredPunks.sol:81`, `punkIndexToAddress(punkId) != msg.sender`). With it:

- the Alchemy `demo` key and the dead Reservoir fallback go away,
- wallets holding more than 100 punks are no longer cut off,
- My Punks shows exactly the punks that can mint.

It also fixes the stale-response race in `PunkGrid.jsx:21-84` by moving the fetch into react-query.

## Audit claims checked (2026-11-18)

- `ownedPunks.js:5` falls back to `'demo'`. `.env.example` is the only env file, and prod has no key.
- `ownedPunks.js:38-73` calls `api.reservoir.tools`, which is dead.
- `ownedPunks.js:79` uses `pageSize=100` and never follows `pageKey`, so wallets with more than 100 punks are cut off.
- **New bug found while probing:** the testnet path uses `batchSize: 100_000` (`PunkGrid.jsx:44`). viem's
  `batchSize` counts calldata **bytes**, and each call is 36 bytes, so that makes chunks of about 2,777 calls,
  which is about 622 KB of aggregate3 calldata. I tested it against mainnet `ethereum-rpc.publicnode.com`:
  that chunk was rejected with "Request body size limit reached". Because `allowFailure: true` is set, viem
  reported **every call in the chunk as a failure**, and the code treated those punks as "not owned". 2,777 of
  the 3,434 punks silently disappeared, with no error shown. Copying the testnet code to mainnet as-is would ship this bug.

### RPC probe results (scratchpad scripts, block 26,441,692)

Each `punkIndexToAddress` call costs about 5.7k gas and adds about 224 bytes of aggregate3 calldata.

| Calls per chunk | Calldata | Gas | publicnode | drpc | 1rpc | ankr (keyless) | eth.merkle.io (viem's default mainnet RPC) | cloudflare-eth |
|---|---|---|---|---|---|---|---|---|
| 500 | 112 KB | 2.8M | ok | ok | ok | 401 | Cloudflare challenge page | fails |
| 1000 | 224 KB | 5.7M | ok | ok | ok | 401 | challenge | fails |
| 2777 | 622 KB | ~16M | body too large | hits the 16.7M gas cap | too large | 413 | challenge | fails |
| 3434 | 769 KB | ~20M | too large | out of gas | too large | 413 | challenge | fails |

What this means:
- **Use chunks of 500 calls**, i.e. `batchSize: 500 * 36 = 18_000`. That gives 7 parallel `eth_call`s of
  about 112 KB and 2.8M gas each, well under every limit seen. The full 3,434 scan through publicnode took about 4.8 s.
- The app currently has **no mainnet transport**: `App.jsx:22-26` passes no `transports`, so wagmi falls back to
  `eth.merkle.io`, which returned a Cloudflare challenge in this test. A dedicated transport is required (see Coordination).
- Wrapped punks: 275 of the 3,434 eligible punks are held by the two wrappers, `0xb7F7…313F6` (WPUNKS) and
  `0x0000…3607fcE` (CryptoPunks 721). `ownerOf(punkId)` worked on both for all 275.

## Decisions / recommendations

1. **Only show eligible punks in My Punks.** Non-eligible punks can't mint. Scanning all 10,000 would need about 20 chunks
   and 57M gas per page load on a public RPC, and those punks currently show up as greyed "Not eligible" cards
   (`PunkCard.jsx:107,170`) that add nothing. Instead, add a single line of copy: "Only punks with a remaster are
   shown. Look up any punk in Lookup." The testnet path already behaves this way, so both chains end up the same.
2. **Wrapped punks: detect them and explain, don't render cards.** After the main scan, take the eligible ids whose
   owner is one of the two wrappers. Run a second multicall of `ownerOf(id)` on the matching wrapper (at most 275 calls,
   one chunk). If any are owned by the user, show a notice above the grid: "N of your eligible punks are wrapped (#a, #b…).
   Unwrap them at cryptopunks.app to mint." Don't render them as PunkCards, because their Mint button would revert
   (the owner on CryptoPunks is the wrapper). Keeping them out of the cards also means this task doesn't touch
   `PunkCard.jsx`. Mainnet only: the mock has no wrappers. If the wrapper lookup fails, don't fail the page; just skip the notice.
3. **Fail loudly, never silently.** Use `allowFailure: false` on the main scan, so a failed chunk throws
   and the error UI with Retry appears. Never return a partial list as if it were complete.
4. **Read the punk chain explicitly.** Decide the ownership chain from the wallet chain: Sepolia (11155111) means the
   mock on Sepolia; anything else means CryptoPunks on mainnet (chainId 1). Get the client with
   `usePublicClient({ chainId: punksChainId })`. That way a wallet on an unsupported chain still sees its mainnet punks,
   and Mint shows "Wrong Network", as it does today.

## Files to change

### 1. `preview/remaster/src/lib/ownedPunks.js`: rewrite (drop Alchemy and Reservoir completely)

This is a pure module with no `import.meta.env` and no React, so a node script can import it.

```js
export const PUNKS_SCAN_BATCH_BYTES = 18_000; // 500 calls x 36 bytes (viem batchSize = calldata bytes)
export async function fetchOwnedEligiblePunks({ client, punksAddress, owner, eligibleIds, wrappers = [] })
  // -> { owned: number[], wrapped: { id, wrapper }[] }
```
- `client.multicall({ contracts: eligibleIds.map(id => ({ address: punksAddress, abi: CRYPTOPUNKS_ABI,
  functionName: 'punkIndexToAddress', args: [BigInt(id)] })), allowFailure: false, batchSize: PUNKS_SCAN_BATCH_BYTES })`
- Compare addresses in lowercase. Collect the ids where `owner === user`, and the `[id, wrapper]` pairs where the owner is a wrapper.
- If `wrappers.length` is set and there are wrapped ids, run the second multicall of `ownerOf`, with `allowFailure: true`
  and failures ignored. Keep the ids whose owner is the user.
- Return the ids sorted ascending.

### 2. `preview/remaster/src/lib/contracts.js`

- Add `CRYPTOPUNKS_ABI` (`punkIndexToAddress` only; the mock and the real contract share this signature) and
  `ERC721_OWNER_OF_ABI`.
- Add `PUNK_WRAPPERS = ['0xb7F7F6C52F2e2fdb1963Eab30438024864c313F6', '0x000000000000003607fce1aC9e043a86675C5C2F']`.
- Add `getPunksSource(chainId)`. It returns `{ chainId: 11155111, address: CONTRACTS.sepolia.cryptoPunks, wrappers: [] }`
  for Sepolia, and `{ chainId: 1, address: CONTRACTS.mainnet.cryptoPunks, wrappers: PUNK_WRAPPERS }` otherwise.
- **Leave `getCryptoPunksAddress` (`:87-92`) and `MOCK_CRYPTOPUNKS_ABI` alone.** PunkCard uses them, and
  mint-errors-ownership changes them. This avoids a merge conflict.

### 3. `preview/remaster/src/components/PunkGrid.jsx`: replace `:9-84` and adjust the render

- Remove `useState` for ownedPunks/loading/error, the whole `useEffect`, and the `fetchOwnedPunks` import (`:3`).
- Add:
  ```js
  const walletChainId = useChainId();            // wallet-state-bugs may switch this to useAccount().chainId
  const source = getPunksSource(walletChainId);
  const client = usePublicClient({ chainId: source.chainId });
  const eligibleIds = useMemo(() => eligiblePunks.filter(id => punkData[id]), [eligiblePunks, punkData]);
  const { data, isPending, error, refetch, isFetching } = useQuery({
    queryKey: ['ownedEligiblePunks', source.chainId, address?.toLowerCase(), eligibleIds.length],
    queryFn: () => fetchOwnedEligiblePunks({ client, punksAddress: source.address, owner: address,
                                            eligibleIds, wrappers: source.wrappers }),
    enabled: !!address && !!client && eligibleIds.length > 0,
    staleTime: 60_000, retry: 2, refetchOnWindowFocus: false,
  });
  const ownedPunks = useMemo(() => (data?.owned ?? []).map(id => ({ ...punkData[id], isEligible: true })), [data, punkData]);
  ```
  The query is keyed by `[chainId, address]`, so a slow response for the old account can't overwrite the new one.
  This fixes the race wallet-state-bugs lists for `PunkGrid.jsx:21-101`.
- Note that `useQuery` comes from `@tanstack/react-query`, which is already a dependency, and `QueryClientProvider` is already set up in `App.jsx:257`.
- Remove `eligibleSet` (`:19`). `eligibleOwned` becomes `ownedPunks`.
- Loading: show the state while `isPending && enabled`, and also while `eligibleIds.length === 0`
  (assets are still loading). Use the copy "Checking which eligible punks this wallet owns…"
  (Ethereum / Sepolia mock). The old copy is at `:103-109`.
- Error (`:111-117`): show "Couldn't read punk ownership from Ethereum. {short message}" and a **Retry** button that calls `refetch()`.
  Use `error.shortMessage ?? error.message`.
- Empty (`:123-129`): "None of this wallet's punks have a remaster." Also show the wrapped notice here if `data.wrapped.length`.
  Add a link to the Lookup tab only if a navigate prop is already available. Don't add new props; leave that to ux-states.
- Stats (`:134-140`): "{n} eligible punk(s) | {m} remastered". The "found" and "eligible" counts are now the same number, so merge them.
- Filter (`:141-154`, `:119-121`, `:168-172`): "Eligible Only" no longer means anything. Replace it with **All / Not minted**,
  using `activatedResults[i]?.result !== true`. If the reviewer wants an even smaller diff, deleting the filter is fine too.
- Add the wrapped-punks notice block above `.punk-grid`, plus a small CSS rule in `App.css`, reusing the existing `.no-results`/`.loading` styling.
- Optional: in dev only (`import.meta.env.DEV`), read `?as=0x…` and use it instead of `address`, so you can view a big holder
  without their wallet. It is read-only and Mint will show "Not your punk" or revert. Strip it from prod builds with the DEV guard.

### 4. Mainnet RPC transport (`App.jsx:22-26`): coordinate with mainnet-config

This task **can't ship without** a working mainnet transport. If mainnet-config has already merged, reuse its transport.
If it hasn't, add the minimal version here, and mainnet-config builds on it:
```js
import { http, fallback } from 'wagmi';
transports: {
  [mainnet.id]: fallback([
    ...(import.meta.env.VITE_MAINNET_RPC_URL ? [http(import.meta.env.VITE_MAINNET_RPC_URL)] : []),
    http('https://ethereum-rpc.publicnode.com'),
    http('https://eth.drpc.org'),
  ]),
  [sepolia.id]: http(import.meta.env.VITE_SEPOLIA_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com'),
},
```
- Use the same env var name, `VITE_MAINNET_RPC_URL`, in both tasks. For prod, a domain-allowlisted Alchemy or Infura
  RPC URL is recommended. A plain eth_call of 112 KB is fine on those. Setting the Vercel env var is Snax's call; the
  public fallbacks work without it.
- Probe Sepolia publicnode with 500-call chunks before relying on it. It behaves like mainnet publicnode in principle,
  but this test didn't cover it.

### 5. `preview/remaster/.env.example`

Replace `VITE_ALCHEMY_API_KEY` with `VITE_MAINNET_RPC_URL=` (optional; public fallbacks are used if empty).
Remove `VITE_ALCHEMY_API_KEY` from Vercel env if it's set there. It's harmless, but it's dead config.

### 6. `scripts/check-owned-punks.mjs` (new, for verification)

`node scripts/check-owned-punks.mjs <address> [rpcUrl]`. It imports `fetchOwnedEligiblePunks` from
`preview/remaster/src/lib/ownedPunks.js`, which is why that module must stay pure. Run it from `preview/remaster` so `viem`
resolves, or use a relative import of `node_modules/viem`. It prints the owned count, the wrapped count and the ids.

## Merge order / conflicts

- **mainnet-config** (`App.jsx` transports, `contracts.js:10`): ideally merge it first and reuse its transport. If this task
  merges first, it brings the transport block above, and mainnet-config only adds the build guard and hides the testnet UI.
  The two touch different parts of `contracts.js` (this task adds new exports; mainnet-config changes `:10`).
- **wallet-state-bugs**: this task takes over its "cancel stale owned-punk fetches" item. Mark that sub-item done in TASKS.md
  notes. Its other items (refetching the remastered count after mint, the merkle-load failure, the account chainId) remain.
  Its "refetch count after mint" item edits the `useReadContracts` at `:90-101`, which this task leaves alone.
- **gate-ui-on-eligible / mint-errors-ownership**: these mostly edit `PunkCard.jsx`, which this task doesn't touch.
  The PunkGrid overlap is small (props passed to `PunkCard`, `:158-165`). Suggested order: **owned-punks-multicall first**,
  because it replaces most of PunkGrid, then gate-ui-on-eligible, then mint-errors-ownership, each rebased onto the previous.
  mint-errors-ownership's "check punk ownership on mainnet too" can reuse `getPunksSource` and `CRYPTOPUNKS_ABI` from this task.
- **ux-states** also edits the PunkGrid empty/loading/error states. Land this task first; ux-states then polishes the copy and adds the Connect button.

## Alternatives considered

- **Keep Alchemy NFT API + `pageKey` loop with a real key.** Rejected. It needs a paid or secret key in the client bundle,
  it's indexer-lagged, it returns non-eligible punks, it returns wrapped punks as CryptoPunks owner = wrapper, and the
  NFT API is a third-party dependency for something one contract call answers.
- **Scan all 10,000 ids.** Rejected: about 3x the RPC load to show cards that can't mint (decision 1).
- **Serverless `/api/owned?address=` doing the scan with a server RPC key, cached per block.** Hides the key and
  saves client RPC calls. It's a reasonable follow-up if public-RPC flakiness shows up, but it's extra moving parts before
  launch, and the client path already works on public RPCs. Not doing it now.
- **Event-log indexing (`PunkTransfer`/`PunkBought` logs).** Many `eth_getLogs` ranges since 2017 is slow and fragile. Rejected.
- **wagmi `useReadContracts` with 3,434 contracts.** It works (it is multicall underneath), but `batchSize` is under `multicall`
  config and `allowFailure` semantics differ. Wrapping the fetch in a pure function with `useQuery` keeps it testable from node.

## Risks

- **Public RPC limits change.** Mitigations: chunks of 500 (about 5x headroom on gas and body size), a `fallback` transport,
  retry 2, a Retry button, and the optional `VITE_MAINNET_RPC_URL`.
- **Rate limits:** each wallet view sends 7 parallel eth_calls, plus 1 if wrapped punks exist. With `staleTime` 60s there is no refetch on focus.
- **Latency:** about 5 s for a full scan on publicnode. The loading state must make clear it's working.
- **Missing a punk.** The punk doesn't show if its owner differs only in case (handled by lowercasing), or if it's in
  `eligiblePunks` but not in `punkData`. The `eligibleIds` filter keeps the testnet behaviour. Check that
  `all-eligible-punks.json` ids are all in `punkData`. If any are missing, include them with minimal data rather than dropping them.
- **Wrong network edge case:** with the wallet on Sepolia, discovery runs against the mock. That's intended; it matches today.
- **Bundle:** removing ownedPunks' fetch code is a net decrease. The `fallback`/`http` imports are already in wagmi.

## Verification

1. `cd preview/remaster && npm run lint && npm run build`. The build must pass with no `VITE_*` set.
2. Node check against real data (mainnet holdings at block 26,441,692; re-check, since holdings move):
   - `node scripts/check-owned-punks.mjs 0xA858DDc0445d8131daC4d1DE01f834ffcbA52Ef1` should return about **156 owned**.
     That is more than 100, which proves the truncation fix; Alchemy would have stopped at 100.
   - `node scripts/check-owned-punks.mjs 0xf41B389E0C1950dc0B16C9498eaE77131CC08A56` should return about **79 wrapped**.
   - `0x577eBC5De943e35cdf9ECb5BbE1f7D7CB6c7C647` should return about 52 owned.
   - Cross-check one or two ids per address on Etherscan "Read Contract → punkIndexToAddress".
   - Run once with `https://eth.drpc.org` as the rpcUrl to confirm a second provider gives the same result.
3. Dev server with the `?as=` override: open My Punks for the three addresses above. Check that the counts match the script,
   the loading state is visible, there are 7 `eth_call` requests in DevTools (each about 112 KB or less), and the wrapped notice lists the right ids.
4. Race check: start a load for address A, switch to `?as=B` (or switch the wallet account) before it finishes, and confirm only B's punks render.
5. Error UI: set `VITE_MAINNET_RPC_URL` to a bad URL and use a transport with no fallback (temporary local edit), or block
   `publicnode.com` in DevTools. You should see the error message and a working Retry. Revert the edit.
6. Sepolia regression: connect Snax's test wallet on Sepolia. The mock-assigned punks should appear exactly as before (same
   count as `main` today, or more if the 100_000-byte chunking had been silently dropping some there). Mint still works on one.
7. Vercel preview (`/ship` → `vercel-deploy`): connect a real mainnet wallet. My Punks should load through the configured
   transport, and DevTools should show no requests to `alchemy.com` or `reservoir.tools`. Also check
   `grep -r "alchemy\|reservoir" preview/remaster/dist` comes back empty.
8. Mobile (`/mobile-check`) on My Punks: the loading/error/wrapped notice fits at 390px.

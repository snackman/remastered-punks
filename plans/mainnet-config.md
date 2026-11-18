# mainnet-config: launch flag, mainnet address guard, RPC transport, network gating

Task row: `TASKS.md:13` (P1, pre-mainnet). Base branch: `prototype/base-ear-shift` (prod, punksremastered.com).
Branch: `task/mainnet-config`. Merge **first** of the pre-mainnet frontend tasks (see "Sibling tasks").

## Goal

Keep the live pre-launch site behaving exactly as it does today, and make mainnet cutover a
config change (Vercel env vars plus a redeploy) instead of a code edit. A mainnet-mode build must
fail at build time if the contract address or RPC URL is missing or wrong. Mainnet mode hides
everything Sepolia-related and pins all reads and writes to Ethereum mainnet over a dedicated RPC.

## Verified current state (2026-11-18)

- `preview/remaster/src/lib/contracts.js:10` sets `mainnet.remasteredPunks: null`. `:76-93`: `getContractAddress`
  maps 11155111 to Sepolia and 1 to null. `getCryptoPunksAddress` returns null on mainnet (Sepolia mock only).
- `preview/remaster/src/App.jsx:22-26`: `getDefaultConfig({ projectId: 'c490ddb4…7452', chains: [mainnet, sepolia] })`.
  There are no `transports`, so every read goes to viem's default public RPCs.
- `App.jsx:142-153`: "Add Testnet" shows for every connected user not on Sepolia.
- `useChainId()` is used at `App.jsx:32`, `PunkCard.jsx:16` and `PunkGrid.jsx:14`. In wagmi 2.19.5 this returns the
  *config's* chain. When a wallet is on an unconfigured chain (e.g. Polygon) it keeps the last configured
  chain, so a card can look mint-ready while the wallet is on the wrong network. `useReadContract` and
  `usePublicClient` (PunkCard.jsx:22,34; PunkGrid.jsx:16,88) take no `chainId`, so they follow the same state.
- `PunkCard.jsx:115`: on chain 1 with no address the button says "Minting Soon". That is today's pre-launch behavior.
- **Vercel project `remastered-punks` has NO environment variables** (`vercel env ls`, 2026-11-18).
  So `ownedPunks.js:5` runs on Alchemy key `'demo'` in prod. The mainnet "My Punks" path also uses
  `'demo'`; that is owned-punks-multicall's job, not this task's.
- WalletConnect projectId `c490ddb4e12e01e9e541522b7cde7452` (added in commit e7882bf, 2026-01-27) is **real**:
  the WC explorer API returns 200 for it and 401 for a fake ID. It is hardcoded, not an env var.
  Not yet confirmed: which Reown account owns it, and whether its domain allowlist includes punksremastered.com.
- `contracts/script/Deploy.s.sol:22`: if `BASE_URI` is unset it **silently defaults to `ipfs://QmPlaceholder/`**.
  The cutover checklist has to guard against this.
- No unit-test runner in `preview/remaster/package.json`. The `.gitignore` there covers `.env` and `.env*.local`. `.env.example` is tracked.

## Design: the config surface

### Env vars (all `VITE_*`, so they are inlined into the client bundle and are public)

| Var | Sepolia mode (today) | Mainnet mode |
|---|---|---|
| `VITE_NETWORK` | `sepolia` (default if unset) | `mainnet` |
| `VITE_REMASTERED_PUNKS_MAINNET` | ignored (forced null, so "Minting Soon" stays) | **required**, a valid checksummed address |
| `VITE_MAINNET_RPC_URL` | optional (falls back to public RPC) | **required**, `https://` |
| `VITE_SEPOLIA_RPC_URL` | optional (falls back to public RPC) | unused |
| `VITE_WALLETCONNECT_PROJECT_ID` | optional, defaults to the current hardcoded ID | same |

Build guard rules, enforced in `vite.config.js` during `vite build`:
1. `VITE_NETWORK` must be `sepolia` or `mainnet` (unset means sepolia, except for rule 2).
2. If `process.env.VERCEL_ENV === 'production'`, `VITE_NETWORK` must be **set explicitly**. Then a lost env var after
   launch fails the prod build instead of silently going back to Sepolia mode. **This means
   `VITE_NETWORK=sepolia` has to be added to Vercel Production before this ships** (step 9).
3. Mainnet mode also requires:
   - the address passes viem `isAddress` (strict checksum);
   - the address is not the zero address and not either Sepolia address;
   - `VITE_MAINNET_RPC_URL` starts with `https://`.

Sepolia addresses stay committed constants. They are public and already live.

### Modules (siblings import from these and nothing else)

1. **`preview/remaster/src/lib/networkEnv.js`** (new, pure, no `import.meta`): exports `validateNetworkEnv(env, { vercelEnv })`
   that returns `string[]` errors. The Sepolia address constants move here, and `contracts.js` re-imports them.
   `vite.config.js` (Node) and the unit test both import this file.
2. **`preview/remaster/src/lib/network.js`** (new):
   - `NETWORK` (`'sepolia' | 'mainnet'`) and `IS_MAINNET`.
   - `TARGET_CHAIN`: `mainnet` or `sepolia`. This is the chain mint, reads and "switch to" point at.
   - `CHAINS`: sepolia mode is `[mainnet, sepolia]`, the same order as today, so the default and initial chain don't change.
     Mainnet mode is `[mainnet]` only.
   - `SUPPORTED_CHAIN_IDS`.
   - `TRANSPORTS`:
     - `{ [mainnet.id]: fallback([http(VITE_MAINNET_RPC_URL, { batch: true }), http()]) }`
     - plus `[sepolia.id]: http(VITE_SEPOLIA_RPC_URL)` in sepolia mode.
     - Drop the empty-URL entry when a var is unset, so you get plain `http()`.
     - In mainnet mode, consider leaving the public fallback out so a dead key is noticed rather than hidden. Decide in review; the default is to keep the fallback.
   - `wagmiConfig = getDefaultConfig({ appName, projectId, chains: CHAINS, transports: TRANSPORTS, batch: { multicall: true }, ssr: false })`.
     RainbowKit 2.2.10's `getDefaultConfig` passes the remaining params through to wagmi `createConfig`, so `transports` and `batch` are honored.
     `batch.multicall` folds the many per-card `activated` reads into Multicall3 calls.
   - Write all `import.meta.env.VITE_NETWORK` checks as direct comparisons, so Vite/Rollup can drop Sepolia-only code from mainnet bundles.
3. **`preview/remaster/src/lib/contracts.js`** (modify):
   - `CONTRACTS.mainnet.remasteredPunks = IS_MAINNET ? import.meta.env.VITE_REMASTERED_PUNKS_MAINNET : null`.
   - `getContractAddress(chainId)` returns an address only for chain IDs in `SUPPORTED_CHAIN_IDS`. In mainnet mode, Sepolia returns null.
   - **`getCryptoPunksAddress(chainId)` now also returns the real `0xb47e…BBB` on chain 1.** The current callers are already gated
     on `isTestnet` (PunkCard.jsx:40, PunkGrid.jsx:31-34), so nothing changes for them. Both siblings need this for real ownership reads.
   - Add `CRYPTOPUNKS_ABI` (`punkIndexToAddress`; the real contract has the same signature) and keep `MOCK_CRYPTOPUNKS_ABI` as an alias.
4. **`preview/remaster/src/lib/useNetwork.js`** (new hook): uses `useAccount()` and returns
   `{ chainId, isConnected, isSupported, isTarget, isTestnet, contractAddress, cryptoPunksAddress, targetChain }`.
   - `chainId` comes from `useAccount().chainId` (the wallet's real chain, defined even when the chain isn't configured).
   - `isTestnet = !IS_MAINNET && chainId === sepolia.id`.
   - `isTarget = chainId === TARGET_CHAIN.id`. In sepolia mode chain 1 is also "supported", for the "Minting Soon" state.

Rules for siblings: never call `useChainId()`. Get RPC access only through
`usePublicClient({ chainId: TARGET_CHAIN.id })` or `useReadContract({ chainId: … })`, never a raw URL. Get addresses only through
`getContractAddress` / `getCryptoPunksAddress`.

## Steps

1. **`networkEnv.js` + unit test.** Write `validateNetworkEnv` as described above. Add
   `preview/remaster/src/lib/networkEnv.test.mjs` (node:test) covering:
   - unset → ok
   - `VERCEL_ENV=production` with unset → error
   - bad value → error
   - mainnet + missing / zero / Sepolia / bad-checksum address → error
   - mainnet + http:// RPC → error
   - mainnet + valid → ok

   Add `"test": "node --test src/lib/"` to `package.json`.
2. **`vite.config.js`.** Change to the function form `defineConfig(({ command, mode }) => …)`. Keep the `GITHUB_PAGES` base logic.
   - `const env = loadEnv(mode, process.cwd(), 'VITE_')`. This merges `.env*` files with `process.env` `VITE_*`, which is how Vercel vars arrive.
   - When `command === 'build'`, throw with all errors joined.
   - Log one line: `[network] mode=… address=… rpc=<host only>`. Never log the full RPC URL, because it contains the key.
3. **`network.js` and `useNetwork.js`** as specified above.
4. **`contracts.js`** changes as specified above.
5. **`App.jsx`.**
   - Delete the inline config (`:22-26`) and import `wagmiConfig`. Remove `useChainId` and the `mainnet, sepolia` imports.
   - In `AppContent` use `useNetwork()`.
   - Gate the Add Testnet button (`:142`) on `!IS_MAINNET && isConnected && !isTestnet`. Also wrap `addTestnet` (`:40-72`) in that
     condition, or leave it in a branch the bundler can drop.
   - Mainnet mode with a connected wallet on a chain other than 1: show a small "Wrong network" button that calls
     `useSwitchChain().switchChain({ chainId: TARGET_CHAIN.id })`, in the same slot and using the `testnet-switch` class.
     RainbowKit's ConnectButton also shows its own red "Wrong network" for unconfigured chains, so this is a backup, not the main path.
   - Pass `isTestnet` (`:181`) from the hook.
6. **`PunkCard.jsx`.**
   - Replace `:16-19` with `useNetwork()`.
   - Add `chainId: TARGET_CHAIN.id` to the `activated` read (`:22`). Add `chainId: sepolia.id` to the mock-owner read (`:34`), keeping it testnet-only.
   - Add `chainId: TARGET_CHAIN.id` to `writeContract` (`:100`). wagmi then refuses to send on the wrong chain.
   - `canMint` (`:110`) also requires `isTarget`.
   - Button text (`:115`): `!isSupported || !isTarget` → "Wrong Network". In sepolia mode, chain 1 with no address → "Minting Soon" (unchanged).
   - Leave the error handling and ownership logic alone; that belongs to mint-errors-ownership.
7. **`PunkGrid.jsx`.**
   - Replace `useChainId` (`:14`) with `useNetwork()`.
   - The Sepolia mock multicall branch uses `usePublicClient({ chainId: sepolia.id })`.
   - The `activated` reads (`:88`) get `chainId: TARGET_CHAIN.id`.
   - Don't touch the `fetchOwnedPunks` path (owned-punks-multicall's job).
8. **`.env.example`.**
   - List all five vars with comments.
   - Note that `VITE_*` values are public, so the RPC key must be origin-restricted.
   - Keep `VITE_ALCHEMY_API_KEY` there until owned-punks-multicall removes it.
9. **Vercel env (needs Snax's OK; do this before prod gets this code).** Set Production `VITE_NETWORK=sepolia` with
   `VERCEL_TOKEN="$(vercel-token)" vercel env add VITE_NETWORK production` (sandbox disabled).
   Optional: set `VITE_MAINNET_RPC_URL` / `VITE_SEPOLIA_RPC_URL` (Production + Preview) once an Alchemy app exists.
   The key needs an allowlist: `punksremastered.com`, `*.vercel.app` (or the project's preview domain), `localhost`.
10. **`handoff.md`.** Replace the "Post-deploy checklist" paragraph (`handoff.md:102-104`) with the cutover checklist below.
    Point `TASKS.md` notes at it.

## Alternatives considered

- **Committed mainnet address in `contracts.js`, no env flag.** Easy to audit in git, but every cutover or rollback
  needs a PR. And until the address exists, there's no way to rehearse the mainnet UI. Rejected as the main mechanism.
  Optional follow-up after launch: commit the real address as the in-code default, so the env var acts as an override.
- **Runtime-only check (render an error banner if the address is missing).** It still ships a broken build. The task asks for a
  build-time failure. A runtime `console.error` can be added as an extra.
- **Build-time on-chain check (eth_getCode / `merkleRoot()` against the RPC in `vite build`).** Strong, but it makes the
  build depend on a third-party RPC being up. Use a manual `cast` check in the checklist instead (see below).
- **Keep Sepolia in mainnet mode for testing.** Rejected. Mainnet previews/prod should not offer Sepolia. Sepolia
  testing continues on Preview deployments, which stay in sepolia mode because `VITE_NETWORK=mainnet` is set on Production only.

## Risks

- **Prod build breaks on merge** if step 9 (`VITE_NETWORK=sepolia` on Production) isn't done first (rule 2). That's intended,
  but sequence it: env var first, then deploy.
- **RPC key in the bundle.** Every `VITE_` var is public. Use an origin-restricted Alchemy (or similar) key that is separate from any server key.
  Rate limits: the Sepolia branch does a 3,434-call multicall (`PunkGrid.jsx:36-45`, `batchSize: 100_000`). Check that the chosen
  provider accepts one large `eth_call`, or lower `batchSize`.
- **`batch: { multicall: true }`** changes how per-card reads go out. Check that the "remastered" count and the "Already Minted"
  states still resolve. Multicall3 is defined on both chains in viem.
- **`useAccount().chainId`** is `undefined` while disconnected. Handle that in the hook (`isSupported=false` but no "Wrong Network"
  text; "Connect Wallet" wins, per the `PunkCard.jsx:114` order).
- **Preview-domain WalletConnect/RPC allowlists.** If Reown or Alchemy restrict origins, `*.vercel.app` previews may fail to connect. Confirm both.
- **Sibling conflicts.** All three tasks edit `PunkCard.jsx` and `PunkGrid.jsx`. Merging this one first keeps the rebases small.
- **Deploy-script trap.** Leaving `BASE_URI` unset means `ipfs://QmPlaceholder/` (`Deploy.s.sol:22`). Only the owner's `setBaseURI` can fix it, so verify right after deploy.

## Verification

Local, from `preview/remaster`:
1. `npm test`: all validator cases pass. `npm run lint`: no new errors in the changed files.
2. `npm run build` (no env): passes. `grep -l 0x7bfc1458 dist/assets/*.js` matches. "Add Testnet" is in the bundle.
3. `VERCEL_ENV=production npm run build`: **fails** (rule 2). `VERCEL_ENV=production VITE_NETWORK=sepolia npm run build`: passes.
4. `VITE_NETWORK=mainnet npm run build`: **fails**, naming both the missing address and the missing RPC.
   Repeat with the zero address, the Sepolia address and a bad-checksum address: each one fails.
5. `VITE_NETWORK=mainnet VITE_REMASTERED_PUNKS_MAINNET=<any valid checksummed non-Sepolia addr> VITE_MAINNET_RPC_URL=https://eth.llamarpc.com npm run build`:
   passes. `grep -c '7bfc1458\|6fCdfA445\|Add Testnet' dist/assets/*.js` gives 0 (the Sepolia code was dropped).
6. `npm run dev`, MetaMask:
   - mainnet: header has Add Testnet; cards say "Minting Soon".
   - Sepolia: mint works on an owned test punk.
   - Polygon: cards say "Wrong Network", not mint-ready (the bug fixed by `useAccount().chainId`).
   - In the network tab, check that reads go to `VITE_SEPOLIA_RPC_URL` when set.

Vercel previews (`vercel-deploy` from the repo root; it forwards args to `vercel deploy`):
7. Default preview (no build env): same behavior as prod today on desktop and mobile (`/mobile-check`):
   - Home/Gallery/Lookup unchanged.
   - Sepolia mint path works.
   - `/api/metadata/contract.json` returns 200.
8. Mainnet-mode UI rehearsal preview, without touching project env:
   `vercel-deploy -b VITE_NETWORK=mainnet -b VITE_REMASTERED_PUNKS_MAINNET=<dummy checksummed addr> -b VITE_MAINNET_RPC_URL=<rpc>`.
   Check:
   - no Add Testnet;
   - the RainbowKit chain list shows Ethereum only;
   - on Sepolia, the wallet shows Wrong network plus the switch button;
   - on mainnet, cards render (dummy-address reads fail harmlessly; never send a tx).

## Launch-day cutover checklist (goes into handoff.md)

Every step that broadcasts needs Snax's explicit go/no-go first.

1. **Wallet.** Use a new, real, funded mainnet deployer (about 0.02–0.05 ETH), **not** the Sepolia airdrop key
   (`remastered-airdrop-sepolia` / 0x709C4b…). Store the key in the keychain, e.g. `security add-generic-password -l remastered-mainnet -a remastered-punks -w`.
   Never echo it.
2. **Dry run.** From `contracts/`, run the handoff.md:94-98 command without `--broadcast`.
   Check the output shows:
   - `BASE_URI=https://punksremastered.com/api/metadata/`;
   - CryptoPunks `0xb47e3cd837dDF8e4c57F05d70Ab865de6e193BBB`;
   - root `0x9188c058…1324`.
3. **Deploy and verify.** Rerun the same command with `--broadcast --verify`
   (`ETHERSCAN_API_KEY` from keychain `-l etherscan -a remastered-punks`). Record the address and tx hash in handoff.md.
4. **On-chain checks** (`cast call <addr> … --rpc-url <mainnet rpc>`):
   - `merkleRoot()(bytes32)` == `0x9188c0…1324`
   - `cryptoPunks()(address)` == `0xb47e…BBB`
   - `baseURI()(string)` == `https://punksremastered.com/api/metadata/`
   - `owner()(address)` == deployer
   - `contractURI()(string)` resolves (curl gives 200)
   - Etherscan shows the source verified.
5. **Vercel env, Production scope only:**
   - `VITE_NETWORK=mainnet`
   - `VITE_REMASTERED_PUNKS_MAINNET=<checksummed addr>`
   - `VITE_MAINNET_RPC_URL=<origin-restricted key URL>`
   - confirm `VITE_WALLETCONNECT_PROJECT_ID` (or rely on the default)

   Leave Preview in sepolia mode.
6. **Rehearse.** Run `vercel-deploy -b …` with the real values (step 8 above). Smoke-test the preview, then promote:
   `vercel-deploy --prod` (Snax's OK). The build log must print `[network] mode=mainnet address=<addr>`.
7. **Smoke-test prod** (punksremastered.com):
   - no Add Testnet; the chain list shows Ethereum only;
   - My Punks loads for a punk-holding wallet;
   - "Mint Remaster" is enabled for an owned eligible punk;
   - one real activation by Snax: the tx confirms, the card shows Already Minted;
   - `tokenURI(id)` returns `https://punksremastered.com/api/metadata/<id>`, which serves 200 JSON + image;
   - OpenSea / Etherscan pick up the token;
   - a wallet on Sepolia/Polygon shows Wrong network.
8. **Rollback.** Set Production `VITE_NETWORK=sepolia`, then redeploy. The contract stays deployed; only the UI goes back to pre-launch mode.
9. **Afterwards.** Update memory/handoff with the mainnet address. Optionally commit it as the in-code default. Mark the TASKS.md row done.

## Sibling tasks and merge order

1. **mainnet-config (this one): merge first.** Adds `network.js`, `useNetwork.js`, the extended `contracts.js` getters and `TRANSPORTS`.
2. **owned-punks-multicall** (`TASKS.md:11`): rebase onto this. Implement the `punkIndexToAddress` multicall in `ownedPunks.js` with
   `usePublicClient({ chainId: TARGET_CHAIN.id })` (pass the client in), `getCryptoPunksAddress(1)` and `CRYPTOPUNKS_ABI`.
   Remove `VITE_ALCHEMY_API_KEY` from `ownedPunks.js:5` and `.env.example`. The RPC key now lives in `VITE_MAINNET_RPC_URL`.
3. **mint-errors-ownership** (`TASKS.md:12`): after 2. Add the custom errors to `REMASTERED_PUNKS_ABI` (contracts.js:16-55; the errors are at
   `contracts/src/*.sol:31-36`). Do the mainnet ownership check in PunkCard via
   `useReadContract({ address: cryptoPunksAddress, abi: CRYPTOPUNKS_ABI, chainId: TARGET_CHAIN.id })` from `useNetwork()`.
4. **wallet-state-bugs** (`TASKS.md:14`): its "use account chainId" item is **covered here**; drop it from that task.

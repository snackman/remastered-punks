# mint-errors-ownership — readable mint errors, reverted receipts, ownership check on mainnet

Base branch: `prototype/base-ear-shift`. Branch: `task/mint-errors-ownership`. Frontend only (`preview/remaster`); no contract changes.

## Goal

1. Mint reverts show what went wrong (not owner / already minted / not eligible), not "Error minting".
2. Wallet rejection reads "Transaction cancelled", not an error.
3. A tx that is mined but reverts shows an error, not a silent button reset.
4. The Mint button is disabled with "Not Your Punk" on **mainnet as well as Sepolia**, and shows a loading state until ownership is known (fixes L6, the "Not Your Punk" flash).
5. The PunkGrid "N remastered" count updates after a mint.
6. `syncOwnership` and `announcedOwner` go into the ABI. The UI for them is optional (step 7).

## Findings (checked against the code on 2026-11-18)

- `contracts/src/RemasteredPunks.sol:31-36` defines the custom errors: `NotEligible`, `NotPunkOwner`, `AlreadyActivated`, `TransferDisabled`, `NotActivated`, `AlreadySynced`. All take no arguments. None are in `REMASTERED_PUNKS_ABI` (`src/lib/contracts.js:16-55`). The ABI also lacks `syncOwnership(uint256)` (sol:128) and the public `announcedOwner(uint256)` mapping (sol:29).
- `activate` checks in this order (sol:73-99): proof, then owner, then already-activated. `AlreadyActivated` can only reach the punk's current owner.
- `PunkCard.jsx:190-197` matches strings in `writeError.message`. Without error ABI entries viem cannot decode the revert, so neither check ever matches. A wallet rejection (`UserRejectedRequestError`, code 4001) also falls through to "Error minting".
- `PunkCard.jsx:51` ignores `isError`/`error` from `useWaitForTransactionReceipt`. **This is worse than the audit says.** On a reverted receipt, wagmi core (`node_modules/@wagmi/core/dist/esm/actions/waitForTransactionReceipt.js`) re-runs the call and throws `new Error(hexToString(data.substring(138)))`. That only decodes `Error(string)`. For our 4-byte custom errors the message is garbage or empty. So the receipt error can't be used as text. We have to show a generic "reverted" message and re-check the reason ourselves.
- `PunkCard.jsx:56-67`: the effect calls `refetchActivated()` whenever any dependency changes while `isSuccess` stays true. `mintStatus` is only read for the `success` CSS class (l.183). The status can be derived instead of stored.
- `PunkCard.jsx:34-45,110,117`: the ownership read is enabled only on testnet (`isTestnet`). `canMint` skips ownership on mainnet. "Not Your Punk" shows while `punkOwner` is still `undefined` (L6).
- `contracts.js:86-92`: `getCryptoPunksAddress` returns `null` on mainnet. The mainnet address `0xb47e3cd837dDF8e4c57F05d70Ab865de6e193BBB` is already at l.11. Real CryptoPunks has `punkIndexToAddress(uint256) view returns (address)`, the same signature as the mock.
- `PunkGrid.jsx:90-101`: `useReadContracts` for the `activated` count is never invalidated. Note that `wallet-state-bugs` (TASKS.md:14) also lists "refetch remastered count after mint". This task does it, so that item should be struck from wallet-state-bugs.
- Only `PunkGrid.jsx:159` and `ManualLookup.jsx:50` render PunkCard. Gallery doesn't.
- Versions: wagmi 2.19.5, viem 2.45.0, react-query 5. `getDefaultConfig` sets no `transports`, so mainnet reads go through the chain's default public RPC. A dedicated RPC is the `mainnet-config` task's job.
- The frontend has no unit-test runner. Root Playwright only matches `*.spec.js`.

## Files to change

| File | Change |
|---|---|
| `preview/remaster/src/lib/contracts.js` | Add the 6 `type:'error'` entries, `syncOwnership`, `announcedOwner`. Add `CRYPTOPUNKS_ABI` (`punkIndexToAddress`) and keep `MOCK_CRYPTOPUNKS_ABI` as a superset (it adds `claimPunk`). `getCryptoPunksAddress(chainId)` returns the mainnet address for chainId 1. |
| `preview/remaster/src/lib/mintErrors.js` (new) | `describeTxError(err) -> { kind: 'cancelled' \| 'revert' \| 'other', errorName?, message }` |
| `preview/remaster/src/components/PunkCard.jsx` | Ownership read on both chains, loading state, simulate-then-write, receipt error, derived status, invalidate queries on success |
| `preview/remaster/src/App.css` (~l.739 `.mint-error`) | Add a muted `.mint-note` style for "cancelled" (optional) |

`PunkGrid.jsx` needs **no edits**: it is fixed by invalidating queries from PunkCard. That keeps this task off the lines that `owned-punks-multicall` rewrites.

## Implementation steps

### 1. `contracts.js`
- Add these entries to `REMASTERED_PUNKS_ABI`:
  ```js
  { type: 'error', name: 'NotEligible', inputs: [] },
  { type: 'error', name: 'NotPunkOwner', inputs: [] },
  { type: 'error', name: 'AlreadyActivated', inputs: [] },
  { type: 'error', name: 'TransferDisabled', inputs: [] },
  { type: 'error', name: 'NotActivated', inputs: [] },
  { type: 'error', name: 'AlreadySynced', inputs: [] },
  ```
  Also add `syncOwnership(uint256 tokenId)` (nonpayable, no outputs) and `announcedOwner(uint256) view returns (address)`.
- Cross-check against the compiled ABI rather than by eye: `contracts/out/RemasteredPunks.sol/RemasteredPunks.json`, after `forge build` if `out/` is missing. Compare with `jq '.abi[] | select(.type=="error")'`.
- Export `CRYPTOPUNKS_ABI = [punkIndexToAddress entry]` and rebuild `MOCK_CRYPTOPUNKS_ABI` as `[claimPunk, ...CRYPTOPUNKS_ABI]`.
- `getCryptoPunksAddress`: return `CONTRACTS.mainnet.cryptoPunks` for chainId 1, and update the "testnet only" comment. Check that callers are safe: `PunkGrid.jsx:34` calls it only inside `if (isTestnet)`, so nothing changes there.

### 2. `lib/mintErrors.js`
```js
import { BaseError, ContractFunctionRevertedError, UserRejectedRequestError } from 'viem';
const MESSAGES = {
  NotPunkOwner: "You don't own this punk",
  AlreadyActivated: 'Already minted',
  NotEligible: 'This punk is not eligible',
  NotActivated: 'Not minted yet',
  AlreadySynced: 'Already in sync',
};
export function describeTxError(err) { /* see below */ }
```
- If `err instanceof BaseError`, call `err.walk(e => e instanceof UserRejectedRequestError || e?.code === 4001)`. If that finds something, return `{ kind: 'cancelled', message: 'Transaction cancelled' }`.
- `err.walk(e => e instanceof ContractFunctionRevertedError)`. If it finds `r` and `r.data?.errorName` is set, return `{ kind: 'revert', errorName, message: MESSAGES[errorName] ?? errorName }`.
- Otherwise return `{ kind: 'other', message: err.shortMessage ?? 'Something went wrong' }`. Never render raw `err.message`, because it is multi-line and includes RPC detail.

### 3. PunkCard: ownership on both chains, with loading state
- Rename `mockPunksAddress` to `punksAddress = getCryptoPunksAddress(chainId)`. Read `punkIndexToAddress` with `CRYPTOPUNKS_ABI`.
- Enable it as `enabled: !!punksAddress && isConnected && hasMerkleProof && hasRemasters`. This limits RPC calls to cards that can show a button. Move the `hasMerkleProof` and `hasRemasters` definitions (l.70-73) above this hook.
- Get `isLoading: ownerLoading` and `refetch: refetchOwner`.
- `ownsPunk = !!address && !!punkOwner && punkOwner !== zeroAddress && punkOwner.toLowerCase() === address.toLowerCase()`. Use viem `isAddressEqual` and `zeroAddress` instead of the local constant.
- `canMint = isConnected && contractAddress && hasMerkleProof && hasRemasters && !isActivated && ownsPunk`. **The `isTestnet` special case goes away.**
- Button text priority, top to bottom:
  1. Connect Wallet
  2. Minting Soon / Wrong Network (no contract address)
  3. Already Minted
  4. `ownerLoading`: "Checking ownership…" (disabled). This fixes the L6 flash.
  5. `!ownsPunk`: "Not Your Punk"
  6. Confirm in Wallet… (`isPending` or simulating)
  7. Minting… (`isConfirming`)
  8. Minted!
  9. Mint Remaster
- On mainnet before deploy, `contractAddress` is null, so "Minting Soon" still wins. The ownership read still runs, so after deploy only the address constant needs to change. With `!punksAddress` (unknown chain), "Wrong Network" already covers it.

### 4. PunkCard: simulate before writing (recommended: on click, not `useSimulateContract`)
- `const publicClient = usePublicClient({ chainId })`. Make `handleMint` async:
  ```js
  reset(); setTxError(null); setSimulating(true);
  try {
    const { request } = await publicClient.simulateContract({
      address: contractAddress, abi: REMASTERED_PUNKS_ABI, functionName: 'activate',
      args: [BigInt(punk.id), merkleProof], account: address,
    });
    writeContract({ ...request, chainId });
  } catch (e) { setTxError(describeTxError(e)); refetchActivated(); refetchOwner(); }
  finally { setSimulating(false); }
  ```
- Render a single error source: `const shownError = txError ?? (writeError && describeTxError(writeError)) ?? (receiptError && REVERTED)`, where `REVERTED = { kind:'revert', message:'Transaction reverted' }`. Show `kind === 'cancelled'` with muted styling.
- If a simulation revert is `NotPunkOwner` or `AlreadyActivated`, the refetches fix the button state at the same time.
- Why on click and not the `useSimulateContract` hook: the hook would fire an `eth_call` for every rendered card on every block or refocus. On-click costs one call, still catches the decoded error before the signature, and keeps `canMint` as the only gate before the click. Pre-checking eligibility belongs to `gate-ui-on-eligible`.

### 5. PunkCard: receipt success and revert
- `const { isLoading: isConfirming, isSuccess, isError: receiptFailed, data: receipt } = useWaitForTransactionReceipt({ hash, chainId })`.
- Replace the `mintStatus` state and effect (l.13, 56-67) with derived values. Keep a single effect keyed on the tx outcome:
  ```js
  const handled = useRef(null);
  useEffect(() => {
    if (!hash || handled.current === hash || !(isSuccess || receiptFailed)) return;
    handled.current = hash;
    queryClient.invalidateQueries({ queryKey: ['readContract'] });
    queryClient.invalidateQueries({ queryKey: ['readContracts'] });
  }, [hash, isSuccess, receiptFailed, queryClient]);
  ```
  `queryClient = useQueryClient()`. wagmi v2 query keys start with `'readContract'` and `'readContracts'`. That refreshes this card's `activated` and owner reads and PunkGrid's count (fixes PunkGrid.jsx:90-101) without touching PunkGrid. The ref guard stops the repeated refetch from the old effect.
- On a revert, show "Transaction reverted", plus an Etherscan link `https://{sepolia.}etherscan.io/tx/${hash}` when a hash exists. Re-enable the button after the invalidated reads land. **Don't** display `receiptError.message` (it's garbled, see findings).
- Success CSS class: `isSuccess` instead of `mintStatus === 'success'`.

### 6. Wording ("Mint" vs "Activate")
The contract function is `activate`. It emits `Transfer(0 → owner)`, so marketplaces and wallets show it as a mint. **Recommendation:** keep "Mint" for everything users see (button, errors, "Minted"), and keep `activate` only in code. Home.jsx:181 already says "mint". Any new strings in this task use "Mint". The final copy pass, and if wanted the "deactivate = burn" wording, belongs to `og-tags-copy` (TASKS.md:15).

### 7. syncOwnership: optional, recommended, can be cut
- The ABI entries are in step 1 either way. They cost nothing and are needed for any future UI.
- Proposed UI: when `isActivated` is true, read `announcedOwner(id)`. If it isn't equal to `punkOwner` and `punkOwner` isn't zero, show a small secondary button, "Sync to marketplaces". It calls `syncOwnership(id)` through the same simulate, write and receipt flow, with `AlreadySynced` mapped to "Already in sync".
- It is permissionless, so anyone connected can trigger it, and it's useful to a buyer whose OpenSea listing shows the old owner.
- To limit scope, it can be its own PR. This plan recommends adding it, since it's ~30 lines in the same component. Snax decides at plan review.

## Risks

- **Sibling merge conflicts.**
  - `gate-ui-on-eligible` edits PunkCard l.72 (`hasRemasters`), l.110 (`canMint`) and l.177 (the mint-section condition).
  - `owned-punks-multicall` rewrites the mainnet branch of `PunkGrid.jsx:53-72` and `ownedPunks.js`, and will want a mainnet `punkIndexToAddress` ABI and address.
  - **Suggested merge order:** this task first, because it adds the shared `CRYPTOPUNKS_ABI` and mainnet `getCryptoPunksAddress` that owned-punks-multicall should reuse. Then owned-punks-multicall (it doesn't touch PunkCard). gate-ui-on-eligible goes last and rebases onto the new `canMint` line, swapping `hasRemasters` for its eligible-set check.
  - If gate-ui merges first, the conflict is limited to the `canMint`/`hasRemasters` lines. Keep its eligibility gate and add `ownsPunk`.
- Wide `invalidateQueries({ queryKey: ['readContract'] })` refetches every mounted contract read once per mint. That's at most a few hundred `activated` calls in a large grid, once. To narrow it, use a `predicate` that checks `query.queryKey[1]?.address` equals `contractAddress` or `punksAddress`.
- Mainnet ownership reads go over the default public RPC until `mainnet-config` adds a transport, so they may be slow or rate-limited. "Checking ownership…" covers slow reads. If a read errors, treat the punk as not owned. Show "Couldn't check ownership", not "Not Your Punk".
- Wallets built on older wagmi may wrap a rejection as `code: 4001` without the viem class. The walk also checks `code`.
- `useChainId()` returns the config chain, not the wallet chain. `chainId` is passed to `writeContract`, so wagmi raises or switches chains instead of sending on the wrong chain. The full fix stays in `wallet-state-bugs`.
- `simulateContract` with an `account` address does a plain `eth_call` from that address. It needs no signature, so it can't leak or spend anything.

## Verification

### Static
- `cd preview/remaster && npm run lint`. TASKS.md says lint errors already exist (repo-cleanup). Require **no new** errors in the touched files.
- `npm run build`.

### Offline decode check (no chain)
Write a scratch node script that imports the new ABI and `describeTxError`, and runs these with viem:
- `encodeErrorResult` for each of the 6 errors, then `decodeErrorResult`. Names must round-trip.
- A fake `ContractFunctionExecutionError` wrapping `ContractFunctionRevertedError` (with abi and data) must map to the right message.
- A `UserRejectedRequestError` must map to `kind: 'cancelled'`.

### Sepolia read-only checks (no transactions, safe without asking)
Contract `0x7bfc1458fD8BC7D176b2D3B8020f07C335fe117B`, mock punks `0x6fCdfA445bF2752D4F38AB67F08c7eEDEfEaAed8`. Use a scratch viem script with a Sepolia public client. `simulateContract` is `eth_call`, so no gas, no keys.
1. Pick an eligible id with a proof (from `data/` merkle proofs). Read `punkIndexToAddress(id)` and `activated(id)`.
2. Simulate `activate(id, proof)` from a random address. Expect `errorName === 'NotPunkOwner'`.
3. Simulate the same call from the mock owner of an **activated** id. Find one by scanning `activated()` or `Transfer` logs from `0x0`. Expect `AlreadyActivated`.
4. Simulate with an empty or wrong proof. Expect `NotEligible`.
5. Simulate `syncOwnership` on a non-activated id. Expect `NotActivated`.

### Sepolia UI (local `npm run dev`, then Vercel preview via `/ship`)
- Connected wallet that doesn't own the looked-up punk (ManualLookup): "Checking ownership…" briefly, then a disabled "Not Your Punk", with no flash.
- Owned, unminted punk: click Mint and reject in the wallet. Expect a muted "Transaction cancelled" and an enabled button.
- Owned, already-activated punk: "Already Minted" badge.
- Switch the wallet or app to mainnet. ManualLookup still shows "Minting Soon" (contract null). In the network tab, confirm that `punkIndexToAddress` is called on `0xb47e…BBB` (mainnet ownership read is wired up).
- **Needs Snax's OK before running (sends real Sepolia transactions):**
  - A successful mint of a test-owned punk. Expect "Minted!", then the badge, and the PunkGrid "N remastered" count goes up without a reload.
  - Optional forced revert: mint the same punk from two tabs, send both, confirm the second. Expect "Transaction reverted" with an Etherscan link.
  - Optional `syncOwnership` UI, if built: needs a punk transfer on the mock (`setPunkOwner`, owner-only) and is the most invasive check. Skip unless Snax wants it.
- Vercel preview: confirm the build is Ready and that the cases above behave the same on the preview URL. Deploy with `vercel-deploy` or `/ship`.

## Decisions (Snax, 2026-11-18)
- **syncOwnership "Sync to marketplaces" button: INCLUDE** (in this PR, not split out).

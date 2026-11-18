// Finds the eligible punks a wallet owns with on-chain multicalls (no indexer/API).
// Pure module (no import.meta.env, no React) so scripts/check-owned-punks.mjs can import it.

// Minimal ABIs. The mock on Sepolia and the real CryptoPunks contract share this signature.
export const CRYPTOPUNKS_ABI = [
  {
    name: 'punkIndexToAddress',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'punkIndex', type: 'uint256' }],
    outputs: [{ name: '', type: 'address' }],
  },
];

export const ERC721_OWNER_OF_ABI = [
  {
    name: 'ownerOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'address' }],
  },
];

// Mainnet wrappers that hold punks on behalf of their owners: WPUNKS and CryptoPunks 721.
export const PUNK_WRAPPERS = [
  '0xb7F7F6C52F2e2fdb1963Eab30438024864c313F6',
  '0x000000000000003607fce1aC9e043a86675C5C2F',
];

// viem's multicall `batchSize` counts calldata BYTES, not calls. One punkIndexToAddress call is
// ~36 bytes (~224 bytes of aggregate3 calldata), so 500 calls per chunk keeps each eth_call at
// ~112 KB / ~2.8M gas, under public RPC body and gas limits.
export const PUNKS_SCAN_BATCH_BYTES = 500 * 36;

/**
 * Which of `eligibleIds` does `owner` own on the punks contract at `punksAddress`?
 * Throws if any chunk fails (never returns a partial list as if complete).
 * If `wrappers` is given, also reports eligible punks held by a wrapper that `owner` owns there
 * (best effort: a failed wrapper lookup just yields no `wrapped` entries).
 * @returns {Promise<{ owned: number[], wrapped: { id: number, wrapper: string }[] }>}
 */
export async function fetchOwnedEligiblePunks({ client, punksAddress, owner, eligibleIds, wrappers = [] }) {
  const me = owner.toLowerCase();
  const wrapperSet = new Set(wrappers.map((w) => w.toLowerCase()));

  const owners = await client.multicall({
    contracts: eligibleIds.map((id) => ({
      address: punksAddress,
      abi: CRYPTOPUNKS_ABI,
      functionName: 'punkIndexToAddress',
      args: [BigInt(id)],
    })),
    allowFailure: false,
    batchSize: PUNKS_SCAN_BATCH_BYTES,
  });

  const owned = [];
  const heldByWrapper = []; // { id, wrapper }
  eligibleIds.forEach((id, i) => {
    const o = String(owners[i]).toLowerCase();
    if (o === me) owned.push(id);
    else if (wrapperSet.has(o)) heldByWrapper.push({ id, wrapper: o });
  });

  const wrapped = [];
  if (heldByWrapper.length > 0) {
    try {
      const wrappedOwners = await client.multicall({
        contracts: heldByWrapper.map(({ id, wrapper }) => ({
          address: wrapper,
          abi: ERC721_OWNER_OF_ABI,
          functionName: 'ownerOf',
          args: [BigInt(id)],
        })),
        allowFailure: true,
        batchSize: PUNKS_SCAN_BATCH_BYTES,
      });
      heldByWrapper.forEach((h, i) => {
        const r = wrappedOwners[i];
        if (r?.status === 'success' && String(r.result).toLowerCase() === me) wrapped.push(h);
      });
    } catch {
      // Wrapped notice is informational; ignore lookup failures.
    }
  }

  owned.sort((a, b) => a - b);
  wrapped.sort((a, b) => a.id - b.id);
  return { owned, wrapped };
}

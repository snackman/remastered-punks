// Usage (from preview/remaster so viem resolves):
//   node scripts/check-owned-punks.mjs <address> [rpcUrl]
// Prints how many eligible punks the address owns / has wrapped, using the same code as the app.
import { createPublicClient, http } from 'viem';
import { mainnet } from 'viem/chains';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { fetchOwnedEligiblePunks, PUNK_WRAPPERS } from '../src/lib/ownedPunks.js';

const [owner, rpcUrl = 'https://ethereum-rpc.publicnode.com'] = process.argv.slice(2);
if (!owner) {
  console.error('usage: check-owned-punks.mjs <address> [rpcUrl]');
  process.exit(1);
}

const here = path.dirname(fileURLToPath(import.meta.url));
const eligible = JSON.parse(readFileSync(path.join(here, '../../../data/all-eligible-punks.json'), 'utf8'));
const eligibleIds = Array.isArray(eligible) ? eligible : eligible.punks ?? eligible.eligible;

const client = createPublicClient({ chain: mainnet, transport: http(rpcUrl) });
const t = Date.now();
const { owned, wrapped } = await fetchOwnedEligiblePunks({
  client,
  punksAddress: '0xb47e3cd837dDF8e4c57F05d70Ab865de6e193BBB',
  owner,
  eligibleIds,
  wrappers: PUNK_WRAPPERS,
});
console.log(`eligible scanned: ${eligibleIds.length} in ${Date.now() - t}ms via ${rpcUrl}`);
console.log(`owned: ${owned.length}`, owned.slice(0, 20).join(','), owned.length > 20 ? '...' : '');
console.log(`wrapped: ${wrapped.length}`, wrapped.slice(0, 20).map((w) => w.id).join(','));

// Single source of truth for "does this punk have a remaster / can it mint":
// membership in data/all-eligible-punks.json. No imports, so Node scripts can use it.
let set = new Set();

export function initEligibility(ids) {
  set = new Set((ids || []).map(Number));
}
export const isEligibleId = (id) => set.has(Number(id));
export const eligibleCount = () => set.size;
export const noRemasterCopy = (id) =>
  `#${id} has no remaster — only ${set.size.toLocaleString('en-US')} punks are eligible`;

// Pure view-state for a card. merkleStatus: 'loading' | 'ready' | 'error'
export function remasterState(id, proof, merkleStatus) {
  const eligible = isEligibleId(id);
  const hasProof = Array.isArray(proof) && proof.length > 0;
  return {
    eligible,
    hasProof,
    showRemaster: eligible,
    showMint: eligible,
    proofPending: eligible && !hasProof && merkleStatus === 'loading',
    proofMissing: eligible && !hasProof && merkleStatus !== 'loading',
  };
}

// Home shuffle buckets: eligible ids only, keyed by remaster trait.
// traitsOf(punk) returns a list of trait names (or {trait} objects).
export function buildBuckets(eligibleIds, punkData, traitsOf) {
  const map = {};
  for (const id of eligibleIds || []) {
    const p = punkData[id];
    if (!p) continue;
    let keys = (traitsOf(p) || []).map((t) => (typeof t === 'string' ? t : t.trait));
    if (!keys.length) keys = ['Remaster'];
    for (const k of keys) (map[k] || (map[k] = [])).push(id);
  }
  return { keys: Object.keys(map), map };
}

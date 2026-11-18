import { useEffect, useState } from 'react';
import { dataUrl } from './dataUrl';
import { createProofLoader, proofFetcher } from './merkleLoader';

// Per-punk proofs (data/proofs/<id>.json, ~830 B each) replace downloading the 3.2 MB tree.
// DEV has no build step, so there we read the full tree once and index into it.
let devTree = null;
const devFetch = async (id) => {
  devTree ??= fetch('../../data/merkle-tree.json').then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });
  const tree = await devTree.catch((e) => { devTree = null; throw e; });
  const proof = tree.proofs?.[id];
  if (!Array.isArray(proof)) throw new Error(`no proof for ${id}`);
  return proof;
};

const loadProof = createProofLoader(
  import.meta.env.DEV
    ? devFetch
    : proofFetcher((u) => fetch(u), (id) => dataUrl(`proofs/${id}.json`)),
);

// Returns { proof, status }. status: 'loading' | 'ready' | 'error'. Ineligible ids
// are 'ready' with no proof and never fetch. Matches remasterState()'s merkleStatus.
export function useMerkleProof(id, eligible) {
  const [result, setResult] = useState({ id: null, proof: undefined, status: 'loading' });

  useEffect(() => {
    if (!eligible) return;
    let cancelled = false;
    loadProof(id).then(
      (proof) => { if (!cancelled) setResult({ id, proof, status: 'ready' }); },
      (e) => {
        console.warn(`Merkle proof ${id} not loaded:`, e);
        if (!cancelled) setResult({ id, proof: undefined, status: 'error' });
      },
    );
    return () => { cancelled = true; };
  }, [id, eligible]);

  if (!eligible) return { proof: undefined, status: 'ready' };
  if (result.id !== id) return { proof: undefined, status: 'loading' };
  return { proof: result.proof, status: result.status };
}

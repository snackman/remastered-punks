// Pure, dependency-free proof loading (testable in node with a fetch mock).

// Returns fetchById(id) -> Promise<string[]>; rejects on HTTP or parse failure.
export function proofFetcher(fetchImpl, urlFor) {
  return async (id) => {
    const res = await fetchImpl(urlFor(id));
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const proof = await res.json();
    if (!Array.isArray(proof) || proof.length === 0) throw new Error('bad proof payload');
    return proof;
  };
}

// Memoizes in-flight/finished fetches per id. A failed fetch is dropped from the
// cache so a later card mount (or retry) tries again.
export function createProofLoader(fetchById) {
  const cache = new Map();
  return function loadProof(id) {
    let p = cache.get(id);
    if (!p) {
      p = fetchById(id).catch((e) => {
        cache.delete(id);
        throw e;
      });
      cache.set(id, p);
    }
    return p;
  };
}

// Gallery-only cache of remastered 24x24 composites, keyed by punk id. Kept out of
// remaster.js so the compositor files stay untouched. ~2.3 KB each, so even all
// 3,434 eligible punks is only ~8 MB; no eviction needed.
import { compositePunk, isStackingReady } from './remaster';

const cache = new Map();

// Returns the cached 24x24 canvas, or null if the stacking compositor isn't ready
// yet. Before then compositePunk returns the plain (non-stacked) composite, which
// must never be cached as the remaster.
export function getRemasterTile(punk) {
  if (!punk) return null;
  const hit = cache.get(punk.id);
  if (hit) return hit;
  if (!isStackingReady()) return null;
  const canvas = compositePunk(punk, true);
  cache.set(punk.id, canvas);
  return canvas;
}

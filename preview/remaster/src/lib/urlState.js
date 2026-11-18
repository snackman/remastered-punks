export const VALID_TABS = ['home', 'wallet', 'lookup', 'gallery'];

// search/hash are raw location strings ("?trait=Cap", "#gallery").
export function parseUrl({ search, hash }) {
  const h = (hash || '').replace(/^#/, '');
  const q = new URLSearchParams(search || '');
  const tab = VALID_TABS.includes(h) ? h : 'home';
  const rawPunk = q.get('punk');
  const punkN = Number(rawPunk);
  return {
    tab,
    trait: tab === 'gallery' ? q.get('trait') || null : null,
    punk: tab === 'home' && rawPunk && Number.isInteger(punkN) ? punkN : null,
  };
}

// Rebuilds the query from scratch so stale ?trait/?punk never leak across tabs.
// keepDev: carry the dev-only ?as= param (PunkGrid useViewAs).
export function buildUrl({ pathname, search = '', tab, trait = null, punk = null, keepDev = false }) {
  const out = new URLSearchParams();
  if (keepDev) {
    const as = new URLSearchParams(search).get('as');
    if (as) out.set('as', as);
  }
  if (tab === 'gallery' && trait) out.set('trait', trait);
  if (tab === 'home' && punk != null) out.set('punk', String(punk));
  const s = out.toString();
  return `${pathname}${s ? `?${s}` : ''}#${tab}`;
}

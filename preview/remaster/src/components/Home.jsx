import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { SPRITE_SIZE } from '../lib/constants';
import { extractPunk } from '../lib/sprites';
import { compositePunk, getRemasters } from '../lib/remaster';

const ZOOM = 9;

// Bucket eligible punks by alteration type (the remaster trait: each hairstyle,
// 'Bald', Regular Shades, Earring, Choker, Front Beard, Small Shades, ...).
function buildBuckets(eligiblePunks, punkData) {
  const ids = eligiblePunks && eligiblePunks.length
    ? eligiblePunks
    : Object.keys(punkData).map(Number);
  const map = {};
  for (const id of ids) {
    const p = punkData[id];
    if (!p) continue;
    for (const r of getRemasters(p)) {
      (map[r.trait] || (map[r.trait] = [])).push(id);
    }
  }
  return { keys: Object.keys(map), map };
}

// Pick a random alteration type (equal chance each), then a random punk of that
// type - so rare alterations show as often as common ones.
function pickRandomByType(buckets) {
  if (!buckets.keys.length) return null;
  const key = buckets.keys[Math.floor(Math.random() * buckets.keys.length)];
  const bucket = buckets.map[key];
  return bucket[Math.floor(Math.random() * bucket.length)];
}

function Home({ punkData, eligiblePunks, onNavigate }) {
  const [punk, setPunk] = useState(null);
  const [pos, setPos] = useState(-1);     // index into the shuffle history
  const [count, setCount] = useState(0);  // history length
  const [reveal, setReveal] = useState(false);      // "can't see the difference?" overlay
  const [changedCount, setChangedCount] = useState(0);
  const [revealShowing, setRevealShowing] = useState('remastered');
  const originalRef = useRef(null);
  const remasteredRef = useRef(null);
  const overlayRef = useRef(null);

  // Refs so the popstate handler and callbacks always see current values.
  const historyRef = useRef([]);          // array of punk ids, in view order
  const posRef = useRef(-1);
  const punkDataRef = useRef(punkData);
  useEffect(() => { punkDataRef.current = punkData; }, [punkData]);

  // Alteration-type buckets for weighted shuffle (rebuilt when data changes).
  const buckets = useMemo(() => buildBuckets(eligiblePunks, punkData), [eligiblePunks, punkData]);
  const bucketsRef = useRef(buckets);
  useEffect(() => { bucketsRef.current = buckets; }, [buckets]);

  const urlFor = (id) => `?punk=${id}${window.location.hash || '#home'}`;

  // Show the punk at a given history index and mirror it into the URL.
  const showAt = useCallback((p) => {
    const id = historyRef.current[p];
    const punkObj = id != null ? punkDataRef.current[id] : null;
    if (!punkObj) return;
    posRef.current = p;
    setPos(p);
    setPunk(punkObj);
    window.history.replaceState(null, '', urlFor(id));
  }, []);

  // Shuffle appends to the history (never truncates forward entries) and jumps
  // to the new punk at the end.
  const goToNew = useCallback((id) => {
    if (!punkDataRef.current[id]) return;
    historyRef.current.push(id);
    setCount(historyRef.current.length);
    showAt(historyRef.current.length - 1);
  }, [showAt]);

  const shuffle = useCallback(() => {
    const id = pickRandomByType(bucketsRef.current);
    if (id != null) goToNew(id);
  }, [goToNew]);

  const goBack = useCallback(() => {
    if (posRef.current > 0) showAt(posRef.current - 1);
  }, [showAt]);
  const goNext = useCallback(() => {
    if (posRef.current < historyRef.current.length - 1) showAt(posRef.current + 1);
  }, [showAt]);

  // Initial punk: honor ?punk=<id> from the URL (deep-link/refresh), else shuffle.
  const initedRef = useRef(false);
  useEffect(() => {
    if (initedRef.current) return;
    if (!punkData || !Object.keys(punkData).length || !buckets.keys.length) return;
    initedRef.current = true;
    const q = parseInt(new URLSearchParams(window.location.search).get('punk'), 10);
    if (!Number.isNaN(q) && punkData[q]) {
      goToNew(q);
    } else {
      const id = pickRandomByType(buckets);
      if (id != null) goToNew(id);
    }
  }, [punkData, buckets, goToNew]);

  // Draw both punks whenever the selection changes.
  useEffect(() => {
    if (!punk || !originalRef.current || !remasteredRef.current) return;

    const draw = (canvasEl, sourceCanvas) => {
      const ctx = canvasEl.getContext('2d');
      ctx.clearRect(0, 0, SPRITE_SIZE * ZOOM, SPRITE_SIZE * ZOOM);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(
        sourceCanvas,
        0, 0, SPRITE_SIZE, SPRITE_SIZE,
        0, 0, SPRITE_SIZE * ZOOM, SPRITE_SIZE * ZOOM
      );
    };

    draw(originalRef.current, extractPunk(punk.id));
    draw(remasteredRef.current, compositePunk(punk, true));
  }, [punk, reveal]);

  // Reveal mode: overlay the two images in one spot and flicker between them so
  // the changed pixels stand out. Both are drawn on the same background, so the
  // diff count reflects only real pixel changes (not the transparent-vs-grey bg).
  useEffect(() => {
    if (!reveal || !punk || !overlayRef.current) return;
    const canvas = overlayRef.current;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    const S = SPRITE_SIZE * ZOOM;

    // Composite the original onto the same background as the remaster
    // (extractPunk's background is transparent, which would otherwise all count
    // as "changed" against the remaster's opaque background).
    const orig = document.createElement('canvas');
    orig.width = SPRITE_SIZE;
    orig.height = SPRITE_SIZE;
    const oc = orig.getContext('2d');
    oc.fillStyle = '#638596';
    oc.fillRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);
    oc.drawImage(extractPunk(punk.id), 0, 0);

    const rem = compositePunk(punk, true);
    const od = oc.getImageData(0, 0, SPRITE_SIZE, SPRITE_SIZE).data;
    const rd = rem.getContext('2d').getImageData(0, 0, SPRITE_SIZE, SPRITE_SIZE).data;
    let changed = 0;
    for (let i = 0; i < od.length; i += 4) {
      if (od[i] !== rd[i] || od[i + 1] !== rd[i + 1] || od[i + 2] !== rd[i + 2]) changed += 1;
    }
    setChangedCount(changed);

    const drawImg = (src) => {
      ctx.clearRect(0, 0, S, S);
      ctx.drawImage(src, 0, 0, SPRITE_SIZE, SPRITE_SIZE, 0, 0, S, S);
    };

    let cancelled = false;
    let timer = null;
    let showRem = true;
    const flick = () => {
      if (cancelled) return;
      drawImg(showRem ? rem : orig);
      setRevealShowing(showRem ? 'remastered' : 'original');
      showRem = !showRem;
      timer = setTimeout(flick, 380);
    };
    flick();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [reveal, punk]);

  return (
    <section className="home">
      <h1 className="home-title">Your CryptoPunks, remastered</h1>
      <p className="home-sub">
        Every eligible punk can mint a remaster that follows the original onchain.
      </p>

      {reveal ? (
        <div className="hero-overlay">
          <canvas
            ref={overlayRef}
            width={SPRITE_SIZE * ZOOM}
            height={SPRITE_SIZE * ZOOM}
          />
          <span className="hero-label">
            {revealShowing === 'remastered' ? 'Remastered' : 'Original'} · {changedCount} pixel{changedCount === 1 ? '' : 's'} changed
          </span>
        </div>
      ) : (
        <div className="hero-compare">
          <div className="hero-side">
            <canvas
              ref={originalRef}
              width={SPRITE_SIZE * ZOOM}
              height={SPRITE_SIZE * ZOOM}
            />
            <span className="hero-label">Original</span>
          </div>
          <span className="hero-arrow">&rarr;</span>
          <div className="hero-side">
            <canvas
              ref={remasteredRef}
              width={SPRITE_SIZE * ZOOM}
              height={SPRITE_SIZE * ZOOM}
            />
            <span className="hero-label">Remastered</span>
          </div>
        </div>
      )}

      {punk && (
        <div className="hero-meta">
          <a
            className="hero-punkid"
            href={`https://cryptopunks.app/cryptopunks/details/${punk.id}`}
            target="_blank"
            rel="noreferrer"
          >
            Punk #{punk.id}
          </a>
          {(punk.accessories || []).map((a, i) => (
            <span key={i} className="remaster-badge">{a}</span>
          ))}
        </div>
      )}

      <button className="reveal-toggle" onClick={() => setReveal((v) => !v)}>
        {reveal ? 'Back to compare' : "Can't see the difference?"}
      </button>

      <div className="hero-actions">
        <button className="btn btn-secondary" onClick={goBack} disabled={pos <= 0}>
          &larr; Back
        </button>
        <button className="btn" onClick={shuffle}>Shuffle &#8635;</button>
        <button className="btn btn-secondary" onClick={goNext} disabled={pos >= count - 1}>
          Next &rarr;
        </button>
      </div>

      {count > 1 && (
        <div className="hero-position">{pos + 1} / {count}</div>
      )}

      <div className="hero-actions hero-actions-secondary">
        <button className="btn btn-secondary" onClick={() => onNavigate('wallet')}>
          View my punks
        </button>
        <button className="btn btn-secondary" onClick={() => onNavigate('lookup')}>
          Look up a punk
        </button>
      </div>
    </section>
  );
}

export default Home;

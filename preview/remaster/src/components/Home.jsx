import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { SPRITE_SIZE } from '../lib/constants';
import { extractPunk } from '../lib/sprites';
import { compositePunk, remasterTraits } from '../lib/remaster';
import { buildUrl } from '../lib/urlState';
import { buildBuckets, isEligibleId, noRemasterCopy } from '../lib/eligibility';
import HomeExplainer from './HomeExplainer';

const ZOOM = 9;
const REVEAL_BG = '#638596';

// Composite the original onto the same background as the remaster (extractPunk's
// background is transparent, which would otherwise all count as "changed"
// against the remaster's opaque background) and count differing pixels.
function countChangedPixels(punk) {
  const orig = document.createElement('canvas');
  orig.width = SPRITE_SIZE;
  orig.height = SPRITE_SIZE;
  const oc = orig.getContext('2d');
  oc.fillStyle = REVEAL_BG;
  oc.fillRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);
  oc.drawImage(extractPunk(punk.id), 0, 0);

  const rem = compositePunk(punk, true);
  const od = oc.getImageData(0, 0, SPRITE_SIZE, SPRITE_SIZE).data;
  const rd = rem.getContext('2d').getImageData(0, 0, SPRITE_SIZE, SPRITE_SIZE).data;
  let changed = 0;
  for (let i = 0; i < od.length; i += 4) {
    if (od[i] !== rd[i] || od[i + 1] !== rd[i + 1] || od[i + 2] !== rd[i + 2]) changed += 1;
  }
  return { orig, rem, changed };
}

// Pick a random alteration type (equal chance each), then a random punk of that
// type - so rare alterations show as often as common ones.
function pickRandomByType(buckets) {
  if (!buckets.keys.length) return null;
  const key = buckets.keys[Math.floor(Math.random() * buckets.keys.length)];
  const bucket = buckets.map[key];
  return bucket[Math.floor(Math.random() * bucket.length)];
}

function Home({ punkData, eligiblePunks, onNavigate, onTrait }) {
  const [punk, setPunk] = useState(null);
  const [pos, setPos] = useState(-1);     // index into the shuffle history
  const [count, setCount] = useState(0);  // history length
  const [reveal, setReveal] = useState(false);      // "can't see the difference?" overlay
  const [revealShowing, setRevealShowing] = useState({ id: null, v: 'remastered' });
  const originalRef = useRef(null);
  const remasteredRef = useRef(null);
  const overlayRef = useRef(null);

  // Refs so callbacks always see current values.
  const historyRef = useRef([]);          // array of punk ids, in view order
  const posRef = useRef(-1);
  const punkDataRef = useRef(punkData);
  useEffect(() => { punkDataRef.current = punkData; }, [punkData]);

  // Alteration-type buckets for weighted shuffle (rebuilt when data changes).
  const buckets = useMemo(() => buildBuckets(eligiblePunks, punkData, remasterTraits), [eligiblePunks, punkData]);
  const bucketsRef = useRef(buckets);
  useEffect(() => { bucketsRef.current = buckets; }, [buckets]);

  // Home only renders on the home tab; shuffles replace (not push) the history entry.
  const urlFor = (id) => buildUrl({
    pathname: window.location.pathname, search: window.location.search,
    tab: 'home', punk: id, keepDev: import.meta.env.DEV,
  });

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

  // A deep link can land on a non-eligible punk: show only the original.
  const eligible = !!punk && isEligibleId(punk.id);

  // Draw both punks whenever the selection changes.
  useEffect(() => {
    if (!punk || !originalRef.current) return;

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
    if (eligible && remasteredRef.current) draw(remasteredRef.current, compositePunk(punk, true));
  }, [punk, reveal, eligible]);

  const revealData = useMemo(
    () => (reveal && eligible && punk ? countChangedPixels(punk) : null),
    [reveal, eligible, punk],
  );

  // Reveal mode: overlay the two images in one spot and flicker between them so
  // the changed pixels stand out. Both are drawn on the same background, so the
  // diff count reflects only real pixel changes (not the transparent-vs-grey bg).
  useEffect(() => {
    if (!revealData || !overlayRef.current) return;
    const canvas = overlayRef.current;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    const S = SPRITE_SIZE * ZOOM;

    const { orig, rem } = revealData;

    const drawImg = (src) => {
      ctx.clearRect(0, 0, S, S);
      ctx.drawImage(src, 0, 0, SPRITE_SIZE, SPRITE_SIZE, 0, 0, S, S);
    };

    let cancelled = false;
    let timer = null;
    let showRem = false;
    const flick = () => {
      if (cancelled) return;
      drawImg(showRem ? rem : orig);
      setRevealShowing({ id: punk.id, v: showRem ? 'remastered' : 'original' });
      showRem = !showRem;
      timer = setTimeout(flick, 380);
    };
    drawImg(rem);
    timer = setTimeout(flick, 380);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [reveal, punk, eligible, revealData]);

  return (
    <section className="home">
      <h1 className="home-title">Your CryptoPunks, remastered</h1>
      <p className="home-sub">
        Every eligible punk can mint a remaster that follows the original onchain.
      </p>

      {reveal && eligible ? (
        <div className="hero-overlay">
          <canvas
            ref={overlayRef}
            role="img"
            aria-label={`Punk #${punk.id}, alternating between original and remaster`}
            width={SPRITE_SIZE * ZOOM}
            height={SPRITE_SIZE * ZOOM}
          />
          <span className="hero-label">
            {(revealShowing.id !== punk.id || revealShowing.v === 'remastered')
              ? `Remaster · ${revealData?.changed ?? 0} pixel${revealData?.changed === 1 ? '' : 's'} changed`
              : 'Original'}
          </span>
        </div>
      ) : (
        <div className="hero-compare">
          <div className="hero-side">
            <canvas
              ref={originalRef}
              role="img"
              aria-label={punk ? `Punk #${punk.id}${eligible ? ', original' : ''}` : 'Loading punk'}
              width={SPRITE_SIZE * ZOOM}
              height={SPRITE_SIZE * ZOOM}
            />
            <span className="hero-label">Original</span>
          </div>
          {eligible && (
            <>
              <span className="hero-arrow">&rarr;</span>
              <div className="hero-side">
                <canvas
                  ref={remasteredRef}
                  role="img"
                  aria-label={punk ? `Punk #${punk.id}, remastered` : 'Loading punk'}
                  width={SPRITE_SIZE * ZOOM}
                  height={SPRITE_SIZE * ZOOM}
                />
                <span className="hero-label">Remaster</span>
              </div>
            </>
          )}
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
            <button
              key={i}
              className="remaster-badge remaster-badge-btn"
              onClick={() => onTrait && onTrait(a)}
              title={`Show all remasters with ${a}`}
            >
              {a}
            </button>
          ))}
        </div>
      )}

      {punk && !eligible && <div className="no-remaster">{noRemasterCopy(punk.id)}</div>}

      {eligible && (
        <button className="reveal-toggle" onClick={() => { setRevealShowing({ id: null, v: 'remastered' }); setReveal((v) => !v); }}>
          {reveal ? 'Back to compare' : "Can't see the difference?"}
        </button>
      )}

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

      <HomeExplainer onNavigate={onNavigate} onTrait={onTrait} />
    </section>
  );
}

export default Home;

import { useEffect, useRef, useState, useCallback } from 'react';
import { SPRITE_SIZE } from '../lib/constants';
import { extractPunk } from '../lib/sprites';
import { compositePunk, getRemasters } from '../lib/remaster';

const ZOOM = 9;

// Pick a random eligible punk that actually has a visible remaster.
function pickRandom(eligiblePunks, punkData) {
  const ids = eligiblePunks && eligiblePunks.length
    ? eligiblePunks
    : Object.keys(punkData).map(Number);
  if (!ids.length) return null;

  for (let tries = 0; tries < 60; tries++) {
    const id = ids[Math.floor(Math.random() * ids.length)];
    const punk = punkData[id];
    if (punk && getRemasters(punk).length > 0) return punk;
  }
  // Fallback: first id with data
  return punkData[ids[0]] || null;
}

function Home({ punkData, eligiblePunks, onNavigate }) {
  const [punk, setPunk] = useState(null);
  const [pos, setPos] = useState(-1);     // index into the shuffle history
  const [count, setCount] = useState(0);  // history length
  const originalRef = useRef(null);
  const remasteredRef = useRef(null);

  // Refs so the popstate handler and callbacks always see current values.
  const historyRef = useRef([]);          // array of punk ids, in view order
  const posRef = useRef(-1);
  const punkDataRef = useRef(punkData);
  const eligibleRef = useRef(eligiblePunks);
  useEffect(() => { punkDataRef.current = punkData; }, [punkData]);
  useEffect(() => { eligibleRef.current = eligiblePunks; }, [eligiblePunks]);

  const urlFor = (id) => `?punk=${id}${window.location.hash || '#home'}`;

  // Show a brand-new punk: append to history (dropping any forward entries) and
  // record a browser history entry so back/forward and refresh/share all work.
  const goToNew = useCallback((id, { replace = false } = {}) => {
    const p = punkDataRef.current[id];
    if (!p) return;
    const h = historyRef.current.slice(0, posRef.current + 1);
    h.push(id);
    historyRef.current = h;
    const newPos = h.length - 1;
    posRef.current = newPos;
    setPos(newPos);
    setCount(h.length);
    setPunk(p);
    const state = { punkHistory: true, pos: newPos };
    if (replace) window.history.replaceState(state, '', urlFor(id));
    else window.history.pushState(state, '', urlFor(id));
  }, []);

  const shuffle = useCallback(() => {
    const data = punkDataRef.current;
    if (!data || !Object.keys(data).length) return;
    const p = pickRandom(eligibleRef.current, data);
    if (p) goToNew(p.id);
  }, [goToNew]);

  // Back/Next drive the browser history, so browser arrows and these stay in sync.
  const goBack = useCallback(() => {
    if (posRef.current > 0) window.history.back();
  }, []);
  const goNext = useCallback(() => {
    if (posRef.current < historyRef.current.length - 1) window.history.forward();
  }, []);

  // Browser back/forward (and our Back/Next buttons) land here.
  useEffect(() => {
    const onPop = (e) => {
      const st = e.state;
      if (st && st.punkHistory && typeof st.pos === 'number') {
        const id = historyRef.current[st.pos];
        const p = id != null ? punkDataRef.current[id] : null;
        if (p) {
          posRef.current = st.pos;
          setPos(st.pos);
          setPunk(p);
        }
      }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // Initial punk: honor ?punk=<id> from the URL (deep-link/refresh), else shuffle.
  const initedRef = useRef(false);
  useEffect(() => {
    if (initedRef.current) return;
    if (!punkData || !Object.keys(punkData).length) return;
    initedRef.current = true;
    const q = parseInt(new URLSearchParams(window.location.search).get('punk'), 10);
    if (!Number.isNaN(q) && punkData[q]) {
      goToNew(q, { replace: true });
    } else {
      const p = pickRandom(eligiblePunks, punkData);
      if (p) goToNew(p.id, { replace: true });
    }
  }, [punkData, eligiblePunks, goToNew]);

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
  }, [punk]);

  return (
    <section className="home">
      <h1 className="home-title">Your CryptoPunks, remastered</h1>
      <p className="home-sub">
        Every eligible punk can mint a remaster that follows the original onchain.
      </p>

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

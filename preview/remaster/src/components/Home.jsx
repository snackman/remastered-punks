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
  const originalRef = useRef(null);
  const remasteredRef = useRef(null);

  const shuffle = useCallback(() => {
    if (!punkData || !Object.keys(punkData).length) return;
    setPunk(pickRandom(eligiblePunks, punkData));
  }, [punkData, eligiblePunks]);

  // Pick an initial punk once data is available.
  useEffect(() => {
    shuffle();
  }, [shuffle]);

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

  const remasters = punk ? getRemasters(punk) : [];

  return (
    <section className="home">
      <h1 className="home-title">Your CryptoPunks, remastered</h1>
      <p className="home-sub">
        Every eligible punk gets a hand-corrected remaster that follows the
        original on-chain &mdash; no transfers needed. Here&rsquo;s one, refreshed.
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
          <span className="hero-punkid">Punk #{punk.id}</span>
          {remasters.map((r, i) => (
            <span key={i} className="remaster-badge">{r.trait}</span>
          ))}
        </div>
      )}

      <div className="hero-actions">
        <button className="btn" onClick={shuffle}>Shuffle &#8635;</button>
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

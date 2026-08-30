import { useEffect, useMemo, useRef, useState } from 'react';
import { SPRITE_SIZE } from '../lib/constants';
import { extractPunk } from '../lib/sprites';
import { compositePunk } from '../lib/remaster';

const ZOOM = 3;

// One punk tile - composites the remaster onto a canvas only once it scrolls
// into view (there are thousands, so we can't render them all up front).
function PunkTile({ id, pixels, punk, onTrait }) {
  const holderRef = useRef(null);
  const canvasRef = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = holderRef.current;
    if (!el || visible) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { rootMargin: '300px' }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [visible]);

  useEffect(() => {
    if (!visible || !canvasRef.current || !punk) return;
    const ctx = canvasRef.current.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(compositePunk(punk, true), 0, 0, SPRITE_SIZE, SPRITE_SIZE,
      0, 0, SPRITE_SIZE * ZOOM, SPRITE_SIZE * ZOOM);
  }, [visible, punk]);

  return (
    <div className="gallery-tile" ref={holderRef}>
      <canvas
        width={SPRITE_SIZE * ZOOM}
        height={SPRITE_SIZE * ZOOM}
        ref={canvasRef}
        title={`Punk #${id} - ${pixels} pixel${pixels === 1 ? '' : 's'} changed`}
      />
      <div className="gallery-tile-id">#{id}</div>
      <div className="gallery-tile-px">{pixels}px</div>
      {(punk?.accessories || []).map((a, i) => (
        <button key={i} className="gallery-tile-trait" onClick={() => onTrait(a)}>{a}</button>
      ))}
    </div>
  );
}

function Gallery({ punkData, filterTrait, onFilterTrait }) {
  const [counts, setCounts] = useState(null);

  useEffect(() => {
    const basePath = import.meta.env.DEV ? '../..' : '';
    fetch(`${basePath}/data/remaster-pixel-counts.json`)
      .then(res => res.json())
      .then(setCounts)
      .catch(e => { console.error('pixel counts not loaded', e); setCounts([]); });
  }, []);

  // Only punks with a visible change, already sorted most-changed first; filter
  // to a trait if one is selected.
  const rows = useMemo(() => {
    if (!counts) return [];
    return counts.filter(c => c.pixels > 0 && (!filterTrait
      || (punkData[c.id]?.accessories || []).includes(filterTrait)));
  }, [counts, filterTrait, punkData]);

  if (!counts) return <div className="gallery"><p className="gallery-status">Loading remasters…</p></div>;

  return (
    <section className="gallery">
      <div className="gallery-head">
        <h1 className="gallery-title">All remasters</h1>
        <p className="gallery-sub">
          {rows.length.toLocaleString()} punk{rows.length === 1 ? '' : 's'}
          {filterTrait ? <> with <strong>{filterTrait}</strong></> : null}, most pixels changed first.
        </p>
        {filterTrait && (
          <button className="gallery-clear" onClick={() => onFilterTrait(null)}>
            Clear filter ✕
          </button>
        )}
      </div>
      <div className="gallery-grid">
        {rows.map(c => (
          <PunkTile key={c.id} id={c.id} pixels={c.pixels} punk={punkData[c.id]} onTrait={onFilterTrait} />
        ))}
      </div>
    </section>
  );
}

export default Gallery;

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { SPRITE_SIZE } from '../lib/constants';
import { getRemasterTile } from '../lib/tileCache';
import { useWindowedGrid } from '../hooks/useWindowedGrid';
import { dataUrl } from '../lib/dataUrl';

// Layout constants (CSS px, all integers so sprites stay on the device-pixel grid;
// keep in sync with .gallery-tile in App.css). The canvas backing store is the raw
// 24x24 sprite, scaled 4x by CSS with image-rendering: pixelated, so it is an exact
// multiple at dpr 1/1.25/1.5/2/3. (If some old browser blurs this, fall back to a
// backing store of 24 * round(4 * devicePixelRatio) with imageSmoothingEnabled=false.)
const COL_WIDTH = 96;
const GAP = 12;
const ROW_GAP = 16;
// 96 canvas + 24 id/px line + 3 x 24 chip slots
const ROW_HEIGHT = 192;
const MAX_CHIPS = 3;

// One punk tile. Only mounted while near the viewport (see useWindowedGrid), so it
// draws straight from the tile cache; no per-tile IntersectionObserver.
function PunkTile({ id, pixels, punk, onTrait, filterTrait }) {
  const canvasRef = useRef(null);
  const [retry, setRetry] = useState(0);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const tile = getRemasterTile(punk);
    if (!tile) {
      // Stacking compositor not ready yet: leave blank and try again shortly.
      if (!punk) return;
      const t = setTimeout(() => setRetry(n => n + 1), 250);
      return () => clearTimeout(t);
    }
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);
    ctx.drawImage(tile, 0, 0);
  }, [punk, retry]);

  // When filtering by a trait, list it first so the matching chip is always shown.
  const raw = punk?.accessories || [];
  const accessories = filterTrait && raw.includes(filterTrait)
    ? [filterTrait, ...raw.filter(a => a !== filterTrait)] : raw;
  // Fixed row height: show up to 3 chips; with more, show 2 plus a "+N" link to
  // the punk page (which lists every trait).
  const overflow = accessories.length > MAX_CHIPS;
  const shown = overflow ? accessories.slice(0, MAX_CHIPS - 1) : accessories;

  return (
    <div className="gallery-tile">
      <canvas
        width={SPRITE_SIZE}
        height={SPRITE_SIZE}
        ref={canvasRef}
        title={`Punk #${id} - ${pixels} pixel${pixels === 1 ? '' : 's'} changed`}
      />
      <div className="gallery-tile-meta">
        <a className="gallery-tile-id" href={`?punk=${id}#home`}>#{id}</a>
        <span className="gallery-tile-px">{pixels}px</span>
      </div>
      {shown.map((a, i) => (
        <button key={i} className="gallery-tile-trait" title={a} onClick={() => onTrait(a)}>{a}</button>
      ))}
      {overflow && (
        <a className="gallery-tile-trait gallery-tile-more" href={`?punk=${id}#home`}
          title={accessories.slice(MAX_CHIPS - 1).join(', ')}>
          +{accessories.length - (MAX_CHIPS - 1)} more
        </a>
      )}
    </div>
  );
}

function Gallery({ punkData, filterTrait, onFilterTrait }) {
  const [counts, setCounts] = useState(null);
  const sectionRef = useRef(null);

  useEffect(() => {
    fetch(dataUrl('remaster-pixel-counts.json'))
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

  const { containerRef, cols, totalHeight, startIndex, endIndex, offsetY, snapX, snapY } = useWindowedGrid({
    count: rows.length, colWidth: COL_WIDTH, gap: GAP, rowHeight: ROW_HEIGHT, rowGap: ROW_GAP,
  });

  // A new filter shrinks/grows the list: if we were scrolled past the top of the
  // gallery, bring the new list's start back into view instead of leaving the user
  // stranded below it.
  const lastFilter = useRef(filterTrait);
  useLayoutEffect(() => {
    if (lastFilter.current === filterTrait) return;
    lastFilter.current = filterTrait;
    const el = sectionRef.current;
    if (el && el.getBoundingClientRect().top < 0) {
      window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY });
    }
  }, [filterTrait]);

  if (!counts) return <div className="gallery"><p className="gallery-status">Loading remasters…</p></div>;

  return (
    <section className="gallery" ref={sectionRef}>
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
      {/* Tab/focus into a tile that is near the window edge: scroll it into view so
          the window advances and the next Tab target gets mounted. */}
      <div
        className="gallery-grid"
        ref={containerRef}
        style={{ height: totalHeight }}
        onFocusCapture={e => e.target.scrollIntoView?.({ block: 'nearest' })}
      >
        <div
          className="gallery-grid-inner"
          style={{
            // Positioned with left/top (not transform): a fractional transform
            // resamples the canvases and blends their last pixel row.
            left: snapX,
            top: offsetY + snapY,
            gridTemplateColumns: `repeat(${cols}, ${COL_WIDTH}px)`,
          }}
        >
          {rows.slice(startIndex, endIndex).map(c => (
            <PunkTile key={c.id} id={c.id} pixels={c.pixels} punk={punkData[c.id]} onTrait={onFilterTrait} filterTrait={filterTrait} />
          ))}
        </div>
      </div>
    </section>
  );
}

export default Gallery;

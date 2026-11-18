import { useEffect, useRef, useState } from 'react';

// Window-scroll virtualization for a fixed-cell grid. The page scrolls normally
// (sticky header, URL-bar collapse and scroll restoration keep working); this hook
// only works out which rows are near the viewport so the caller can mount just
// those. All sizes are integer CSS px so canvases land on the device-pixel grid.
//
// Returns { containerRef, cols, totalHeight, startIndex, endIndex, offsetY }.
// Attach containerRef to a `position: relative` block whose height is totalHeight,
// and render items [startIndex, endIndex) in an inner grid translated by offsetY.
export function useWindowedGrid({ count, colWidth, gap, rowHeight, rowGap = gap, overscan = 3 }) {
  const containerRef = useRef(null);
  const [win, setWin] = useState({ cols: 3, first: 0, last: 12 });
  const pitch = rowHeight + rowGap;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let raf = 0;
    const compute = () => {
      raf = 0;
      const cols = Math.max(1, Math.floor((el.clientWidth + gap) / (colWidth + gap)));
      const rows = Math.ceil(count / cols);
      const top = el.getBoundingClientRect().top; // viewport-relative
      const first = Math.min(rows, Math.max(0, Math.floor(-top / pitch) - overscan));
      const last = Math.min(rows, Math.max(first, Math.ceil((window.innerHeight - top) / pitch) + overscan));
      setWin(prev => (prev.cols === cols && prev.first === first && prev.last === last
        ? prev : { cols, first, last }));
    };
    const schedule = () => { if (!raf) raf = requestAnimationFrame(compute); };

    const ro = new ResizeObserver(schedule); // also fires once on observe()
    ro.observe(el);
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    schedule();
    return () => {
      ro.disconnect();
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [count, colWidth, gap, pitch, overscan]);

  const { cols } = win;
  const rows = Math.ceil(count / cols);
  const first = Math.min(win.first, rows);
  const last = Math.min(win.last, rows);
  return {
    containerRef,
    cols,
    totalHeight: Math.max(0, rows * pitch - rowGap),
    startIndex: first * cols,
    endIndex: Math.min(count, last * cols),
    offsetY: first * pitch,
  };
}

import { useLayoutEffect, useRef, useState } from 'react';

// Window-scroll virtualization for a fixed-cell grid. The page scrolls normally
// (sticky header, URL-bar collapse and scroll restoration keep working); this hook
// only works out which rows are near the viewport so the caller can mount just
// those. All sizes are integer CSS px so canvases land on the device-pixel grid.
//
// Returns { containerRef, cols, totalHeight, startIndex, endIndex, offsetY, snapX, snapY }.
// Attach containerRef to a `position: relative` block whose height is totalHeight,
// and render items [startIndex, endIndex) in an inner grid translated by offsetY.
export function useWindowedGrid({ count, colWidth, gap, rowHeight, rowGap = gap, overscan = 3 }) {
  const containerRef = useRef(null);
  const [win, setWin] = useState({ cols: 3, first: 0, last: 12, snapX: 0, snapY: 0 });
  const pitch = rowHeight + rowGap;

  // Layout effect: the first compute runs before paint, so there is no flash of the
  // placeholder 3-column window.
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let raf = 0;
    const compute = () => {
      raf = 0;
      const cols = Math.max(1, Math.floor((el.clientWidth + gap) / (colWidth + gap)));
      const rows = Math.ceil(count / cols);
      const rect = el.getBoundingClientRect(); // viewport-relative
      const top = rect.top;
      // Snap to the device-pixel grid: containers can sit on a fractional position
      // (e.g. `.app` centred at x=74.5, fractional heights above the grid), which
      // makes sprite pixels uneven. Shift the inner grid back by the fractional
      // part, in CSS px, exact.
      const dpr = window.devicePixelRatio || 1;
      const snap = v => {
        const dev = v * dpr;
        const frac = dev - Math.floor(dev);
        // Layout positions are multiples of 1/64 px, so the shift is exact: do not
        // round it, or the snapped edge lands a hair off the pixel boundary.
        return frac < 1e-4 || frac > 1 - 1e-4 ? 0 : -frac / dpr;
      };
      const snapX = snap(rect.left);
      const snapY = snap(rect.top);
      const first = Math.min(rows, Math.max(0, Math.floor(-top / pitch) - overscan));
      const last = Math.min(rows, Math.max(first, Math.ceil((window.innerHeight - top) / pitch) + overscan));
      setWin(prev => (prev.cols === cols && prev.first === first && prev.last === last
        && prev.snapX === snapX && prev.snapY === snapY
        ? prev : { cols, first, last, snapX, snapY }));
    };
    const schedule = () => { if (!raf) raf = requestAnimationFrame(compute); };

    const ro = new ResizeObserver(schedule); // also fires once on observe()
    ro.observe(el);
    ro.observe(document.body); // content above the grid can move it without resizing it
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    compute();
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
    snapX: win.snapX,
    snapY: win.snapY,
  };
}

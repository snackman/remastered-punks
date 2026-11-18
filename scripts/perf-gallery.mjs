// Gallery / traits.html performance + rendering check (Playwright, Chromium).
//
//   node scripts/perf-gallery.mjs <baseUrl> [label]
//
// <baseUrl> is a running build of preview/remaster (e.g. `npm run preview`, a static
// server over dist/ with data/ copied in, or a Vercel preview URL). Needs the root
// `playwright` devDependency (and `npx playwright install chromium` once).
//
// Runs at 390x844 @ dpr 3 and 1280x800 @ dpr 1. Prints node/tile counts, FPS and
// long tasks while scrolling #gallery top-to-bottom, then checks deep links, chips,
// tap-target sizes, pixel solidity (integer scaling) and traits.html lazy drawing.
// Exits 1 if any PASS criterion fails (a baseline run on the old gallery will).
import { chromium } from 'playwright';

const base = (process.argv[2] || 'http://localhost:4173').replace(/\/$/, '');
const label = process.argv[3] || base;
const SCROLL_STEP = 600;
const SCROLL_BUDGET_MS = 60000;

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok });
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`);
}

const LONGTASK_INIT = () => {
  window.__longtasks = [];
  try {
    new PerformanceObserver(list => {
      for (const e of list.getEntries()) window.__longtasks.push({ start: e.startTime, dur: e.duration });
    }).observe({ type: 'longtask', buffered: true });
  } catch { /* longtask unsupported */ }
};

async function perfRun(browser, name, viewport, dpr) {
  console.log(`\n== ${name}: ${viewport.width}x${viewport.height} @ dpr ${dpr} ==`);
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: dpr });
  const page = await ctx.newPage();
  page.setDefaultTimeout(60000);
  await page.addInitScript(LONGTASK_INIT);
  await page.goto(`${base}/#gallery`);
  await page.waitForSelector('.gallery-tile canvas');
  const firstPaint = await page.evaluate(() => performance.now());
  await page.waitForTimeout(500);

  const nodes0 = await page.evaluate(() => document.querySelectorAll('*').length);
  const tiles0 = await page.evaluate(() => document.querySelectorAll('.gallery-tile').length);
  console.log(`  initial: ${nodes0} nodes, ${tiles0} tiles`);

  // Scroll to the bottom in steps with a rAF frame counter.
  await page.evaluate(() => {
    window.__frames = 0;
    const tick = () => { window.__frames++; window.__raf = requestAnimationFrame(tick); };
    window.__raf = requestAnimationFrame(tick);
  });
  await page.mouse.move(viewport.width / 2, viewport.height / 2);
  const t0 = Date.now();
  let maxNodes = nodes0, maxTiles = tiles0, steps = 0, timedOut = false;
  for (;;) {
    const atBottom = await page.evaluate(() => window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2);
    if (atBottom) break;
    if (Date.now() - t0 > SCROLL_BUDGET_MS) { timedOut = true; break; }
    await page.mouse.wheel(0, SCROLL_STEP);
    await page.waitForTimeout(16);
    steps++;
    if (steps % 10 === 0) {
      const s = await page.evaluate(() => [document.querySelectorAll('*').length, document.querySelectorAll('.gallery-tile').length]);
      maxNodes = Math.max(maxNodes, s[0]); maxTiles = Math.max(maxTiles, s[1]);
    }
  }
  const elapsed = (Date.now() - t0) / 1000;
  const frames = await page.evaluate(() => { cancelAnimationFrame(window.__raf); return window.__frames; });
  const fps = frames / elapsed;
  await page.waitForTimeout(400);
  const bottom = await page.evaluate(() => [document.querySelectorAll('*').length, document.querySelectorAll('.gallery-tile').length,
    document.querySelectorAll('.gallery-tile canvas').length]);
  maxNodes = Math.max(maxNodes, bottom[0]); maxTiles = Math.max(maxTiles, bottom[1]);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(400);
  const top = await page.evaluate(() => [document.querySelectorAll('*').length, document.querySelectorAll('.gallery-tile').length]);
  maxNodes = Math.max(maxNodes, top[0]); maxTiles = Math.max(maxTiles, top[1]);

  const lt = (await page.evaluate(() => window.__longtasks)).filter(t => t.start >= firstPaint);
  const maxLt = lt.reduce((m, t) => Math.max(m, t.dur), 0);
  console.log(`  scroll: ${steps} steps in ${elapsed.toFixed(1)}s${timedOut ? ' (TIMED OUT)' : ''}, avg ${fps.toFixed(1)} fps (rAF)`);
  console.log(`  long tasks after first paint: ${lt.length}, max ${maxLt.toFixed(0)}ms`);
  console.log(`  at bottom: ${bottom[0]} nodes, ${bottom[1]} tiles; peak ${maxNodes} nodes, ${maxTiles} tiles; back at top: ${top[0]} nodes`);

  check('finished scroll inside 60s', !timedOut);
  check('tiles <= 250', maxTiles <= 250, `(peak ${maxTiles})`);
  check('nodes < 4000', maxNodes < 4000, `(peak ${maxNodes})`);
  check('no long task > 200ms after first paint', maxLt <= 200, `(max ${maxLt.toFixed(0)}ms)`);
  if (dpr === 1) check('desktop fps >= 50', fps >= 50, `(${fps.toFixed(1)})`);

  // Pixel solidity + tap target sizes on the (scrolled-to-top) first tile.
  await page.waitForSelector('.gallery-tile canvas');
  const size = await page.evaluate(() => {
    const c = document.querySelector('.gallery-tile canvas');
    const r = c.getBoundingClientRect();
    const chips = [...document.querySelectorAll('.gallery-tile-trait, .gallery-tile-id')].slice(0, 40);
    return {
      w: r.width, h: r.height, bw: c.width,
      minH: Math.min(...chips.map(e => e.getBoundingClientRect().height)),
      minFont: Math.min(...[...chips, ...document.querySelectorAll('.gallery-tile-px')].map(e => parseFloat(getComputedStyle(e).fontSize))),
    };
  });
  console.log(`  canvas ${size.w}x${size.h} css px (backing ${size.bw}); min chip/id height ${size.minH}px; min font ${size.minFont}px`);
  check('tile canvas is an integer multiple of its backing store', Number.isInteger(size.w / size.bw) && size.w === size.h,
    `(${size.w}/${size.bw})`);
  check('chip/id tap targets >= 24px tall', size.minH >= 24, `(${size.minH})`);
  check('text >= 12px', size.minFont >= 12, `(${size.minFont})`);
  await solidity(browser, page, dpr);
  await ctx.close();
}

// Screenshot the first tile's canvas and verify every sprite pixel renders as one
// solid block of device pixels (no blended edges). Skips the 4 corner sprite pixels
// (the canvas has a 4px border-radius).
async function solidity(browser, page, dpr) {
  const canvasEl = page.locator('.gallery-tile canvas').first();
  await canvasEl.scrollIntoViewIfNeeded();
  const buf = await canvasEl.screenshot();
  const b64 = buf.toString('base64');
  const res = await page.evaluate(async ({ b64, dpr }) => {
    const img = new Image();
    img.src = 'data:image/png;base64,' + b64;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(img, 0, 0);
    const N = 24;
    const block = img.width / N;
    if (!Number.isInteger(block)) return { block, bad: -1 };
    const d = g.getImageData(0, 0, img.width, img.height).data;
    let bad = 0;
    for (let by = 0; by < N; by++) for (let bx = 0; bx < N; bx++) {
      if ((bx === 0 || bx === N - 1) && (by === 0 || by === N - 1)) continue;
      const first = ((by * block) * img.width + bx * block) * 4;
      let ok = true;
      for (let y = 0; y < block && ok; y++) for (let x = 0; x < block; x++) {
        const i = ((by * block + y) * img.width + bx * block + x) * 4;
        if (d[i] !== d[first] || d[i + 1] !== d[first + 1] || d[i + 2] !== d[first + 2] || d[i + 3] !== d[first + 3]) { ok = false; break; }
      }
      if (!ok) bad++;
    }
    return { block, bad, dpr };
  }, { b64, dpr });
  check(`pixel solidity (dpr ${dpr}, ${res.block} device px per sprite px)`, res.bad === 0, `(${res.bad} blended blocks)`);
}

async function deepLinks(browser) {
  console.log('\n== deep links / chips ==');
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(60000);

  // Expected count, computed independently of the app from the served data.
  const counts = await (await fetch(`${base}/data/remaster-pixel-counts.json`)).json();
  const csv = (await (await fetch(`${base}/data/punks-attributes/original/cryptopunks.csv`)).text()).trim().split(/\r?\n/).slice(1);
  const acc = new Map();
  for (const line of csv) {
    const m = line.match(/^(\d+),\s*\w+,\s*\w+,\s*\w*,\s*\d+,\s*(.*)$/);
    if (m) acc.set(+m[1], m[2].trim() ? m[2].split(' / ').map(s => s.trim()) : []);
  }
  const expected = counts.filter(c => c.pixels > 0 && (acc.get(c.id) || []).includes('Earring')).length;

  await page.goto(`${base}/?trait=Earring#gallery`);
  await page.waitForSelector('.gallery-tile canvas');
  const sub = await page.textContent('.gallery-sub');
  const n = parseInt(sub.replace(/,/g, '').match(/\d+/)[0], 10);
  check('?trait=Earring subtitle count matches data', n === expected, `(page ${n}, data ${expected})`);
  const firstChips = await page.$$eval('.gallery-tile:first-child .gallery-tile-trait', els => els.map(e => e.textContent));
  const firstTitles = await page.$$eval('.gallery-tile:first-child .gallery-tile-trait', els => els.map(e => e.title || e.textContent));
  check('first tile shows an Earring chip (or +N holding it)', firstChips.includes('Earring') || firstTitles.some(t => t.includes('Earring')),
    `(${firstChips.join(' | ')})`);

  // Click a chip -> ?trait=<chip>#gallery
  const chip = page.locator('.gallery-tile:first-child button.gallery-tile-trait').first();
  const chipName = (await chip.getAttribute('title')) || (await chip.textContent());
  await chip.click();
  await page.waitForFunction(() => location.search.startsWith('?trait='));
  const want = `?trait=${encodeURIComponent(chipName)}#gallery`;
  check('chip click -> ?trait=<chip>#gallery', (await page.evaluate(() => location.search + location.hash)) === want, `(${chipName})`);

  // Click an id -> ?punk=<id>#home
  const idLink = page.locator('.gallery-tile:first-child .gallery-tile-id').first();
  const idText = (await idLink.textContent()).replace('#', '');
  await idLink.click();
  await page.waitForFunction(() => location.search.startsWith('?punk='));
  check('id click -> ?punk=<id>#home', (await page.evaluate(() => location.search + location.hash)) === `?punk=${idText}#home`, `(#${idText})`);
  await ctx.close();
}

async function traitsPage(browser) {
  console.log('\n== traits.html lazy draw ==');
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(60000);
  const t0 = Date.now();
  await page.goto(`${base}/traits.html`);
  await page.waitForSelector('.trait-pixels');
  await page.waitForTimeout(800);
  const ms = Date.now() - t0;
  const s = await page.evaluate(() => ({
    total: document.querySelectorAll('.punk-box canvas:not(.labeled-sprite)').length,
    drawn: document.querySelectorAll('canvas[data-drawn]').length,
  }));
  console.log(`  ready in ${ms}ms; zoomed canvases: ${s.total}, drawn before scrolling: ${s.drawn}`);
  check('traits.html draws fewer canvases than exist before scrolling', s.total > 0 && s.drawn < s.total, `(${s.drawn}/${s.total})`);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(800);
  const after = await page.evaluate(() => document.querySelectorAll('canvas[data-drawn]').length);
  check('scrolling draws more canvases', after > s.drawn, `(${s.drawn} -> ${after})`);
  await ctx.close();
}

console.log(`perf-gallery: ${label}`);
// PW_CHROMIUM=/path/to/chrome-headless-shell overrides the bundled browser.
const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
try {
  await perfRun(browser, 'mobile', { width: 390, height: 844 }, 3);
  await perfRun(browser, 'desktop', { width: 1280, height: 800 }, 1);
  await deepLinks(browser);
  await traitsPage(browser);
} finally {
  await browser.close();
}
const failed = results.filter(r => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);

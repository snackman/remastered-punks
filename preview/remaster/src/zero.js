// Standalone review page: every remaster that changes 0 pixels vs the original
// (i.e. the reconstruction reproduces the original exactly, so nothing visibly
// changes). Uses the same shared compositor as the app.
import { SPRITE_SIZE } from '@lib/constants.js';
import { loadAssets, extractPunk } from './lib/sprites';
import { loadPunkData } from './lib/data';
import { compositePunk, getRemasters } from './lib/remaster';

const ZOOM = 5;

function drawTo(canvas, source) {
  canvas.width = SPRITE_SIZE * ZOOM;
  canvas.height = SPRITE_SIZE * ZOOM;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(source, 0, 0, SPRITE_SIZE, SPRITE_SIZE, 0, 0, SPRITE_SIZE * ZOOM, SPRITE_SIZE * ZOOM);
}

function card(punk) {
  const el = document.createElement('div');
  el.className = 'card';

  const pair = document.createElement('div');
  pair.className = 'pair';
  for (const [label, src] of [['Original', extractPunk(punk.id)], ['Remaster', compositePunk(punk, true)]]) {
    const fig = document.createElement('figure');
    const c = document.createElement('canvas');
    drawTo(c, src);
    const cap = document.createElement('figcaption');
    cap.textContent = label;
    fig.append(c, cap);
    pair.appendChild(fig);
  }
  el.appendChild(pair);

  const pid = document.createElement('a');
  pid.className = 'pid';
  pid.href = `/?punk=${punk.id}#home`;
  pid.textContent = `#${punk.id}`;
  el.appendChild(pid);

  const traits = document.createElement('div');
  traits.className = 'traits';
  traits.textContent = (punk.accessories || []).join(' · ') || '(none)';
  el.appendChild(traits);

  return el;
}

async function init() {
  const root = document.getElementById('root');
  const summary = document.getElementById('summary');
  try {
    const basePath = import.meta.env.DEV ? '../..' : '';
    await loadAssets(
      `${basePath}/data/cryptopunks-assets/punks/config/punks-24x24.png`,
      `${basePath}/data/punks.png`
    );
    const punkData = await loadPunkData(`${basePath}/data/punks-attributes/original/cryptopunks.csv`);
    const counts = await fetch(`${basePath}/data/remaster-pixel-counts.json`).then(r => r.json());

    const zero = counts.filter(c => c.pixels === 0).map(c => punkData[c.id]).filter(Boolean);

    // Group by the remaster type:trait so identical no-ops sit together.
    const groups = {};
    for (const p of zero) {
      const key = getRemasters(p).map(r => `${r.trait} (${r.type})`).join(' + ') || 'unknown';
      (groups[key] || (groups[key] = [])).push(p);
    }
    const ordered = Object.entries(groups).sort((a, b) => b[1].length - a[1].length);

    summary.textContent = `${zero.length} remasters change 0 pixels vs the original — the reconstruction reproduces the original exactly.`;
    root.innerHTML = '';
    for (const [key, punks] of ordered) {
      const h = document.createElement('h2');
      h.className = 'group-title';
      h.textContent = `${key} — ${punks.length}`;
      root.appendChild(h);
      const grid = document.createElement('div');
      grid.className = 'grid';
      punks.sort((a, b) => a.id - b.id).forEach(p => grid.appendChild(card(p)));
      root.appendChild(grid);
    }
  } catch (err) {
    console.error(err);
    root.innerHTML = `<p class="status" style="color:#c00">Error: ${err.message}</p>`;
  }
}

init();

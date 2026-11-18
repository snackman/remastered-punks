// Regression lock for the stacking compositor. No test framework: exits non-zero on failure.
//
//   node scripts/verify-render.mjs            # verify
//   node scripts/verify-render.mjs --update   # rewrite data/render-golden.json (after bumping RENDER_VERSION)
//
// Checks: (1) (6,12) head-outline audit vs canonical punks.png, (2) eligible set + merkle root
// unchanged, (3) layer-order artifact allowlists, (4) pixel counts json, (5) golden snapshot
// (any render change requires a RENDER_VERSION bump in lib/constants.js).
import { join } from 'path';
import { readFileSync, writeFileSync } from 'fs';
import { createHash } from 'crypto';
import { ROOT, canvasLib, viemLib } from './_deps.mjs';
import { createStackCompositor } from '../lib/stack-compositor.js';
import { getRemasters } from '../lib/remaster-logic.js';
import { RENDER_VERSION } from '../lib/constants.js';

const { loadImage, createCanvas } = canvasLib();
const { keccak256, encodePacked } = viemLib();
const update = process.argv.includes('--update');
const dataDir = join(ROOT, 'data');
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const BG = '#638596';

let failures = 0;
const fail = (msg) => { failures++; console.error('FAIL:', msg); };
const ok = (msg) => console.log('ok:', msg);
const expect = (cond, msg) => (cond ? ok(msg) : fail(msg));

// ---- Expected values (change only with an explicit decision) ----
const EXPECTED_ELIGIBLE = 3434;
const EXPECTED_ROOT = '0x9188c058fe5b7bbe641defd3a0444b4d475f8194ab77a9f36b5d424261dd1324';
// (6,12) matches vs canonical on eligible human females (D2 = keep dictated hair colour).
const EXPECTED_612_EAR = [2070, 2454];
const EXPECTED_612_ALL = [2144, 2553];
const SPOT_612_BLACK = [10, 277, 532, 790, 1052, 1427, 1616];
// Hair edits that deliberately paint (6,12), regular-shades remaster, female Big Shades edit.
const EDIT_612_HAIR = ['Crazy Hair', 'Wild Blonde', 'Clown Hair Green'];
// Non-eligible punks whose raw stack render still differs from canonical: id -> pixel count.
// 24 per-pixel layer conflicts (male Clown Hair Green + eyewear, Vampire Hair + Big Beard)
// and 13 frown-only punks (frown over a FROWN_REMASTER_BEARDS beard; not counted for eligibility, D1).
const NON_ELIGIBLE_ARTIFACTS = {
  403: 1, 1303: 1, 1851: 1, 2326: 3, 2763: 1, 2845: 2, 2961: 1, 3017: 1, 3208: 3, 3316: 3, 3852: 1,
  3910: 2, 3921: 3, 4113: 2, 4730: 1, 4862: 1, 5276: 1, 5423: 1, 5935: 1, 6443: 3, 6524: 1, 6724: 1,
  7099: 1, 7651: 1, 7740: 1, 7975: 2, 8041: 2, 8250: 2, 8661: 3, 8689: 1, 8700: 1, 8724: 1, 9005: 1,
  9254: 2, 9718: 2, 9968: 1, 9985: 1,
};
// Eligible punks whose raw render differs from canonical outside the remaster delta: the intended
// frown-over-beard remasters (raw also draws Frown over the beard).
const ELIGIBLE_FROWN_ARTIFACTS = {
  1702: 1, 1748: 1, 2718: 1, 3011: 1, 3305: 1, 3625: 1, 4371: 1, 4528: 1, 5098: 1, 5101: 1, 5548: 1,
  7270: 1, 7368: 1, 8120: 1, 8772: 1, 9090: 1,
};

// ---- Load ----
const sheet = await loadImage(join(dataDir, 'cryptopunks-assets', 'punks', 'config', 'punks-24x24.png'));
const csv = readFileSync(join(dataDir, 'punks-attributes', 'original', 'cryptopunks.csv'), 'utf8');
const punks = {};
for (const l of csv.trim().replace(/\r\n/g, '\n').split('\n').slice(1)) {
  const m = l.match(/^(\d+),\s*(\w+),\s*(\w+),\s*(\w*),\s*(\d+),\s*(.*)$/);
  if (m) punks[+m[1]] = { id: +m[1], type: m[2], gender: m[3], skinTone: m[4] || null, accessories: m[6].trim() ? m[6].split(' / ').map(a => a.trim()) : [] };
}
const { stackPunk } = createStackCompositor({ createCanvas: (w, h) => createCanvas(w, h), getSpriteSheet: () => sheet, punks });
const big = await loadImage(join(dataDir, 'punks.png'));
const sc = createCanvas(big.width, big.height);
const sx = sc.getContext('2d');
sx.fillStyle = BG; sx.fillRect(0, 0, big.width, big.height); sx.drawImage(big, 0, 0);
const BIG = sx.getImageData(0, 0, big.width, big.height).data;
const canon = (id) => {
  const o = new Uint8ClampedArray(24 * 24 * 4);
  const ox = (id % 100) * 24, oy = Math.floor(id / 100) * 24;
  for (let y = 0; y < 24; y++) for (let x = 0; x < 24; x++) for (let k = 0; k < 4; k++) o[(y * 24 + x) * 4 + k] = BIG[((oy + y) * big.width + ox + x) * 4 + k];
  return o;
};
const dat = (c) => c.getContext('2d').getImageData(0, 0, 24, 24).data;
const diffPx = (a, b) => { const r = []; for (let i = 0; i < a.length; i += 4) if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2]) r.push(i / 4); return r; };
const rgbaEq = (a, b) => { for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false; return true; };
const px = (d, x, y) => { const i = (y * 24 + x) * 4; return [d[i], d[i + 1], d[i + 2]]; };

const committedEligible = readJson(join(dataDir, 'all-eligible-punks.json'));
const eligSet = new Set(committedEligible);
console.log(`Rendering ${Object.keys(punks).length} punks (stack + raw)...`);
const stack = {}, raw = {}, eligNow = [];
for (const P of Object.values(punks)) {
  raw[P.id] = dat(stackPunk(P, { raw: true }));
  stack[P.id] = dat(stackPunk(P));
  if (!rgbaEq(raw[P.id], stack[P.id])) eligNow.push(P.id);
}
eligNow.sort((a, b) => a - b);

// ---- 2. Eligibility + merkle lock ----
{
  const same = eligNow.length === committedEligible.length && eligNow.every((id, i) => id === committedEligible[i]);
  expect(same, `eligible set recomputed (${eligNow.length}) equals data/all-eligible-punks.json (${committedEligible.length})`);
  expect(committedEligible.length === EXPECTED_ELIGIBLE, `eligible count is ${EXPECTED_ELIGIBLE}`);
  const leaves = committedEligible.map(id => keccak256(encodePacked(['uint256'], [BigInt(id)]))).sort((a, b) => (a < b ? -1 : 1));
  let level = leaves;
  while (level.length > 1) {
    const next = [];
    for (let i = 0; i < level.length; i += 2) {
      const l = level[i], r = level[i + 1] || l;
      const [a, b] = l < r ? [l, r] : [r, l];
      next.push(keccak256(encodePacked(['bytes32', 'bytes32'], [a, b])));
    }
    level = next;
  }
  const root = level[0];
  expect(root === EXPECTED_ROOT, `merkle root rebuilt in-process = ${root}`);
  expect(readJson(join(dataDir, 'merkle-tree.json')).merkleRoot === root, 'data/merkle-tree.json merkleRoot matches');
  const deploy = readFileSync(join(ROOT, 'contracts', 'script', 'Deploy.s.sol'), 'utf8');
  expect(deploy.includes(`MERKLE_ROOT = ${root}`), 'contracts/script/Deploy.s.sol MERKLE_ROOT matches');
}

// ---- 1. (6,12) audit over eligible human females ----
{
  const females = committedEligible.map(id => punks[id]).filter(P => P.type === 'Human' && P.gender === 'Female');
  expect(females.length === EXPECTED_612_ALL[1], `eligible human females = ${EXPECTED_612_ALL[1]} (got ${females.length})`);
  const EXPLAINED = (P, R) =>
    P.accessories.some(a => EDIT_612_HAIR.includes(a)) && R.some(r => r.type === 'ear') ||
    P.accessories.includes('Regular Shades') && R.some(r => r.type === 'shades') ||
    P.accessories.includes('Big Shades');
  let allMatch = 0, earN = 0, earMatch = 0, unexplained = [];
  for (const P of females) {
    const R = getRemasters(P);
    const ear = R.some(r => r.type === 'ear');
    const match = px(stack[P.id], 6, 12).join() === px(canon(P.id), 6, 12).join();
    if (ear) earN++;
    if (match) { allMatch++; if (ear) earMatch++; } else if (!EXPLAINED(P, R)) unexplained.push(P.id);
  }
  expect(unexplained.length === 0, `every (6,12) mismatch has an allowlisted cause${unexplained.length ? ' (unexplained: ' + unexplained.slice(0, 20).join(',') + ')' : ''}`);
  expect(earN === EXPECTED_612_EAR[1] && earMatch === EXPECTED_612_EAR[0], `(6,12) ear-remaster matches ${earMatch}/${earN} (expected ${EXPECTED_612_EAR.join('/')})`);
  expect(allMatch === EXPECTED_612_ALL[0], `(6,12) all eligible females match ${allMatch}/${females.length} (expected ${EXPECTED_612_ALL.join('/')})`);
  for (const id of SPOT_612_BLACK) expect(px(stack[id], 6, 12).join() === '0,0,0', `punk #${id} is black at (6,12)`);
}

// ---- 3. Artifact lock ----
{
  const got = {};
  for (const P of Object.values(punks)) {
    if (eligSet.has(P.id)) continue;
    const n = diffPx(raw[P.id], canon(P.id)).length;
    if (n) got[P.id] = n;
  }
  const eq = JSON.stringify(got) === JSON.stringify(NON_ELIGIBLE_ARTIFACTS);
  if (!eq) console.error('  non-eligible artifacts now:', JSON.stringify(got));
  expect(eq, `non-eligible raw-vs-canonical artifacts equal the allowlist (${Object.keys(NON_ELIGIBLE_ARTIFACTS).length} punks)`);

  const gotEl = {};
  for (const id of committedEligible) {
    const delta = new Set(diffPx(stack[id], raw[id]));
    const art = diffPx(raw[id], canon(id)).filter(p => !delta.has(p));
    if (art.length) gotEl[id] = art.length;
  }
  const eqEl = JSON.stringify(gotEl) === JSON.stringify(ELIGIBLE_FROWN_ARTIFACTS);
  if (!eqEl) console.error('  eligible artifacts now:', JSON.stringify(gotEl));
  expect(eqEl, `eligible artifacts outside the remaster delta are exactly the ${Object.keys(ELIGIBLE_FROWN_ARTIFACTS).length} frown remasters`);
}

// ---- 4. Pixel counts ----
{
  const counts = committedEligible.map(id => {
    const o = canon(id), r = stack[id];
    let pixels = 0;
    for (let i = 0; i < o.length; i += 4) if (o[i] !== r[i] || o[i + 1] !== r[i + 1] || o[i + 2] !== r[i + 2]) pixels++;
    return { id, pixels };
  }).sort((a, b) => b.pixels - a.pixels || a.id - b.id);
  const committed = readJson(join(dataDir, 'remaster-pixel-counts.json'));
  expect(JSON.stringify(counts) === JSON.stringify(committed), `data/remaster-pixel-counts.json matches recomputed counts (${counts.length})`);
}

// ---- 5. Golden snapshot ----
{
  const goldenPath = join(dataDir, 'render-golden.json');
  const hashes = {};
  for (const id of committedEligible) hashes[id] = createHash('sha256').update(stack[id]).digest('hex').slice(0, 16);
  if (update) {
    writeFileSync(goldenPath, JSON.stringify({ renderVersion: RENDER_VERSION, hashes }));
    ok(`wrote data/render-golden.json (renderVersion ${RENDER_VERSION}, ${committedEligible.length} hashes)`);
  } else {
    const g = readJson(goldenPath);
    const changed = Object.keys(hashes).filter(id => g.hashes[id] !== hashes[id]);
    if (changed.length) console.log(`render changed for ${changed.length} punks: ${changed.slice(0, 60).join(',')}${changed.length > 60 ? ',...' : ''}`);
    if (changed.length && g.renderVersion === RENDER_VERSION) fail(`renders changed without bumping RENDER_VERSION (still ${RENDER_VERSION}); bump lib/constants.js then run with --update`);
    else if (changed.length || g.renderVersion !== RENDER_VERSION) fail('RENDER_VERSION was bumped but golden is stale; run with --update');
    else ok(`golden snapshot matches (${committedEligible.length} punks, RENDER_VERSION ${RENDER_VERSION})`);
  }
}

console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll render checks passed');
process.exit(failures ? 1 : 0);

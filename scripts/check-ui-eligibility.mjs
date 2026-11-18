// Asserts the UI's eligibility logic agrees with the canonical eligible set,
// merkle proofs and gallery pixel counts, for all 10k punks. Node only, no canvas.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initEligibility, remasterState, buildBuckets } from '../preview/remaster/src/lib/eligibility.js';
import { remasterTraits } from '../lib/remaster-logic.js';
import { decodeCompact } from '../preview/remaster/src/lib/punkCodec.js';
import { buildPublicData } from './build-public-data.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const json = (p) => JSON.parse(read(p));

const punkData = {};
for (const line of read('data/punks-attributes/original/cryptopunks.csv').trim().replace(/\r\n/g, '\n').split('\n').slice(1)) {
  const m = line.trim().match(/^(\d+),\s*(\w+),\s*(\w+),\s*(\w*),\s*(\d+),\s*(.*)$/);
  if (!m) continue;
  const acc = m[6].trim();
  punkData[+m[1]] = { id: +m[1], type: m[2], gender: m[3], skinTone: m[4] || null, accessories: acc ? acc.split(' / ').map((a) => a.trim()) : [] };
}

const ids = json('data/all-eligible-punks.json').map(Number);
const eligibleSet = new Set(ids);
const proofs = json('data/merkle-tree.json').proofs || {};
const counts = json('data/remaster-pixel-counts.json');
initEligibility(ids);

const fails = [];
const fail = (m) => fails.push(m);
const sameSet = (a, b) => a.size === b.size && [...a].every((x) => b.has(x));

if (Object.keys(punkData).length !== 10000) fail(`expected 10000 punks, parsed ${Object.keys(punkData).length}`);

let mismatches = 0;
for (let id = 0; id < 10000; id++) {
  const e = eligibleSet.has(id);
  const s = remasterState(id, proofs[id], 'ready');
  if (s.showRemaster !== e || s.showMint !== e || s.eligible !== e || s.proofMissing || (!e && s.hasProof)) {
    mismatches++;
    fail(`state mismatch for #${id}`);
  }
}
if (!remasterState(13, undefined, 'loading').proofPending) fail('proofPending not set while loading');

const b = buildBuckets(ids, punkData, remasterTraits);
const inBuckets = new Set(Object.values(b.map).flat());
if (!sameSet(inBuckets, eligibleSet)) fail('bucket ids != eligible set');
const fallback = (b.map['Remaster'] || []).length;
if (fallback) fail(`${fallback} ids in fallback 'Remaster' bucket`);

if (!sameSet(new Set(Object.keys(proofs).map(Number)), eligibleSet)) fail('proof keys != eligible set');
// Public-data parity: the per-punk proof shards and compact punk file the browser fetches
// must reproduce the full merkle tree / CSV parse exactly.
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'public-data-'));
  try {
    const { proofs: n } = buildPublicData(tmp);
    if (n !== eligibleSet.size) fail(`${n} proof shards != ${eligibleSet.size} eligible`);
    const shardIds = fs.readdirSync(path.join(tmp, 'proofs')).map((f) => +f.replace('.json', ''));
    if (!sameSet(new Set(shardIds), eligibleSet)) fail('proof shard ids != eligible set');
    for (const id of shardIds) {
      const shard = JSON.parse(fs.readFileSync(path.join(tmp, 'proofs', `${id}.json`), 'utf8'));
      if (JSON.stringify(shard) !== JSON.stringify(proofs[id])) { fail(`proof shard #${id} != merkle-tree.json`); break; }
    }
    const compact = JSON.parse(fs.readFileSync(path.join(tmp, 'punks-compact.json'), 'utf8'));
    if (JSON.stringify(decodeCompact(compact)) !== JSON.stringify(punkData)) fail('punks-compact.json decodes != CSV parse');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}
const countIds = new Set(counts.filter((c) => c.pixels > 0).map((c) => c.id));
if (!sameSet(countIds, eligibleSet)) fail('pixel-count ids != eligible set');

for (const id of [13, 14, 22, 53, 641]) if (!eligibleSet.has(id)) fail(`#${id} should be eligible`);
for (const id of [65, 305, 573, 1303]) if (eligibleSet.has(id)) fail(`#${id} should not be eligible`);

console.log(`${eligibleSet.size} eligible, ${mismatches} mismatches, ${fallback} fallback bucket ids, ${b.keys.length} bucket keys`);
if (fails.length) { console.error(fails.slice(0, 20).join('\n')); process.exit(1); }
console.log('OK');

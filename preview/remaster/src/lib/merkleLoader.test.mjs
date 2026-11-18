import test from 'node:test';
import assert from 'node:assert/strict';
import { createProofLoader, proofFetcher } from './merkleLoader.js';

const ok = (body) => ({ ok: true, status: 200, json: async () => body });

test('loads and caches a proof per id', async () => {
  let calls = 0;
  const f = proofFetcher(async (u) => { calls++; return ok(['0xaa', '0xbb']); }, (id) => `/data/proofs/${id}.json`);
  const load = createProofLoader(f);
  assert.deepEqual(await load(13), ['0xaa', '0xbb']);
  assert.deepEqual(await load(13), ['0xaa', '0xbb']);
  assert.equal(calls, 1);
  await load(14);
  assert.equal(calls, 2);
});

test('requests the per-punk URL', async () => {
  const seen = [];
  const load = createProofLoader(proofFetcher(async (u) => { seen.push(u); return ok(['0x1']); }, (id) => `/data/proofs/${id}.json?v=x`));
  await load(7);
  assert.deepEqual(seen, ['/data/proofs/7.json?v=x']);
});

test('HTTP error rejects (-> status "error") and is retried next time', async () => {
  let n = 0;
  const load = createProofLoader(proofFetcher(
    async () => (++n === 1 ? { ok: false, status: 404 } : ok(['0x1'])),
    (id) => `/p/${id}`,
  ));
  await assert.rejects(load(5), /HTTP 404/);
  assert.deepEqual(await load(5), ['0x1']);
});

test('malformed payload rejects', async () => {
  const load = createProofLoader(proofFetcher(async () => ok({ nope: 1 }), (id) => `/p/${id}`));
  await assert.rejects(load(1), /bad proof payload/);
});

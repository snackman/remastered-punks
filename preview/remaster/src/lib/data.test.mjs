import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parsePunkCsv, encodeCompact, decodeCompact } from './punkCodec.js';

const csv = fs.readFileSync(
  fileURLToPath(new URL('../../../../data/punks-attributes/original/cryptopunks.csv', import.meta.url)),
  'utf8',
);

test('compact punk data decodes to exactly the CSV parse (all punks)', () => {
  const fromCsv = parsePunkCsv(csv);
  assert.equal(Object.keys(fromCsv).length, 10000);
  const compact = JSON.parse(JSON.stringify(encodeCompact(fromCsv))); // through JSON like the wire
  assert.deepEqual(decodeCompact(compact), fromCsv);
});

test('compact encoding is small and interned', () => {
  const c = encodeCompact(parsePunkCsv(csv));
  assert.ok(c.bases.length < 50);
  assert.ok(JSON.stringify(c).length < 200_000);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { parseUrl, buildUrl } from './urlState.js';

test('buildUrl drops stale trait/punk when switching to wallet', () => {
  assert.equal(buildUrl({ pathname: '/', search: '?trait=Cap&punk=3', tab: 'wallet' }), '/#wallet');
});
test('buildUrl encodes trait for gallery', () => {
  assert.equal(
    buildUrl({ pathname: '/', search: '', tab: 'gallery', trait: 'Clown Hair Green' }),
    '/?trait=Clown+Hair+Green#gallery',
  );
});
test('buildUrl only keeps punk on home', () => {
  assert.equal(buildUrl({ pathname: '/', tab: 'home', punk: 42 }), '/?punk=42#home');
  assert.equal(buildUrl({ pathname: '/', tab: 'lookup', punk: 42 }), '/#lookup');
});
test('buildUrl keepDev preserves as param', () => {
  assert.equal(buildUrl({ pathname: '/', search: '?as=0xabc&trait=x', tab: 'wallet', keepDev: true }), '/?as=0xabc#wallet');
  assert.equal(buildUrl({ pathname: '/', search: '?as=0xabc', tab: 'wallet' }), '/#wallet');
});
test('parseUrl falls back to home on garbage hash', () => {
  assert.equal(parseUrl({ search: '', hash: '#nonsense' }).tab, 'home');
  assert.equal(parseUrl({ search: '', hash: '' }).tab, 'home');
});
test('parseUrl rejects non-integer punk', () => {
  assert.equal(parseUrl({ search: '?punk=12.7', hash: '#home' }).punk, null);
  assert.equal(parseUrl({ search: '?punk=12', hash: '#home' }).punk, 12);
});
test('parseUrl trait only on gallery', () => {
  assert.equal(parseUrl({ search: '?trait=Cap', hash: '#gallery' }).trait, 'Cap');
  assert.equal(parseUrl({ search: '?trait=Cap', hash: '#wallet' }).trait, null);
});

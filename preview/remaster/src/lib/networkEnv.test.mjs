import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateNetworkEnv,
  SEPOLIA_REMASTERED_PUNKS,
  SEPOLIA_CRYPTOPUNKS_MOCK,
} from './networkEnv.js';

// Real mainnet CryptoPunks address: valid checksum, not a Sepolia address.
const GOOD_ADDR = '0xb47e3cd837dDF8e4c57F05d70Ab865de6e193BBB';
const GOOD_RPC = 'https://eth.llamarpc.com';
const mainnet = (extra = {}) => ({
  VITE_NETWORK: 'mainnet',
  VITE_REMASTERED_PUNKS_MAINNET: GOOD_ADDR,
  VITE_MAINNET_RPC_URL: GOOD_RPC,
  ...extra,
});

test('unset is ok (sepolia default)', () => {
  assert.deepEqual(validateNetworkEnv({}, {}), []);
});

test('explicit sepolia is ok, also on Vercel production', () => {
  assert.deepEqual(validateNetworkEnv({ VITE_NETWORK: 'sepolia' }, {}), []);
  assert.deepEqual(validateNetworkEnv({ VITE_NETWORK: 'sepolia' }, { vercelEnv: 'production' }), []);
});

test('VERCEL_ENV=production with unset VITE_NETWORK errors', () => {
  assert.equal(validateNetworkEnv({}, { vercelEnv: 'production' }).length, 1);
});

test('VERCEL_ENV=preview with unset is ok', () => {
  assert.deepEqual(validateNetworkEnv({}, { vercelEnv: 'preview' }), []);
});

test('bad VITE_NETWORK value errors', () => {
  assert.equal(validateNetworkEnv({ VITE_NETWORK: 'goerli' }, {}).length, 1);
});

test('mainnet + missing address and RPC reports both', () => {
  assert.equal(validateNetworkEnv({ VITE_NETWORK: 'mainnet' }, {}).length, 2);
});

test('mainnet + zero address errors', () => {
  const errs = validateNetworkEnv(
    mainnet({ VITE_REMASTERED_PUNKS_MAINNET: '0x0000000000000000000000000000000000000000' }), {});
  assert.equal(errs.length, 1);
});

test('mainnet + Sepolia addresses error', () => {
  for (const a of [SEPOLIA_REMASTERED_PUNKS, SEPOLIA_CRYPTOPUNKS_MOCK]) {
    assert.equal(validateNetworkEnv(mainnet({ VITE_REMASTERED_PUNKS_MAINNET: a }), {}).length, 1);
  }
});

test('mainnet + bad-checksum address errors', () => {
  const bad = GOOD_ADDR.replace('dDF8', 'ddf8');
  assert.notEqual(bad, GOOD_ADDR);
  assert.equal(validateNetworkEnv(mainnet({ VITE_REMASTERED_PUNKS_MAINNET: bad }), {}).length, 1);
});

test('mainnet + http:// RPC errors', () => {
  assert.equal(validateNetworkEnv(mainnet({ VITE_MAINNET_RPC_URL: 'http://x.example' }), {}).length, 1);
});

test('mainnet + valid is ok', () => {
  assert.deepEqual(validateNetworkEnv(mainnet(), { vercelEnv: 'production' }), []);
});

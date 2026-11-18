import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  encodeErrorResult, decodeErrorResult,
  ContractFunctionRevertedError, ContractFunctionExecutionError, UserRejectedRequestError, BaseError,
} from 'viem';
import { describeTxError } from './mintErrors.js';

// contracts.js reads import.meta.env (Vite), so pull its error entries out of the source text.
const src = readFileSync(new URL('./contracts.js', import.meta.url), 'utf8');
const names = [...src.matchAll(/type: 'error', name: '(\w+)'/g)].map((m) => m[1]);
const abi = names.map((name) => ({ type: 'error', name, inputs: [] }));

test('all six contract errors present and round-trip', () => {
  assert.deepEqual([...names].sort(), ['AlreadyActivated', 'AlreadySynced', 'NotActivated', 'NotEligible', 'NotPunkOwner', 'TransferDisabled']);
  for (const errorName of names) {
    const data = encodeErrorResult({ abi, errorName });
    assert.equal(decodeErrorResult({ abi, data }).errorName, errorName);
  }
});

const wrap = (errorName) => {
  const data = encodeErrorResult({ abi, errorName });
  const reverted = new ContractFunctionRevertedError({ abi, data, functionName: 'activate' });
  return new ContractFunctionExecutionError(reverted, { abi, functionName: 'activate' });
};

test('revert maps to readable message', () => {
  assert.deepEqual(describeTxError(wrap('NotPunkOwner')), { kind: 'revert', errorName: 'NotPunkOwner', message: "You don't own this punk" });
  assert.equal(describeTxError(wrap('AlreadyActivated')).message, 'Already minted');
  assert.equal(describeTxError(wrap('NotEligible')).message, 'This punk is not eligible');
  assert.equal(describeTxError(wrap('AlreadySynced')).message, 'Already in sync');
});

test('user rejection maps to cancelled', () => {
  const rej = new UserRejectedRequestError(new Error('no'));
  assert.equal(describeTxError(rej).kind, 'cancelled');
  assert.equal(describeTxError(new ContractFunctionExecutionError(rej, { abi, functionName: 'activate' })).kind, 'cancelled');
  assert.equal(describeTxError({ code: 4001 }).kind, 'cancelled');
});

test('unknown errors are generic', () => {
  assert.equal(describeTxError(new BaseError('boom')).kind, 'other');
  assert.equal(describeTxError(new Error('multi\nline')).message, 'Something went wrong');
});

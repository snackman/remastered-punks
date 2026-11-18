import { BaseError, ContractFunctionRevertedError, UserRejectedRequestError } from 'viem';

const MESSAGES = {
  NotPunkOwner: "You don't own this punk",
  AlreadyActivated: 'Already minted',
  NotEligible: 'This punk is not eligible',
  NotActivated: 'Not minted yet',
  AlreadySynced: 'Already in sync',
  TransferDisabled: 'Transfers are disabled',
};

// Wallets wrap rejections differently (EIP-1193 4001, MetaMask/Ledger -32603 + originalError,
// WalletConnect plain-text errors), so check codes and messages along the cause chain.
const REJECT_RE = /user (rejected|denied)|cancel/i;
const isRejection = (e) =>
  e instanceof UserRejectedRequestError || e?.code === 4001 || e?.data?.originalError?.code === 4001
  || REJECT_RE.test(e?.details ?? '') || REJECT_RE.test(e?.message ?? '');

export const REVERTED = { kind: 'revert', message: 'Transaction reverted' };

// Turn a wagmi/viem error into { kind: 'cancelled' | 'revert' | 'other', errorName?, message }.
// Never returns raw err.message (multi-line, includes RPC detail).
export function describeTxError(err) {
  if (!err) return null;
  if (err instanceof BaseError) {
    const rejected = err.walk(isRejection);
    if (rejected) return { kind: 'cancelled', message: 'Transaction cancelled' };
    const reverted = err.walk((e) => e instanceof ContractFunctionRevertedError);
    const errorName = reverted?.data?.errorName;
    if (errorName) return { kind: 'revert', errorName, message: MESSAGES[errorName] ?? errorName };
  } else if (isRejection(err)) {
    return { kind: 'cancelled', message: 'Transaction cancelled' };
  }
  return { kind: 'other', message: err.shortMessage?.split('\n')[0] ?? 'Something went wrong' };
}

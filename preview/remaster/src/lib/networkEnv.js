// Pure network-config validation. No import.meta, no browser APIs, so it can be
// imported by vite.config.js (Node) and by the node:test file.
import { isAddress, getAddress } from 'viem';

export const SEPOLIA_REMASTERED_PUNKS = '0x7bfc1458fD8BC7D176b2D3B8020f07C335fe117B'; // merkle root 0x9188c0… (3434), contractURI + syncOwnership
export const SEPOLIA_CRYPTOPUNKS_MOCK = '0x6fCdfA445bF2752D4F38AB67F08c7eEDEfEaAed8'; // Mock

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

// Returns an array of error strings (empty = ok).
// env: object with VITE_* keys. vercelEnv: process.env.VERCEL_ENV (or undefined).
export function validateNetworkEnv(env = {}, { vercelEnv } = {}) {
  const errors = [];
  const network = env.VITE_NETWORK;

  if (vercelEnv === 'production' && !network) {
    errors.push(
      'VITE_NETWORK must be set explicitly on Vercel Production (sepolia or mainnet); refusing to silently default.'
    );
  }

  if (network && network !== 'sepolia' && network !== 'mainnet') {
    errors.push(`VITE_NETWORK must be "sepolia" or "mainnet" (got "${network}").`);
    return errors;
  }

  if (network === 'mainnet') {
    const addr = env.VITE_REMASTERED_PUNKS_MAINNET;
    if (!addr) {
      errors.push('VITE_REMASTERED_PUNKS_MAINNET is required in mainnet mode.');
    } else if (!isAddress(addr, { strict: true }) || addr !== getAddress(addr)) {
      errors.push('VITE_REMASTERED_PUNKS_MAINNET is not a valid checksummed address.');
    } else if (addr.toLowerCase() === ZERO_ADDRESS) {
      errors.push('VITE_REMASTERED_PUNKS_MAINNET must not be the zero address.');
    } else if (
      addr.toLowerCase() === SEPOLIA_REMASTERED_PUNKS.toLowerCase() ||
      addr.toLowerCase() === SEPOLIA_CRYPTOPUNKS_MOCK.toLowerCase()
    ) {
      errors.push('VITE_REMASTERED_PUNKS_MAINNET must not be a Sepolia address.');
    }

    const rpc = env.VITE_MAINNET_RPC_URL;
    if (!rpc) {
      errors.push('VITE_MAINNET_RPC_URL is required in mainnet mode.');
    } else if (!rpc.startsWith('https://')) {
      errors.push('VITE_MAINNET_RPC_URL must start with https://.');
    }
  }

  return errors;
}

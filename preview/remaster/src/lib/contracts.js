import { IS_MAINNET, SUPPORTED_CHAIN_IDS } from './network';
import { SEPOLIA_REMASTERED_PUNKS, SEPOLIA_CRYPTOPUNKS_MOCK } from './networkEnv';

// Contract addresses
export const CONTRACTS = {
  // Sepolia testnet
  // Nulled in mainnet mode so the Sepolia addresses are tree-shaken out of mainnet bundles.
  sepolia: IS_MAINNET
    ? { remasteredPunks: null, cryptoPunks: null }
    : {
        remasteredPunks: SEPOLIA_REMASTERED_PUNKS,
        cryptoPunks: SEPOLIA_CRYPTOPUNKS_MOCK, // Mock
      },
  // Mainnet: address comes from VITE_REMASTERED_PUNKS_MAINNET (validated at build time),
  // and only in mainnet mode. In sepolia mode it stays null ("Minting Soon").
  mainnet: {
    remasteredPunks: IS_MAINNET ? import.meta.env.VITE_REMASTERED_PUNKS_MAINNET : null,
    cryptoPunks: '0xb47e3cd837dDF8e4c57F05d70Ab865de6e193BBB',
  },
};

// RemasteredPunks ABI (only the functions we need)
export const REMASTERED_PUNKS_ABI = [
  {
    name: 'activate',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'punkId', type: 'uint256' },
      { name: 'merkleProof', type: 'bytes32[]' },
    ],
    outputs: [],
  },
  {
    name: 'deactivate',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'punkId', type: 'uint256' }],
    outputs: [],
  },
  {
    name: 'activated',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'ownerOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    name: 'totalSupply',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
];

// CryptoPunks ABI. The real mainnet contract has the same punkIndexToAddress signature as the
// Sepolia mock; claimPunk exists on the mock only.
export const CRYPTOPUNKS_ABI = [
  {
    name: 'punkIndexToAddress',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'punkIndex', type: 'uint256' }],
    outputs: [{ name: '', type: 'address' }],
  },
];

// Mock CryptoPunks ABI (testnet only - for claiming punks)
export const MOCK_CRYPTOPUNKS_ABI = [
  {
    name: 'claimPunk',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'punkId', type: 'uint256' }],
    outputs: [],
  },
  ...CRYPTOPUNKS_ABI,
];

// Get contract address for a chain. Only chains this build supports return an address.
export function getContractAddress(chainId) {
  if (!SUPPORTED_CHAIN_IDS.includes(chainId)) return null;
  if (chainId === 11155111) return CONTRACTS.sepolia.remasteredPunks;
  if (chainId === 1) return CONTRACTS.mainnet.remasteredPunks;
  return null;
}

// Get CryptoPunks address: the mock on Sepolia (sepolia mode only), the real contract on mainnet.
export function getCryptoPunksAddress(chainId) {
  if (!SUPPORTED_CHAIN_IDS.includes(chainId)) return null;
  if (chainId === 11155111) return CONTRACTS.sepolia.cryptoPunks;
  if (chainId === 1) return CONTRACTS.mainnet.cryptoPunks;
  return null;
}

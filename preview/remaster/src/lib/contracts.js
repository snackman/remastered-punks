// Contract addresses
export const CONTRACTS = {
  // Sepolia testnet
  sepolia: {
    remasteredPunks: '0x5Ac5eC4d2b0107F3521084045fe401E3366Cd62F',
    cryptoPunks: '0x6fCdfA445bF2752D4F38AB67F08c7eEDEfEaAed8', // Mock
  },
  // Mainnet (to be deployed)
  mainnet: {
    remasteredPunks: null,
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

// Get contract address for current chain
export function getContractAddress(chainId) {
  if (chainId === 11155111) {
    return CONTRACTS.sepolia.remasteredPunks;
  }
  if (chainId === 1) {
    return CONTRACTS.mainnet.remasteredPunks;
  }
  return null;
}

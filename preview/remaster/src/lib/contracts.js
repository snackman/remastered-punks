// Contract addresses
export const CONTRACTS = {
  // Sepolia testnet
  sepolia: {
    remasteredPunks: '0x7bfc1458fD8BC7D176b2D3B8020f07C335fe117B', // merkle root 0x9188c0… (3434), contractURI + syncOwnership
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

// Mock CryptoPunks ABI (testnet only - for claiming punks)
export const MOCK_CRYPTOPUNKS_ABI = [
  {
    name: 'claimPunk',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'punkId', type: 'uint256' }],
    outputs: [],
  },
  {
    name: 'punkIndexToAddress',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'punkIndex', type: 'uint256' }],
    outputs: [{ name: '', type: 'address' }],
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

// Get mock CryptoPunks address (testnet only)
export function getCryptoPunksAddress(chainId) {
  if (chainId === 11155111) {
    return CONTRACTS.sepolia.cryptoPunks;
  }
  return null;
}

// Dependency-free network flags for the app shell (header, footer). Importing wagmi,
// viem or RainbowKit from here would drag the wallet stack into the first load: that
// all lives in src/wallet/* (lazy) and network.js.
import { SEPOLIA_REMASTERED_PUNKS } from './netAddresses';

// Direct comparison on import.meta.env so the bundler can drop Sepolia-only code in mainnet builds.
export const IS_MAINNET = import.meta.env.VITE_NETWORK === 'mainnet';

// Same values as network.js TARGET_CHAIN / contracts.js getContractAddress(TARGET_CHAIN.id).
export const TARGET_CHAIN_ID = IS_MAINNET ? 1 : 11155111;
export const TARGET_EXPLORER = IS_MAINNET ? 'https://etherscan.io' : 'https://sepolia.etherscan.io';
// null in sepolia mode when unset; in mainnet mode the validated build-time address.
export const TARGET_CONTRACT = IS_MAINNET
  ? (import.meta.env.VITE_REMASTERED_PUNKS_MAINNET || null)
  : SEPOLIA_REMASTERED_PUNKS;

// Single source of truth for which network the app targets.
// Set at build time via VITE_NETWORK ('sepolia' default, or 'mainnet').
// Validated in vite.config.js (see networkEnv.js).
import { fallback, http } from 'viem';
import { mainnet, sepolia } from 'wagmi/chains';
import { getDefaultConfig } from '@rainbow-me/rainbowkit';

// Direct comparison on import.meta.env so the bundler can drop Sepolia-only code in mainnet builds.
export const IS_MAINNET = import.meta.env.VITE_NETWORK === 'mainnet';
export const NETWORK = IS_MAINNET ? 'mainnet' : 'sepolia';

// The chain mint, reads and "switch to" point at.
export const TARGET_CHAIN = IS_MAINNET ? mainnet : sepolia;

// Same order as before in sepolia mode (mainnet first), so default/initial chain is unchanged.
export const CHAINS = IS_MAINNET ? [mainnet] : [mainnet, sepolia];
export const SUPPORTED_CHAIN_IDS = CHAINS.map((c) => c.id);

const MAINNET_RPC = import.meta.env.VITE_MAINNET_RPC_URL;
const SEPOLIA_RPC = import.meta.env.VITE_SEPOLIA_RPC_URL;

// Dedicated RPC first, then public RPCs that accept large eth_calls. No JSON-RPC batching:
// it would merge the owned-punks multicall chunks back into one oversized POST.
// viem's default mainnet RPC (eth.merkle.io) is Cloudflare-challenged, so don't rely on http().
const mainnetTransport = fallback([
  ...(MAINNET_RPC ? [http(MAINNET_RPC)] : []),
  http('https://ethereum-rpc.publicnode.com'),
  http('https://eth.drpc.org'),
]);

export const TRANSPORTS = {
  [mainnet.id]: mainnetTransport,
  ...(IS_MAINNET ? {} : { [sepolia.id]: SEPOLIA_RPC ? http(SEPOLIA_RPC) : http() }),
};

const WALLETCONNECT_PROJECT_ID =
  import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || 'c490ddb4e12e01e9e541522b7cde7452';

export const wagmiConfig = getDefaultConfig({
  appName: 'Remastered Punks',
  projectId: WALLETCONNECT_PROJECT_ID,
  chains: CHAINS,
  transports: TRANSPORTS,
  batch: { multicall: true },
  ssr: false,
});

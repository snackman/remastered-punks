import { useAccount } from 'wagmi';
import { sepolia } from 'wagmi/chains';
import { IS_MAINNET, TARGET_CHAIN, SUPPORTED_CHAIN_IDS } from './network';
import { getContractAddress, getCryptoPunksAddress } from './contracts';

// The wallet's REAL chain (useAccount().chainId), not wagmi's last configured chain
// (useChainId()), which sticks to a configured chain when the wallet is on e.g. Polygon.
// chainId is undefined while disconnected.
export function useNetwork() {
  const { chainId, isConnected } = useAccount();
  return {
    chainId,
    isConnected,
    isSupported: chainId !== undefined && SUPPORTED_CHAIN_IDS.includes(chainId),
    isTarget: chainId === TARGET_CHAIN.id,
    isTestnet: !IS_MAINNET && chainId === sepolia.id,
    contractAddress: getContractAddress(chainId),
    cryptoPunksAddress: getCryptoPunksAddress(chainId),
    targetChain: TARGET_CHAIN,
  };
}

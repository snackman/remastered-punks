import { useAccount } from 'wagmi';
import { sepolia } from 'wagmi/chains';
import { IS_MAINNET, TARGET_CHAIN, SUPPORTED_CHAIN_IDS } from './network';
import { getContractAddress, getCryptoPunksAddress } from './contracts';

// The wallet's REAL chain (useAccount().chainId), not wagmi's last configured chain
// (useChainId()), which sticks to a configured chain when the wallet is on e.g. Polygon.
// chainId is undefined while disconnected.
export function useNetwork() {
  const { chainId, isConnected } = useAccount();
  const contractAddress = getContractAddress(chainId);
  return {
    chainId,
    isConnected,
    isSupported: chainId !== undefined && SUPPORTED_CHAIN_IDS.includes(chainId),
    isTarget: chainId === TARGET_CHAIN.id,
    isTestnet: !IS_MAINNET && chainId === sepolia.id,
    contractAddress, // for minting: only set when the wallet is on a supported chain
    // For read-only queries (e.g. `activated`): in mainnet mode independent of the wallet chain, so
    // disconnected / wrong-chain visitors still see minted state. Sepolia mode is unchanged.
    readAddress: IS_MAINNET ? getContractAddress(TARGET_CHAIN.id) : contractAddress,
    cryptoPunksAddress: getCryptoPunksAddress(chainId),
    targetChain: TARGET_CHAIN,
  };
}

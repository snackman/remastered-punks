import { useState, useMemo } from 'react';
import { useReadContracts, usePublicClient } from 'wagmi';
import { useQuery } from '@tanstack/react-query';
import { isAddress } from 'viem';
import { mainnet } from 'wagmi/chains';
import { TARGET_CHAIN } from '../lib/network';
import { useNetwork } from '../lib/useNetwork';
import { fetchOwnedEligiblePunks, PUNK_WRAPPERS } from '../lib/ownedPunks';
import { REMASTERED_PUNKS_ABI, getCryptoPunksAddress } from '../lib/contracts';
import PunkCard from './PunkCard';

// Dev only: ?as=0x... views another wallet's punks read-only (Mint will not work for them).
function useViewAs(address) {
  if (!import.meta.env.DEV) return address;
  const as = new URLSearchParams(window.location.search).get('as');
  return as && isAddress(as) ? as : address;
}

function PunkGrid({ address: connectedAddress, punkData, eligiblePunks }) {
  const [filter, setFilter] = useState('all'); // 'all' or 'unminted'
  const address = useViewAs(connectedAddress);

  const { isTestnet, readAddress } = useNetwork();

  // Which punks contract to read: the Sepolia mock when the wallet is on Sepolia (sepolia builds),
  // otherwise the real CryptoPunks on mainnet. Independent of the wallet chain otherwise, so a
  // wallet on an unsupported chain still sees its mainnet punks.
  const source = isTestnet
    ? { chainId: TARGET_CHAIN.id, address: getCryptoPunksAddress(TARGET_CHAIN.id), wrappers: [] }
    : { chainId: mainnet.id, address: getCryptoPunksAddress(mainnet.id), wrappers: PUNK_WRAPPERS };
  const client = usePublicClient({ chainId: source.chainId });

  const eligibleIds = useMemo(
    () => eligiblePunks.filter((id) => punkData[id]),
    [eligiblePunks, punkData],
  );

  // Keyed by [chain, address]: a slow response for a previous account can't overwrite the current one.
  const { data, isPending, error, refetch, isFetching } = useQuery({
    queryKey: ['ownedEligiblePunks', source.chainId, address?.toLowerCase(), eligibleIds.length],
    queryFn: () => fetchOwnedEligiblePunks({
      client,
      punksAddress: source.address,
      owner: address,
      eligibleIds,
      wrappers: source.wrappers,
    }),
    enabled: !!address && !!client && !!source.address && eligibleIds.length > 0,
    staleTime: 60_000,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  // Only eligible punks are shown: those are the ones that can mint.
  const ownedPunks = useMemo(
    () => (data?.owned ?? []).map((id) => ({ ...punkData[id], isEligible: true })),
    [data, punkData],
  );
  const wrapped = data?.wrapped ?? [];

  // Of those, how many have actually been remastered (minted/activated on-chain).
  const { data: activatedResults } = useReadContracts({
    contracts: ownedPunks.map(p => ({
      address: readAddress,
      abi: REMASTERED_PUNKS_ABI,
      functionName: 'activated',
      args: [BigInt(p.id)],
      chainId: TARGET_CHAIN.id,
    })),
    query: { enabled: !!readAddress && ownedPunks.length > 0 },
  });
  const remasteredCount = activatedResults
    ? activatedResults.filter(r => r?.result === true).length
    : 0;

  const wrappedNotice = wrapped.length > 0 && (
    <div className="wrapped-notice">
      <p>
        {wrapped.length} of your eligible punk{wrapped.length !== 1 ? 's are' : ' is'} wrapped (
        {wrapped.map((w) => `#${w.id}`).join(', ')}). Unwrap {wrapped.length !== 1 ? 'them' : 'it'} at{' '}
        <a href="https://cryptopunks.app" target="_blank" rel="noopener noreferrer">cryptopunks.app</a> to mint.
      </p>
    </div>
  );

  if (error) {
    return (
      <div className="error">
        <p>Couldn&apos;t read punk ownership{isTestnet ? ' (testnet)' : ' from Ethereum'}. {error.shortMessage ?? error.message}</p>
        <button onClick={() => refetch()} disabled={isFetching}>Retry</button>
      </div>
    );
  }

  if (isPending) {
    return (
      <div className="loading">
        <p>Checking which eligible punks this wallet owns{isTestnet ? ' (testnet)' : ''}...</p>
      </div>
    );
  }

  const filteredPunks = filter === 'unminted'
    ? ownedPunks.filter((_, i) => activatedResults?.[i]?.result !== true)
    : ownedPunks;

  if (ownedPunks.length === 0) {
    return (
      <div className="no-punks">
        <p>None of this wallet&apos;s punks have a remaster.</p>
        {wrappedNotice}
      </div>
    );
  }

  return (
    <div className="punk-grid-container">
      <div className="grid-header">
        <div className="stats">
          <span>{ownedPunks.length} eligible punk{ownedPunks.length !== 1 ? 's' : ''}</span>
          <span className="divider">|</span>
          <span>{remasteredCount} remastered</span>
        </div>
        <div className="filter-buttons">
          <button
            className={filter === 'all' ? 'active' : ''}
            onClick={() => setFilter('all')}
          >
            All
          </button>
          <button
            className={filter === 'unminted' ? 'active' : ''}
            onClick={() => setFilter('unminted')}
          >
            Not minted
          </button>
        </div>
      </div>

      <p className="grid-note">Only punks with a remaster are shown. Look up any punk in Lookup.</p>
      {wrappedNotice}

      <div className="punk-grid">
        {filteredPunks.map(punk => (
          <PunkCard key={punk.id} punk={punk} />
        ))}
      </div>

      {filteredPunks.length === 0 && filter === 'unminted' && (
        <div className="no-results">
          <p>All of your eligible punks are already minted.</p>
        </div>
      )}
    </div>
  );
}

export default PunkGrid;

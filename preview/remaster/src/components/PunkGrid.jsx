import { useState, useEffect } from 'react';
import { useReadContracts } from 'wagmi';
import { CRYPTOPUNKS_ADDRESS } from '../lib/constants';
import { hasRemasters } from '../lib/remaster';
import PunkCard from './PunkCard';

// CryptoPunks ABI - just the function we need
const PUNKS_ABI = [
  {
    name: 'punkIndexToAddress',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'punkIndex', type: 'uint256' }],
    outputs: [{ name: '', type: 'address' }],
  },
];

function PunkGrid({ address, punkData, eligiblePunks }) {
  const [ownedPunks, setOwnedPunks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // 'all' or 'remastered'

  // Query ownership for eligible punks only (more efficient)
  const contracts = eligiblePunks.map(punkId => ({
    address: CRYPTOPUNKS_ADDRESS,
    abi: PUNKS_ABI,
    functionName: 'punkIndexToAddress',
    args: [BigInt(punkId)],
  }));

  const { data, isLoading, isError } = useReadContracts({
    contracts,
    query: {
      enabled: eligiblePunks.length > 0 && !!address,
    },
  });

  useEffect(() => {
    if (data && address) {
      const owned = [];
      data.forEach((result, index) => {
        if (result.status === 'success' && result.result) {
          const owner = result.result.toLowerCase();
          if (owner === address.toLowerCase()) {
            const punkId = eligiblePunks[index];
            if (punkData[punkId]) {
              owned.push(punkData[punkId]);
            }
          }
        }
      });
      setOwnedPunks(owned);
      setLoading(false);
    }
  }, [data, address, eligiblePunks, punkData]);

  if (isLoading || loading) {
    return (
      <div className="loading">
        <p>Checking ownership of {eligiblePunks.length} eligible punks...</p>
        <p className="loading-note">This may take a moment</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="error">
        <p>Error fetching punk ownership</p>
      </div>
    );
  }

  const filteredPunks = filter === 'remastered'
    ? ownedPunks.filter(p => hasRemasters(p))
    : ownedPunks;

  const remasteredCount = ownedPunks.filter(p => hasRemasters(p)).length;

  if (ownedPunks.length === 0) {
    return (
      <div className="no-punks">
        <p>No CryptoPunks with remaster-eligible traits found in this wallet.</p>
        <p className="note">
          Only {eligiblePunks.length} punks out of 10,000 have traits that can be remastered.
        </p>
      </div>
    );
  }

  return (
    <div className="punk-grid-container">
      <div className="grid-header">
        <div className="stats">
          <span>{ownedPunks.length} punk{ownedPunks.length !== 1 ? 's' : ''} found</span>
          <span className="divider">|</span>
          <span>{remasteredCount} with remasters</span>
        </div>
        <div className="filter-buttons">
          <button
            className={filter === 'all' ? 'active' : ''}
            onClick={() => setFilter('all')}
          >
            All
          </button>
          <button
            className={filter === 'remastered' ? 'active' : ''}
            onClick={() => setFilter('remastered')}
          >
            Remastered Only
          </button>
        </div>
      </div>

      <div className="punk-grid">
        {filteredPunks.map(punk => (
          <PunkCard key={punk.id} punk={punk} />
        ))}
      </div>

      {filteredPunks.length === 0 && filter === 'remastered' && (
        <div className="no-results">
          <p>None of your punks have remasterable traits.</p>
        </div>
      )}
    </div>
  );
}

export default PunkGrid;

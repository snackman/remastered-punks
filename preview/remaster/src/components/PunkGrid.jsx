import { useState, useEffect } from 'react';
import { fetchOwnedPunks } from '../lib/ownedPunks';
import { hasRemasters } from '../lib/remaster';
import PunkCard from './PunkCard';

function PunkGrid({ address, punkData, eligiblePunks, merkleProofs = {}, isTestnet = false }) {
  const [ownedPunks, setOwnedPunks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all'); // 'all' or 'remastered'

  // Create a Set for O(1) lookup
  const eligibleSet = new Set(eligiblePunks);

  useEffect(() => {
    if (!address) return;

    async function loadPunks() {
      setLoading(true);
      setError(null);

      try {
        let owned;

        if (isTestnet) {
          // On testnet, show all eligible punks (anyone can claim on mock contract)
          owned = eligiblePunks
            .filter(punkId => punkData[punkId])
            .map(punkId => ({
              ...punkData[punkId],
              isEligible: true,
            }));
        } else {
          // On mainnet, query actual ownership
          const punkIds = await fetchOwnedPunks(address);
          owned = punkIds.map(punkId => {
            if (punkData[punkId]) {
              return {
                ...punkData[punkId],
                isEligible: eligibleSet.has(punkId),
              };
            }
            return {
              id: punkId,
              type: 'Unknown',
              gender: 'Unknown',
              skinTone: null,
              accessories: [],
              isEligible: false,
            };
          });
        }

        setOwnedPunks(owned);
      } catch (err) {
        console.error('Failed to fetch owned punks:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadPunks();
  }, [address, punkData, eligiblePunks, isTestnet]);

  if (loading) {
    return (
      <div className="loading">
        <p>{isTestnet ? 'Loading eligible punks...' : 'Fetching CryptoPunks for this wallet...'}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error">
        <p>Error fetching punks: {error}</p>
      </div>
    );
  }

  const eligibleOwned = ownedPunks.filter(p => p.isEligible);
  const filteredPunks = filter === 'remastered'
    ? ownedPunks.filter(p => p.isEligible && hasRemasters(p))
    : ownedPunks;

  const remasteredCount = ownedPunks.filter(p => p.isEligible && hasRemasters(p)).length;

  if (ownedPunks.length === 0) {
    return (
      <div className="no-punks">
        <p>No CryptoPunks found in this wallet.</p>
      </div>
    );
  }

  return (
    <div className="punk-grid-container">
      <div className="grid-header">
        <div className="stats">
          <span>{ownedPunks.length} punk{ownedPunks.length !== 1 ? 's' : ''} found</span>
          <span className="divider">|</span>
          <span>{eligibleOwned.length} eligible for remaster</span>
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
          <PunkCard
            key={punk.id}
            punk={punk}
            showEligibility={true}
            merkleProof={merkleProofs[punk.id]}
          />
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

import { useState } from 'react';
import PunkCard from './PunkCard';

function ManualLookup({ punkData, merkleProofs = {} }) {
  const [inputValue, setInputValue] = useState('');
  const [punk, setPunk] = useState(null);
  const [error, setError] = useState(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError(null);
    setPunk(null);

    const punkId = parseInt(inputValue.trim());

    if (isNaN(punkId) || punkId < 0 || punkId > 9999) {
      setError('Please enter a valid punk ID (0-9999)');
      return;
    }

    const foundPunk = punkData[punkId];
    if (!foundPunk) {
      setError(`Punk #${punkId} not found`);
      return;
    }

    setPunk(foundPunk);
  };

  return (
    <div className="manual-lookup">
      <form onSubmit={handleSubmit}>
        <div className="input-row">
          <input
            type="number"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Enter punk ID (0-9999)"
            min="0"
            max="9999"
          />
          <button type="submit">Lookup</button>
        </div>
      </form>

      {error && <div className="lookup-error">{error}</div>}

      {punk && (
        <div className="lookup-result">
          <PunkCard punk={punk} merkleProof={merkleProofs[punk.id]} />
        </div>
      )}
    </div>
  );
}

export default ManualLookup;

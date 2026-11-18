import { useState } from 'react';
import PunkCard from './PunkCard';

function ManualLookup({ punkData, eligiblePunks = [], merkleProofs = {}, merkleStatus = 'loading' }) {
  const [inputValue, setInputValue] = useState('');
  const [punk, setPunk] = useState(null);
  const [error, setError] = useState(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError(null);
    setPunk(null);

    const raw = inputValue.trim().replace(/^#/, '');
    if (!/^\d{1,4}$/.test(raw)) {
      setError('Enter a whole-number punk ID from 0 to 9999');
      return;
    }
    const punkId = Number(raw);

    const foundPunk = punkData[punkId];
    if (!foundPunk) {
      setError(`Punk #${punkId} not found`);
      return;
    }

    setPunk(foundPunk);
  };

  const randomEligible = () => {
    if (!eligiblePunks.length) return;
    const id = eligiblePunks[Math.floor(Math.random() * eligiblePunks.length)];
    setError(null);
    setInputValue(String(id));
    setPunk(punkData[id] || null);
  };

  return (
    <div className="manual-lookup">
      <form onSubmit={handleSubmit}>
        <div className="input-row">
          <label htmlFor="punk-id-input" className="sr-only">Punk ID (0–9999)</label>
          <input
            id="punk-id-input"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Enter Punk ID"
            aria-invalid={!!error}
            aria-describedby={error ? 'lookup-error' : undefined}
          />
          <button type="submit">Lookup</button>
        </div>
      </form>
      <button
        type="button"
        className="link-button"
        onClick={randomEligible}
        disabled={!eligiblePunks.length}
      >
        Random eligible punk
      </button>

      {error && <div id="lookup-error" className="lookup-error" role="alert">{error}</div>}

      {punk && (
        <div className="lookup-result">
          <PunkCard key={punk.id} punk={punk} merkleProof={merkleProofs[punk.id]} merkleStatus={merkleStatus} />
        </div>
      )}
    </div>
  );
}

export default ManualLookup;

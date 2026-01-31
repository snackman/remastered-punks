import { useState } from 'react';
import { compositePunk } from '../lib/remaster';

// Example punks that showcase each remastered trait
const TRAIT_EXAMPLES = [
  // Female ear remasters
  { id: 0, name: 'Blonde Bob', description: 'Ear shifted down 1px' },
  { id: 77, name: 'Mohawk', description: 'Ear shifted down 1px' },
  { id: 1672, name: 'Wild Blonde', description: 'Ear shifted down 1px' },
  { id: 2621, name: 'Orange Side + Earring', description: 'Ear and earring shifted down 1px' },
  { id: 395, name: 'Blonde Short', description: 'Ear shifted down 1px' },
  { id: 1214, name: 'Pigtails', description: 'Ear shifted down 1px' },
  { id: 2140, name: 'Crazy Hair', description: 'Ear shifted down 1px' },
  { id: 6089, name: 'Clown Hair Green', description: 'Ear shifted down 1px' },
  // Bald female
  { id: 2066, name: 'Bald Female', description: 'Ear shifted down 1px' },
  // Female with Regular Shades
  { id: 3220, name: 'Mohawk + Regular Shades', description: 'Ear and shades shifted down 1px' },
  // Choker remaster
  { id: 1, name: 'Choker', description: 'Choker centered (3 pixels)' },
  // Male remasters
  { id: 9, name: 'Front Beard', description: 'Beard pixels added at chin' },
  { id: 1189, name: 'Front Beard Dark', description: 'Beard pixels added at chin' },
  { id: 5, name: 'Small Shades', description: 'Nose bridge pixels added' },
];

export default function TraitsGallery({ punkData }) {
  const [selectedTrait, setSelectedTrait] = useState(null);

  const renderPunkComparison = (punkId) => {
    const punk = punkData[punkId];
    if (!punk) return null;

    const originalCanvas = compositePunk(punk, false);
    const remasteredCanvas = compositePunk(punk, true);

    return (
      <div className="comparison">
        <div className="comparison-item">
          <canvas
            ref={el => {
              if (el) {
                const ctx = el.getContext('2d');
                ctx.imageSmoothingEnabled = false;
                ctx.drawImage(originalCanvas, 0, 0, 120, 120);
              }
            }}
            width={120}
            height={120}
          />
          <span>Original</span>
        </div>
        <div className="comparison-arrow">→</div>
        <div className="comparison-item">
          <canvas
            ref={el => {
              if (el) {
                const ctx = el.getContext('2d');
                ctx.imageSmoothingEnabled = false;
                ctx.drawImage(remasteredCanvas, 0, 0, 120, 120);
              }
            }}
            width={120}
            height={120}
          />
          <span>Remastered</span>
        </div>
      </div>
    );
  };

  return (
    <div className="traits-gallery">
      <h2>Remastered Traits</h2>
      <p className="traits-intro">
        Click on a trait to see the before/after comparison.
        These subtle fixes correct pixel-level issues in the original CryptoPunks.
      </p>

      <div className="traits-grid">
        {TRAIT_EXAMPLES.map(trait => (
          <div
            key={trait.id}
            className={`trait-card ${selectedTrait?.id === trait.id ? 'selected' : ''}`}
            onClick={() => setSelectedTrait(trait)}
          >
            <canvas
              ref={el => {
                if (el && punkData[trait.id]) {
                  const canvas = compositePunk(punkData[trait.id], true);
                  const ctx = el.getContext('2d');
                  ctx.imageSmoothingEnabled = false;
                  ctx.drawImage(canvas, 0, 0, 72, 72);
                }
              }}
              width={72}
              height={72}
            />
            <div className="trait-info">
              <span className="trait-name">{trait.name}</span>
              <span className="trait-id">#{trait.id}</span>
            </div>
          </div>
        ))}
      </div>

      {selectedTrait && punkData[selectedTrait.id] && (
        <div className="trait-detail">
          <h3>{selectedTrait.name} <span className="punk-id">Punk #{selectedTrait.id}</span></h3>
          <p>{selectedTrait.description}</p>
          {renderPunkComparison(selectedTrait.id)}
        </div>
      )}
    </div>
  );
}

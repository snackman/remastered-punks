import { useEffect, useRef } from 'react';
import { SPRITE_SIZE } from '../lib/constants';
import { extractPunk } from '../lib/sprites';
import { compositePunk, getRemasters } from '../lib/remaster';

const ZOOM = 4;

function PunkCard({ punk, showRemastered = true }) {
  const originalRef = useRef(null);
  const remasteredRef = useRef(null);

  const remasters = getRemasters(punk);
  const hasRemasters = remasters.length > 0;

  useEffect(() => {
    if (!originalRef.current) return;

    // Clear and draw original
    const origCtx = originalRef.current.getContext('2d');
    origCtx.clearRect(0, 0, SPRITE_SIZE * ZOOM, SPRITE_SIZE * ZOOM);
    const originalCanvas = extractPunk(punk.id);
    origCtx.imageSmoothingEnabled = false;
    origCtx.drawImage(originalCanvas, 0, 0, SPRITE_SIZE, SPRITE_SIZE, 0, 0, SPRITE_SIZE * ZOOM, SPRITE_SIZE * ZOOM);

    // Clear and draw remastered if applicable
    if (hasRemasters && showRemastered && remasteredRef.current) {
      const remCtx = remasteredRef.current.getContext('2d');
      remCtx.clearRect(0, 0, SPRITE_SIZE * ZOOM, SPRITE_SIZE * ZOOM);
      const remasteredCanvas = compositePunk(punk, true);
      remCtx.imageSmoothingEnabled = false;
      remCtx.drawImage(remasteredCanvas, 0, 0, SPRITE_SIZE, SPRITE_SIZE, 0, 0, SPRITE_SIZE * ZOOM, SPRITE_SIZE * ZOOM);
    }
  }, [punk, hasRemasters, showRemastered]);

  return (
    <div className="punk-card">
      <div className="punk-id">#{punk.id}</div>
      <div className="punk-images">
        <div className="punk-image-wrapper">
          <canvas
            ref={originalRef}
            width={SPRITE_SIZE * ZOOM}
            height={SPRITE_SIZE * ZOOM}
          />
          {hasRemasters && showRemastered && <span className="label">Original</span>}
        </div>
        {hasRemasters && showRemastered && (
          <>
            <span className="arrow">→</span>
            <div className="punk-image-wrapper">
              <canvas
                ref={remasteredRef}
                width={SPRITE_SIZE * ZOOM}
                height={SPRITE_SIZE * ZOOM}
              />
              <span className="label">Remastered</span>
            </div>
          </>
        )}
      </div>
      <div className="punk-info">
        <span className="gender">{punk.gender}</span>
        <span className="skin">{punk.skinTone}</span>
      </div>
      {hasRemasters && (
        <div className="remasters">
          {remasters.map((r, i) => (
            <span key={i} className="remaster-badge">{r.trait}</span>
          ))}
        </div>
      )}
      {!hasRemasters && (
        <div className="no-remaster">No remaster available</div>
      )}
    </div>
  );
}

export default PunkCard;

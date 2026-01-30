import { useEffect, useRef, useState } from 'react';
import { useAccount, useChainId, useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi';
import { SPRITE_SIZE } from '../lib/constants';
import { extractPunk } from '../lib/sprites';
import { compositePunk, getRemasters } from '../lib/remaster';
import { REMASTERED_PUNKS_ABI, getContractAddress } from '../lib/contracts';

const ZOOM = 4;

function PunkCard({ punk, showRemastered = true, showEligibility = false, merkleProof }) {
  const originalRef = useRef(null);
  const remasteredRef = useRef(null);
  const [mintStatus, setMintStatus] = useState(null);

  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const contractAddress = getContractAddress(chainId);

  // Check if already activated
  const { data: isActivated, refetch: refetchActivated } = useReadContract({
    address: contractAddress,
    abi: REMASTERED_PUNKS_ABI,
    functionName: 'activated',
    args: [BigInt(punk.id)],
    query: {
      enabled: !!contractAddress,
    },
  });

  // Write contract hook
  const { writeContract, data: hash, isPending, error: writeError } = useWriteContract();

  // Wait for transaction
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  // Update status based on transaction state
  useEffect(() => {
    if (isPending) {
      setMintStatus('confirming');
    } else if (isConfirming) {
      setMintStatus('minting');
    } else if (isSuccess) {
      setMintStatus('success');
      refetchActivated();
    } else if (writeError) {
      setMintStatus('error');
    }
  }, [isPending, isConfirming, isSuccess, writeError, refetchActivated]);

  // Only check remasters if punk is eligible (has full data)
  const isEligible = punk.isEligible !== false && punk.accessories && punk.accessories.length > 0;
  const remasters = isEligible ? getRemasters(punk) : [];
  const hasRemasters = remasters.length > 0;
  const hasMerkleProof = merkleProof && merkleProof.length > 0;

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

  const handleMint = () => {
    if (!contractAddress || !merkleProof) return;

    setMintStatus('confirming');
    writeContract({
      address: contractAddress,
      abi: REMASTERED_PUNKS_ABI,
      functionName: 'activate',
      args: [BigInt(punk.id), merkleProof],
    });
  };

  const cardClass = `punk-card${punk.isEligible === false ? ' not-eligible' : ''}`;

  // Determine button state
  const canMint = isConnected && contractAddress && hasMerkleProof && hasRemasters && !isActivated;
  const buttonDisabled = !canMint || isPending || isConfirming;

  let buttonText = 'Mint Remaster';
  if (!isConnected) buttonText = 'Connect Wallet';
  else if (!contractAddress) buttonText = 'Wrong Network';
  else if (isActivated) buttonText = 'Already Minted';
  else if (isPending) buttonText = 'Confirm in Wallet...';
  else if (isConfirming) buttonText = 'Minting...';
  else if (isSuccess) buttonText = 'Minted!';

  return (
    <div className={cardClass}>
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
      {punk.gender && punk.skinTone && (
        <div className="punk-info">
          <span className="gender">{punk.gender}</span>
          <span className="skin">{punk.skinTone}</span>
        </div>
      )}
      {hasRemasters && (
        <div className="remasters">
          {remasters.map((r, i) => (
            <span key={i} className="remaster-badge">{r.trait}</span>
          ))}
        </div>
      )}
      {showEligibility && punk.isEligible === false && (
        <div className="not-eligible-badge">Not eligible for remaster</div>
      )}
      {isEligible && !hasRemasters && (
        <div className="no-remaster">No remaster available</div>
      )}

      {/* Mint Button */}
      {hasRemasters && hasMerkleProof && (
        <div className="mint-section">
          {isActivated ? (
            <div className="minted-badge">Minted</div>
          ) : (
            <button
              className={`mint-button ${mintStatus === 'success' ? 'success' : ''}`}
              onClick={handleMint}
              disabled={buttonDisabled}
            >
              {buttonText}
            </button>
          )}
          {writeError && (
            <div className="mint-error">
              {writeError.message?.includes('NotPunkOwner')
                ? "You don't own this punk"
                : writeError.message?.includes('AlreadyActivated')
                ? 'Already minted'
                : 'Error minting'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default PunkCard;

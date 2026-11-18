import { useEffect, useRef, useState } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi';
import { SPRITE_SIZE } from '../lib/constants';
import { extractPunk } from '../lib/sprites';
import { compositePunk } from '../lib/remaster';
import { remasterState, noRemasterCopy } from '../lib/eligibility';
import { TARGET_CHAIN } from '../lib/network';
import { useNetwork } from '../lib/useNetwork';
import { REMASTERED_PUNKS_ABI, MOCK_CRYPTOPUNKS_ABI } from '../lib/contracts';

const ZOOM = 4;

function PunkCard({ punk, showRemastered = true, showEligibility = false, merkleProof, merkleStatus = 'loading' }) {
  const originalRef = useRef(null);
  const remasteredRef = useRef(null);
  const [mintStatus, setMintStatus] = useState(null);

  const { address } = useAccount();
  const {
    chainId, isConnected, isSupported, isTarget, isTestnet,
    contractAddress, readAddress, cryptoPunksAddress: mockPunksAddress,
  } = useNetwork();

  // Check if already activated
  const { data: isActivated, refetch: refetchActivated } = useReadContract({
    address: readAddress,
    abi: REMASTERED_PUNKS_ABI,
    functionName: 'activated',
    args: [BigInt(punk.id)],
    chainId: TARGET_CHAIN.id,
    query: {
      enabled: !!readAddress,
    },
  });

  // Check punk ownership on mock contract (testnet only). On testnet punks are
  // pre-assigned to owners (no claim step); mint is enabled only for punks you own.
  const { data: punkOwner } = useReadContract({
    address: mockPunksAddress,
    abi: MOCK_CRYPTOPUNKS_ABI,
    functionName: 'punkIndexToAddress',
    args: [BigInt(punk.id)],
    chainId: TARGET_CHAIN.id, // mock owner read only runs in sepolia mode (enabled below)
    query: {
      enabled: !!mockPunksAddress && isTestnet,
    },
  });

  const zeroAddress = '0x0000000000000000000000000000000000000000';
  const ownsPunkOnMock = punkOwner && punkOwner !== zeroAddress && address && punkOwner.toLowerCase() === address.toLowerCase();

  // Write contract hook for minting
  const { writeContract, data: hash, isPending, error: writeError } = useWriteContract();

  // Wait for mint transaction
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  // Update status based on mint transaction state
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

  // Eligibility = membership in all-eligible-punks.json (same set as the server and merkle tree).
  const { eligible, hasProof, proofPending, proofMissing } = remasterState(punk.id, merkleProof, merkleStatus);

  useEffect(() => {
    if (!originalRef.current) return;

    // Clear and draw original
    const origCtx = originalRef.current.getContext('2d');
    origCtx.clearRect(0, 0, SPRITE_SIZE * ZOOM, SPRITE_SIZE * ZOOM);
    const originalCanvas = extractPunk(punk.id);
    origCtx.imageSmoothingEnabled = false;
    origCtx.drawImage(originalCanvas, 0, 0, SPRITE_SIZE, SPRITE_SIZE, 0, 0, SPRITE_SIZE * ZOOM, SPRITE_SIZE * ZOOM);

    // Clear and draw remastered if applicable
    if (eligible && showRemastered && remasteredRef.current) {
      const remCtx = remasteredRef.current.getContext('2d');
      remCtx.clearRect(0, 0, SPRITE_SIZE * ZOOM, SPRITE_SIZE * ZOOM);
      const remasteredCanvas = compositePunk(punk, true);
      remCtx.imageSmoothingEnabled = false;
      remCtx.drawImage(remasteredCanvas, 0, 0, SPRITE_SIZE, SPRITE_SIZE, 0, 0, SPRITE_SIZE * ZOOM, SPRITE_SIZE * ZOOM);
    }
  }, [punk, eligible, showRemastered]);

  const handleMint = () => {
    if (!contractAddress || !merkleProof) return;

    setMintStatus('confirming');
    writeContract({
      address: contractAddress,
      abi: REMASTERED_PUNKS_ABI,
      functionName: 'activate',
      args: [BigInt(punk.id), merkleProof],
      chainId: TARGET_CHAIN.id,
    });
  };

  const cardClass = `punk-card${!eligible ? ' not-eligible' : ''}`;

  // Determine mint button state
  const canMint = isConnected && isTarget && contractAddress && eligible && hasProof && !isActivated && (!isTestnet || ownsPunkOnMock);
  const buttonDisabled = !canMint || isPending || isConfirming;

  let buttonText = 'Mint Remaster';
  if (!isConnected) buttonText = 'Connect Wallet';
  else if (!isSupported) buttonText = 'Wrong Network';
  else if (!contractAddress) buttonText = chainId === 1 ? 'Minting Soon' : 'Wrong Network';
  else if (isActivated) buttonText = 'Already Minted';
  else if (proofPending) buttonText = 'Loading proof…';
  else if (proofMissing) buttonText = 'Proof unavailable';
  else if (isTestnet && !ownsPunkOnMock) buttonText = 'Not Your Punk';
  else if (isPending) buttonText = 'Confirm in Wallet...';
  else if (isConfirming) buttonText = 'Minting...';
  else if (isSuccess) buttonText = 'Minted!';

  return (
    <div className={cardClass}>
      <div className="punk-id">
        <a
          href={`https://cryptopunks.app/cryptopunks/details/${punk.id}`}
          target="_blank"
          rel="noreferrer"
        >
          #{punk.id}
        </a>
      </div>
      <div className="punk-images">
        <div className="punk-image-wrapper">
          <canvas
            ref={originalRef}
            width={SPRITE_SIZE * ZOOM}
            height={SPRITE_SIZE * ZOOM}
          />
          {eligible && showRemastered && <span className="label">Original</span>}
        </div>
        {eligible && showRemastered && (
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
      {punk.accessories && punk.accessories.length > 0 && (
        <div className="remasters">
          {punk.accessories.map((a, i) => (
            <span key={i} className="remaster-badge">{a}</span>
          ))}
        </div>
      )}
      {!eligible && (
        <div className="no-remaster">{noRemasterCopy(punk.id)}</div>
      )}

      {/* Mint Button */}
      {eligible && (
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

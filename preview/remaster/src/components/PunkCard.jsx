import { useEffect, useRef, useState } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract, usePublicClient } from 'wagmi';
import { useQueryClient } from '@tanstack/react-query';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { isAddressEqual, zeroAddress } from 'viem';
import { SPRITE_SIZE } from '../lib/constants';
import { extractPunk } from '../lib/sprites';
import { compositePunk } from '../lib/remaster';
import { remasterState, noRemasterCopy } from '../lib/eligibility';
import { TARGET_CHAIN } from '../lib/network';
import { useNetwork } from '../lib/useNetwork';
import { REMASTERED_PUNKS_ABI, CRYPTOPUNKS_ABI } from '../lib/contracts';
import { describeTxError, REVERTED } from '../lib/mintErrors';

const ZOOM = 4;

function PunkCard({ punk, showRemastered = true, merkleProof, merkleStatus = 'loading' }) {
  const originalRef = useRef(null);
  const remasteredRef = useRef(null);
  const [txError, setTxError] = useState(null);
  const [simulating, setSimulating] = useState(false);
  const [syncTxError, setSyncTxError] = useState(null);
  const [syncSimulating, setSyncSimulating] = useState(false);
  const handledHashes = useRef(new Set());
  const queryClient = useQueryClient();
  const { openConnectModal } = useConnectModal();

  const { address } = useAccount();
  const {
    chainId, isConnected, isSupported, isTarget,
    contractAddress, readAddress, cryptoPunksAddress: punksAddress,
  } = useNetwork();
  const publicClient = usePublicClient({ chainId: TARGET_CHAIN.id });

  // Eligibility = membership in all-eligible-punks.json (same set as the server and merkle tree).
  const { eligible, hasProof, proofPending, proofMissing } = remasterState(punk.id, merkleProof, merkleStatus);

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

  // Current CryptoPunks owner (mock on Sepolia, the real contract on mainnet). Only read for
  // cards that can show a mint/sync button.
  const {
    data: punkOwner,
    isLoading: ownerLoading,
    isError: ownerError,
    refetch: refetchOwner,
  } = useReadContract({
    address: punksAddress,
    abi: CRYPTOPUNKS_ABI,
    functionName: 'punkIndexToAddress',
    args: [BigInt(punk.id)],
    chainId: TARGET_CHAIN.id,
    query: {
      enabled: !!punksAddress && isConnected && isTarget && eligible,
    },
  });

  const ownsPunk = !!address && !!punkOwner && punkOwner !== zeroAddress && isAddressEqual(punkOwner, address);

  // Owner last announced by the RemasteredPunks Transfer event (for the sync button).
  const { data: announcedOwner, refetch: refetchAnnounced } = useReadContract({
    address: readAddress,
    abi: REMASTERED_PUNKS_ABI,
    functionName: 'announcedOwner',
    args: [BigInt(punk.id)],
    chainId: TARGET_CHAIN.id,
    query: {
      enabled: !!readAddress && !!isActivated,
    },
  });

  // Mint tx
  const { writeContract, data: hash, isPending, error: writeError, reset } = useWriteContract();
  const {
    isLoading: isConfirming, isSuccess, isError: receiptFailed,
  } = useWaitForTransactionReceipt({ hash, chainId: TARGET_CHAIN.id, query: { retry: 1 } });

  // Sync tx
  const {
    writeContract: writeSync, data: syncHash, isPending: syncPending,
    error: syncWriteError, reset: resetSync,
  } = useWriteContract();
  const {
    isLoading: syncConfirming, isSuccess: syncSuccess, isError: syncReceiptFailed,
  } = useWaitForTransactionReceipt({ hash: syncHash, chainId: TARGET_CHAIN.id });

  // Once per mined tx (success or revert): refresh every contract read (this card's activated /
  // owner state and PunkGrid's "N remastered" count) so the UI matches the chain.
  useEffect(() => {
    for (const [h, done] of [[hash, isSuccess || receiptFailed], [syncHash, syncSuccess || syncReceiptFailed]]) {
      if (!h || !done || handledHashes.current.has(h)) continue;
      handledHashes.current.add(h);
      queryClient.invalidateQueries({ queryKey: ['readContract'] });
      queryClient.invalidateQueries({ queryKey: ['readContracts'] });
    }
  }, [hash, isSuccess, receiptFailed, syncHash, syncSuccess, syncReceiptFailed, queryClient]);

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

  // Simulate first (a plain eth_call, no signature) so reverts show their decoded reason before
  // the wallet prompt. Rejections / write errors are decoded by describeTxError at render time.
  const handleMint = async () => {
    if (!contractAddress || !merkleProof) return;
    reset();
    setTxError(null);
    setSimulating(true);
    try {
      const { request } = await publicClient.simulateContract({
        address: contractAddress,
        abi: REMASTERED_PUNKS_ABI,
        functionName: 'activate',
        args: [BigInt(punk.id), merkleProof],
        account: address,
      });
      writeContract({ ...request, abi: REMASTERED_PUNKS_ABI, chainId: TARGET_CHAIN.id });
    } catch (e) {
      setTxError(describeTxError(e));
      refetchActivated();
      refetchOwner();
    } finally {
      setSimulating(false);
    }
  };

  const handleSync = async () => {
    if (!contractAddress) return;
    resetSync();
    setSyncTxError(null);
    setSyncSimulating(true);
    try {
      const { request } = await publicClient.simulateContract({
        address: contractAddress,
        abi: REMASTERED_PUNKS_ABI,
        functionName: 'syncOwnership',
        args: [BigInt(punk.id)],
        account: address,
      });
      writeSync({ ...request, abi: REMASTERED_PUNKS_ABI, chainId: TARGET_CHAIN.id });
    } catch (e) {
      setSyncTxError(describeTxError(e));
      refetchAnnounced();
      refetchOwner();
    } finally {
      setSyncSimulating(false);
    }
  };

  const cardClass = `punk-card${!eligible ? ' not-eligible' : ''}`;

  // Determine mint button state
  const canMint = isConnected && isTarget && contractAddress && eligible && hasProof && !isActivated && ownsPunk;
  const buttonDisabled = !canMint || isPending || simulating || isConfirming;

  let buttonText = 'Mint Remaster';
  if (!isSupported) buttonText = 'Wrong Network';
  else if (!contractAddress) buttonText = chainId === 1 ? 'Minting Soon' : 'Wrong Network';
  else if (isActivated) buttonText = 'Already Minted';
  else if (proofPending) buttonText = 'Loading proof…';
  else if (proofMissing) buttonText = 'Proof unavailable';
  else if (ownerLoading) buttonText = 'Checking ownership…';
  else if (ownerError) buttonText = "Couldn't check ownership";
  else if (!ownsPunk) buttonText = 'Not Your Punk';
  else if (isPending || simulating) buttonText = 'Confirm in Wallet...';
  else if (isConfirming) buttonText = 'Minting...';
  else if (isSuccess) buttonText = 'Minted!';

  const shownError = txError ?? (writeError ? describeTxError(writeError) : null) ?? (receiptFailed ? REVERTED : null);
  const shownSyncError = syncTxError ?? (syncWriteError ? describeTxError(syncWriteError) : null)
    ?? (syncReceiptFailed ? REVERTED : null);
  const explorer = TARGET_CHAIN.id === 1 ? 'https://etherscan.io' : 'https://sepolia.etherscan.io';
  const errorBox = (err, txHash) => err && (
    <div className={err.kind === 'cancelled' ? 'mint-note' : 'mint-error'}>
      {err.message}
      {err === REVERTED && txHash && (
        <>
          {' '}
          <a href={`${explorer}/tx/${txHash}`} target="_blank" rel="noreferrer">View tx</a>
        </>
      )}
    </div>
  );

  // Marketplaces show the owner from the last Transfer event; offer a permissionless re-announce
  // when the punk has since changed hands.
  const needsSync = !!isActivated && !!announcedOwner && !!punkOwner && punkOwner !== zeroAddress
    && !isAddressEqual(announcedOwner, punkOwner);
  const syncBusy = syncPending || syncSimulating || syncConfirming;
  const canSync = isConnected && isTarget && !!contractAddress && !syncBusy;

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
            role="img"
            aria-label={`Punk #${punk.id}${eligible && showRemastered ? ', original' : ''}`}
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
                role="img"
                aria-label={`Punk #${punk.id}, remastered`}
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
          ) : !isConnected ? (
            <>
              <button className="mint-button" onClick={openConnectModal} disabled={!openConnectModal}>Connect wallet to mint</button>
              <p className="mint-hint">Only the punk&apos;s current owner can mint its remaster.</p>
            </>
          ) : (
            <button
              className={`mint-button ${isSuccess ? 'success' : ''}`}
              onClick={handleMint}
              disabled={buttonDisabled}
            >
              {buttonText}
            </button>
          )}
          {errorBox(shownError, hash)}
          {needsSync && (
            <>
              <button className="sync-button" onClick={handleSync} disabled={!canSync}>
                {syncPending || syncSimulating ? 'Confirm in Wallet...' : syncConfirming ? 'Syncing...' : 'Sync to marketplaces'}
              </button>
              {errorBox(shownSyncError, syncHash)}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default PunkCard;

import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';
import PunkGrid from '../components/PunkGrid';
import ManualLookup from '../components/ManualLookup';

// The wallet-dependent tabs (My Punks, Lookup). Rendered through a portal into the
// shell's <main>, so these (and the wagmi/RainbowKit code they need) load lazily.
function WalletMain({ tab, punkData, eligiblePunks, onNavigate }) {
  const { address, isConnected } = useAccount();

  if (tab === 'wallet') {
    return isConnected ? (
      <PunkGrid address={address} punkData={punkData} eligiblePunks={eligiblePunks} />
    ) : (
      <div className="connect-prompt">
        <p>Connect your wallet to see which of your CryptoPunks can mint a remaster.</p>
        <div className="connect-prompt-actions">
          <ConnectButton.Custom>{({ openConnectModal, mounted }) => (
            <button className="btn" onClick={openConnectModal} disabled={!mounted}>Connect wallet</button>
          )}</ConnectButton.Custom>
          <button className="link-button" onClick={() => onNavigate('lookup')}>or look up any punk</button>
        </div>
      </div>
    );
  }
  if (tab === 'lookup') {
    return <ManualLookup punkData={punkData} eligiblePunks={eligiblePunks} />;
  }
  return null;
}

export default WalletMain;

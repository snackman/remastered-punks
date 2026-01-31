import { useState, useEffect } from 'react';
import '@rainbow-me/rainbowkit/styles.css';
import {
  getDefaultConfig,
  RainbowKitProvider,
  ConnectButton,
} from '@rainbow-me/rainbowkit';
import { WagmiProvider, useAccount } from 'wagmi';
import { mainnet, sepolia } from 'wagmi/chains';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { loadAssets } from './lib/sprites';
import { loadPunkData, loadEligiblePunks } from './lib/data';
import PunkGrid from './components/PunkGrid';
import ManualLookup from './components/ManualLookup';
import TraitsGallery from './components/TraitsGallery';

import './App.css';

const config = getDefaultConfig({
  appName: 'Remastered Punks',
  projectId: 'c490ddb4e12e01e9e541522b7cde7452', // Get from cloud.walletconnect.com
  chains: [mainnet, sepolia],
});

const queryClient = new QueryClient();

function AppContent({ punkData, eligiblePunks, assetsLoaded, merkleProofs }) {
  const { address, isConnected } = useAccount();
  const [activeTab, setActiveTab] = useState('wallet');

  if (!assetsLoaded) {
    return <div className="loading">Loading assets...</div>;
  }

  return (
    <div className="app">
      <header>
        <h1>Punks Remastered</h1>
        <p className="subtitle">View your CryptoPunks with remastered traits</p>
        <div className="connect-wrapper">
          <ConnectButton />
        </div>
      </header>

      <div className="tabs">
        <button
          className={activeTab === 'wallet' ? 'active' : ''}
          onClick={() => setActiveTab('wallet')}
        >
          My Punks
        </button>
        <button
          className={activeTab === 'lookup' ? 'active' : ''}
          onClick={() => setActiveTab('lookup')}
        >
          Lookup by ID
        </button>
        <button
          className={activeTab === 'traits' ? 'active' : ''}
          onClick={() => setActiveTab('traits')}
        >
          All Traits
        </button>
      </div>

      <main>
        {activeTab === 'wallet' && (
          isConnected ? (
            <PunkGrid
              address={address}
              punkData={punkData}
              eligiblePunks={eligiblePunks}
              merkleProofs={merkleProofs}
            />
          ) : (
            <div className="connect-prompt">
              <p>Connect your wallet to view your CryptoPunks</p>
            </div>
          )
        )}
        {activeTab === 'lookup' && (
          <ManualLookup punkData={punkData} merkleProofs={merkleProofs} />
        )}
        {activeTab === 'traits' && (
          <TraitsGallery punkData={punkData} />
        )}
      </main>
    </div>
  );
}

function App() {
  const [punkData, setPunkData] = useState({});
  const [eligiblePunks, setEligiblePunks] = useState([]);
  const [merkleProofs, setMerkleProofs] = useState({});
  const [assetsLoaded, setAssetsLoaded] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function init() {
      try {
        // Base path for assets
        const basePath = import.meta.env.DEV ? '../..' : '';

        // Load assets
        await loadAssets(
          `${basePath}/data/cryptopunks-assets/punks/config/punks-24x24.png`,
          `${basePath}/data/punks.png`
        );

        // Load punk data
        const data = await loadPunkData(`${basePath}/data/punks-attributes/original/cryptopunks.csv`);
        setPunkData(data);

        // Load eligible punks
        const eligible = await loadEligiblePunks(`${basePath}/data/all-eligible-punks.json`);
        setEligiblePunks(eligible);

        setAssetsLoaded(true);

        // Load merkle proofs in background (large file, don't block UI)
        fetch(`${basePath}/data/merkle-tree.json`)
          .then(res => res.json())
          .then(merkleData => setMerkleProofs(merkleData.proofs || {}))
          .catch(e => console.warn('Merkle tree not loaded:', e));
      } catch (err) {
        console.error('Failed to load:', err);
        setError(err.message);
      }
    }

    init();
  }, []);

  if (error) {
    return <div className="error">Error loading: {error}</div>;
  }

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          <AppContent
            punkData={punkData}
            eligiblePunks={eligiblePunks}
            merkleProofs={merkleProofs}
            assetsLoaded={assetsLoaded}
          />
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

export default App;

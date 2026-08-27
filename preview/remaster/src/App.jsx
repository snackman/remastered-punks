import { useState, useEffect } from 'react';
import '@rainbow-me/rainbowkit/styles.css';
import {
  getDefaultConfig,
  RainbowKitProvider,
  ConnectButton,
} from '@rainbow-me/rainbowkit';
import { WagmiProvider, useAccount, useChainId } from 'wagmi';
import { mainnet, sepolia } from 'wagmi/chains';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { loadAssets } from './lib/sprites';
import { loadPunkData, loadEligiblePunks } from './lib/data';
import PunkGrid from './components/PunkGrid';
import ManualLookup from './components/ManualLookup';
import Home from './components/Home';

import './App.css';

const config = getDefaultConfig({
  appName: 'Remastered Punks',
  projectId: 'c490ddb4e12e01e9e541522b7cde7452', // Get from cloud.walletconnect.com
  chains: [mainnet, sepolia],
});

const queryClient = new QueryClient();

function AppContent({ punkData, eligiblePunks, assetsLoaded, merkleProofs }) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const isTestnet = chainId === 11155111;

  const VALID_TABS = ['home', 'wallet', 'lookup'];
  const [activeTab, setActiveTab] = useState(() => {
    const h = (typeof window !== 'undefined' ? window.location.hash : '').replace('#', '');
    return VALID_TABS.includes(h) ? h : 'home';
  });

  // Switch tab and keep the URL hash in sync (so /#wallet deep-links work).
  const selectTab = (id) => {
    setActiveTab(id);
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', id === 'home' ? '#home' : `#${id}`);
    }
  };

  const base = import.meta.env.BASE_URL;
  const traitsUrl = `${base}../../traits.html`;
  const faviconUrl = `${base}favicon.png`;

  if (!assetsLoaded) {
    return <div className="loading">Loading assets...</div>;
  }

  const navButton = (id, label) => (
    <button
      className={activeTab === id ? 'active' : ''}
      onClick={() => selectTab(id)}
    >
      {label}
    </button>
  );

  return (
    <div className="app">
      <header className="site-header">
        <button className="brand" onClick={() => selectTab('home')}>
          <img className="brand-logo" src={faviconUrl} alt="" />
          <span className="brand-name">Punks Remastered</span>
        </button>
        <nav className="site-nav">
          {navButton('home', 'Home')}
          {navButton('wallet', 'My Punks')}
          {navButton('lookup', 'Lookup')}
          <a href={traitsUrl}>All Traits</a>
        </nav>
        <div className="connect-wrapper">
          <ConnectButton />
        </div>
      </header>

      <main>
        {activeTab === 'home' && (
          <Home
            punkData={punkData}
            eligiblePunks={eligiblePunks}
            onNavigate={selectTab}
          />
        )}
        {activeTab === 'wallet' && (
          isConnected ? (
            <PunkGrid
              address={address}
              punkData={punkData}
              eligiblePunks={eligiblePunks}
              merkleProofs={merkleProofs}
              isTestnet={isTestnet}
            />
          ) : (
            <div className="connect-prompt">
              <p>Connect your wallet to view your CryptoPunks.</p>
            </div>
          )
        )}
        {activeTab === 'lookup' && (
          <ManualLookup punkData={punkData} merkleProofs={merkleProofs} />
        )}
      </main>

      <footer className="site-footer">
        <button className="brand" onClick={() => selectTab('home')} style={{ font: 'inherit' }}>
          <span className="brand-name" style={{ fontSize: '12px' }}>Punks Remastered</span>
        </button>
        <a href={traitsUrl}>All Traits</a>
        <a href="https://cryptopunks.app" target="_blank" rel="noreferrer">CryptoPunks</a>
      </footer>
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

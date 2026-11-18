import { useState, useEffect } from 'react';
import '@rainbow-me/rainbowkit/styles.css';
import { RainbowKitProvider, ConnectButton } from '@rainbow-me/rainbowkit';
import { WagmiProvider, useAccount, useSwitchChain } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { loadAssets } from './lib/sprites';
import { loadPunkData, loadEligiblePunks } from './lib/data';
import { initEligibility } from './lib/eligibility';
import { initStacking } from './lib/remaster';
import { parseUrl, buildUrl } from './lib/urlState';
import { wagmiConfig, IS_MAINNET, TARGET_CHAIN } from './lib/network';
import { getContractAddress } from './lib/contracts';
import { useNetwork } from './lib/useNetwork';
import PunkGrid from './components/PunkGrid';
import ManualLookup from './components/ManualLookup';
import Home from './components/Home';
import Gallery from './components/Gallery';

import './App.css';

const queryClient = new QueryClient();

function AppContent({ punkData, eligiblePunks, assetsLoaded, merkleProofs, merkleStatus, loadError, onRetry }) {
  const { address, connector } = useAccount();
  const { isConnected, isSupported, isTestnet } = useNetwork();
  const { switchChain } = useSwitchChain();
  const [testnetStatus, setTestnetStatus] = useState('');

  // Switch the wallet to Ethereum Sepolia. Try switch first (works for wallets
  // that already know Sepolia, e.g. MetaMask, which rejects "adding" its own
  // default networks); only fall back to adding it if the wallet reports the
  // chain is unknown (error 4902).
  const addTestnet = async () => {
    setTestnetStatus('pending');
    try {
      const provider = await connector?.getProvider();
      if (!provider?.request) throw new Error('No wallet provider found');
      try {
        await provider.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: '0xaa36a7' }], // 11155111
        });
      } catch (switchErr) {
        const code = switchErr?.code ?? switchErr?.data?.originalError?.code;
        if (code === 4902) {
          await provider.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: '0xaa36a7',
              chainName: 'Sepolia',
              nativeCurrency: { name: 'Sepolia Ether', symbol: 'ETH', decimals: 18 },
              rpcUrls: ['https://ethereum-sepolia-rpc.publicnode.com', 'https://rpc.sepolia.org'],
              blockExplorerUrls: ['https://sepolia.etherscan.io'],
            }],
          });
        } else {
          throw switchErr;
        }
      }
      setTestnetStatus('');
    } catch (err) {
      console.error('Switch to testnet failed:', err);
      setTestnetStatus(err?.shortMessage || err?.message || 'Could not switch network');
    }
  };

  const [activeTab, setActiveTab] = useState(() => parseUrl(window.location).tab);
  // Trait filter for the gallery (deep-linkable via ?trait=Headband#gallery).
  const [filterTrait, setFilterTrait] = useState(() => parseUrl(window.location).trait);

  // Every tab/trait change is a history entry, so the browser Back/Forward
  // buttons move between tabs. The query is rebuilt from scratch so a stale
  // ?trait= / ?punk= never survives a tab switch.
  const nav = (tab, trait = null) => {
    if (tab === activeTab && (tab !== 'gallery' || trait === filterTrait)) {
      window.scrollTo(0, 0);
      return;
    }
    setActiveTab(tab);
    setFilterTrait(trait);
    const loc = window.location;
    const url = buildUrl({
      pathname: loc.pathname, search: loc.search, tab, trait, keepDev: import.meta.env.DEV,
    });
    if (url !== loc.pathname + loc.search + loc.hash) {
      window.history.pushState({ tab, trait }, '', url);
    }
    window.scrollTo(0, 0);
  };
  const selectTab = (id) => nav(id);
  // Show the gallery filtered to a trait (pass null to show every remaster).
  const selectTrait = (trait) => nav('gallery', trait);

  useEffect(() => {
    const onPop = () => {
      const s = parseUrl(window.location);
      setActiveTab(s.tab);
      setFilterTrait(s.trait);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // Per-tab document title (home string must match index.html's <title>).
  useEffect(() => {
    const SITE = 'Punks Remastered';
    const page = { wallet: 'My Punks', lookup: 'Lookup', gallery: filterTrait ? `${filterTrait} remasters` : 'All Remasters' }[activeTab];
    document.title = page ? `${page} \u00b7 ${SITE}` : `${SITE}: soulbound remasters of CryptoPunks`;
  }, [activeTab, filterTrait]);

  const contractAddress = getContractAddress(TARGET_CHAIN.id);
  const explorer = TARGET_CHAIN.blockExplorers?.default?.url;

  const base = import.meta.env.BASE_URL;
  const traitsUrl = `${base}traits.html`;
  const faviconUrl = `${base}favicon.png`;

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
        <nav className="site-nav" aria-label="Main">
          {navButton('home', 'Home')}
          {navButton('wallet', 'My Punks')}
          {navButton('lookup', 'Lookup')}
          <button
            className={activeTab === 'gallery' ? 'active' : ''}
            onClick={() => selectTrait(null)}
          >
            All Remasters
          </button>
          <a href={traitsUrl}>All Traits</a>
        </nav>
        <div className="connect-wrapper">
          {!IS_MAINNET && isConnected && !isTestnet && (
            <button
              className="testnet-switch"
              onClick={addTestnet}
              disabled={testnetStatus === 'pending'}
              title={testnetStatus && testnetStatus !== 'pending'
                ? testnetStatus
                : 'Add the Sepolia test network to your wallet and switch to it'}
            >
              {testnetStatus === 'pending' ? 'Adding…' : 'Add Testnet'}
            </button>
          )}
          {IS_MAINNET && isConnected && !isSupported && (
            <button
              className="testnet-switch"
              onClick={() => switchChain({ chainId: TARGET_CHAIN.id })}
              title={`Switch your wallet to ${TARGET_CHAIN.name}`}
            >
              Wrong network
            </button>
          )}
          <ConnectButton
            showBalance={false}
            chainStatus={{ smallScreen: 'icon', largeScreen: 'full' }}
            accountStatus={{ smallScreen: 'avatar', largeScreen: 'full' }}
          />
        </div>
      </header>

      <main>
        {loadError ? (
          <div className="error" role="alert">
            <p>Couldn&apos;t load punk data. {loadError}</p>
            <button className="btn" onClick={onRetry}>Retry</button>
          </div>
        ) : !assetsLoaded ? (
          <div className="loading" role="status" aria-live="polite">
            <span className="spinner" aria-hidden="true" />
            <p>Loading punks…</p>
          </div>
        ) : (<>
        {activeTab === 'home' && (
          <Home
            punkData={punkData}
            eligiblePunks={eligiblePunks}
            onNavigate={selectTab}
            onTrait={selectTrait}
          />
        )}
        {activeTab === 'gallery' && (
          <Gallery
            punkData={punkData}
            filterTrait={filterTrait}
            onFilterTrait={selectTrait}
          />
        )}
        {activeTab === 'wallet' && (
          isConnected ? (
            <PunkGrid
              address={address}
              punkData={punkData}
              eligiblePunks={eligiblePunks}
              merkleProofs={merkleProofs}
              merkleStatus={merkleStatus}
            />
          ) : (
            <div className="connect-prompt">
              <p>Connect your wallet to see which of your CryptoPunks can mint a remaster.</p>
              <div className="connect-prompt-actions">
                <ConnectButton.Custom>{({ openConnectModal, mounted }) => (
                  <button className="btn" onClick={openConnectModal} disabled={!mounted}>Connect wallet</button>
                )}</ConnectButton.Custom>
                <button className="link-button" onClick={() => selectTab('lookup')}>or look up any punk</button>
              </div>
            </div>
          )
        )}
        {activeTab === 'lookup' && (
          <ManualLookup punkData={punkData} eligiblePunks={eligiblePunks} merkleProofs={merkleProofs} merkleStatus={merkleStatus} />
        )}
        </>)}
      </main>

      <footer className="site-footer">
        {contractAddress && explorer
          ? <a href={`${explorer}/address/${contractAddress}`} target="_blank" rel="noreferrer">
              Contract on Etherscan{IS_MAINNET ? '' : ' (Sepolia)'}
            </a>
          : <span>Contract: coming soon</span>}
        <a href="https://cryptopunks.app" target="_blank" rel="noreferrer">CryptoPunks</a>
      </footer>
    </div>
  );
}

function App() {
  const [punkData, setPunkData] = useState({});
  const [eligiblePunks, setEligiblePunks] = useState([]);
  const [merkleProofs, setMerkleProofs] = useState({});
  const [merkleStatus, setMerkleStatus] = useState('loading'); // 'loading' | 'ready' | 'error'
  const [assetsLoaded, setAssetsLoaded] = useState(false);
  const [error, setError] = useState(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const retry = () => { setError(null); setLoadAttempt((n) => n + 1); };

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

        // Build the stacking compositor now that the sprite sheet + punk map exist.
        initStacking(data);

        // Load eligible punks
        const eligible = await loadEligiblePunks(`${basePath}/data/all-eligible-punks.json`);
        initEligibility(eligible);
        setEligiblePunks(eligible);

        setAssetsLoaded(true);

        // Load merkle proofs in background (large file, don't block UI)
        fetch(`${basePath}/data/merkle-tree.json`)
          .then(res => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.json();
          })
          .then(merkleData => {
            setMerkleProofs(merkleData.proofs || {});
            setMerkleStatus('ready');
          })
          .catch(e => {
            console.warn('Merkle tree not loaded:', e);
            setMerkleStatus('error');
          });
      } catch (err) {
        console.error('Failed to load:', err);
        setError(err.message);
      }
    }

    init();
  }, [loadAttempt]);

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          <AppContent
            punkData={punkData}
            eligiblePunks={eligiblePunks}
            merkleProofs={merkleProofs}
            merkleStatus={merkleStatus}
            assetsLoaded={assetsLoaded}
            loadError={error}
            onRetry={retry}
          />
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

export default App;

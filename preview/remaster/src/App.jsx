import { Component, useState, useEffect, useCallback, lazy, Suspense } from 'react';

import { loadSpriteSheet, loadPunksComposite, originalsLoaded } from './lib/sprites';
import { loadPunkData, loadPunkDataCompact, loadEligiblePunks } from './lib/data';
import { dataUrl } from './lib/dataUrl';
import { initEligibility } from './lib/eligibility';
import { initStacking } from './lib/remaster';
import { parseUrl, buildUrl } from './lib/urlState';
// Shell code must stay free of wagmi / viem / RainbowKit / react-query (see src/wallet/*):
// netFlag.js is the dependency-free subset of network.js + contracts.js the shell needs.
import { IS_MAINNET, TARGET_CONTRACT, TARGET_EXPLORER } from './lib/netFlag';
import Home from './components/Home';
import Gallery from './components/Gallery';

import './App.css';

// The wallet stack (wagmi, RainbowKit, react-query, ~190 KB br) loads lazily: Home and
// Gallery never need it. loadWallet() is shared so we can start it early.
const loadWallet = () => import('./wallet/WalletIslands');
const WalletIslands = lazy(loadWallet);

// A failed chunk load (offline, stale deploy) would otherwise throw out of render and
// blank the whole app; the shell keeps working and just reports the wallet as unavailable.
class WalletBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(err) {
    console.error('Wallet chunk failed to load:', err);
    this.props.onFail();
  }
  render() { return this.state.failed ? null : this.props.children; }
}

function AppContent({ punkData, eligiblePunks, assetsLoaded, loadError, onRetry }) {
  // Wallet islands (header controls + My Punks/Lookup) portal into these slots.
  const [headerSlot, setHeaderSlot] = useState(null);
  const [mainSlot, setMainSlot] = useState(null);
  const [walletWanted, setWalletWanted] = useState(false);
  const [walletReady, setWalletReady] = useState(false);
  const [walletFailed, setWalletFailed] = useState(false);
  const [openConnectOnReady, setOpenConnectOnReady] = useState(false);
  const onWalletReady = useCallback(() => setWalletReady(true), []);

  const [activeTab, setActiveTab] = useState(() => parseUrl(window.location).tab);
  // Trait filter for the gallery (deep-linkable via ?trait=Headband#gallery).
  const [filterTrait, setFilterTrait] = useState(() => parseUrl(window.location).trait);
  // Punk selected via ?punk=<id>#home (gallery links, deep links); Home shows it.
  const [selectedPunk, setSelectedPunk] = useState(() => parseUrl(window.location).punk);

  // Every tab/trait change is a history entry, so the browser Back/Forward
  // buttons move between tabs. The query is rebuilt from scratch so a stale
  // ?trait= / ?punk= never survives a tab switch.
  const nav = (tab, trait = null, punk = null) => {
    if (tab === activeTab && (tab !== 'gallery' || trait === filterTrait) && (punk == null || punk === selectedPunk)) {
      window.scrollTo(0, 0);
      return;
    }
    setActiveTab(tab);
    setFilterTrait(trait);
    setSelectedPunk(punk);
    const loc = window.location;
    const url = buildUrl({
      pathname: loc.pathname, search: loc.search, tab, trait, punk, keepDev: import.meta.env.DEV,
    });
    if (url !== loc.pathname + loc.search + loc.hash) {
      window.history.pushState({ tab, trait, punk }, '', url);
    }
    window.scrollTo(0, 0);
  };
  const selectTab = (id) => nav(id);
  // Show the gallery filtered to a trait (pass null to show every remaster).
  const selectTrait = (trait) => nav('gallery', trait);
  // Open a punk on Home (pass an id) without reloading the app.
  const selectPunk = (id) => nav('home', null, id);

  useEffect(() => {
    const onPop = () => {
      const s = parseUrl(window.location);
      setActiveTab(s.tab);
      setFilterTrait(s.trait);
      setSelectedPunk(s.punk);
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

  const contractAddress = TARGET_CONTRACT;
  const explorer = TARGET_EXPLORER;

  // Load the wallet chunk: right away on the wallet tabs (deep links included), otherwise
  // once the shell is up and the browser is idle, so reconnecting users get their wallet
  // without the first paint paying for it.
  const needsWallet = activeTab === 'wallet' || activeTab === 'lookup';
  // Sticky: once wanted, the islands stay mounted so the wallet connection survives tab switches.
  if (needsWallet && !walletWanted) setWalletWanted(true);
  useEffect(() => {
    if (needsWallet || !assetsLoaded) return undefined;
    const idle = window.requestIdleCallback
      ? (fn) => { const h = window.requestIdleCallback(fn, { timeout: 3000 }); return () => window.cancelIdleCallback(h); }
      : (fn) => { const h = setTimeout(fn, 1500); return () => clearTimeout(h); };
    return idle(() => setWalletWanted(true));
  }, [needsWallet, assetsLoaded]);

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
    <>
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
          {!walletReady && (
            <button
              className="wallet-fallback"
              onClick={() => {
                if (walletFailed) { window.location.reload(); return; }
                setOpenConnectOnReady(true);
                setWalletWanted(true);
              }}
            >
              Connect Wallet
            </button>
          )}
          <span className="wallet-slot" ref={setHeaderSlot} style={{ display: 'contents' }} />
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
            selectedPunk={selectedPunk}
            onNavigate={selectTab}
            onTrait={selectTrait}
          />
        )}
        {activeTab === 'gallery' && (
          <Gallery
            punkData={punkData}
            filterTrait={filterTrait}
            onFilterTrait={selectTrait}
            onSelectPunk={selectPunk}
          />
        )}
        {needsWallet && (<>
          {walletFailed && (
            <div className="error" role="alert">
              <p>Couldn&apos;t load the wallet. Check your connection and reload the page.</p>
            </div>
          )}
          {!walletReady && !walletFailed && (
            <div className="loading" role="status" aria-live="polite">
              <span className="spinner" aria-hidden="true" />
              <p>Loading wallet…</p>
            </div>
          )}
          <div ref={setMainSlot} style={{ display: 'contents' }} />
        </>)}
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
    {walletWanted && (
      <WalletBoundary onFail={() => setWalletFailed(true)}>
      <Suspense fallback={null}>
        <WalletIslands
          headerSlot={headerSlot}
          mainSlot={assetsLoaded && !loadError ? mainSlot : null}
          tab={activeTab}
          punkData={punkData}
          eligiblePunks={eligiblePunks}
          onNavigate={selectTab}
          autoOpenConnect={openConnectOnReady}
          onReady={onWalletReady}
        />
      </Suspense>
      </WalletBoundary>
    )}
    </>
  );
}

function App() {
  const [punkData, setPunkData] = useState({});
  const [eligiblePunks, setEligiblePunks] = useState([]);
  const [assetsLoaded, setAssetsLoaded] = useState(false);
  const [error, setError] = useState(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const retry = () => { setError(null); setLoadAttempt((n) => n + 1); };

  useEffect(() => {
    async function init() {
      try {
        // Originals (punks.png, 848 KB) are not on the critical path: Home/PunkCard draw
        // them as soon as it arrives (see useOriginalsReady). A failure only leaves the
        // original canvases blank.
        if (!originalsLoaded()) loadPunksComposite(dataUrl('punks.png')).catch((e) => console.warn('punks.png not loaded:', e));

        // Critical path, fetched in parallel: sprite sheet, punk attributes, eligible list.
        // (DEV has no build step, so it reads the CSV instead of the compact JSON.)
        const [, data, eligible] = await Promise.all([
          loadSpriteSheet(dataUrl('cryptopunks-assets/punks/config/punks-24x24.png')),
          import.meta.env.DEV
            ? loadPunkData(dataUrl('punks-attributes/original/cryptopunks.csv'))
            : loadPunkDataCompact(dataUrl('punks-compact.json')),
          loadEligiblePunks(dataUrl('all-eligible-punks.json')),
        ]);

        setPunkData(data);
        // Build the stacking compositor now that the sprite sheet + punk map exist.
        initStacking(data);
        initEligibility(eligible);
        setEligiblePunks(eligible);

        setAssetsLoaded(true);
      } catch (err) {
        console.error('Failed to load:', err);
        setError(err.message);
      }
    }

    init();
  }, [loadAttempt]);

  return (
    <AppContent
      punkData={punkData}
      eligiblePunks={eligiblePunks}
      assetsLoaded={assetsLoaded}
      loadError={error}
      onRetry={retry}
    />
  );
}

export default App;

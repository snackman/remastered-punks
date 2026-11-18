import { useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import '@rainbow-me/rainbowkit/styles.css';
import { RainbowKitProvider } from '@rainbow-me/rainbowkit';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { wagmiConfig } from '../lib/network';
import WalletHeader from './WalletHeader';
import WalletMain from './WalletMain';

const queryClient = new QueryClient();

// The whole wallet stack (wagmi, RainbowKit, react-query) behind one lazy chunk. One
// provider tree renders two portals into slots owned by the app shell (header + main),
// so the shell never remounts when this chunk arrives and nothing double-connects.
//
// RainbowKit scopes its CSS variables to a [data-rk] ancestor, which its provider
// renders as a wrapper around ITS children only; portal content is attached elsewhere
// in the DOM, so each portal carries its own [data-rk] wrapper.
function WalletIslands({
  headerSlot, mainSlot, tab, punkData, eligiblePunks, onNavigate, autoOpenConnect, onReady,
}) {
  // Layout effect: the shell swaps its placeholders for the real islands in the same paint.
  useLayoutEffect(() => { onReady?.(); }, [onReady]);

  const showMain = mainSlot && (tab === 'wallet' || tab === 'lookup');

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          {headerSlot && createPortal(
            <div data-rk="" style={{ display: 'contents' }}>
              <WalletHeader autoOpenConnect={autoOpenConnect} />
            </div>,
            headerSlot,
          )}
          {showMain && createPortal(
            <div data-rk="" style={{ display: 'contents' }}>
              <WalletMain
                tab={tab}
                punkData={punkData}
                eligiblePunks={eligiblePunks}
                onNavigate={onNavigate}
              />
            </div>,
            mainSlot,
          )}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

export default WalletIslands;

import { useState, useEffect, useRef } from 'react';
import { ConnectButton, useConnectModal } from '@rainbow-me/rainbowkit';
import { useAccount, useSwitchChain } from 'wagmi';
import { IS_MAINNET, TARGET_CHAIN } from '../lib/network';
import { useNetwork } from '../lib/useNetwork';

// Opens the connect modal once, for a click on the pre-load placeholder button.
function AutoOpenConnect() {
  const { openConnectModal } = useConnectModal();
  const done = useRef(false);
  useEffect(() => {
    if (openConnectModal && !done.current) {
      done.current = true;
      openConnectModal();
    }
  }, [openConnectModal]);
  return null;
}

// The wallet controls in the site header: Add Testnet / Wrong network + ConnectButton.
// Rendered through a portal into the shell's `.connect-wrapper`.
function WalletHeader({ autoOpenConnect }) {
  const { connector } = useAccount();
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

  return (
    <>
      {autoOpenConnect && <AutoOpenConnect />}
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
    </>
  );
}

export default WalletHeader;

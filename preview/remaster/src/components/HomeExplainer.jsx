import { IS_MAINNET } from '../lib/network';
import './HomeExplainer.css';

const STEPS = [
  { title: 'Connect', body: 'Connect the wallet that holds your punk.' },
  { title: 'Mint', body: "Mint the remaster from My Punks. It's free apart from gas." },
  {
    title: 'It stays with your punk',
    body: "The remaster is soulbound: it can't be sold or sent on its own, and whoever owns the punk owns the remaster.",
  },
];

function HomeExplainer({ onNavigate, onTrait }) {
  const go = (fn) => (e) => { e.preventDefault(); if (fn) fn(); };
  return (
    <div className="explainer">
      <h2 className="explainer-title">How it works</h2>
      <ol className="explainer-steps">
        {STEPS.map((s) => (
          <li key={s.title} className="explainer-step">
            <strong>{s.title}</strong>
            <span>{s.body}</span>
          </li>
        ))}
      </ol>
      <div className="explainer-cta">
        <button className="btn" onClick={() => onNavigate && onNavigate('wallet')}>Go to My Punks</button>
      </div>

      <h2 className="explainer-title">FAQ</h2>
      {!IS_MAINNET && (
        <p className="explainer-note">Minting is live on the Sepolia testnet for now. Mainnet is coming soon.</p>
      )}
      <div className="explainer-faq">
        <details>
          <summary>What is a remaster?</summary>
          <p>
            A cleaned-up version of your punk's pixel art that fixes small drawing quirks in some traits.
            Same punk, same traits. Use "Can't see the difference?" above to spot the changed pixels.
          </p>
        </details>
        <details>
          <summary>What does soulbound mean here?</summary>
          <p>
            The remaster can't be transferred. Its owner is read straight from the CryptoPunks contract,
            so when the punk sells, the remaster goes with it automatically.
          </p>
        </details>
        <details>
          <summary>What does it cost?</summary>
          <p>Nothing apart from the Ethereum gas for the mint transaction.</p>
        </details>
        <details>
          <summary>Which punks are eligible?</summary>
          <p>
            3,434 of 10,000: the ones with a trait the remaster changes. Browse{' '}
            <a href="#gallery" onClick={go(() => onTrait && onTrait(null))}>all remasters</a> or{' '}
            <a href="#lookup" onClick={go(() => onNavigate && onNavigate('lookup'))}>look up a punk</a>.
          </p>
        </details>
        <details>
          <summary>My punk is wrapped.</summary>
          <p>Wrapped punks are held by the wrapper contract, so unwrap it first, then mint. If you wrap it again later, the remaster follows the punk to the wrapper contract.</p>
        </details>
        <details>
          <summary>What does "Sync to marketplaces" do?</summary>
          <p>
            After a punk changes hands, marketplaces can keep showing the old remaster owner. Sync records
            the current owner onchain so they update. It's optional, and anyone can do it (gas only).
          </p>
        </details>
      </div>
    </div>
  );
}

export default HomeExplainer;

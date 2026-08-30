# Remastered Punks — Handoff

## What This Is

An NFT collection pairing remastered artwork with specific CryptoPunks. Ownership is **dynamic** — the remastered token follows the original punk via on-chain lookup, no transfers needed.

**Eligible punks**: 3,558 (punks with traits that have remastered artwork).

---

## Repo Structure

```
remastered-punks/
├── contracts/              # Foundry project — RemasteredPunks.sol
│   ├── src/                # Contract source (ERC721 + soulbound + merkle)
│   ├── test/               # 24 unit tests (all passing)
│   └── script/             # Deployment script (mainnet + testnet)
├── api/                    # Vercel serverless API — renders remastered PNGs
│   ├── remaster.js         # Server-side compositing (uses @napi-rs/canvas)
│   ├── sprites.js          # Sprite extraction + pixel manipulation helpers
│   ├── constants.js        # Sprite IDs, layer order, skin colors, fill configs
│   ├── remaster-logic.js   # Determines which remasters apply to a punk
│   ├── data.js             # Punk data loading
│   ├── [punkId].js         # GET /api/[punkId] — returns remastered PNG
│   └── server.js           # Local Express dev server
├── lib/                    # Shared code (used by both API and frontend)
│   ├── constants.js        # Canonical sprite IDs, colors, layer order
│   └── remaster-logic.js   # Canonical remaster logic
├── preview/                # Dev tools and preview pages
│   ├── remaster/           # Vite + React frontend app
│   │   └── src/lib/        # Frontend compositing (mirrors api/remaster.js)
│   ├── composite.html      # Side-by-side compositing debugger
│   ├── traits.html         # All-traits gallery with compositing
│   ├── remaster.html       # Full remaster preview with minting UI
│   └── ear-finder.html     # Ear pixel analysis tool
├── scripts/                # One-off data generation scripts
│   ├── generate-mapping.js # Builds punk → modifications mapping
│   ├── generate-references.js
│   ├── find-ear-pixels.js
│   ├── extract-eye-colors.js
│   └── diagnose-white-eyes.mjs  # Pixel-level eye diagnostic
├── data/                   # Generated data files
│   ├── punks.png           # Official 10K composite spritesheet
│   ├── cryptopunks-assets/ # Ruby spritesheet project (24x24 trait sprites)
│   ├── all-eligible-punks.json    # 3,558 eligible punk IDs
│   ├── eligible-punk-traits.json  # Punk ID → {gender, skinTone, accessories}
│   ├── punk-modifications.json    # Punk ID → [modification types]
│   ├── merkle-tree.json           # Merkle tree for contract verification
│   └── *.json                     # Per-trait punk lists
├── plans/                  # Implementation plans
├── PLAN.md                 # Architecture and design doc
└── contracts/README.md     # Contract-specific docs
```

---

## How Compositing Works

Punks are recomposited from individual trait sprites in the `punks-24x24.png` spritesheet:

1. **Draw base head** — selected by gender + skin tone (or type for Zombie/Ape/Alien)
2. **Fix female eyes** — the `f,s` base sprites lack eyes; we paint 4 pixels (2 black pupils + 2 white sclera at y=12) and fix shadow at y=13
3. **Shift ear** (if applicable) — moves ear pixels down 1px for ear-visible hairstyles
4. **Draw accessories** sorted by layer order: `base → cheeks → blemish → hair → beard → eyes → eyewear → nose → mouth → mouthprop → earring → headgear → neck`
5. **Apply remaster modifications** — shift shades/earring down, add bridge pixels to small shades, extend front beard, etc.
6. **Post-compositing fills** — pixel-level fixes for specific hairstyle/ear interactions

Sprite IDs are mapped per-gender in `FEMALE_SPRITE_IDS` and `MALE_SPRITE_IDS` (constants.js).

---

## Remaster Types

| Type | What Changes | Affected Punks |
|------|-------------|----------------|
| `shades` | Regular Shades shifted down 1px | Females with Regular Shades + ear-visible hair |
| `ear` | Ear shifted down 1px on base sprite | Females with ear-visible hairstyles |
| `earring` | Earring shifted down 1px | Females with Earring + ear-visible hair |
| `smallShades` | Bridge pixels added at (11, 12-13) | Males with Small Shades |
| `frontBeard` / `frontBeardDark` | Beard extended at (10,20) and (14,20) | Males with Front Beard variants |
| `choker` | Choker redrawn at (9-11, 22) | Females with Choker |

---

## Smart Contract Status

**Fully implemented** at `contracts/src/RemasteredPunks.sol`:
- Soulbound ERC721 with dynamic ownership via `punkIndexToAddress()`
- Merkle proof verification for eligibility
- Activate / deactivate / reactivate flow
- EIP-5192 compliance, transfer + approval blocking
- 24 tests passing

**Not yet deployed** — deployment script ready, needs:
- Sepolia mock CryptoPunks address (placeholder in Deploy.s.sol:12)
- Real IPFS base URI (currently `ipfs://QmPlaceholder/`)
- `PRIVATE_KEY` env var for broadcasting

---

## Frontend Status

Vite + React app in `preview/remaster/`:
- Wallet connection via WalletConnect/Reown
- Punk lookup by ID
- Browse eligible punks
- Side-by-side original vs remastered comparison
- Mint button (calls `activate()` on contract)
- All Traits gallery tab

Deployed to GitHub Pages via `gh-pages` branch.

---

## Known Issues / Recent Fixes

### Fixed: White eyes on female punks (601498a)
The `f,s` female base sprites in the spritesheet don't include eyes — just skin-toned pixels at y=12 and white at y=13. Fixed by painting 4 eye pixels (pupils + sclera) onto the base during compositing. Diagnostic script at `scripts/diagnose-white-eyes.mjs`.

### Watch out for
- **Compositing code exists in 4 places**: `api/remaster.js`, `preview/remaster/src/lib/remaster.js`, `preview/remaster.html`, `preview/traits.html`. Keep them in sync.
- **`lib/` is shared** but `api/` and `preview/remaster/` each have their own `constants.js` copies due to Vercel serverless constraints. The canonical source is `lib/`.
- **Sprite IDs differ between male and female** — always check which `SPRITE_IDS` map is being used.
- **Ear shift is complex** — different hairstyles need different fill colors/patterns after the ear moves (see `TRAIT_FILL_COLORS` in constants.js).

---

## What's Left to Ship

1. **IPFS upload** — Generate final 3,558 remastered images + metadata JSON, pin to IPFS
2. **Testnet deployment** — Deploy mock CryptoPunks to Sepolia, then deploy contract
3. **Integration testing** — Test activate/deactivate flow end-to-end on testnet
4. **Mainnet deployment** — Deploy with real CryptoPunks address + IPFS URI
5. **Frontend production build** — Point at mainnet contract, deploy

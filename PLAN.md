# Remastered Punks - Implementation Plan

## Overview

An NFT collection that pairs remastered artwork with specific CryptoPunks. The remastered token's ownership **dynamically follows** the original punk - if you transfer your punk, the remastered version goes with it automatically.

## Trait Modifications

| Trait | Count | Modification |
|-------|-------|--------------|
| Regular Shades Female | 128 | Art modification |
| Front Beard Dark | 260 | Art modification |
| Choker | 48 | Art modification |
| Small Shades | 378 | Art modification |
| Ear Visible Female | 1,554 | Move ear 1 pixel down |
| **Total Unique** | **2,291** | (some punks have multiple) |

### Ear Visible Hairstyles (Female)
Bandana, Headband, Cap, Knitted Cap, Mohawk, Mohawk Dark, Mohawk Thin, Red Mohawk, Half Shaved, Tiara, Pilot Helmet, Tassle Hat, Welding Goggles

*Note: Special cases to be handled later*

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (Next.js)                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │ Connect      │  │ View Eligible│  │ Activate Remastered  │   │
│  │ Wallet       │→ │ Punks        │→ │ (one-time claim)     │   │
│  └──────────────┘  └──────────────┘  └──────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Ethereum Mainnet                              │
│                                                                  │
│  ┌──────────────────────┐    ┌────────────────────────────────┐ │
│  │ CryptoPunks Contract │    │ RemasteredPunks Contract       │ │
│  │ 0xb47e3cd837dDF8e4c57│◄───│                                │ │
│  │                      │    │ Key Innovation:                │ │
│  │ punkIndexToAddress() │    │ ownerOf(tokenId) returns       │ │
│  └──────────────────────┘    │ cryptoPunks.punkIndexToAddress │ │
│                              │ (tokenId)                      │ │
│                              │                                │ │
│                              │ - No transfers (disabled)      │ │
│                              │ - Ownership follows punk       │ │
│                              │ - One-time activation          │ │
│                              └────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         IPFS / Pinata                            │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ 2,291 Remastered Images + Metadata                        │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Smart Contract

### Contract: `RemasteredPunks.sol`

**Key Innovation: Dynamic Ownership**
- `ownerOf(tokenId)` doesn't store ownership - it queries CryptoPunks contract in real-time
- Token "exists" once activated, but ownership always mirrors the original punk
- Transfers are disabled (revert) - ownership changes happen via the punk itself

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

interface ICryptoPunks {
    function punkIndexToAddress(uint256 punkIndex) external view returns (address);
}

contract RemasteredPunks is ERC721 {
    ICryptoPunks public immutable cryptoPunks;
    bytes32 public immutable merkleRoot;
    string public baseURI;

    // Tracks which punks have been activated (not ownership)
    mapping(uint256 => bool) public activated;
    uint256 public totalActivated;

    error NotEligible();
    error NotPunkOwner();
    error AlreadyActivated();
    error TransferDisabled();

    constructor(
        address _cryptoPunks,
        bytes32 _merkleRoot,
        string memory _baseURI
    ) ERC721("Remastered Punks", "RMPUNK") {
        cryptoPunks = ICryptoPunks(_cryptoPunks);
        merkleRoot = _merkleRoot;
        baseURI = _baseURI;
    }

    /// @notice Activate the remastered version of your punk
    /// @param punkId The CryptoPunk token ID
    /// @param merkleProof Proof that this punk is eligible
    function activate(uint256 punkId, bytes32[] calldata merkleProof) external {
        // 1. Verify punk is eligible
        bytes32 leaf = keccak256(abi.encodePacked(punkId));
        if (!MerkleProof.verify(merkleProof, merkleRoot, leaf)) {
            revert NotEligible();
        }

        // 2. Verify caller owns the punk
        if (cryptoPunks.punkIndexToAddress(punkId) != msg.sender) {
            revert NotPunkOwner();
        }

        // 3. Verify not already activated
        if (activated[punkId]) {
            revert AlreadyActivated();
        }

        // 4. Mark as activated (no actual mint - ownership is dynamic)
        activated[punkId] = true;
        totalActivated++;

        // Emit Transfer from zero address to signal "creation"
        // But actual ownership is dynamic
        emit Transfer(address(0), msg.sender, punkId);
    }

    /// @notice Dynamic ownership - returns current punk owner
    function ownerOf(uint256 tokenId) public view override returns (address) {
        if (!activated[tokenId]) {
            revert ERC721NonexistentToken(tokenId);
        }
        return cryptoPunks.punkIndexToAddress(tokenId);
    }

    /// @notice Check if token exists (has been activated)
    function _ownerOf(uint256 tokenId) internal view override returns (address) {
        if (!activated[tokenId]) {
            return address(0);
        }
        return cryptoPunks.punkIndexToAddress(tokenId);
    }

    /// @notice Disable all transfers - ownership follows the punk
    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal override returns (address) {
        address from = _ownerOf(tokenId);

        // Allow "minting" (from == 0) during activation
        if (from != address(0)) {
            revert TransferDisabled();
        }

        // Don't actually store ownership - it's dynamic
        return from;
    }

    /// @notice Balance is count of activated punks owned
    function balanceOf(address owner) public view override returns (uint256) {
        if (owner == address(0)) {
            revert ERC721InvalidOwner(address(0));
        }

        // This is expensive but necessary for ERC721 compliance
        // Consider caching or off-chain indexing for production
        uint256 count = 0;
        // Would need to iterate or use different approach
        // For now, return 0 and handle in subgraph/indexer
        return count;
    }

    /// @notice Get token URI
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        if (!activated[tokenId]) {
            revert ERC721NonexistentToken(tokenId);
        }
        return string(abi.encodePacked(baseURI, Strings.toString(tokenId), ".json"));
    }

    /// @notice Total supply of activated tokens
    function totalSupply() external view returns (uint256) {
        return totalActivated;
    }
}
```

### Design Decisions

1. **Dynamic `ownerOf()`**: Queries CryptoPunks contract every time - no stale ownership
2. **No actual minting**: `activate()` just sets a flag; ownership is computed
3. **Transfers disabled**: `_update()` reverts for any transfer attempt
4. **`balanceOf()` challenge**: Expensive to compute on-chain; handle via indexer/subgraph
5. **Merkle proof**: Verifies punk is in eligible set (2,291 punks)

---

## Phase 2: Metadata & Art

### Art Modifications Required

1. **Regular Shades Female** (128 punks) - Modified shades art
2. **Front Beard Dark** (260 punks) - Modified beard art
3. **Choker** (48 punks) - Modified choker art
4. **Small Shades** (378 punks) - Modified shades art
5. **Ear Visible Female** (1,554 punks) - Ear moved 1px down

### Multi-Trait Handling
Some punks have multiple modifications. Need to apply all relevant changes:
- Example: Punk #70 has Regular Shades + is Female with visible ear
- Both modifications apply to the final remastered image

### Directory Structure
```
metadata/
├── images/
│   ├── 70.png
│   ├── 94.png
│   └── ...        # 2,291 images
└── json/
    ├── 70.json
    ├── 94.json
    └── ...        # 2,291 metadata files
```

### Metadata Format
```json
{
  "name": "Remastered Punk #70",
  "description": "A remastered version of CryptoPunk #70, paired to the original.",
  "image": "ipfs://Qm.../70.png",
  "attributes": [
    { "trait_type": "Original Punk", "value": 70 },
    { "trait_type": "Modifications", "value": "Regular Shades, Ear Position" },
    { "trait_type": "Paired", "value": "Yes" }
  ]
}
```

---

## Phase 3: Frontend

### Tech Stack
- Next.js 14 (App Router)
- wagmi v2 + viem
- Tailwind CSS

### Pages

1. **Home** (`/`) - Explain the project, connect wallet
2. **My Punks** (`/my-punks`) - Show user's eligible punks, activation status
3. **Gallery** (`/gallery`) - Browse all 2,291 eligible punks
4. **Punk Detail** (`/punk/[id]`) - Side-by-side original vs remastered

### Key Features
- Show which modifications apply to each punk
- Original ↔ Remastered comparison view
- Activation transaction flow
- Real-time ownership display

---

## Phase 4: Data Files

### Generated Files
```
data/
├── punks-attributes/          # Cloned repo (done)
├── eligible-punks.json        # Regular Shades Female (128)
├── front-beard-dark.json      # Front Beard Dark (260)
├── choker.json                # Choker (48)
├── small-shades.json          # Small Shades (378)
├── ear-visible-female.json    # Ear visible females (1,554)
├── all-eligible-punks.json    # Combined unique (2,291)
└── merkle-tree.json           # Generated merkle tree
```

### Punk Modification Mapping
Need to generate a mapping showing which modifications apply to each punk:
```json
{
  "70": ["regular-shades-female", "ear-visible"],
  "94": ["regular-shades-female", "ear-visible"],
  "203": ["front-beard-dark"],
  ...
}
```

---

## Implementation Order

### Done
- [x] Clone punk attributes data
- [x] Generate trait-specific punk lists
- [x] Calculate total eligible (2,291)

### Next Steps
1. **Data & Scripts**
   - [ ] Generate punk → modifications mapping
   - [ ] Generate merkle tree from all-eligible-punks.json
   - [ ] Create metadata generation script

2. **Smart Contract**
   - [ ] Initialize Foundry project
   - [ ] Implement RemasteredPunks.sol
   - [ ] Write tests (activation, ownership, transfers blocked)
   - [ ] Deploy to Sepolia

3. **Art Pipeline**
   - [ ] Receive remastered trait artwork
   - [ ] Build image composition script
   - [ ] Generate 2,291 remastered images

4. **Frontend**
   - [ ] Initialize Next.js project
   - [ ] Build wallet connection
   - [ ] Build punk eligibility checker
   - [ ] Build activation flow

5. **Launch**
   - [ ] Upload images/metadata to IPFS
   - [ ] Deploy contract to mainnet
   - [ ] Deploy frontend

---

## Key Design Principle: What's Fixed vs Dynamic

| Aspect | Fixed/Dynamic | Notes |
|--------|---------------|-------|
| Eligible Punk IDs | **Fixed** | Merkle root set at deploy (2,291 punks) |
| Eligible Wallets | **Dynamic** | `ownerOf()` queries CryptoPunks in real-time |
| Activation Status | **Fixed** | Once activated, always activated |
| Ownership | **Dynamic** | Follows punk ownership automatically |

**Example:** Punk #70 is activated. Owner sells punk #70 to someone else. New owner now owns remastered #70 automatically - no claim needed.

---

## Admin Functions (Optional)

The contract can include owner-controlled functions:
- `setBaseURI(string)` - Update metadata location
- `pause()` / `unpause()` - Emergency pause activations

The merkle root (eligible punks) remains immutable.

---

## Security Notes

1. **Dynamic ownership**: Can't be gamed - always queries CryptoPunks contract
2. **Merkle root**: Immutable eligible set (2,291 punks)
3. **No re-entrancy risk**: Simple state changes only
4. **Activation is one-time**: Can't be undone or re-activated

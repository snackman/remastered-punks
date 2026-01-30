// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

interface ICryptoPunks {
    function punkIndexToAddress(uint256 punkIndex) external view returns (address);
}

/// @title RemasteredPunks
/// @notice NFT collection where ownership dynamically follows the original CryptoPunk
/// @dev Implements EIP-5192 (Soulbound) - tokens cannot be transferred, only activated/deactivated
contract RemasteredPunks is ERC721 {
    using Strings for uint256;

    ICryptoPunks public immutable cryptoPunks;
    bytes32 public immutable merkleRoot;
    string public baseURI;

    /// @notice Tracks which punks have been activated (not ownership - that's dynamic)
    mapping(uint256 => bool) public activated;
    uint256 public totalActivated;

    error NotEligible();
    error NotPunkOwner();
    error AlreadyActivated();
    error TransferDisabled();
    error NotActivated();

    /// @notice EIP-5192 event - emitted when token lock status changes
    event Locked(uint256 tokenId);

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
    /// @param merkleProof Proof that this punk is eligible for remastering
    function activate(uint256 punkId, bytes32[] calldata merkleProof) external {
        // 1. Verify punk is eligible via merkle proof
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

        // 4. Mark as activated
        activated[punkId] = true;
        totalActivated++;

        // Emit Transfer from zero address to signal "creation"
        emit Transfer(address(0), msg.sender, punkId);

        // EIP-5192: Signal that this token is locked (soulbound)
        emit Locked(punkId);
    }

    /// @notice Deactivate (burn) your remastered punk
    /// @dev Can be reactivated later by calling activate() again
    /// @param punkId The CryptoPunk token ID
    function deactivate(uint256 punkId) external {
        // Must own the punk
        if (cryptoPunks.punkIndexToAddress(punkId) != msg.sender) {
            revert NotPunkOwner();
        }

        // Must be activated
        if (!activated[punkId]) {
            revert NotActivated();
        }

        activated[punkId] = false;
        totalActivated--;

        // Emit burn event
        emit Transfer(msg.sender, address(0), punkId);
    }

    /// @notice Dynamic ownership - returns current punk owner
    /// @dev Queries CryptoPunks contract in real-time, no stored ownership
    function ownerOf(uint256 tokenId) public view override returns (address) {
        if (!activated[tokenId]) {
            revert ERC721NonexistentToken(tokenId);
        }
        return cryptoPunks.punkIndexToAddress(tokenId);
    }

    /// @notice Internal ownership check
    function _ownerOf(uint256 tokenId) internal view override returns (address) {
        if (!activated[tokenId]) {
            return address(0);
        }
        return cryptoPunks.punkIndexToAddress(tokenId);
    }

    /// @notice Disable all transfers - ownership follows the punk automatically
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

    /// @notice Balance is expensive to compute on-chain
    /// @dev For accurate balance, use an indexer/subgraph
    function balanceOf(address owner) public view override returns (uint256) {
        if (owner == address(0)) {
            revert ERC721InvalidOwner(address(0));
        }
        // Returning 0 here - use off-chain indexing for accurate counts
        // A full implementation would iterate all 2,291 eligible punks
        return 0;
    }

    /// @notice Get token URI for metadata
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        if (!activated[tokenId]) {
            revert ERC721NonexistentToken(tokenId);
        }
        return string(abi.encodePacked(baseURI, tokenId.toString(), ".json"));
    }

    /// @notice Total supply of activated tokens
    function totalSupply() external view returns (uint256) {
        return totalActivated;
    }

    /// @notice Block approvals to prevent marketplace listings
    function approve(address, uint256) public pure override {
        revert TransferDisabled();
    }

    /// @notice Block approvals to prevent marketplace listings
    function setApprovalForAll(address, bool) public pure override {
        revert TransferDisabled();
    }

    /// @notice EIP-5192: Check if token is locked (always true for soulbound)
    function locked(uint256 tokenId) external view returns (bool) {
        if (!activated[tokenId]) {
            revert ERC721NonexistentToken(tokenId);
        }
        return true; // Always locked - cannot be transferred
    }

    /// @notice EIP-165: Interface detection
    function supportsInterface(bytes4 interfaceId) public view override returns (bool) {
        return
            interfaceId == 0xb45a3c0e || // EIP-5192 (Soulbound)
            super.supportsInterface(interfaceId);
    }
}

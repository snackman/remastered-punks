// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/RemasteredPunks.sol";
import "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";

/// @dev Mock CryptoPunks contract for testing
contract MockCryptoPunks {
    mapping(uint256 => address) public punkIndexToAddress;

    function setPunkOwner(uint256 punkId, address owner) external {
        punkIndexToAddress[punkId] = owner;
    }
}

contract RemasteredPunksTest is Test {
    RemasteredPunks public remastered;
    MockCryptoPunks public punks;

    address public alice = address(0xA11CE);
    address public bob = address(0xB0B);

    // Test with a simple merkle tree of 3 eligible punks: 70, 94, 203
    // Leaf: keccak256(abi.encodePacked(uint256))
    bytes32 public leaf70 = keccak256(abi.encodePacked(uint256(70)));
    bytes32 public leaf94 = keccak256(abi.encodePacked(uint256(94)));
    bytes32 public leaf203 = keccak256(abi.encodePacked(uint256(203)));

    // For a 3-leaf tree:
    // Level 0 (leaves): [leaf70, leaf94, leaf203, leaf203] (padded)
    // Level 1: [hash(leaf70, leaf94), hash(leaf203, leaf203)]
    // Level 2 (root): hash(level1[0], level1[1])

    bytes32 public hash70_94;
    bytes32 public hash203_203;
    bytes32 public merkleRoot;

    bytes32[] public proof70;
    bytes32[] public proof94;
    bytes32[] public proof203;

    function setUp() public {
        // Deploy mock CryptoPunks
        punks = new MockCryptoPunks();

        // Set up punk owners
        punks.setPunkOwner(70, alice);
        punks.setPunkOwner(94, alice);
        punks.setPunkOwner(203, bob);
        punks.setPunkOwner(1, bob); // Punk 1 is NOT eligible

        // Build merkle tree
        // Sort pairs for consistent hashing
        if (leaf70 < leaf94) {
            hash70_94 = keccak256(abi.encodePacked(leaf70, leaf94));
        } else {
            hash70_94 = keccak256(abi.encodePacked(leaf94, leaf70));
        }

        hash203_203 = keccak256(abi.encodePacked(leaf203, leaf203));

        if (hash70_94 < hash203_203) {
            merkleRoot = keccak256(abi.encodePacked(hash70_94, hash203_203));
        } else {
            merkleRoot = keccak256(abi.encodePacked(hash203_203, hash70_94));
        }

        // Build proofs
        // Proof for 70: [leaf94, hash203_203]
        proof70 = new bytes32[](2);
        proof70[0] = leaf94;
        proof70[1] = hash203_203;

        // Proof for 94: [leaf70, hash203_203]
        proof94 = new bytes32[](2);
        proof94[0] = leaf70;
        proof94[1] = hash203_203;

        // Proof for 203: [leaf203, hash70_94]
        proof203 = new bytes32[](2);
        proof203[0] = leaf203;
        proof203[1] = hash70_94;

        // Deploy RemasteredPunks
        remastered = new RemasteredPunks(
            address(punks),
            merkleRoot,
            "ipfs://QmTest/"
        );
    }

    // ============ Activation Tests ============

    function test_ActivateSuccess() public {
        vm.prank(alice);
        remastered.activate(70, proof70);

        assertTrue(remastered.activated(70));
        assertEq(remastered.ownerOf(70), alice);
        assertEq(remastered.totalActivated(), 1);
    }

    function test_ActivateEmitsTransfer() public {
        vm.prank(alice);
        vm.expectEmit(true, true, true, true);
        emit IERC721.Transfer(address(0), alice, 70);
        remastered.activate(70, proof70);
    }

    function test_ActivateEmitsLocked() public {
        vm.prank(alice);
        vm.expectEmit(true, false, false, false);
        emit RemasteredPunks.Locked(70);
        remastered.activate(70, proof70);
    }

    function test_ActivateFailsNotEligible() public {
        // Punk 1 is not in the merkle tree
        bytes32[] memory fakeProof = new bytes32[](2);
        fakeProof[0] = leaf94;
        fakeProof[1] = hash203_203;

        vm.prank(bob);
        vm.expectRevert(RemasteredPunks.NotEligible.selector);
        remastered.activate(1, fakeProof);
    }

    function test_ActivateFailsNotOwner() public {
        // Bob doesn't own punk 70
        vm.prank(bob);
        vm.expectRevert(RemasteredPunks.NotPunkOwner.selector);
        remastered.activate(70, proof70);
    }

    function test_ActivateFailsAlreadyActivated() public {
        vm.prank(alice);
        remastered.activate(70, proof70);

        vm.prank(alice);
        vm.expectRevert(RemasteredPunks.AlreadyActivated.selector);
        remastered.activate(70, proof70);
    }

    // ============ Dynamic Ownership Tests ============

    function test_OwnershipFollowsPunk() public {
        // Alice activates punk 70
        vm.prank(alice);
        remastered.activate(70, proof70);
        assertEq(remastered.ownerOf(70), alice);

        // Punk 70 is "transferred" to Bob (simulated by updating mock)
        punks.setPunkOwner(70, bob);

        // Remastered ownership now follows
        assertEq(remastered.ownerOf(70), bob);
    }

    function test_OwnerOfRevertsIfNotActivated() public {
        vm.expectRevert(abi.encodeWithSelector(IERC721Errors.ERC721NonexistentToken.selector, 70));
        remastered.ownerOf(70);
    }

    // ============ Transfer Blocking Tests ============

    function test_TransferFromReverts() public {
        vm.prank(alice);
        remastered.activate(70, proof70);

        vm.prank(alice);
        vm.expectRevert(RemasteredPunks.TransferDisabled.selector);
        remastered.transferFrom(alice, bob, 70);
    }

    function test_SafeTransferFromReverts() public {
        vm.prank(alice);
        remastered.activate(70, proof70);

        vm.prank(alice);
        vm.expectRevert(RemasteredPunks.TransferDisabled.selector);
        remastered.safeTransferFrom(alice, bob, 70);
    }

    // ============ Approval Blocking Tests ============

    function test_ApproveReverts() public {
        vm.prank(alice);
        remastered.activate(70, proof70);

        vm.prank(alice);
        vm.expectRevert(RemasteredPunks.TransferDisabled.selector);
        remastered.approve(bob, 70);
    }

    function test_SetApprovalForAllReverts() public {
        vm.prank(alice);
        vm.expectRevert(RemasteredPunks.TransferDisabled.selector);
        remastered.setApprovalForAll(bob, true);
    }

    // ============ Deactivate Tests ============

    function test_DeactivateSuccess() public {
        vm.prank(alice);
        remastered.activate(70, proof70);
        assertEq(remastered.totalActivated(), 1);

        vm.prank(alice);
        remastered.deactivate(70);

        assertFalse(remastered.activated(70));
        assertEq(remastered.totalActivated(), 0);
    }

    function test_DeactivateEmitsBurn() public {
        vm.prank(alice);
        remastered.activate(70, proof70);

        vm.prank(alice);
        vm.expectEmit(true, true, true, true);
        emit IERC721.Transfer(alice, address(0), 70);
        remastered.deactivate(70);
    }

    function test_DeactivateFailsNotOwner() public {
        vm.prank(alice);
        remastered.activate(70, proof70);

        vm.prank(bob);
        vm.expectRevert(RemasteredPunks.NotPunkOwner.selector);
        remastered.deactivate(70);
    }

    function test_DeactivateFailsNotActivated() public {
        vm.prank(alice);
        vm.expectRevert(RemasteredPunks.NotActivated.selector);
        remastered.deactivate(70);
    }

    // ============ Reactivate Tests ============

    function test_ReactivateAfterDeactivate() public {
        // Activate
        vm.prank(alice);
        remastered.activate(70, proof70);

        // Deactivate
        vm.prank(alice);
        remastered.deactivate(70);

        // Reactivate
        vm.prank(alice);
        remastered.activate(70, proof70);

        assertTrue(remastered.activated(70));
        assertEq(remastered.totalActivated(), 1);
    }

    function test_NewOwnerCanReactivate() public {
        // Alice activates
        vm.prank(alice);
        remastered.activate(70, proof70);

        // Alice deactivates
        vm.prank(alice);
        remastered.deactivate(70);

        // Punk transfers to Bob
        punks.setPunkOwner(70, bob);

        // Bob can reactivate
        vm.prank(bob);
        remastered.activate(70, proof70);

        assertTrue(remastered.activated(70));
        assertEq(remastered.ownerOf(70), bob);
    }

    // ============ EIP-5192 Tests ============

    function test_LockedReturnsTrue() public {
        vm.prank(alice);
        remastered.activate(70, proof70);

        assertTrue(remastered.locked(70));
    }

    function test_LockedRevertsIfNotActivated() public {
        vm.expectRevert(abi.encodeWithSelector(IERC721Errors.ERC721NonexistentToken.selector, 70));
        remastered.locked(70);
    }

    function test_SupportsEIP5192Interface() public {
        // EIP-5192 interface ID: 0xb45a3c0e
        assertTrue(remastered.supportsInterface(0xb45a3c0e));
    }

    function test_SupportsERC721Interface() public {
        // ERC721 interface ID: 0x80ac58cd
        assertTrue(remastered.supportsInterface(0x80ac58cd));
    }

    // ============ Metadata Tests ============

    function test_TokenURI() public {
        vm.prank(alice);
        remastered.activate(70, proof70);

        assertEq(remastered.tokenURI(70), "ipfs://QmTest/70.json");
    }

    function test_TokenURIRevertsIfNotActivated() public {
        vm.expectRevert(abi.encodeWithSelector(IERC721Errors.ERC721NonexistentToken.selector, 70));
        remastered.tokenURI(70);
    }

    // ============ Supply Tests ============

    function test_TotalSupply() public {
        assertEq(remastered.totalSupply(), 0);

        vm.prank(alice);
        remastered.activate(70, proof70);
        assertEq(remastered.totalSupply(), 1);

        vm.prank(alice);
        remastered.activate(94, proof94);
        assertEq(remastered.totalSupply(), 2);

        vm.prank(bob);
        remastered.activate(203, proof203);
        assertEq(remastered.totalSupply(), 3);
    }
}

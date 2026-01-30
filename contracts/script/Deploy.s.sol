// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/RemasteredPunks.sol";

contract DeployRemasteredPunks is Script {
    // CryptoPunks mainnet address
    address constant CRYPTOPUNKS_MAINNET = 0xb47e3cd837dDF8e4c57F05d70Ab865de6e193BBB;

    // CryptoPunks Sepolia mock (you'll need to deploy this or use an existing mock)
    address constant CRYPTOPUNKS_SEPOLIA = address(0); // TODO: Set after deploying mock

    // Merkle root for 2,291 eligible punks
    bytes32 constant MERKLE_ROOT = 0xe9a0a3506c7d467a484add1d5375860039d558aeaf0607d4bb78ff25ada9d1a9;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        string memory baseURI = vm.envOr("BASE_URI", string("ipfs://QmPlaceholder/"));
        address cryptoPunksAddress = vm.envOr("CRYPTOPUNKS_ADDRESS", CRYPTOPUNKS_MAINNET);

        vm.startBroadcast(deployerPrivateKey);

        RemasteredPunks remastered = new RemasteredPunks(
            cryptoPunksAddress,
            MERKLE_ROOT,
            baseURI
        );

        console.log("RemasteredPunks deployed to:", address(remastered));
        console.log("CryptoPunks address:", cryptoPunksAddress);
        console.log("Merkle root:", vm.toString(MERKLE_ROOT));
        console.log("Base URI:", baseURI);

        vm.stopBroadcast();
    }
}

/// @notice Deploy a mock CryptoPunks contract for testing on testnets
contract DeployMockCryptoPunks is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);

        MockCryptoPunksForDeploy mock = new MockCryptoPunksForDeploy();
        console.log("MockCryptoPunks deployed to:", address(mock));

        vm.stopBroadcast();
    }
}

/// @dev Simple mock for testnet deployment
contract MockCryptoPunksForDeploy {
    mapping(uint256 => address) public punkIndexToAddress;

    function setPunkOwner(uint256 punkId, address owner) external {
        punkIndexToAddress[punkId] = owner;
    }

    // Allow anyone to "claim" a punk for testing
    function claimPunk(uint256 punkId) external {
        require(punkIndexToAddress[punkId] == address(0), "Already claimed");
        punkIndexToAddress[punkId] = msg.sender;
    }
}

const { keccak256, encodePacked } = require('viem');
const fs = require('fs');
const path = require('path');

// Read eligible punks
const eligiblePunksPath = path.join(__dirname, '../../data/all-eligible-punks.json');
const eligiblePunks = JSON.parse(fs.readFileSync(eligiblePunksPath, 'utf-8'));

console.log(`Generating Merkle tree for ${eligiblePunks.length} eligible punks...`);

// Generate leaves: keccak256(abi.encodePacked(uint256(punkId)))
function generateLeaf(punkId) {
  return keccak256(encodePacked(['uint256'], [BigInt(punkId)]));
}

// Build merkle tree
function buildMerkleTree(leaves) {
  if (leaves.length === 0) return [];

  const tree = [leaves];

  while (tree[tree.length - 1].length > 1) {
    const currentLevel = tree[tree.length - 1];
    const nextLevel = [];

    for (let i = 0; i < currentLevel.length; i += 2) {
      const left = currentLevel[i];
      const right = currentLevel[i + 1] || left; // Duplicate last if odd

      // Sort to ensure consistent ordering (OpenZeppelin MerkleProof expects this)
      const [a, b] = left < right ? [left, right] : [right, left];
      nextLevel.push(keccak256(encodePacked(['bytes32', 'bytes32'], [a, b])));
    }

    tree.push(nextLevel);
  }

  return tree;
}

// Get proof for a specific leaf
function getProof(tree, leafIndex) {
  const proof = [];
  let index = leafIndex;

  for (let level = 0; level < tree.length - 1; level++) {
    const currentLevel = tree[level];
    const siblingIndex = index % 2 === 0 ? index + 1 : index - 1;

    if (siblingIndex < currentLevel.length) {
      proof.push(currentLevel[siblingIndex]);
    } else {
      // Odd number of elements, sibling is itself
      proof.push(currentLevel[index]);
    }

    index = Math.floor(index / 2);
  }

  return proof;
}

// Generate all leaves
const leaves = eligiblePunks.map(punkId => generateLeaf(punkId));

// Sort leaves for consistent tree structure
const sortedLeaves = [...leaves].sort((a, b) => (a < b ? -1 : 1));
const sortedPunks = eligiblePunks
  .map((punkId, i) => ({ punkId, leaf: leaves[i] }))
  .sort((a, b) => (a.leaf < b.leaf ? -1 : 1));

// Build tree with sorted leaves
const tree = buildMerkleTree(sortedLeaves);
const merkleRoot = tree[tree.length - 1][0];

console.log(`Merkle Root: ${merkleRoot}`);

// Generate proofs for all punks
const proofs = {};
for (let i = 0; i < sortedPunks.length; i++) {
  const { punkId, leaf } = sortedPunks[i];
  proofs[punkId] = getProof(tree, i);
}

// Output
const output = {
  merkleRoot,
  totalEligible: eligiblePunks.length,
  proofs
};

// Save to file
const outputPath = path.join(__dirname, '../../data/merkle-tree.json');
fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
console.log(`Merkle tree saved to ${outputPath}`);

// Also output just the root for easy copy
console.log('\n--- For Contract Deployment ---');
console.log(`Merkle Root: ${merkleRoot}`);

// Verify a few proofs
console.log('\n--- Verification ---');
const testPunks = [70, 94, 203, 5, 10];
for (const punkId of testPunks) {
  if (proofs[punkId]) {
    console.log(`Punk #${punkId}: ${proofs[punkId].length} proof elements`);
  }
}

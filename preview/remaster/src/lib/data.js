import { parsePunkCsv, decodeCompact } from './punkCodec';

// Load and parse punk CSV data (dev, traits/zero pages)
export async function loadPunkData(csvPath) {
  const response = await fetch(csvPath);
  return parsePunkCsv(await response.text());
}

// Load the compact punk JSON built by scripts/build-public-data.mjs (prod app).
export async function loadPunkDataCompact(jsonPath) {
  const response = await fetch(jsonPath);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return decodeCompact(await response.json());
}

// Load eligible punks list
export async function loadEligiblePunks(jsonPath) {
  const response = await fetch(jsonPath);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

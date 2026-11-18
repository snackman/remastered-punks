// Copies ONLY the data files the browser fetches into <outDir> (default dist/data),
// instead of the whole data/ folder (~11 MB of build inputs and scratch files).
// Usage: node scripts/build-public-data.mjs <outDir>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = path.join(root, 'data');

// Files fetched by the app (via dataUrl) and the dev/preview pages.
export const PUBLIC_DATA_FILES = [
  'cryptopunks-assets/punks/config/punks-24x24.png',
  'punks.png',
  'punks-attributes/original/cryptopunks.csv', // traits.js + zero.js still read the CSV
  'all-eligible-punks.json',
  'remaster-pixel-counts.json',
  'merkle-tree.json', // kept public on purpose (transparency); the app itself uses per-punk proofs
];

export function buildPublicData(outDir) {
  const missing = PUBLIC_DATA_FILES.filter((f) => !fs.existsSync(path.join(dataDir, f)));
  if (missing.length) throw new Error(`missing data files: ${missing.join(', ')}`);

  for (const f of PUBLIC_DATA_FILES) {
    const dest = path.join(outDir, f);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(path.join(dataDir, f), dest);
  }
  return PUBLIC_DATA_FILES.slice();
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const out = process.argv[2];
  if (!out) {
    console.error('usage: node scripts/build-public-data.mjs <outDir>');
    process.exit(1);
  }
  try {
    const files = buildPublicData(path.resolve(out));
    console.log(`[public-data] copied ${files.length} files to ${out}`);
  } catch (e) {
    console.error(`[public-data] ${e.message}`);
    process.exit(1);
  }
}

// ERC-721 metadata endpoint. tokenURI() returns `${baseURI}${tokenId}.json`, so a
// request comes in at /api/metadata/<id>.json (rewritten to /api/metadata/<id>).
// Returns OpenSea-style metadata; the image points at the remastered-image endpoint.
import { readFileSync } from 'fs';
import { join } from 'path';

let punkData = null;
let eligiblePunks = null;
let pixelCounts = null;

function loadPunkData(csvPath) {
  if (punkData) return punkData;
  const text = readFileSync(csvPath, 'utf-8');
  const lines = text.trim().replace(/\r\n/g, '\n').split('\n');
  punkData = {};
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const m = line.match(/^(\d+),\s*(\w+),\s*(\w+),\s*(\w*),\s*(\d+),\s*(.*)$/);
    if (m) {
      const id = parseInt(m[1]);
      const accessoriesStr = m[6].trim();
      punkData[id] = {
        id,
        type: m[2],
        gender: m[3],
        skinTone: m[4] || null,
        accessories: accessoriesStr ? accessoriesStr.split(' / ').map(a => a.trim()) : [],
      };
    }
  }
  return punkData;
}

function loadEligiblePunks(jsonPath) {
  if (eligiblePunks) return eligiblePunks;
  eligiblePunks = new Set(JSON.parse(readFileSync(jsonPath, 'utf-8')));
  return eligiblePunks;
}

function loadPixelCounts(jsonPath) {
  if (pixelCounts) return pixelCounts;
  pixelCounts = {};
  for (const { id, pixels } of JSON.parse(readFileSync(jsonPath, 'utf-8'))) pixelCounts[id] = pixels;
  return pixelCounts;
}

export default async function handler(req, res) {
  const raw = String(req.query.id ?? '').replace(/\.json$/i, '');
  const id = parseInt(raw, 10);
  if (isNaN(id) || id < 0 || id > 9999) {
    return res.status(400).json({ error: 'Invalid punk ID. Must be 0-9999.' });
  }

  const dataDir = join(process.cwd(), 'data');
  loadPunkData(join(dataDir, 'punks-attributes', 'original', 'cryptopunks.csv'));
  loadEligiblePunks(join(dataDir, 'all-eligible-punks.json'));
  loadPixelCounts(join(dataDir, 'remaster-pixel-counts.json'));

  const punk = punkData[id];
  if (!punk || !eligiblePunks.has(id)) {
    return res.status(404).json({ error: `Punk #${id} is not an eligible remaster.`, eligible: false, punkId: id });
  }

  const host = (req.headers['x-forwarded-host'] || req.headers.host || 'punksremastered.com').split(',')[0].trim();
  const proto = (req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim();
  const origin = `${proto}://${host}`;

  const attributes = [{ trait_type: 'Type', value: punk.type }];
  if (punk.type === 'Human' && punk.gender) attributes.push({ trait_type: 'Gender', value: punk.gender });
  if (punk.skinTone) attributes.push({ trait_type: 'Skin Tone', value: punk.skinTone });
  for (const a of punk.accessories) attributes.push({ trait_type: 'Accessory', value: a });
  attributes.push({ trait_type: 'Pixels Remastered', value: pixelCounts[id] || 0, display_type: 'number' });

  const metadata = {
    name: `Remastered Punk #${id}`,
    description:
      'A remastered CryptoPunk. Ownership dynamically follows the original CryptoPunk onchain — soulbound, non-transferable (EIP-5192).',
    image: `${origin}/api/${id}?size=480`,
    external_url: `${origin}/?punk=${id}#home`,
    attributes,
  };

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400');
  return res.status(200).send(JSON.stringify(metadata));
}

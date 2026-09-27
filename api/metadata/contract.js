// ERC-7572 collection metadata. contractURI() returns `${baseURI}contract.json`, so a
// request comes in at /api/metadata/contract.json (rewritten to /api/metadata/contract).
export default function handler(req, res) {
  const host = (req.headers['x-forwarded-host'] || req.headers.host || 'punksremastered.com').split(',')[0].trim();
  const proto = (req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim();
  const origin = `${proto}://${host}`;

  const metadata = {
    name: 'Remastered Punks',
    description:
      'Remastered artwork for 3,434 CryptoPunks. Each token is bound to its original punk: ownership dynamically follows the CryptoPunk onchain — soulbound, non-transferable (EIP-5192). Only the punk\'s owner can activate it.',
    image: `${origin}/favicon.png`,
    external_link: origin,
  };

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400');
  return res.status(200).send(JSON.stringify(metadata));
}

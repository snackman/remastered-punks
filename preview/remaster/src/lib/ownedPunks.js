const CRYPTOPUNKS_ADDRESS = '0xb47e3cd837dDF8e4c57F05d70Ab865de6e193BBB';

// Alchemy API key - get free key at https://alchemy.com
// For production, use environment variable: import.meta.env.VITE_ALCHEMY_API_KEY
const ALCHEMY_API_KEY = import.meta.env.VITE_ALCHEMY_API_KEY || 'demo';

/**
 * Fetch all CryptoPunks owned by an address
 * Tries multiple APIs with fallbacks
 */
export async function fetchOwnedPunks(address) {
  const normalizedAddress = address.toLowerCase();
  console.log(`Fetching punks for address: ${normalizedAddress}`);

  // Try APIs in order of reliability
  const apis = [
    { name: 'Alchemy', fn: () => fetchFromAlchemy(normalizedAddress) },
    { name: 'Reservoir', fn: () => fetchFromReservoir(normalizedAddress) },
  ];

  for (const api of apis) {
    try {
      console.log(`Trying ${api.name}...`);
      const result = await api.fn();
      console.log(`Found ${result.length} punks via ${api.name}`);
      return result;
    } catch (error) {
      console.error(`${api.name} failed:`, error.message);
    }
  }

  throw new Error('All APIs failed to fetch owned punks');
}

/**
 * Fetch from Reservoir API
 */
async function fetchFromReservoir(address) {
  const punks = [];
  let continuation = null;
  let pageCount = 0;

  do {
    const url = new URL(`https://api.reservoir.tools/users/${address}/tokens/v10`);
    url.searchParams.set('collection', CRYPTOPUNKS_ADDRESS);
    url.searchParams.set('limit', '200');
    if (continuation) {
      url.searchParams.set('continuation', continuation);
    }

    const response = await fetch(url.toString(), {
      headers: { 'accept': 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    for (const token of data.tokens || []) {
      const tokenId = token.token?.tokenId;
      if (tokenId != null) {
        punks.push(parseInt(tokenId, 10));
      }
    }

    continuation = data.continuation;
    pageCount++;
  } while (continuation && pageCount < 10);

  return [...new Set(punks)].sort((a, b) => a - b);
}

/**
 * Fetch from Alchemy NFT API
 */
async function fetchFromAlchemy(address) {
  const url = `https://eth-mainnet.g.alchemy.com/nft/v3/${ALCHEMY_API_KEY}/getNFTsForOwner?owner=${address}&contractAddresses[]=${CRYPTOPUNKS_ADDRESS}&withMetadata=false&pageSize=100`;

  const response = await fetch(url, {
    headers: { 'accept': 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const data = await response.json();
  const punks = (data.ownedNfts || [])
    .map(nft => parseInt(nft.tokenId, 10))
    .filter(id => !isNaN(id));

  return [...new Set(punks)].sort((a, b) => a - b);
}

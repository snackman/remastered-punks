import { CRYPTOPUNKS_ADDRESS } from './constants';

// Cache to prevent repeated fetches
const cache = new Map();
const CACHE_TTL = 60000; // 1 minute

/**
 * Fetch with retry logic
 */
async function fetchWithRetry(url, options = {}, maxRetries = 3) {
  let lastError;

  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, options);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return response;
    } catch (error) {
      lastError = error;
      console.warn(`Fetch attempt ${i + 1} failed:`, error.message);
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
      }
    }
  }

  throw lastError;
}

/**
 * Fetch all CryptoPunks owned by an address using Reservoir API
 */
export async function fetchOwnedPunks(address) {
  const normalizedAddress = address.toLowerCase();

  // Check cache
  const cached = cache.get(normalizedAddress);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log(`Using cached result: ${cached.punks.length} punks`);
    return cached.punks;
  }

  console.log(`Fetching punks for address: ${address}`);

  const punks = [];
  let continuation = null;
  let pageCount = 0;
  const maxPages = 10;

  do {
    const url = new URL('https://api.reservoir.tools/users/' + normalizedAddress + '/tokens/v10');
    url.searchParams.set('collection', CRYPTOPUNKS_ADDRESS);
    url.searchParams.set('limit', '200');
    url.searchParams.set('includeAttributes', 'false');
    url.searchParams.set('includeLastSale', 'false');
    url.searchParams.set('includeTopBid', 'false');
    url.searchParams.set('normalizeRoyalties', 'false');
    if (continuation) {
      url.searchParams.set('continuation', continuation);
    }

    console.log(`Fetching page ${pageCount + 1}...`);

    const response = await fetchWithRetry(url.toString(), {
      headers: {
        'accept': 'application/json',
      },
    });

    const data = await response.json();
    const tokens = data.tokens || [];
    console.log(`Page ${pageCount + 1}: found ${tokens.length} tokens`);

    for (const token of tokens) {
      const tokenId = token.token?.tokenId;
      if (tokenId !== undefined && tokenId !== null) {
        punks.push(parseInt(tokenId, 10));
      }
    }

    continuation = data.continuation;
    pageCount++;

    if (pageCount >= maxPages) {
      console.warn('Reached max page limit');
      break;
    }

    // Small delay between pages to avoid rate limiting
    if (continuation) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  } while (continuation);

  // Remove duplicates and sort
  const uniquePunks = [...new Set(punks)].sort((a, b) => a - b);
  console.log(`Total unique punks: ${uniquePunks.length}`);

  // Cache the result
  cache.set(normalizedAddress, {
    punks: uniquePunks,
    timestamp: Date.now()
  });

  return uniquePunks;
}

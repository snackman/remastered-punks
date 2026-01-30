/**
 * Fetch all CryptoPunks owned by an address using The Graph
 */
export async function fetchOwnedPunks(address) {
  const normalizedAddress = address.toLowerCase();

  console.log(`Fetching punks for address: ${normalizedAddress}`);

  // Use The Graph's CryptoPunks subgraph
  const query = `
    query GetPunks($owner: String!) {
      punks(where: { owner: $owner }, first: 1000) {
        id
      }
    }
  `;

  try {
    const response = await fetch(
      'https://api.thegraph.com/subgraphs/name/itsjerryokolo/cryptopunks',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          variables: { owner: normalizedAddress },
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    if (data.errors) {
      console.error('GraphQL errors:', data.errors);
      throw new Error(data.errors[0]?.message || 'GraphQL error');
    }

    const punks = (data.data?.punks || [])
      .map(p => parseInt(p.id, 10))
      .sort((a, b) => a - b);

    console.log(`Found ${punks.length} punks via The Graph`);
    return punks;
  } catch (error) {
    console.error('The Graph failed, trying Reservoir:', error.message);
    return fetchFromReservoir(normalizedAddress);
  }
}

/**
 * Fallback: Fetch from Reservoir API
 */
async function fetchFromReservoir(address) {
  const punks = [];
  let continuation = null;
  let pageCount = 0;

  const CRYPTOPUNKS_ADDRESS = '0xb47e3cd837dDF8e4c57F05d70Ab865de6e193BBB';

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

  console.log(`Found ${punks.length} punks via Reservoir`);
  return [...new Set(punks)].sort((a, b) => a - b);
}

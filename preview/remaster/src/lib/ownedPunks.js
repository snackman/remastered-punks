import { CRYPTOPUNKS_ADDRESS } from './constants';

/**
 * Fetch all CryptoPunks owned by an address using Reservoir API
 */
export async function fetchOwnedPunks(address) {
  const punks = [];
  let continuation = null;

  do {
    const url = new URL('https://api.reservoir.tools/users/' + address + '/tokens/v10');
    url.searchParams.set('collection', CRYPTOPUNKS_ADDRESS);
    url.searchParams.set('limit', '100');
    if (continuation) {
      url.searchParams.set('continuation', continuation);
    }

    const response = await fetch(url.toString(), {
      headers: {
        'accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch owned punks: ${response.status}`);
    }

    const data = await response.json();

    for (const token of data.tokens || []) {
      const tokenId = token.token?.tokenId;
      if (tokenId !== undefined) {
        punks.push(parseInt(tokenId, 10));
      }
    }

    continuation = data.continuation;
  } while (continuation);

  return punks.sort((a, b) => a - b);
}

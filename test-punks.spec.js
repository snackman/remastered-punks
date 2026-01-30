const { test, expect } = require('@playwright/test');

const LIVE_URL = 'https://snackman.github.io/remastered-punks/preview/remaster/dist/';
const CRYPTOPUNKS_ADDRESS = '0xb47e3cd837dDF8e4c57F05d70Ab865de6e193BBB';

test('live site header shows "Punks Remastered"', async ({ page }) => {
  await page.goto(LIVE_URL);
  await page.waitForSelector('h1', { timeout: 30000 });
  const header = await page.textContent('h1');
  expect(header).toBe('Punks Remastered');
});

test('snax.eth should have 16 CryptoPunks via Reservoir API', async ({ page }) => {
  // Navigate to the live site first (provides proper origin for CORS)
  await page.goto(LIVE_URL);
  await page.waitForLoadState('networkidle');

  // Test the Reservoir API directly in the browser context
  const result = await page.evaluate(async (contractAddress) => {
    const punks = [];
    let continuation = null;
    let pageCount = 0;

    // snax.eth resolved address
    const address = '0x8B9E9C4e39acE79c7A54FAaB3c1a9bc334D2e0ED';

    do {
      const url = new URL('https://api.reservoir.tools/users/' + address.toLowerCase() + '/tokens/v10');
      url.searchParams.set('collection', contractAddress);
      url.searchParams.set('limit', '200');
      url.searchParams.set('includeAttributes', 'false');
      url.searchParams.set('includeLastSale', 'false');
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
      const tokens = data.tokens || [];

      for (const token of tokens) {
        const tokenId = token.token?.tokenId;
        if (tokenId !== undefined && tokenId !== null) {
          punks.push(parseInt(tokenId, 10));
        }
      }

      continuation = data.continuation;
      pageCount++;

      if (pageCount >= 10) break;

      // Small delay between pages
      if (continuation) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } while (continuation);

    return {
      count: [...new Set(punks)].length,
      punkIds: [...new Set(punks)].sort((a, b) => a - b)
    };
  }, CRYPTOPUNKS_ADDRESS);

  console.log(`Found ${result.count} punks for snax.eth:`, result.punkIds);
  expect(result.count).toBe(16);
});

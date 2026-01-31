const { test, expect } = require('@playwright/test');

const LIVE_URL = 'https://snackman.github.io/remastered-punks/preview/remaster/dist/';

test('live site header shows "Punks Remastered"', async ({ page }) => {
  await page.goto(LIVE_URL + '?nocache=' + Date.now(), { waitUntil: 'networkidle' });
  await page.waitForSelector('h1', { timeout: 30000 });
  const header = await page.textContent('h1');
  console.log('Header text:', header);
  expect(header).toBe('Punks Remastered');
});

test('Lookup by ID shows punk with remaster for eligible punk #70', async ({ page }) => {
  // Punk #70 is Female with Crazy Hair (ear visible) + Regular Shades + Earring - should have remasters
  await page.goto(LIVE_URL + '?nocache=' + Date.now(), { waitUntil: 'networkidle' });

  // Click "Lookup by ID" tab
  await page.click('button:has-text("Lookup by ID")');

  // Enter punk ID and submit
  await page.fill('input[type="number"]', '70');
  await page.click('button[type="submit"]');

  // Wait for punk card to appear
  await page.waitForSelector('.punk-card', { timeout: 10000 });

  // Check that we see "Original" and "Remastered" labels (indicating remaster is shown)
  const originalLabel = await page.locator('.label:has-text("Original")').count();
  const remasteredLabel = await page.locator('.label:has-text("Remastered")').count();

  console.log('Original label count:', originalLabel);
  console.log('Remastered label count:', remasteredLabel);

  // Should show both original and remastered
  expect(originalLabel).toBeGreaterThan(0);
  expect(remasteredLabel).toBeGreaterThan(0);

  // Check for remaster badge
  const remasterBadges = await page.locator('.remaster-badge').count();
  console.log('Remaster badges count:', remasterBadges);
  expect(remasterBadges).toBeGreaterThan(0);
});

test('Lookup by ID shows no remaster for punk #1 (Ape)', async ({ page }) => {
  // Punk #1 is an Ape - no remasters available
  await page.goto(LIVE_URL + '?nocache=' + Date.now(), { waitUntil: 'networkidle' });

  await page.click('button:has-text("Lookup by ID")');
  await page.fill('input[type="number"]', '1');
  await page.click('button[type="submit"]');

  await page.waitForSelector('.punk-card', { timeout: 10000 });

  // Should show "No remaster available" message
  const noRemasterMsg = await page.locator('.no-remaster').count();
  console.log('No remaster message count:', noRemasterMsg);
  expect(noRemasterMsg).toBeGreaterThan(0);
});

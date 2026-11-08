import { expect, test } from '@playwright/test';

test('opens restaurant search from the welcome page', async ({ page }) => {
  await page.goto('/');
  await page.getByText('Explore the app', { exact: true }).click();

  await expect(page).toHaveURL(/\/search$/);
  await expect(page.getByPlaceholder('Search restaurants, dishes, areas')).toBeVisible();
});


test('finds a restaurant by separate words and clears every search filter', async ({ page }) => {
  await page.goto('/search', { waitUntil: 'domcontentloaded' });
  await expect(page.getByText('Map unavailable. Browse restaurants below.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open Luna Lu' })).toBeInViewport();
  const search = page.getByPlaceholder('Search restaurants, dishes, areas');
  await search.fill('paci newtown');

  await expect(page.getByRole('button', { name: 'Open Cafe Paci' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open Bistecca' })).toHaveCount(0);

  await page.getByText('Clear all', { exact: true }).click();
  await expect(search).toHaveValue('');
  await expect(page.getByRole('button', { name: /Remove Within .* filter/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Open Bistecca' })).toBeVisible();
});

test('creates, edits and removes a review from the personal List', async ({ page }) => {
  await page.goto('/search', { waitUntil: 'domcontentloaded' });
  await page.getByPlaceholder('Search restaurants, dishes, areas').fill('Cafe Paci');
  await page.getByRole('button', { name: 'Open Cafe Paci' }).click();
  await expect(page).toHaveURL(/\/place\/p2(?:\?|$)/);
  await page.getByText('Write a review', { exact: true }).click();

  const note = page.getByLabel('Your review note (optional)');
  await page.getByRole('button', { name: 'Increase rating by 0.01' }).click();
  await note.fill('Playwright review');
  await page.evaluate(() => {
    const markers = document.body.dataset;
    const observer = new MutationObserver(() => {
      if (document.body.textContent?.includes('Finding this place…')) markers.placeReloaded = 'true';
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  });
  await page.getByText('Share review', { exact: true }).click();
  await expect(page).toHaveURL(/\/place\/p2(?:\?|$)/);
  await expect(page.getByText('Playwright review', { exact: true })).toBeVisible();
  expect(await page.locator('body').getAttribute('data-place-reloaded')).toBeNull();

  await page.getByText('Edit review', { exact: true }).click();
  await expect(note).toHaveValue('Playwright review');
  await page.getByRole('button', { name: 'Increase rating by 0.01' }).click();
  await note.fill('Updated Playwright review');
  await page.getByText('Save changes', { exact: true }).click();
  await expect(page).toHaveURL(/\/place\/p2(?:\?|$)/);
  await expect(page.getByText('Updated Playwright review', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Go back', exact: true }).click();
  await expect(page).toHaveURL(/\/search$/);
  await page.getByRole('button', { name: 'List', exact: true }).click();
  const reviewedPlace = page.getByRole('button', { name: /Rank \d+: Cafe Paci, rated 0\.02/ });
  await expect(reviewedPlace).toBeVisible();
  await reviewedPlace.click();
  await page.getByText('Edit review', { exact: true }).click();
  await page.getByText('Delete review', { exact: true }).click();
  await expect(page.getByText('Delete review?', { exact: true })).toBeVisible();
  await page.getByText('Delete review', { exact: true }).last().click();
  await expect(page).toHaveURL(/\/place\/p2$/);
  await expect(page.getByText('Write a review', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Go back', exact: true }).click();
  await expect(page).toHaveURL(/\/list$/);
  await expect(reviewedPlace).toHaveCount(0);
});


test('filters a Combined List without renumbering its restaurants', async ({ page }) => {
  await page.goto('/list', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Combined List', exact: true }).click();
  const yourself = page.getByRole('checkbox', { name: 'Include yourself' });
  await expect(yourself).toBeChecked();
  const porcine = page.getByRole('button', { name: /Rank \d+: Porcine, rated 5\.00 out of 5\.00, 1 review/ });
  const originalLabel = await porcine.getAttribute('aria-label');

  await page.getByPlaceholder('Search restaurants').fill('Porcine');
  await expect(porcine).toHaveAttribute('aria-label', originalLabel!);
  await expect(page.getByText('1 of 3 restaurants · Original combined ranks')).toBeVisible();
  await porcine.click();
  await expect(page.getByText('Your Combined List', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Go back' }).click();
  await expect(page).toHaveURL(/\/combined-list$/);
  await expect(yourself).toBeChecked();
  await yourself.click();
  await expect(page.getByText('Select at least one person to build a Combined List.')).toBeVisible();
});

test('adjusts the overall rating with the keyboard', async ({ page }) => {
  await page.goto('/review/p2', { waitUntil: 'domcontentloaded' });
  const slider = page.getByRole('slider', { name: 'Overall rating slider' });
  await page.getByRole('button', { name: 'Go back' }).focus();
  await page.keyboard.press('Tab');
  await expect(slider).toBeFocused();
  await page.keyboard.press('End');
  await expect(slider).toHaveAttribute('aria-valuenow', '5');
  await slider.press('ArrowLeft');
  await expect(slider).toHaveAttribute('aria-valuenow', '4.99');
  await slider.press('Home');
  await expect(slider).toHaveAttribute('aria-valuenow', '0');
});

test('keeps the default search area until the user opts into device location', async ({ page, context }) => {
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ latitude: -33.8688, longitude: 151.2093 });
  await page.goto('/search', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Toggle filters' }).click();
  await expect(page.getByText('Distance from Sydney CBD', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Use my location', exact: true }).click();
  await expect(page.getByText('Distance from your location', { exact: true })).toBeVisible();
});

test('opens the List when bundled typefaces cannot load', async ({ page }) => {
  await page.route(/\.(ttf|woff2?)(\?|$)/i, route => route.abort());
  await page.goto('/list', { waitUntil: 'domcontentloaded' });
  await expect(page.getByText('YOUR PLACES', { exact: true })).toHaveCSS('font-family', /^monospace(?:,|$)/);
  await expect(page.getByRole('button', { name: 'Tasting Passport', exact: true })).toBeVisible();
});

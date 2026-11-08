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
  await page.getByText('Share review', { exact: true }).click();
  await expect(page).toHaveURL(/\/place\/p2(?:\?|$)/);
  await expect(page.getByText('Playwright review', { exact: true })).toBeVisible();

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

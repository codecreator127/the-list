import { expect, test } from '@playwright/test';

const passportEnabled = process.env.EXPO_PUBLIC_TASTING_PASSPORT_ENABLED === 'true';

test('hides Tasting Passport and redirects its direct link when disabled', async ({ page }) => {
  test.skip(passportEnabled, 'Requires Tasting Passport to be disabled.');
  await page.goto('/tasting-passport', { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(/\/list$/);
  await expect(page.getByRole('button', { name: 'Combined List', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Tasting Passport', exact: true })).toHaveCount(0);
});

test('explores an unstamped cuisine and updates Passport progress after saving a review', async ({ page }) => {
  test.skip(!passportEnabled, 'Requires EXPO_PUBLIC_TASTING_PASSPORT_ENABLED=true.');
  await page.clock.setFixedTime(new Date('2026-06-01T12:00:00Z'));
  await page.goto('/list', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Tasting Passport', exact: true }).click();
  const title = page.getByRole('heading', { name: 'Tasting Passport', exact: true });
  await expect(title).toBeVisible();
  const progress = page.getByRole('progressbar', { name: 'Weekly tasting challenge' });
  await expect(progress).toHaveAttribute('aria-valuenow', '0');
  await expect(page.getByText('3 of 11 collected.', { exact: false })).toBeVisible();

  await page.getByRole('button', { name: 'Explore Thai, stamp available', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Remove Thai filter', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open Cafe Paci', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Open Chin Chin', exact: true }).click();
  await page.getByRole('button', { name: 'Write a review', exact: true }).click();
  await page.getByRole('slider', { name: 'Overall rating slider' }).press('End');
  await page.getByRole('button', { name: 'Share review', exact: true }).click();
  await expect(page).toHaveURL(/\/place\/p5\?from=search$/);
  await page.getByRole('button', { name: 'Go back', exact: true }).click();
  await page.getByRole('button', { name: 'List', exact: true }).click();
  await page.getByRole('button', { name: 'Tasting Passport', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Explore Thai, stamp collected', exact: true })).toBeVisible();
  await expect(progress).toHaveAttribute('aria-valuenow', '1');
  await expect(page.getByText('4 of 11 collected.', { exact: false })).toBeVisible();
});

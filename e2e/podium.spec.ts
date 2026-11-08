import { expect, test } from '@playwright/test';

test('celebrates only the podium spots changed by a saved review once the List has ten places', async ({ page }) => {
  await page.goto('/search', { waitUntil: 'domcontentloaded' });
  const search = page.getByPlaceholder('Search restaurants, dishes, areas');
  const heading = page.getByRole('heading', { name: 'Your podium changed' });
  const slider = page.getByRole('slider', { name: 'Overall rating slider' });

  async function openReview(name: string, edit = false) {
    await search.fill(name);
    await page.getByRole('button', { name: 'Open ' + name, exact: true }).click();
    await page.getByRole('button', { name: edit ? 'Edit review' : 'Write a review', exact: true }).click();
    await expect(slider).toBeVisible();
  }

  async function backToSearch() {
    await expect(page).toHaveURL(/\/place\/[^?]+\?from=search$/);
    await page.getByRole('button', { name: 'Go back', exact: true }).click();
    await expect(search).toBeVisible();
  }

  for (const name of ['Cafe Paci', 'Totti’s', 'Chin Chin', 'Bar Ume', 'AP Bakery', 'Cafe Monaka']) {
    await openReview(name);
    if (name === 'Cafe Paci') await slider.press('End');
    await page.getByRole('button', { name: 'Share review', exact: true }).click();
    await backToSearch();
    await expect(heading).toHaveCount(0);
  }

  await openReview('The Apollo');
  await slider.press('End');
  await expect(heading).toHaveCount(0);
  await page.getByRole('button', { name: 'Share review', exact: true }).click();
  await expect(heading).toBeVisible();
  await expect(page.getByText('New #1', { exact: true })).toBeVisible();
  await expect(page.getByText('New #2', { exact: true })).toBeVisible();
  await expect(page.getByText('New #3', { exact: true })).toBeVisible();
  await expect(page.getByText('The Apollo', { exact: true }).last()).toBeVisible();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await backToSearch();

  await openReview('Cafe Paci', true);
  await slider.press('ArrowLeft');
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(heading).toBeVisible();
  await expect(page.getByText('New #1', { exact: true })).toHaveCount(0);
  await expect(page.getByText('New #2', { exact: true })).toBeVisible();
  await expect(page.getByText('New #3', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await backToSearch();

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openReview('Porcine', true);
  await slider.press('ArrowLeft');
  await slider.press('ArrowLeft');
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(heading).toBeVisible();
  await expect(page.getByText('New #1', { exact: true })).toHaveCount(0);
  await expect(page.getByText('New #2', { exact: true })).toHaveCount(0);
  await expect(page.getByText('New #3', { exact: true })).toBeVisible();
  await expect(page.getByTestId('podium-medal-3')).toHaveCSS('transform', 'none');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await backToSearch();
});

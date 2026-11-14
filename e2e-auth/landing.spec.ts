import { expect, test } from '@playwright/test';

test('shows full-screen startup and routes signed-out visitors to signup or sign-in', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  let releaseFonts!: () => void;
  const fonts = new Promise<void>(resolve => { releaseFonts = resolve; });
  await page.route(/\.(ttf|woff2?)(\?|$)/i, async route => {
    await fonts;
    await route.continue();
  });
  try {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const loader = page.getByRole('progressbar', { name: 'Getting your table ready…' });
    await expect(loader).toBeVisible({ timeout: 90000 });
    const viewport = page.viewportSize()!;
    expect(await loader.boundingBox()).toEqual({ x: 0, y: 0, ...viewport });
  } finally {
    releaseFonts();
  }
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.getByRole('button', { name: 'Explore the app', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Make a List worth coming back to.' })).toBeInViewport();
  await page.getByRole('button', { name: 'Start your List', exact: true }).last().click();
  await expect(page.getByText('Create your account', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Go back', exact: true }).click();
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByText('Welcome back', { exact: true })).toBeVisible();
});

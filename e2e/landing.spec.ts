import { expect, test } from '@playwright/test';

for (const width of [320, 390, 768, 960, 1024, 1440, 1920]) {
  for (const colorScheme of ['light', 'dark'] as const) {
    test(`keeps the landing page readable at ${width}px in ${colorScheme} mode`, async ({ page }) => {
      await page.addInitScript(() => localStorage.setItem('the-list-theme-mode', 'system'));
      await page.setViewportSize({ width, height: 850 });
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Every place you’ve eaten. Ranked.');
      await expect(page.getByRole('button', { name: 'Start your List' }).first()).toBeInViewport();

      const section = page.getByRole('heading', { name: 'Find a favourite you agree on.' });
      await section.scrollIntoViewIfNeeded();
      const combined = page.getByText('Combined List', { exact: true });
      await expect(combined).toBeVisible();

      const layout = await combined.evaluate(label => {
        const card = label.parentElement!.parentElement!;
        const rect = card.getBoundingClientRect();
        const rgb = (value: string) => value.match(/[\d.]+/g)!.slice(0, 3).map(Number);
        const luminance = (value: string) => rgb(value).map(channel => {
          const fraction = channel / 255;
          return fraction <= 0.04045 ? fraction / 12.92 : ((fraction + 0.055) / 1.055) ** 2.4;
        }).reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
        const background = luminance(getComputedStyle(card).backgroundColor);
        const name = label.nextElementSibling!;
        const contrasts = [label, name].map(text => {
          const foreground = luminance(getComputedStyle(text).color);
          return (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05);
        });
        const scrollOverflow = Array.from(document.querySelectorAll('body *')).some(element =>
          getComputedStyle(element).overflowX === 'auto' && element.scrollWidth > element.clientWidth + 1);
        return { theme: getComputedStyle(document.querySelector('[role=heading]')!).color, left: rect.left, right: rect.right, scrollOverflow, contrast: Math.min(...contrasts) };
      });
      expect(layout.theme).toBe(colorScheme === 'light' ? 'rgb(37, 40, 32)' : 'rgb(243, 238, 229)');
      expect(layout.left).toBeGreaterThanOrEqual(0);
      expect(layout.right).toBeLessThanOrEqual(width);
      expect(layout.scrollOverflow).toBe(false);
      expect(layout.contrast).toBeGreaterThanOrEqual(4.5);
    });
  }
}

test('landing actions open Search, Home and My List', async ({ page }) => {
  const actions = [
    { name: 'Explore the app', path: /\/search$/ },
    { name: 'Start your List', path: /\/home$/ },
    { name: 'Go to My List', path: /\/list$/ },
  ];
  for (const action of actions) {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: action.name, exact: true }).first().click();
    await expect(page).toHaveURL(action.path);
  }
});

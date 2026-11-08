import { defineConfig, devices } from '@playwright/test';

const port = 4173;
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: './e2e',
  timeout: 120_000,
  use: {
    baseURL,
    actionTimeout: 15_000,
    trace: 'retain-on-failure',
  },
  workers: 2,
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 5'] } },
  ],
  webServer: {
    command: `npm run start -- --port ${port}`,
    url: baseURL,
    timeout: 120_000,
    env: {
      CI: '1',
      EXPO_NO_DOTENV: '1',
      EXPO_PUBLIC_DATA_MODE: 'mock',
      EXPO_PUBLIC_GOOGLE_MAPS_BROWSER_API_KEY: '',
    },
  },
});

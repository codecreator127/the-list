import { defineConfig } from '@playwright/test';
import baseConfig from './playwright.config';

const baseURL = 'http://127.0.0.1:4175';

export default defineConfig({
  ...baseConfig,
  testDir: './e2e-auth',
  webServer: {
    command: 'npm run start -- --port 4175',
    url: baseURL,
    timeout: 120_000,
    env: {
      CI: '1',
      EXPO_NO_DOTENV: '1',
      EXPO_PUBLIC_DATA_MODE: 'firebase',
      EXPO_PUBLIC_FIREBASE_PROJECT_ID: 'demo-the-list',
      EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN: 'demo-the-list.firebaseapp.com',
      EXPO_PUBLIC_FIREBASE_API_KEY: 'demo-key',
      EXPO_PUBLIC_FIREBASE_APP_ID: 'demo-app',
      EXPO_PUBLIC_GOOGLE_MAPS_BROWSER_API_KEY: '',
      EXPO_PUBLIC_UPLOAD_API_URL: '',
    },
  },
  use: { ...baseConfig.use, baseURL },
});

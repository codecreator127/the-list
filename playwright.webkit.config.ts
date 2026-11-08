import { defineConfig, devices } from '@playwright/test';
import baseConfig from './playwright.config';

export default defineConfig({
  ...baseConfig,
  projects: [{ name: 'mobile-webkit', use: { ...devices['iPhone 13'] } }],
});

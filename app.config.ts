import type { ExpoConfig } from 'expo/config';
import { AndroidConfig, IOSConfig, type ConfigPlugin } from '@expo/config-plugins';
import base from './app.json';

const nativeMapsKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_NATIVE_API_KEY ?? '';

// Expo loads .env before evaluating this config. Vercel supplies these at build time.
// Never publish a production bundle that silently falls back to sample users/data.
if (process.env.NODE_ENV === 'production' || process.env.VERCEL === '1') {
  const required = [
    'EXPO_PUBLIC_FIREBASE_API_KEY',
    'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN',
    'EXPO_PUBLIC_FIREBASE_PROJECT_ID',
    'EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET',
    'EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
    'EXPO_PUBLIC_FIREBASE_APP_ID',
    'EXPO_PUBLIC_GOOGLE_MAPS_BROWSER_API_KEY',
  ];
  const missing = required.filter(name => !process.env[name]?.trim());
  if (missing.length) throw new Error(`Missing production environment variables: ${missing.join(', ')}`);
  if (process.env.EXPO_PUBLIC_DATA_MODE && process.env.EXPO_PUBLIC_DATA_MODE !== 'firebase') {
    throw new Error('Production exports require EXPO_PUBLIC_DATA_MODE=firebase (or unset).');
  }
}

const withMapsApiKey: ConfigPlugin = config => IOSConfig.Maps.withMaps(AndroidConfig.GoogleMapsApiKey.withGoogleMapsApiKey(config));

const config: ExpoConfig = {
  ...(base.expo as ExpoConfig),
  plugins: [
    ...(base.expo.plugins ?? []),
    withMapsApiKey as any,
  ],
  android: {
    package: 'com.thelist.app',
    config: { googleMaps: { apiKey: nativeMapsKey } },
  },
  ios: {
    bundleIdentifier: 'com.thelist.app',
    config: { googleMapsApiKey: nativeMapsKey },
  },
};

export default config;

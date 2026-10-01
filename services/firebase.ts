import { getApp, getApps, initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const config = {
 apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
 authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
 projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
 storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
 messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
 appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};
export const hasFirebaseConfig = Boolean(config.apiKey && config.authDomain && config.projectId && config.appId);
export const isFirebaseRepositoryEnabled = hasFirebaseConfig && process.env.EXPO_PUBLIC_DATA_MODE !== 'mock';
export const firebaseApp = hasFirebaseConfig ? getApps().length ? getApp() : initializeApp(config) : undefined;
export const firestore = firebaseApp ? getFirestore(firebaseApp) : undefined;

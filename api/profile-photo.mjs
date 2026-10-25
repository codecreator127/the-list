import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { createPhotoHandler, PhotoError } from '../server/profile-photo.mjs';

export const config = { api: { bodyParser: false } };

export async function verifyToken(token) {
  if (process.env.FIREBASE_AUTH_EMULATOR_HOST) throw new Error('Emulator authentication is disabled here.');
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId) throw new PhotoError(503, 'Photo authentication is not configured. Please try again later.');
  if (process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID && projectId !== process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID) {
    throw new PhotoError(503, 'Photo authentication configuration does not match the app. Please try again later.');
  }
  const app = getApps().find(app => app.name === 'photo-upload') ?? initializeApp({ projectId }, 'photo-upload');
  // Verify with Firebase public certificates; no service-account key is required.
  return getAuth(app).verifyIdToken(token);
}
export default createPhotoHandler({ verifyToken });

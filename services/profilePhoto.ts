import { Platform } from 'react-native';
import type { ImagePickerAsset } from 'expo-image-picker';
import { firebaseAuth } from './auth';

const maxProfilePhotoSize = 4 * 1024 * 1024;

function endpoint(kind: 'profile' | 'review') {
  const base = process.env.EXPO_PUBLIC_UPLOAD_API_URL?.replace(/\/$/, '') ?? '';
  if (!base && Platform.OS !== 'web') throw new Error('Photo uploads need EXPO_PUBLIC_UPLOAD_API_URL configured.');
  if (base && !base.startsWith('https://') && !__DEV__) throw new Error('Photo uploads require a secure server URL.');
  return `${base}/api/${kind}-photo`;
}

async function photoRequest(method: 'POST' | 'DELETE', body: Blob | string, contentType: string, kind: 'profile' | 'review' = 'profile') {
  const user = firebaseAuth?.currentUser;
  if (!user) throw new Error('Sign in again before uploading a photo.');
  const response = await fetch(endpoint(kind), {
    method, body, headers: { Authorization: `Bearer ${await user.getIdToken()}`, 'Content-Type': contentType },
  });
  let result;
  try { result = await response.json(); }
  catch { throw new Error('Photo uploads are unavailable. Check that the upload server is deployed.'); }
  if (!response.ok) throw new Error(result.error ?? 'Could not upload your photo.');
  return result;
}

async function uploadPhoto(userId: string, asset: ImagePickerAsset, kind: 'profile' | 'review'): Promise<{ path: string; url: string }> {
  if (firebaseAuth?.currentUser?.uid !== userId) throw new Error('Sign in again before uploading a photo.');
  if ((asset.file?.size ?? asset.fileSize ?? 0) > maxProfilePhotoSize) throw new Error('Choose a photo smaller than 4 MB.');
  const contentType = asset.mimeType ?? asset.file?.type ?? 'image/jpeg';
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(contentType)) throw new Error('Choose a JPEG, PNG, or WebP image.');
  let file: Blob;
  if (asset.file) file = asset.file;
  else {
    const response = await fetch(asset.uri);
    if (!response.ok) throw new Error('Could not read the selected image.');
    file = await response.blob();
  }
  if (file.size > maxProfilePhotoSize) throw new Error('Choose a photo smaller than 4 MB.');
  return photoRequest('POST', file, contentType, kind);
}

export const uploadProfilePhoto = (userId: string, asset: ImagePickerAsset) => uploadPhoto(userId, asset, 'profile');
export const uploadReviewPhoto = (userId: string, asset: ImagePickerAsset) => uploadPhoto(userId, asset, 'review');
export async function deleteReviewPhoto(photo: { path: string }) {
  if (!photo.path.startsWith('cloudinary:the-list/reviews/')) throw new Error('Invalid review photo.');
  await photoRequest('DELETE', JSON.stringify({ publicId: photo.path.slice('cloudinary:'.length) }), 'application/json', 'review');
}

export async function deleteProfilePhoto(path: string) {
  if (!path.startsWith('cloudinary:')) return;
  await photoRequest('DELETE', JSON.stringify({ publicId: path.slice('cloudinary:'.length) }), 'application/json');
}

export async function deletePreviousProfilePhoto(userId: string, url: string) {
  if (firebaseAuth?.currentUser?.uid !== userId) throw new Error('Sign in again before uploading a photo.');
  // Preserve legacy avatars; only this service's URLs are cleanup candidates.
  const match = /^https:\/\/res\.cloudinary\.com\/[a-z0-9_-]+\/image\/upload\/(the-list\/profiles\/[a-f0-9]{64}\/[a-f0-9-]{36})\.webp$/.exec(url);
  if (match) await deleteProfilePhoto(`cloudinary:${match[1]}`);
}

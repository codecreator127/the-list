import { Platform } from 'react-native';
import type { ImagePickerAsset } from 'expo-image-picker';
import { firebaseAuth } from './auth';

const maxPhotoSize = 4 * 1024 * 1024;

function checkPhotoSize(size: number) {
  if (size > maxPhotoSize) throw new Error('Choose a photo smaller than 4 MB.');
}

export async function validateSelectedPhoto(asset: ImagePickerAsset) {
  if (asset.type === 'video') throw new Error('Choose an image file.');
  if (Platform.OS === 'web') {
    checkPhotoSize(asset.file?.size ?? asset.fileSize ?? 0);
    return;
  }
  // Android's picker can report the original size even after exporting a smaller file.
  const { getInfoAsync } = require('expo-file-system') as typeof import('expo-file-system');
  const info = await getInfoAsync(asset.uri);
  if (!info.exists || info.isDirectory) throw new Error('Could not read the selected image.');
  checkPhotoSize(info.size);
}

function endpoint(kind: 'profile' | 'review') {
  const configured = process.env.EXPO_PUBLIC_UPLOAD_API_URL?.replace(/\/$/, '') ?? '';
  const base = Platform.OS === 'web' && !__DEV__ && !configured.startsWith('https://') ? '' : configured;
  if (!base && Platform.OS !== 'web') throw new Error('Photo uploads need EXPO_PUBLIC_UPLOAD_API_URL configured.');
  if (base && !base.startsWith('https://') && !__DEV__) throw new Error('Photo uploads require a secure server URL.');
  return `${base}/api/${kind}-photo`;
}

async function photoHeaders(contentType: string, expectedUserId?: string) {
  const user = firebaseAuth?.currentUser;
  if (!user || (expectedUserId && user.uid !== expectedUserId)) throw new Error('Sign in again before uploading a photo.');
  const token = await user.getIdToken();
  if (firebaseAuth?.currentUser?.uid !== user.uid) throw new Error('Sign in again before uploading a photo.');
  return { Authorization: 'Bearer ' + token, 'Content-Type': contentType };
}

function photoResponse(status: number, body: string) {
  let result;
  try { result = JSON.parse(body); }
  catch { throw new Error('Photo uploads are unavailable. Check that the upload server is running.'); }
  if (status < 200 || status >= 300) throw new Error(result?.error ?? 'Could not save your photo. Please try again.');
  return result;
}

async function photoRequest(method: 'POST' | 'DELETE', body: Blob | string, contentType: string, kind: 'profile' | 'review' = 'profile', expectedUserId?: string) {
  const url = endpoint(kind);
  const headers = await photoHeaders(contentType, expectedUserId);
  const response = await fetch(url, { method, body, headers }).catch(() => {
    throw new Error('Could not reach the photo server. Check your connection and try again.');
  });
  return photoResponse(response.status, await response.text());
}

async function uploadPhoto(userId: string, asset: ImagePickerAsset, kind: 'profile' | 'review'): Promise<{ path: string; url: string }> {
  if (firebaseAuth?.currentUser?.uid !== userId) throw new Error('Sign in again before uploading a photo.');
  await validateSelectedPhoto(asset);
  const reportedType = (asset.file?.type || asset.mimeType || 'application/octet-stream').toLowerCase();
  const contentType = reportedType === 'image/jpg' ? 'image/jpeg' : reportedType;

  let result;
  if (Platform.OS === 'web') {
    if (!['image/jpeg', 'image/png', 'image/webp', 'application/octet-stream'].includes(contentType)) throw new Error('Choose a JPEG, PNG, or WebP image.');
    let file: Blob;
    if (asset.file) file = asset.file;
    else {
      const response = await fetch(asset.uri);
      if (!response.ok) throw new Error('Could not read the selected image.');
      file = await response.blob();
    }
    checkPhotoSize(file.size);
    result = await photoRequest('POST', file, contentType, kind, userId);
  } else {
    const { uploadAsync, FileSystemUploadType } = require('expo-file-system') as typeof import('expo-file-system');
    const url = endpoint(kind);
    // The server checks the exported bytes; the picker MIME type can describe the original image.
    const headers = await photoHeaders('application/octet-stream', userId);
    const response = await uploadAsync(url, asset.uri, {
      httpMethod: 'POST', uploadType: FileSystemUploadType.BINARY_CONTENT, headers,
    }).catch(() => { throw new Error('Could not upload the selected image. Check your connection and try again.'); });
    result = photoResponse(response.status, response.body);
  }
  if (typeof result?.path !== 'string' || typeof result?.url !== 'string') throw new Error('The photo server did not return an image. Please try again.');
  return { path: result.path, url: result.url };
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

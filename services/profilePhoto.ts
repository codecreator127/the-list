import { deleteObject, getDownloadURL, getStorage, ref, uploadBytes } from 'firebase/storage';
import type { ImagePickerAsset } from 'expo-image-picker';
import { firebaseApp } from './firebase';

const maxProfilePhotoSize = 5 * 1024 * 1024;

function profileStorage() {
  if (!firebaseApp?.options.storageBucket) {
    throw new Error('Firebase Storage is not configured. Set EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET and try again.');
  }
  return getStorage(firebaseApp);
}

export async function uploadProfilePhoto(userId: string, asset: ImagePickerAsset) {
  if ((asset.file && asset.file.size > maxProfilePhotoSize) || (asset.fileSize && asset.fileSize > maxProfilePhotoSize)) {
    throw new Error('Choose a profile picture smaller than 5 MB.');
  }
  const contentType = asset.mimeType ?? asset.file?.type ?? 'image/jpeg';
  if (!contentType.startsWith('image/')) throw new Error('Choose an image file for your profile picture.');

  let file: Blob;
  if (asset.file) file = asset.file;
  else {
    const response = await fetch(asset.uri);
    if (!response.ok) throw new Error('Could not read the selected image.');
    file = await response.blob();
  }
  if (file.size > maxProfilePhotoSize) throw new Error('Choose a profile picture smaller than 5 MB.');

  const extension = contentType.split('/')[1]?.replace(/[^a-z0-9]/gi, '') || 'jpg';
  const path = `users/${userId}/profile/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
  const storageRef = ref(profileStorage(), path);
  await uploadBytes(storageRef, file, { contentType });
  try {
    return { path, url: await getDownloadURL(storageRef) };
  } catch (cause) {
    try {
      await deleteObject(storageRef);
    } catch (cleanupCause) {
      const original = cause instanceof Error ? cause.message : 'Could not retrieve the profile picture URL.';
      const cleanup = cleanupCause instanceof Error ? cleanupCause.message : 'Storage cleanup failed.';
      throw new Error(`${original} The uploaded image could not be cleaned up: ${cleanup}`);
    }
    throw cause;
  }
}

export async function deleteProfilePhoto(path: string) {
  await deleteObject(ref(profileStorage(), path));
}

export async function deletePreviousProfilePhoto(userId: string, url: string) {
  const storage = profileStorage();
  const bucket = storage.app.options.storageBucket;
  if (!bucket || !url.startsWith(`https://firebasestorage.googleapis.com/v0/b/${bucket}/o/`)) return;
  const oldPhoto = ref(storage, url);
  if (oldPhoto.fullPath.startsWith(`users/${userId}/profile/`)) await deleteObject(oldPhoto);
}

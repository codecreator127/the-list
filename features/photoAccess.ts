export const PHOTO_UPLOAD_RESTRICTION = 'Photo uploads are currently available only for test@gmail.com.';

export function canUploadPhotos(user?: { email: string | null } | null): boolean {
  return user?.email?.toLowerCase() === 'test@gmail.com';
}

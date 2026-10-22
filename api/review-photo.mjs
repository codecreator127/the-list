import { verifyToken } from './profile-photo.mjs';
import { createPhotoHandler } from '../server/profile-photo.mjs';
export const config = { api: { bodyParser: false } };
export default createPhotoHandler({ verifyToken, kind: 'review' });

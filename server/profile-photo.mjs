import { createHash, randomUUID } from 'node:crypto';
import { createPhotoBudgetGuard } from './photo-budget.mjs';

export const MAX_PHOTO_BYTES = 4 * 1024 * 1024;
export class PhotoError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export function photoPrefix(uid, kind = 'profile') {
  return kind === 'review' ? `the-list/reviews/${uid}/` : `the-list/profiles/${createHash('sha256').update(uid).digest('hex')}/`;
}
export function ownsPhoto(uid, id, kind = 'profile') {
  return typeof id === 'string' && id.startsWith(photoPrefix(uid, kind)) &&
    /^[a-f0-9-]{36}$/.test(id.slice(photoPrefix(uid, kind).length));
}
export function imageType(bytes) {
  if (bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'image/jpeg';
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return 'image/png';
  if (bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  throw new PhotoError(415, 'Choose a JPEG, PNG, or WebP image.');
}
export async function readLimited(stream, limit) {
  const chunks = [];
  let size = 0;
  for await (const chunk of stream) {
    const buffer = Buffer.from(chunk);
    size += buffer.length;
    if (size > limit) throw new PhotoError(413, 'Choose a photo smaller than 4 MB.');
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
}
export function signature(params, secret) {
  const value = Object.keys(params).sort().map(key => `${key}=${params[key]}`).join('&');
  return createHash('sha256').update(value + secret).digest('hex');
}
export function configuration(env) {
  const { CLOUDINARY_CLOUD_NAME: cloud, CLOUDINARY_API_KEY: key, CLOUDINARY_API_SECRET: secret } = env;
  if (!cloud || !/^[a-z0-9_-]+$/i.test(cloud) || !key || !secret) throw new PhotoError(503, 'Photo uploads are not configured yet.');
  return { cloud, key, secret };
}

// Inject dependencies so tests never need credentials or make live writes.
export function createPhotoHandler({ verifyToken, env = process.env, fetcher = fetch, now = Date.now, uuid = randomUUID, kind = 'profile', checkBudget }) {
  const budget = checkBudget ?? createPhotoBudgetGuard({ env, fetcher, now });
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    try {
      const origin = req.headers.origin;
      if (origin) {
        const allowed = (env.CLOUDINARY_BROWSER_ORIGINS ?? '').split(',').map(value => value.trim());
        let sameOrigin = false;
        try { const url = new URL(origin); sameOrigin = ['https:','http:'].includes(url.protocol) && url.host === req.headers.host; } catch {}
        if (!sameOrigin && !allowed.includes(origin)) throw new PhotoError(403, 'This browser origin is not allowed to upload photos.');
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Vary', 'Origin');
        res.setHeader('Access-Control-Allow-Methods', 'POST, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
        if (req.method === 'OPTIONS') { res.status(204).end(); return; }
      }
      if (!['POST', 'DELETE'].includes(req.method)) {
        res.setHeader('Allow', 'POST, DELETE');
        throw new PhotoError(405, 'Method not allowed.');
      }
      const bearer = req.headers.authorization;
      if (typeof bearer !== 'string' || !bearer.startsWith('Bearer ')) throw new PhotoError(401, 'Sign in before uploading a photo.');
      let user;
      try { user = await verifyToken(bearer.slice(7)); }
      catch { throw new PhotoError(401, 'Your session expired. Sign in again.'); }
      if (!user?.uid) throw new PhotoError(401, 'Sign in again.');
      if (kind === 'review' && !/^[A-Za-z0-9_-]{1,128}$/.test(user.uid)) throw new PhotoError(403, 'This account cannot upload review photos.');
      const { cloud, key, secret } = configuration(env);
      if (req.method === 'POST' && env.CLOUDINARY_UPLOADS_ENABLED !== 'true') throw new PhotoError(503, 'Photo uploads are temporarily disabled.');
      const timestamp = Math.floor(now() / 1000);
      const body = await readLimited(req, req.method === 'POST' ? MAX_PHOTO_BYTES : 1024);
      let params, form, operation;
      if (req.method === 'POST') {
        const mime = imageType(body);
        try { await budget(); } catch (error) { throw new PhotoError(503, error.message); }
        params = { public_id: photoPrefix(user.uid, kind) + uuid(), timestamp, overwrite: 'false', transformation: 'c_limit,w_1024,h_1024/q_auto/f_webp' };
        form = new FormData();
        form.append('file', new Blob([body], { type: mime }), 'profile');
        operation = 'upload';
      } else {
        let id;
        try { id = JSON.parse(body.toString()).publicId; } catch { throw new PhotoError(400, 'Invalid photo reference.'); }
        if (!ownsPhoto(user.uid, id, kind)) throw new PhotoError(403, 'You can only remove your own uploaded photos.');
        params = { public_id: id, timestamp, invalidate: 'true' };
        form = new FormData();
        operation = 'destroy';
      }
      for (const [name, value] of Object.entries(params)) form.append(name, String(value));
      form.append('api_key', key);
      form.append('signature', signature(params, secret));
      const response = await fetcher(`https://api.cloudinary.com/v1_1/${cloud}/image/${operation}`, {
        method: 'POST', body: form, signal: AbortSignal.timeout(25000),
      });
      const result = await response.json();
      if (!response.ok || result.error) throw new PhotoError(502, 'Image hosting could not complete the request. Please try again.');
      if (operation === 'destroy') {
        if (!['ok', 'not found'].includes(result.result)) throw new PhotoError(502, 'Photo cleanup failed. Please try again.');
        res.status(200).json({ deleted: true });
      } else {
        if (result.public_id !== params.public_id) throw new PhotoError(502, 'Image hosting returned an unexpected photo reference.');
        const url = `https://res.cloudinary.com/${cloud}/image/upload/${params.public_id}.webp`;
        res.status(200).json({ path: `cloudinary:${params.public_id}`, url });
      }
    } catch (error) {
      res.status(error instanceof PhotoError ? error.status : 502).json({
        error: error instanceof PhotoError ? error.message : 'Photo service is temporarily unavailable. Please try again.',
      });
    }
  };
}

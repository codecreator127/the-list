import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { imageType, MAX_PHOTO_BYTES, readLimited } from '../server/profile-photo.mjs';

const projectId = 'demo-the-list';
for (const [key, port] of [['FIREBASE_AUTH_EMULATOR_HOST', 32199], ['FIRESTORE_EMULATOR_HOST', 32180]]) {
  assert.equal(process.env[key], `127.0.0.1:${port}`, `${key} must point to the local emulator`);
}
initializeApp({ projectId });
const auth = getAuth();
const db = getFirestore();
const uid = 'iosreviewtester';
const email = 'ios-review@example.test';
const placeId = 'pl_ios-test-place';
const photoId = `the-list/reviews/${uid}/a1b2c3d4-1234-1234-1234-123456789abc`;
const photo = {
  path: `cloudinary:${photoId}`,
  url: `https://res.cloudinary.com/z4ocz8nr/image/upload/${photoId}.webp`,
};

if (process.argv[2] === 'serve') {
  await auth.createUser({ uid, email, password: 'simulator-only-pass' });
  const now = new Date();
  await db.collection('places').doc(placeId).set({ googlePlaceId: 'ios-test-place', createdAt: now, updatedAt: now });
  let attempts = 0;
  createServer(async (req, res) => {
    if (req.method === 'GET' && req.url === '/ready') return res.end('ready');
    if (req.method !== 'POST' || req.url !== '/api/review-photo') {
      res.writeHead(404).end();
      return;
    }
    res.setHeader('Content-Type', 'application/json');
    try {
      assert.match(req.headers.authorization ?? '', /^Bearer /);
      assert.equal((await auth.verifyIdToken(req.headers.authorization.slice(7))).uid, uid);
      assert.equal(req.headers['content-type'], 'application/octet-stream');
      const bytes = await readLimited(req, MAX_PHOTO_BYTES);
      assert.ok(imageType(bytes), 'Expected an actual image');
      if (++attempts === 1) {
        res.writeHead(503).end(JSON.stringify({ error: 'Photo service is temporarily unavailable.' }));
      } else {
        res.end(JSON.stringify(photo));
      }
    } catch (error) {
      console.error(error);
      res.writeHead(400).end(JSON.stringify({ error: 'Invalid test upload' }));
    }
  }).listen(32181, '127.0.0.1');
} else {
  assert.equal(process.argv[2], 'verify');
  const reviews = await db.collection('reviews').where('userId', '==', uid).get();
  assert.equal(reviews.size, 1);
  const review = reviews.docs[0].data();
  assert.equal(review.placeId, placeId);
  assert.deepEqual(review.photo, photo);
  console.log('The iOS review saved exactly one photo reference.');
}

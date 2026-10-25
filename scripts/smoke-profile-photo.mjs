// Explicitly opted-in live smoke test. No Firestore writes; only disposable Auth/image resources.
import { createServer } from 'node:http';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { deflateSync } from 'node:zlib';
import assert from 'node:assert/strict';
import handler from '../api/profile-photo.mjs';
import reviewHandler from '../api/review-photo.mjs';
import { configuration } from '../server/profile-photo.mjs';

const projectId = 'the-list-78f2b';
const kind = process.argv.includes('--review') ? 'review' : 'profile';
if (!process.argv.includes('--live')) {
  console.log('Live smoke uploads are paused while uploads are restricted to test@gmail.com. Run npm run test:photos for automated verification.');
  process.exit(0);
}
throw new Error('Live upload smoke tests are paused while uploads are restricted to test@gmail.com. Run npm run test:photos instead.');
assert.ok(process.argv.includes(`--project=${projectId}`), 'Pass the explicit Firebase project ID.');
assert.equal(process.env.FIREBASE_PROJECT_ID, projectId, 'Server Firebase project mismatch.');
assert.equal(process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID, projectId, 'Client Firebase project mismatch.');
assert.ok(!process.env.FIREBASE_AUTH_EMULATOR_HOST, 'Do not mix emulator authentication with this live test.');

function pngChunk(type, data) {
  const raw = Buffer.concat([Buffer.from(type), data]);
  let crc = 0xffffffff;
  for (const byte of raw) {
    crc ^= byte;
    for (let bit=0;bit<8;bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  const size = Buffer.alloc(4), checksum = Buffer.alloc(4);
  size.writeUInt32BE(data.length); checksum.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
  return Buffer.concat([size, raw, checksum]);
}
function generatedImage() {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(16,0); header.writeUInt32BE(16,4); header[8]=8; header[9]=2;
  const pixels = Buffer.alloc(16 * (16*3+1));
  for(let y=0;y<16;y++) for(let x=0;x<16;x++) {
    const offset=y*49+1+x*3;
    pixels[offset]=80+x*8; pixels[offset+1]=90+y*8; pixels[offset+2]=160;
  }
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), pngChunk('IHDR',header), pngChunk('IDAT',deflateSync(pixels)), pngChunk('IEND',Buffer.alloc(0))]);
}

let token, server, uploadedPath;
const result = { projectId, kind, cloud: '', plan: '', uploaded: false, downloaded: false, photoDeleted: false, authUserDeleted: false, firestoreWrites: 0 };
const firebaseKey = process.env.EXPO_PUBLIC_FIREBASE_API_KEY;
async function authRequest(action, body) {
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:${action}?key=${firebaseKey}`, {
    method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body), signal:AbortSignal.timeout(15000),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(`Disposable Firebase Auth ${action} failed (${response.status}).`);
  return data;
}
async function photoRequest(method, body, contentType) {
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/${kind}-photo`, {
    method, body, headers:{Authorization:`Bearer ${token}`,'Content-Type':contentType}, signal:AbortSignal.timeout(45000),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(`Photo ${method} failed (${response.status}): ${data.error}`);
  return data;
}

let failure;
try {
  const { cloud, key, secret } = configuration(process.env);
  result.cloud = cloud;
  const usageResponse = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/usage`, {
    headers:{Authorization:`Basic ${Buffer.from(`${key}:${secret}`).toString('base64')}`}, signal:AbortSignal.timeout(15000),
  });
  assert.ok(usageResponse.ok, 'Could not verify Cloudinary plan. No resources were created.');
  const usage = await usageResponse.json();
  assert.equal(usage.plan, 'Free', 'Live smoke test requires the Free plan.');
  result.plan = usage.plan;
  assert.ok(firebaseKey, 'Firebase web API key is missing.');
  const signup = await authRequest('signUp', {email:`list-photo-smoke-${randomUUID()}@example.invalid`, password:randomUUID()+'A9!',returnSecureToken:true});
  assert.ok(signup.idToken && signup.localId !== 'GeLF6tNOsachIKnddKFNYLQvMwG3', 'Unexpected disposable Auth identity.');
  token = signup.idToken;
  process.env.CLOUDINARY_UPLOADS_ENABLED = 'true'; // Only this smoke-test process, after the Free-plan check.
  server = createServer((req,res) => {
    res.status = code => {res.statusCode=code;return res;};
    res.json = data => {res.setHeader('Content-Type','application/json');res.end(JSON.stringify(data));};
    void (kind === 'review' ? reviewHandler : handler)(req,res);
  });
  server.listen(0,'127.0.0.1');
  await once(server,'listening');
  const uploaded = await photoRequest('POST',generatedImage(),'image/png');
  uploadedPath = uploaded.path;
  result.uploaded = true;
  const downloaded = await fetch(uploaded.url,{signal:AbortSignal.timeout(15000)});
  assert.ok(downloaded.ok, 'Uploaded photo could not be retrieved.');
  assert.match(downloaded.headers.get('content-type')??'', /^image\/webp/);
  assert.ok((await downloaded.arrayBuffer()).byteLength > 0, 'Downloaded image is empty.');
  result.downloaded = true;
} catch (error) { failure=error; }
finally {
  if (uploadedPath) {
    try {
      await photoRequest('DELETE', JSON.stringify({publicId:uploadedPath.slice('cloudinary:'.length)}),'application/json');
      result.photoDeleted=true;
    } catch (error) { failure ??= error; result.remainingPhoto=uploadedPath; }
  }
  if (token) {
    try { await authRequest('delete',{idToken:token}); result.authUserDeleted=true; }
    catch (error) { failure ??= error; }
  }
  if (server) {server.closeAllConnections(); await new Promise(resolve=>server.close(resolve));}
}
console.log(JSON.stringify(result,null,2));
if (failure) {console.error(failure.message);process.exitCode=1;}

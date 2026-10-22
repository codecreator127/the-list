import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { createHash } from 'node:crypto';
import { createPhotoHandler, MAX_PHOTO_BYTES, photoPrefix, readLimited, signature } from './profile-photo.mjs';
import liveHandler from '../api/profile-photo.mjs';

const uid = 'fake-user-only';
const id = photoPrefix(uid) + '12345678-1234-1234-1234-123456789abc';
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');
const env = { CLOUDINARY_CLOUD_NAME: 'test-cloud', CLOUDINARY_API_KEY: 'fake-key', CLOUDINARY_API_SECRET: 'fake-secret', CLOUDINARY_UPLOADS_ENABLED: 'true' };
async function invoke(handler, { method = 'POST', body = png, token = 'test-token', headers = {} } = {}) {
  const req = Readable.from([body]);
  req.method = method;
  req.headers = { ...(token ? { authorization: `Bearer ${token}` } : {}), ...headers };
  const res = { headers: {}, setHeader(k,v) { this.headers[k] = v; }, status(s) { this.code = s; return this; }, json(data) { this.data = data; }, end() {} };
  await handler(req, res);
  return res;
}
function fixture(overrides = {}) {
  const calls = [];
  const handler = createPhotoHandler({ env, checkBudget: async () => {}, verifyToken: async () => ({ uid }), uuid: () => id.split('/').at(-1),
    fetcher: async (url, options) => { calls.push({ url, form: options.body }); return { ok: true, json: async () => url.endsWith('/destroy') ? { result: 'ok' } : { public_id: id } }; }, ...overrides });
  return { handler, calls };
}

test('upload derives ownership from verified token and signs restricted parameters', async () => {
  const { handler, calls } = fixture();
  const res = await invoke(handler);
  assert.equal(res.code, 200);
  assert.equal(res.data.path, `cloudinary:${id}`);
  assert.equal(res.data.url, `https://res.cloudinary.com/test-cloud/image/upload/${id}.webp`);
  assert.equal(calls[0].form.get('public_id'), id);
  assert.equal(calls[0].form.get('overwrite'), 'false');
  assert.equal(calls[0].form.get('transformation'), 'c_limit,w_1024,h_1024/q_auto/f_webp');
  assert.ok(!JSON.stringify(res.data).includes('fake-secret'));
});
test('missing/invalid authentication makes no Cloudinary requests', async () => {
  const f = fixture({ verifyToken: async () => { throw new Error('invalid'); } });
  assert.equal((await invoke(f.handler, { token: '' })).code, 401);
  assert.equal((await invoke(f.handler)).code, 401);
  assert.equal(f.calls.length, 0);
});
test('seed-protected accounts can manage their own photos through authenticated manual flows', async () => {
  for (const user of [{ uid: 'GeLF6tNOsachIKnddKFNYLQvMwG3' }, { uid, email: 'TEST@gmail.com' }]) {
    // Mock transport only: never upload or change the real account's photo in tests.
    const calls = [];
    const f = fixture({ verifyToken: async () => user, fetcher: async (url, options) => {
      calls.push(url);
      return { ok: true, json: async () => url.endsWith('/destroy') ? { result: 'ok' } : { public_id: options.body.get('public_id') } };
    } });
    const ownId = photoPrefix(user.uid) + id.split('/').at(-1);
    const upload = await invoke(f.handler);
    assert.equal(upload.code, 200);
    assert.equal(upload.data.path, `cloudinary:${ownId}`);
    assert.equal((await invoke(f.handler, { method: 'DELETE', body: JSON.stringify({ publicId: ownId }) })).code, 200);
    assert.equal((await invoke(f.handler, { method: 'DELETE', body: JSON.stringify({ publicId: photoPrefix('someone-else') + id.split('/').at(-1) }) })).code, 403);
    assert.equal(calls.length, 2);
  }
});
test('HTML/SVG and oversized streams are rejected before forwarding', async () => {
  const f = fixture();
  assert.equal((await invoke(f.handler, { body: Buffer.from('<svg></svg>') })).code, 415);
  assert.equal((await invoke(f.handler, { body: Buffer.alloc(MAX_PHOTO_BYTES + 1) })).code, 413);
  await assert.rejects(readLimited(Readable.from([Buffer.alloc(5), Buffer.alloc(6)]), 10), { status: 413 });
  assert.equal(f.calls.length, 0);
});
test('cross-user deletion, path traversal and malformed bodies never reach Cloudinary', async () => {
  const f = fixture();
  for (const publicId of [photoPrefix('someone-else') + id.split('/').at(-1), id + '/../x', 'users/test/avatar']) {
    assert.equal((await invoke(f.handler, { method: 'DELETE', body: JSON.stringify({ publicId }) })).code, 403);
  }
  assert.equal((await invoke(f.handler, { method: 'DELETE', body: '{' })).code, 400);
  assert.equal(f.calls.length, 0);
});
test('own deletion invalidates CDN and supports idempotent cleanup', async () => {
  const f = fixture({ fetcher: async () => ({ ok: true, json: async () => ({ result: 'not found' }) }) });
  assert.equal((await invoke(f.handler, { method: 'DELETE', body: JSON.stringify({ publicId: id }) })).code, 200);
  const normal = fixture();
  await invoke(normal.handler, { method: 'DELETE', body: JSON.stringify({ publicId: id }) });
  assert.equal(normal.calls[0].form.get('invalidate'), 'true');
});
test('missing configuration and upload pause fail closed; cleanup remains available', async () => {
  assert.equal((await invoke(fixture({ env: {} }).handler)).code, 503);
  const f = fixture({ env: { ...env, CLOUDINARY_UPLOADS_ENABLED: 'false' } });
  assert.equal((await invoke(f.handler)).code, 503);
  assert.equal((await invoke(f.handler, { method: 'DELETE', body: JSON.stringify({ publicId: id }) })).code, 200);
});
test('provider errors do not expose secrets or claim upload success', async () => {
  const f = fixture({ fetcher: async () => ({ ok: false, json: async () => ({ error: { message: 'fake-secret' } }) }) });
  const res = await invoke(f.handler);
  assert.equal(res.code, 502);
  assert.ok(!res.data.error.includes('fake-secret'));
});
test('browser origin allowlist permits only configured preflights and same-origin requests', async () => {
  const f = fixture({env:{...env,CLOUDINARY_BROWSER_ORIGINS:'http://localhost:8085'}});
  assert.equal((await invoke(f.handler,{method:'OPTIONS',token:'',headers:{origin:'http://localhost:8085'}})).code,204);
  assert.equal((await invoke(f.handler,{headers:{origin:'https://untrusted.example'}})).code,403);
  assert.equal(f.calls.length,0);
  assert.equal((await invoke(f.handler,{headers:{origin:'https://app.example',host:'app.example'}})).code,200);
});
test('signature matches sorted Cloudinary SHA-256 parameter signing', () => {
  assert.equal(signature({ timestamp: 1, public_id: 'x' }, 'secret'), createHash('sha256').update('public_id=x&timestamp=1secret').digest('hex'));
});
test('review uploads use a distinct owner namespace and cannot delete profile photos', async () => {
  const calls=[];
  const f=fixture({kind:'review',fetcher:async(url,options)=>{calls.push(url);return {ok:true,json:async()=>({public_id:options.body.get('public_id')})};}});
  const response=await invoke(f.handler);
  assert.equal(response.code,200);
  assert.ok(response.data.path.startsWith(`cloudinary:the-list/reviews/${uid}/`));
  assert.equal((await invoke(f.handler,{method:'DELETE',body:JSON.stringify({publicId:id})})).code,403);
  assert.equal(calls.length,1);
});
test('quota pause blocks uploads while preserving cleanup',async()=>{
  const f=fixture({checkBudget:async()=>{throw Error('Photo uploads are paused');}});
  assert.equal((await invoke(f.handler)).code,503);
  assert.equal(f.calls.length,0);
  assert.equal((await invoke(f.handler,{method:'DELETE',body:JSON.stringify({publicId:id})})).code,200);
});
test('live adapter rejects unsigned Firebase tokens and emulator mode', async () => {
  const previous = process.env.FIREBASE_PROJECT_ID;
  const emulator = process.env.FIREBASE_AUTH_EMULATOR_HOST;
  try {
    process.env.FIREBASE_PROJECT_ID = 'the-list-78f2b';
    delete process.env.FIREBASE_AUTH_EMULATOR_HOST;
    const b64 = value => Buffer.from(JSON.stringify(value)).toString('base64url');
    const token = `${b64({ alg: 'none' })}.${b64({ sub: uid, aud: 'the-list-78f2b', exp: Math.floor(Date.now()/1000)+3600 })}.`;
    assert.equal((await invoke(liveHandler, { token })).code, 401);
    process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';
    assert.equal((await invoke(liveHandler)).code, 401);
  } finally {
    if (previous === undefined) delete process.env.FIREBASE_PROJECT_ID; else process.env.FIREBASE_PROJECT_ID = previous;
    if (emulator === undefined) delete process.env.FIREBASE_AUTH_EMULATOR_HOST; else process.env.FIREBASE_AUTH_EMULATOR_HOST = emulator;
  }
});

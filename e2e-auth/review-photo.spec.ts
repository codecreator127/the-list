import { createHash, randomUUID } from 'node:crypto';
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jf2kAAAAASUVORK5CYII=',
  'base64',
);

function emulatorHost(name: string) {
  const host = process.env[name];
  if (!host || !/^127\.0\.0\.1:\d+$/.test(host)) {
    throw new Error('Run this suite using npm run test:e2e:auth with the local Firebase emulators.');
  }
  return host;
}

async function prepareAccount(page: Page, request: APIRequestContext) {
  const auth = emulatorHost('FIREBASE_AUTH_EMULATOR_HOST');
  const firestore = emulatorHost('FIRESTORE_EMULATOR_HOST');
  await page.addInitScript(hosts => {
    Object.assign(globalThis, { __FIREBASE_DEFAULTS__: { emulatorHosts: hosts } });
  }, { auth, firestore });

  const email = 'photo-' + randomUUID() + '@example.test';
  const password = randomUUID();
  const signup = await request.post('http://' + auth + '/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key', {
    data: { email, password, returnSecureToken: true },
  });
  expect(signup.ok()).toBeTruthy();
  const { localId: uid, idToken } = await signup.json();
  expect(uid).toMatch(/^[A-Za-z0-9_-]+$/);
  return { email, password, uid, idToken, firestore };
}

async function signIn(page: Page, email: string, password: string) {
  await page.getByRole('textbox', { name: 'Email', exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
}

async function choosePhoto(page: Page, label: string) {
  const chooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: label, exact: true }).click();
  await (await chooserPromise).setFiles({ name: 'test.png', mimeType: 'image/png', buffer: png });
}

test('signs in from a review link and saves a photo after a retry', async ({ page, request }) => {
  const { email, password, uid, idToken, firestore } = await prepareAccount(page, request);
  const googlePlaceId = 'photo-test-' + randomUUID();
  const placeId = 'pl_' + googlePlaceId;
  const now = new Date().toISOString();
  const places = 'http://' + firestore + '/v1/projects/demo-the-list/databases/(default)/documents/places';
  const seed = await request.post(places + '?documentId=' + placeId, {
    headers: { Authorization: 'Bearer ' + idToken },
    data: { fields: {
      googlePlaceId: { stringValue: googlePlaceId },
      createdAt: { timestampValue: now },
      updatedAt: { timestampValue: now },
    } },
  });
  expect(seed.ok()).toBeTruthy();

  const publicId = 'the-list/reviews/' + uid + '/' + randomUUID();
  const url = 'https://res.cloudinary.com/z4ocz8nr/image/upload/' + publicId + '.webp';
  await page.route(url, route => route.fulfill({ body: png, contentType: 'image/png' }));
  const methods: string[] = [];
  await page.route('**/api/review-photo', async route => {
    const upload = route.request();
    methods.push(upload.method());
    expect(upload.headers().authorization).toMatch(/^Bearer /);
    if (upload.method() === 'POST') {
      expect(upload.headers()['content-type']).toBe('image/png');
      expect(upload.postDataBuffer()).toEqual(png);
      if (methods.length === 1) {
        await route.fulfill({ status: 503, json: { error: 'Photo service is temporarily unavailable.' } });
      } else {
        await route.fulfill({ json: { path: 'cloudinary:' + publicId, url } });
      }
    } else {
      expect(upload.method()).toBe('DELETE');
      expect(upload.postDataJSON()).toEqual({ publicId });
      await route.fulfill({ json: { deleted: true } });
    }
  });

  let profileCommits = 0;
  page.on('request', req => {
    if (req.url().includes('/documents:commit') && req.postData()?.includes('/documents/users/' + uid + '"')) profileCommits++;
  });
  await page.goto('/review/' + placeId);
  await expect(page).toHaveURL(new RegExp('/auth[?]'));
  await signIn(page, email, password);
  await expect(page).toHaveURL(new RegExp('/review/' + placeId + '$'));
  await choosePhoto(page, 'Add photo');
  await expect(page.getByRole('img', { name: 'Review photo preview' })).toBeVisible();

  await page.getByRole('slider', { name: 'Overall rating slider' }).press('End');
  await page.getByLabel('Your review note (optional)').fill('Review with a photo');
  const share = page.getByRole('button', { name: 'Share review', exact: true });
  await share.click();
  await expect(page.getByText('Photo service is temporarily unavailable.', { exact: true })).toBeVisible();
  await expect(page.getByRole('img', { name: 'Review photo preview' })).toBeVisible();
  await share.click();
  await expect(page).toHaveURL(new RegExp('/place/' + placeId + '$'));
  const photo = page.getByRole('img', { name: /Photo from .+ review/ });
  await expect(photo).toHaveAttribute('src', url);
  await photo.scrollIntoViewIfNeeded();
  await expect(photo).toHaveJSProperty('naturalWidth', 1);
  expect(methods).toEqual(['POST', 'POST']);
  expect(profileCommits).toBe(1);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(photo).toHaveAttribute('src', url);
  await page.getByRole('button', { name: 'Edit review', exact: true }).click();
  await page.getByRole('button', { name: 'Remove photo', exact: true }).click();
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(page).toHaveURL(new RegExp('/place/' + placeId + '$'));
  await expect(photo).toHaveCount(0);
  await expect(page.getByText('Review with a photo', { exact: true })).toBeVisible();
  expect(methods).toEqual(['POST', 'POST', 'DELETE']);
});

test('saves a profile photo through the editor and reloads it', async ({ page, request }) => {
  const { email, password, uid } = await prepareAccount(page, request);
  const publicId = 'the-list/profiles/' + createHash('sha256').update(uid).digest('hex') + '/' + randomUUID();
  const url = 'https://res.cloudinary.com/z4ocz8nr/image/upload/' + publicId + '.webp';
  await page.route(url, route => route.fulfill({ body: png, contentType: 'image/png' }));
  await page.route('**/api/profile-photo', async route => {
    const upload = route.request();
    expect(upload.method()).toBe('POST');
    expect(upload.headers().authorization).toMatch(/^Bearer /);
    expect(upload.postDataBuffer()).toEqual(png);
    await route.fulfill({ json: { path: 'cloudinary:' + publicId, url } });
  });
  await page.goto('/auth');
  await signIn(page, email, password);
  await expect(page).toHaveURL(/\/home$/);
  await page.goto('/edit-profile');
  await choosePhoto(page, 'Upload photo');
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(page.getByText('Your profile has been updated.', { exact: true })).toBeVisible();
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('img[src="' + url + '"]').first()).toHaveJSProperty('naturalWidth', 1);
});

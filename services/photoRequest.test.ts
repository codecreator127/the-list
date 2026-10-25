import assert from 'node:assert/strict';
import test from 'node:test';
import { requestPhoto } from './photoRequest';

function fixture(statuses: number[]) {
  const refreshes: boolean[] = [], tokens: string[] = [];
  const user = { uid: 'owner', getIdToken: async (force = false) => { refreshes.push(force); return force ? 'fresh' : 'cached'; } };
  const fetcher = (async (_url, options) => {
    tokens.push((options?.headers as Record<string, string>).Authorization);
    const status = statuses.shift()!;
    return new Response(JSON.stringify(status === 200 ? { path: 'photo', url: 'image' } : { error: 'Rejected' }), { status });
  }) as typeof fetch;
  return { user, fetcher, refreshes, tokens };
}
test('expired upload refreshes the token once and resends the same body', async () => {
  const f = fixture([401, 200]);
  assert.equal((await requestPhoto('/photo', 'POST', new Blob(['bytes']), 'image/png', f.user, () => f.user, f.fetcher)).path, 'photo');
  assert.deepEqual(f.refreshes, [false, true]);
  assert.deepEqual(f.tokens, ['Bearer cached', 'Bearer fresh']);
});
test('second rejection stops; permissions, service and network failures never retry', async () => {
  for (const statuses of [[401, 401], [403], [503]]) {
    const expected = [...statuses]; const f = fixture(statuses);
    await assert.rejects(requestPhoto('/photo', 'POST', 'image', 'image/png', f.user, () => f.user, f.fetcher), /Rejected/);
    assert.equal(f.tokens.length, expected.length);
  }
  const f = fixture([]);
  let calls = 0;
  await assert.rejects(requestPhoto('/photo', 'POST', 'image', 'image/png', f.user, () => f.user, async () => { calls++; throw Error('offline'); }), /offline/);
  assert.equal(calls, 1);
});
test('account switch during token refresh prevents retrying as another account', async () => {
  const f = fixture([401]); let signedIn: typeof f.user | null = f.user;
  f.user.getIdToken = async force => { if (force) signedIn = null; return 'cached'; };
  await assert.rejects(requestPhoto('/photo', 'POST', 'image', 'image/png', f.user, () => signedIn, f.fetcher), /account changed/);
  assert.equal(f.tokens.length, 1);
});

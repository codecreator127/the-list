// Conservative pause at 80% of the Free allowance. Delivery can still consume credits
// independently; this is an upload guard, not a provider billing/spending cap.
export function createPhotoBudgetGuard({ env = process.env, fetcher = fetch, now = Date.now } = {}) {
  let cached, pending;
  return async () => {
    if (!cached || now() - cached.checkedAt > 60000) {
      pending ??= (async () => {
        const response = await fetcher(`https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/usage`, {
          headers: { Authorization: `Basic ${Buffer.from(`${env.CLOUDINARY_API_KEY}:${env.CLOUDINARY_API_SECRET}`).toString('base64')}` },
          signal: AbortSignal.timeout(10000),
        });
        if (!response.ok) throw new Error('Photo usage could not be checked. Please try again later.');
        const usage = await response.json();
        if (usage.plan !== 'Free' || !Number.isFinite(usage.credits?.usage) || !Number.isFinite(usage.credits?.limit) || usage.credits.limit <= 0) {
          throw new Error('Photo uploads are paused until the Free allowance can be verified.');
        }
        cached = { used: usage.credits.usage, limit: Math.min(20, usage.credits.limit * 0.8), checkedAt: now() };
      })();
      try { await pending; } finally { pending = undefined; }
    }
    if (cached.used + 0.01 >= cached.limit) throw new Error('Photo uploads are paused to preserve our free allowance. You can still save without a new photo.');
    cached.used += 0.01; // Reserve headroom for uploads while the usage response is cached.
  };
}

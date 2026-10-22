// Read-only account check; never uploads, deletes, or changes a plan.
import { configuration } from '../server/profile-photo.mjs';

try {
  const { cloud, key, secret } = configuration(process.env);
  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/usage`, {
    headers: { Authorization: `Basic ${Buffer.from(`${key}:${secret}`).toString('base64')}` },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error('Cloudinary account check failed. Check the server credentials and permissions.');
  const usage = await response.json();
  if (usage.plan !== 'Free') throw new Error('Account is not reporting the Free plan. Keep uploads disabled and check the account dashboard.');
  console.log(JSON.stringify({ cloud, plan: usage.plan, creditsUsed: usage.credits?.usage, creditLimit: usage.credits?.limit, checkedAt: new Date().toISOString() }, null, 2));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}

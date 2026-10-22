# Live profile and review photos on Cloudinary Free

The app now uploads profile pictures through `POST /api/profile-photo`. Firebase still owns authentication and the profile's `avatarUrl`; Cloudinary stores the image. No Firebase Storage bucket or billing upgrade is needed. Google Places photos continue to use their existing source.

Reviews support one optional `{ path, url }` photo, uploaded through `POST /api/review-photo`. The editor supports add, replace, remove and preview. Review photos appear on restaurant review cards, Home activity and the owner's profile. Web images use native browser lazy loading; native images load after entering the Page viewport. Photo changes use the existing review/List transaction, preserving the ranking rules. A failed review save cleans up the staged image; a successful replacement or deletion cleans up the old image afterward. Failed cleanup is reported with a retry button, never treated as a failed review save. Closing the app during a request can still leave an orphan, as with profile uploads; no bulk cleanup runs.

Both upload APIs verify Cloudinary Free usage before accepting new images. They pause at 80% of the allowance (at most 20 of 25 credits), fail closed if usage cannot be checked or the plan isn't Free, cache the usage response for up to 60 seconds per API instance, and reserve 0.01 credit per upload during that interval. Deletes bypass the upload budget. This is a conservative upload guard, not a global spending cap: provider reporting can lag, instances have separate caches, and serving existing images continues to consume bandwidth. Keep the account on Free and monitor the dashboard.

The local `firestore.rules` validates a single photo, the owner's review namespace, and the exact Cloudinary URL for cloud `z4ocz8nr`. The live project was found to have temporary test-mode rules expiring on 25 October 2026; those broader rules were deliberately left unchanged. The stricter local rules passed emulator tests and need a separate reviewed security-rule deployment before public use.

## Account and deployment setup

1. Create an account at https://cloudinary.com/users/register_free and select **Free**. Do not upgrade the plan or enable paid services. Check the account's Plan/Billing page before enabling uploads. Free has a shared credit allowance for storage, delivery and transformations; it is not unlimited. Account creation, accepting terms and email verification must be completed by the account owner.
2. In Cloudinary Console, find the product environment's cloud name and API keys. Put these in the ignored local `.env` file and in Vercel's server environment variables, **never in chat, source code, or `EXPO_PUBLIC_*` variables**:

   ```dotenv
   FIREBASE_PROJECT_ID=the-list-78f2b
   CLOUDINARY_CLOUD_NAME=your_cloud_name
   CLOUDINARY_API_KEY=your_api_key
   CLOUDINARY_API_SECRET=your_api_secret
   CLOUDINARY_UPLOADS_ENABLED=false
   ```

3. Run `npm run uploads:check`. This reads account usage without creating or deleting images and refuses a plan other than `Free`. It needs an existing local `.env` and a Node version with `--env-file` support (Node 20.6+). Confirm the dashboard also shows Free; this check does not inspect payment methods or guarantee future plan settings.
4. Set `CLOUDINARY_UPLOADS_ENABLED=true` on the server after the check. No upload preset is required. Keep any unrelated unsigned presets disabled unless intentionally used by another application.
5. Deploy the repository to Vercel, including `api/` and `server/`, rather than uploading only `dist`. Use the existing static Expo build. `firebase-admin` is a runtime dependency. The API verifies Firebase ID tokens with public certificates and the explicit project ID; no Firebase Admin service-account secret is required. Never set `FIREBASE_AUTH_EMULATOR_HOST` in this deployment.
6. Web uses the same-origin API by default. For native, set the public `EXPO_PUBLIC_UPLOAD_API_URL=https://your-app.vercel.app` before building. Use the base origin, without `/api/profile-photo`. For local Expo web on port 8085, set `EXPO_PUBLIC_UPLOAD_API_URL=http://127.0.0.1:4177` and server-only `CLOUDINARY_BROWSER_ORIGINS=http://localhost:8085,http://127.0.0.1:8085`, then run `npm run uploads:dev` alongside Expo. Restart Expo after changing its public environment settings. The API binds to loopback and permits only the configured browser origins. Remove the local origin override for deployment; same-origin Vercel needs no CORS configuration. The static `npm run preview` helper does not run server functions.
7. Verify with a disposable signed-in account, **not `test@gmail.com`**: select a JPEG/PNG/WebP under 4 MB, save, refresh, and confirm the new avatar. Replace it and confirm the previous Cloudinary asset is deleted. Confirm the Cloudinary asset is at most 1024 × 1024 and check usage in the dashboard.

On 21 October 2026, the live smoke test passed against cloud `z4ocz8nr` on Free and Firebase project `the-list-78f2b`: real Firebase authentication, image upload, WebP download, photo cleanup and disposable Auth cleanup all succeeded, with zero Firestore writes. Local credentials are in ignored `.env`. Remote deployment credentials and a Vercel deployment still need to be configured separately; the test does not claim a signed-in UI profile-save check.

## Upload and cleanup behavior

- Only authenticated Firebase users from the configured project can upload or delete their own photos. This includes manual profile changes by `test@gmail.com`. Protected-account restrictions apply to automated seeding, cleanup and live smoke tests, rather than ordinary owner-authorized app actions.
- The server streams at most 4 MiB, checks JPEG/PNG/WebP signatures, and sends the image to Cloudinary for decoding. Cloudinary rejects malformed images. SVG, arbitrary files, and remote fetch URLs are not accepted.
- Images receive an incoming transformation limiting dimensions to 1024 × 1024 and storing WebP with automatic quality. Originals are not separately uploaded. Avatars are public by URL; do not use this flow for private documents.
- Each photo gets a random UUID under `the-list/profiles/<SHA-256 of Firebase UID>/`. The server derives this namespace from the verified token, never from a client-supplied UID. Overwrites are disabled.
- Review photos use the separate `the-list/reviews/<Firebase UID>/<UUID>` namespace so Firestore rules can validate ownership as well. The API isolates review and profile cleanup endpoints; neither accepts cross-user deletion.
- Profile saves retain the existing staging/rollback behavior: upload, save the new URL, then delete the old owned Cloudinary photo. A failed profile save triggers deletion of the staged photo. Cleanup failures are reported; retry manually for an orphaned asset in the Cloudinary console. A connection loss or closed tab can leave an orphan; there is no automatic bulk cleanup.
- Deletion checks ownership on the server and invalidates Cloudinary's CDN. Missing assets are treated as successfully cleaned up. Legacy Firebase and external avatar URLs are preserved. No migration or database-wide cleanup runs.
- API secrets stay on the server. Requests and provider errors are not logged with credentials. API responses are not cached.
- To pause new uploads, set `CLOUDINARY_UPLOADS_ENABLED=false` and redeploy. Deletions remain available. Monitor Cloudinary's dashboard credit allowance while building. This integration does not enable billing or paid add-ons on either service. It does not impose a global quota or replace abuse prevention needed for a public launch.
- Vercel executes the upload proxy and has its own plan limits; keep that host on its intended free plan too.

## Local verification

```sh
npm run test:photos
npm run typecheck
npm run test:review-photos
npm run uploads:check
npm run uploads:smoke
```

`test:photos` uses fake credentials, fake users and an injected Cloudinary transport. It verifies authentication, owner-authorized manual photo changes (including seed-protected accounts), size/type restrictions, cross-user isolation, cleanup, the upload pause switch, signing, and rejection of unsigned/emulator tokens by the live adapter. It performs no live uploads or Firestore mutations. `uploads:check` is a separate authenticated, read-only network check; run it after configuring your real account.

`uploads:smoke` defaults to a dry run. To explicitly test the live configured project, run `npm run uploads:smoke -- --live --project=the-list-78f2b`. It verifies the Free plan and both Firebase project IDs first, creates a random disposable Auth account with an `example.invalid` email, and uses its real Firebase ID token against the actual API handler over loopback HTTP. It generates a 16 × 16 PNG, uploads it, downloads the stored WebP, and then deletes both the test image and disposable Auth account in `finally`. It never writes Firestore profiles, reviews or Lists, and does not sign in as an existing user. Check the final JSON for successful cleanup. An interruption or lost response can still leave a disposable resource requiring manual cleanup; the script never runs broad cleanup.

Add `--review` to exercise the review-photo endpoint. This live test also passed on 21 October 2026 with upload, WebP download, photo cleanup and Auth cleanup, and zero Firestore writes.

References: [Cloudinary Free plan](https://cloudinary.com/documentation/developer_onboarding_faq_free_plan), [Upload API](https://cloudinary.com/documentation/image_upload_api_reference), [Firebase token verification](https://firebase.google.com/docs/auth/admin/verify-id-tokens).

# Vercel deployment

Connect the repository manually in Vercel. Choose framework preset **Other**, repository root as the root directory, and `npm ci` as the install command. The root `vercel.json` sets the build command to `expo export -p web`, output to `dist`, clean URLs, and a fallback to `/`. Expo's `web.output` is explicitly `single`; there is no SSR or server function migration. Existing files are served before the SPA fallback. The fallback covers `/`, `/search`, `/list`, `/profile`, `/auth`, `/place/:id`, `/review/:id`, and future client routes. Authentication still guards protected screens.

Configuration follows [Expo's Vercel recommendation](https://docs.expo.dev/guides/publishing-websites/). Do not commit `dist`, local `.env` files, `.vercel`, or emulator debug logs; these are ignored.

## Environment variables

Add these in **Vercel → Project → Settings → Environment Variables** for Production and any Preview environment that should use live services:

| Name | Value |
| --- | --- |
| `EXPO_PUBLIC_DATA_MODE` | `firebase` |
| `EXPO_PUBLIC_FIREBASE_API_KEY` | Existing Firebase web app API key |
| `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN` | Existing Firebase web app auth domain, usually `<project>.firebaseapp.com` |
| `EXPO_PUBLIC_FIREBASE_PROJECT_ID` | Existing Firebase project ID |
| `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET` | Existing Firebase web app storage bucket |
| `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Existing Firebase sender ID |
| `EXPO_PUBLIC_FIREBASE_APP_ID` | Existing Firebase web app ID |
| `EXPO_PUBLIC_GOOGLE_MAPS_BROWSER_API_KEY` | Website-restricted Google Maps/Places browser key |

Use your existing Firebase project and web app configuration. `.env.example` lists the names without credentials. Public Expo variables are embedded at build time and visible to clients; rebuild after changing them. Never put service account JSON, private keys, Firebase Admin credentials, or server-only Google keys in public variables. Production exports reject missing settings and mock mode rather than silently showing sample data.

`EXPO_PUBLIC_GOOGLE_PLACES_API_KEY` and `EXPO_PUBLIC_GOOGLE_MAPS_NATIVE_API_KEY` are native-only settings and are not required in Vercel. The native map key also enters native app configuration. `NODE_ENV` and `VERCEL` are build-system indicators; do not add them manually. `FIREBASE_AUTH_EMULATOR_HOST` and `FIRESTORE_EMULATOR_HOST` are only used by the emulator verification script and must not be added to Vercel.

## Firebase setup and audit

Enable Email/Password in the existing Firebase Authentication project. Add your eventual `<project>.vercel.app` hostname and custom domain to **Authentication → Settings → Authorized domains**; add specific preview hostnames if needed. Keep the existing Firebase `authDomain`. This app uses email/password, not OAuth redirect sign-in. Web `getAuth` uses Firebase's default local persistence, waits for `onAuthStateChanged` before protected navigation, and persists sessions per origin. HTTPS supports browser geolocation. See [Firebase persistence](https://firebase.google.com/docs/auth/web/auth-state-persistence) and [authorized-domain guidance](https://firebase.google.com/docs/auth/faq-and-troubleshooting).

Verify that the existing project's published Firestore rules match `firestore.rules`; Vercel does not publish rules. No rules or schema were changed here. The emulator verification passes owner-only review modification, immutable review owner/place, private personal List reads/writes, owner-only profile writes, persisted rankings, and unauthenticated access denial. Places are shared ID records and may be created/updated by signed-in users; the rules constrain them to IDs and timestamps. Reviews are readable by all signed-in users, as needed for shared ratings.

Privacy finding: all signed-in users can read entire profile documents, including email and optional avatar URL. Firestore rules cannot hide individual fields. Restricting these reads would break author lookups; separating private profile fields would require a schema/architecture change outside this deployment preparation. Review this exposure before public launch. Owners can write valid values to their own List; rules do not enforce that the projection matches review-derived rankings. Cross-user writes remain denied.

The source scan found no hardcoded Google keys or service-account/private-key credentials outside ignored local/generated files. This workspace has no `.git` directory, so tracked files and commit history could not be audited. Check the actual connected repository history separately if credentials were ever committed. Cloud key restrictions and currently deployed rules cannot be verified from local source alone.

## Google Cloud setup

The browser directly loads Maps JavaScript and its Places library; its key is intentionally public. In Google Cloud, enable billing, **Maps JavaScript API** and **Places API (New)**. Apply **Websites / HTTP referrers** restrictions for `https://<project>.vercel.app/*` and each custom domain, plus only specific preview domains you intend to support. Avoid allowing all `*.vercel.app` projects. Apply API restrictions to **Maps JavaScript API** and **Places API (New)**, which this integration uses. Set appropriate quotas and billing alerts. Use a separate development key/origin allowance for localhost. See [Google's key security guidance](https://developers.google.com/maps/api-security-best-practices).

Keep native keys separate from the web key. Existing native Places REST usage should not be treated as a hidden server credential; public native keys can be extracted too. Native application restriction/header compatibility needs separate validation before a native release. No native REST implementation is migrated into the web application.

## Verification and manual checks

Completed: `npx expo export -p web` exports `dist`; `npm run typecheck` passes; `npm run verify:firestore` passes against `demo-the-list` emulators, without production data changes. The emulator script exercises SDK sign-up, sign-in, sign-out, profile writes, review create/update/delete, List isolation, ranking reads, and client reinitialization. It does not exercise the app UI or the repository's review/List transaction code directly.

For local production preview:

```sh
npm run build
npm run preview
```

Open `http://127.0.0.1:4174`. The preview serves exported assets and falls back to `index.html` for client routes, like the configured Vercel SPA routing. It is a local preview helper, not a production server. This Expo SDK's `expo serve` does not supply the required nested-route fallback.

Automated HTTP checks verify the root, search, List, profile, auth, place and review paths return SPA HTML, and the JavaScript asset remains JavaScript. This verifies local fallback behavior, not the actual Vercel platform or authenticated UI rendering. No usable browser automation was available, so the following live UI checks are still required at mobile (390 × 844) and desktop (1440 × 900) sizes:

1. Create an account; confirm its profile is created. Log out and back in. Refresh and confirm the session persists.
2. Search live venues; change cuisine, area, distance and sorting filters. Test location permission granted and denied.
3. Open a real search result, confirm details/photos/attribution, create or edit a review, and confirm the List ranking updates.
4. Reload `/list` and verify rankings persist. Open `/profile`, confirm reviews, then log out and confirm protected routes redirect.
5. Directly open and refresh `/search`, `/list`, `/profile`, a real `/place/<id>` and `/review/<id>` while signed in. Test browser back/forward.
6. Repeat on the eventual HTTPS Vercel domain after adding Firebase authorized domains and Google key restrictions. Check for failed requests and browser console errors.

No deployment, Firebase project creation, cloud configuration changes, or real user account/data mutations were performed during preparation.

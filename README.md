# The List

A mobile-first food discovery and review prototype for Sydney, built with Expo, React Native, TypeScript and Expo Router.

For manual Vercel setup, required environment variables, the Firebase/Google security audit, and production verification results, see [DEPLOYMENT.md](DEPLOYMENT.md).

## Run locally

```sh
npm install
npm run start
```

The start scripts use Expo's offline mode so Metro can start when Expo's package-version endpoint is unreachable. Choose **w** for web, or scan the QR code with Expo Go. You can also run `npm run web`, `npm run ios` or `npm run android`. Use `npm run start:online` when you want Expo's online dependency check.

Copy `.env.example` to `.env` if you want to configure external services. Expo public environment values are included in client bundles; restrict API keys to the required APIs and app origins/identifiers. Restart Expo after changing environment values.

## Data mode

- In local development, with no Firebase configuration, the app uses the local mock repository. Set `EXPO_PUBLIC_DATA_MODE=mock` to force mock data. Production exports require Firebase and the browser Places key and reject mock mode.
- To use Firestore, set all six `EXPO_PUBLIC_FIREBASE_*` values and remove `EXPO_PUBLIC_DATA_MODE=mock` (or set it to `firebase`).
- Firebase Authentication uses email and password. Enable **Email/Password** under Firebase Console → Authentication → Sign-in method, then publish `firestore.rules` and `storage.rules`. The app creates `users/{auth.uid}` on sign-up and returning-user sign-in. Private profile documents are owner-readable; signed-in user discovery uses the public `usernames/{username}` profile index, which stores a display name, unique lowercase username, optional avatar URL, and timestamps. Email addresses remain in Firebase Authentication and are not used for discovery. The username index also reserves usernames atomically, and profile edits update it and the private profile in one transaction.
- Profile pictures are stored in Firebase Storage under `users/{auth.uid}/profile/`. Storage rules restrict uploads and deletion to the signed-in owner and limit image size to 5 MB. Account settings show provider information; password reset is offered only when the account has an email/password provider.
- Firestore stores profiles, one `friendships/{sortedUidA_sortedUidB}` document per pair, reviews, stable place records keyed by Google Place ID, and materialized personal rankings at `users/{uid}/list/{placeId}`. Ratings are numeric 0–5 values normalized to hundredths; review and List documents use `ratingScale: 5`. Friend request records transition from pending to accepted/declined, while cancellation and removal delete the record. Only accepted friends can read another user's persisted List; only the owner can change it. Review create/update/delete operations atomically update the user's ordered List. The first owner List read rebuilds this projection from existing reviews, and `foodService.rebuildMyListFromReviews()` is available to repair it later. List entries keep the place ID, rank, overall rating, rating scale, and review update time. Google Place details and photos are fetched live rather than retained in Firestore because the Places API policy exempts Place IDs from its storage restrictions, but restricts storing other Places content. Review ownership uses the authenticated UID.

### Rating data migration

Existing reviews and personal List entries use legacy scales. The migration below reads both collections, normalizes review ratings to 0–5, and recalculates List ranks from reviews. It updates only review `rating`/`ratingScale` and List `rank`/`rating`/`ratingScale`; existing timestamps and unrelated fields are retained. Orphan List entries are reported and removed when applying. The default command is a dry run and never writes:

```powershell
npm run migrate:ratings -- --project-id <firebase-project-id>
```

Authenticate with Application Default Credentials first (`gcloud auth application-default login`) or set `GOOGLE_APPLICATION_CREDENTIALS` to a service-account key outside the repository. Review the printed project ID, rating changes, rank changes, and stale entry paths, and take a Firestore export/backup before applying. Run during a maintenance window so reviews are not being created or edited while the migration writes its reviewed snapshot. To apply after review, explicitly repeat the same project ID as a confirmation:

```powershell
npm run migrate:ratings -- --project-id <firebase-project-id> --apply --confirm-project <firebase-project-id>
```

The migration is idempotent; it is not run automatically by the app or deployment.

Run `npm run verify:firestore` to exercise the rules with two temporary Auth Emulator accounts and local Firestore and Storage Emulators. It checks unique searchable profiles, profile updates visible to a second account's friend list and existing review authors, owner-only image upload and deletion, the 5 MB upload limit, the mutual friend-request lifecycle, friend-only List visibility and removal, review ownership, stable Place IDs, client reinitialization, and unauthenticated access denial.

## Google Places

Set `EXPO_PUBLIC_GOOGLE_MAPS_BROWSER_API_KEY` for web, `EXPO_PUBLIC_GOOGLE_PLACES_API_KEY` for Android/iOS Places search, and `EXPO_PUBLIC_GOOGLE_MAPS_NATIVE_API_KEY` for Android/iOS map tiles. Without Firebase, search can use the local Sydney mock venues. Firebase mode requires live Places search and reports a configuration error if the Places key is missing.

In Google Cloud, enable billing and:

- **Places API (New)** for search, details and native REST requests.
- **Maps JavaScript API** for the browser Places library.
- **Maps SDK for Android** and **Maps SDK for iOS** for native map tiles.

Restrict the browser key to Maps JavaScript API, Places API (New), and deployed origins. Keep native keys separate: the Places key uses Places API (New), and map keys use the respective Maps SDK and app identifiers configured in `app.config.ts` (`com.thelist.app`). See DEPLOYMENT.md for restriction details and native REST limitations.

Google Places content is shown with Google Maps attribution and photo author attribution when provided. The app requests venue details and photos live; only place IDs are saved. Before public release, provide Terms of Use and a Privacy Policy that cover Google Maps Platform use.

## Structure

- `app/` — Expo Router welcome, tabs, venue and review routes
- `components/` — shared native UI primitives and cards
- `services/foodService.ts` — UI-facing application service
- `services/repositories.ts` — Firebase-independent repository interfaces
- `services/mockRepository.ts` and `services/firestoreRepository.ts` — data implementations
- `services/googlePlaces.web.ts` and `.native.ts` — platform-specific venue discovery
- `data/mock.ts` — local Sydney venues, profiles and starter reviews
- `firestore.rules` — authenticated ownership rules for the MVP
- `theme/` — shared color, spacing, radius and shadow tokens
- `types/` — domain types

Ratings shown as **The List** are calculated from our Firestore reviews and displayed to two decimal places on a 5-point scale. Personal rank uses the overall rating with optional category ratings contributing a combined 10%. Google ratings are displayed separately when available. Reviews, persisted personal List entries, and app-owned user data persist in Firestore when Firebase is configured; mock mode remains in-memory and resets on reload.

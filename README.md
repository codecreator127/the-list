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
- Firebase Authentication uses email and password. Enable **Email/Password** under Firebase Console → Authentication → Sign-in method, then publish `firestore.rules`. The app creates `users/{auth.uid}` on sign-up and returning-user sign-in. Users can read app data when signed in; each review is owned by the creating Auth UID and points to a stable Place document ID.
- Firestore stores user profiles, reviews, a stable place record keyed by Google Place ID, and a materialized personal ranking at `users/{uid}/list/{placeId}`. Reviews remain the source of truth; review create/update/delete operations atomically update the user's ordered List. The first List read rebuilds this projection from that user's existing reviews, and `foodService.rebuildMyListFromReviews()` is available to repair it later. List entries keep only the place ID, rank, overall rating, and review update time. Google Place details and photos are fetched live rather than retained in Firestore because the Places API policy exempts Place IDs from its storage restrictions, but restricts storing other Places content. Review and List ownership use the authenticated UID.

Run `npm run verify:firestore` to exercise the rules with two temporary Auth Emulator accounts and a local Firestore Emulator. It checks cross-user review visibility, UID-scoped queries, personal List ordering and isolation, profile creation metadata, owner-only review changes, stable Place IDs, client reinitialization, and unauthenticated access denial.

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

Ratings shown as **The List** are calculated from our Firestore reviews. Personal rank uses the overall 10-point rating with optional category ratings contributing a combined 10%. Google ratings are displayed separately when available. Reviews, persisted personal List entries, and app-owned user data persist in Firestore when Firebase is configured; mock mode remains in-memory and resets on reload.

# Combined Lists and cuisine filters

Open **List → Combined List**. You are included initially; uncheck yourself to combine only friends. Search and select accepted friends, then tap a restaurant to see its details and the individual ratings used in the combined score. Returning to the selector preserves the selection while refreshing data and permissions.

Both personal and Combined Lists support multiple cuisine selections, All cuisines, removable filter chips, and Clear all. Cuisine selections match any selected cuisine, and compose with the name search, area and minimum-rating filters. Filtering never writes data or renumbers global ranks. Cuisine labels come from existing cuisine/category metadata; comma, slash and semicolon-separated labels are recognized. Blank/generic metadata is shown under Other / unspecified.

## Calculation

`features/combinedList.ts` groups reviews by the canonical `placeId` already used by Firestore and personal Lists. It reuses `latestReviews` so each selected person contributes only their latest review of a restaurant. It computes the arithmetic mean of their displayed List scores, using the same 90% overall / 10% optional category formula as personal Lists and review previews. Each person's score is rounded to two decimals before averaging, matching their displayed contribution. The mean is retained before rounding for ordering; the displayed rating is rounded to two decimals. Ordering is descending mean, descending unique reviewer count, then ascending stable place ID. Rank assignment precedes all filters.

## Data and access

- Combined Lists are calculated on demand. No group, shared List, review or ranking documents are written.
- `createCombinedListData` validates selected IDs against the current user's accepted friendships before and after asynchronous reads. These permission checks use `getDocsFromServer`, failing closed when the server is unreachable rather than authorizing a new calculation from an offline friendship cache. `foodService` also checks that the signed-in identity has not changed during a request.
- `reviewsByUsers` batches complete histories in groups of at most 30 IDs. It does not use the bounded 60-review Home activity query. Places and public user profiles are also fetched in batches, never by issuing a query per restaurant or review.
- Histories, pending reads and hydrated place metadata are reused within a screen session across participant changes. Focus/app activation refreshes the session. Missing place documents are skipped with an unavailable count; unavailable Google details retain a readable placeholder and valid rating. Metadata is not persisted to Firestore.
- The participant selector observes accepted-friendship changes on Firebase. Removal clears displayed results, removes that participant and reloads. The restaurant detail context also rechecks permissions and invalidates on friendship changes. Cached data and forged detail URLs cannot bypass the service checks.
- Only the existing public `usernames` profile projection is used. Combined Lists do not read private user profiles or friends' materialized private List documents. Existing Firestore List visibility rules remain unchanged. Their owner/friend-only enforcement and revocation are tested in the emulator.
- As previously noted in CLOUDINARY.md, the live project's temporary test-mode rules differ from the stricter local rules. This feature does not alter or deploy rules; public-launch security still requires a separate rules deployment. Client service validation does not replace server security rules.

## Verification

```sh
npm run test:combined
npm run test:v1
npm run test:ratings
npm run typecheck
npm run verify:v1
npx expo export --platform web --output-dir .expo/combined-build
npx expo export --platform ios --output-dir .expo/combined-ios
```

`test:combined` covers overlapping/non-overlapping reviews, self exclusion, duplicate reviews, equal and nearly equal averages, deterministic ties, multi-cuisine filtering, missing metadata, empty selections, batched joins, session caching, concurrent reads and removed-friend access. `verify:v1` uses demo emulators, verifies a complete 125-restaurant combined ranking and contributor detail context, confirms the persisted personal List is unchanged, and rejects combined/detail/private-List access after friendship removal. No live data is seeded by these checks.

In the Windows sandbox, Hermes initially could not write its bytecode to the default temporary directory. The iOS export passed with `TEMP` and `TMP` set to a project-local `.expo/hermes-temp` directory for that shell command. No runtime engine setting was changed. Web UI checks also verified multi-cuisine selection/reset on both screens, preserved rank gaps, self-exclusion and the individual-rating panel; native UI/device execution was not performed.

# V1 test data

The commands use Firebase Admin SDK credentials and bypass client security rules. They default to **loopback Auth and Firestore emulators**, require a `demo-` project ID, and never fall back to live Firebase. Nothing in app startup, build or deployment runs the seed automatically.

## Commands

Run in this repository:

```powershell
npm run test:seed
npm run test:seed:emulator
firebase emulators:start --project demo-the-list --only auth,firestore
```

The `test:seed:emulator` smoke test uses its own empty `demo-list-seed-guards` project and verifies all commands refuse an unresolved protected UID without writing anything. Run it before starting a persistent emulator. If the Windows Java launcher hangs, prepend a working JDK's `bin` directory to the current shell's `PATH` before starting Firebase CLI.

In a second terminal:

```powershell
$env:FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:32199'
$env:FIRESTORE_EMULATOR_HOST = '127.0.0.1:32180'
$env:SEED_USER_PASSWORD = '<choose a disposable password of at least 12 characters>'
npm run seed:dry-run -- --namespace v1seed --places-file C:\fixtures\google-place-ids.json
npm run seed -- --namespace v1seed --places-file C:\fixtures\google-place-ids.json
npm run seed:verify -- --namespace v1seed
npm run seed:cleanup -- --namespace v1seed
```

No `.env` files are automatically loaded. Set environment variables in the shell. Keep credentials and private exports outside the repository. Never use a personal password for generated accounts.

`test@gmail.com` must already exist in the selected Auth environment. Every command resolves its UID and fails before writes if it cannot. For an empty emulator, manually create a disposable emulator-only Auth sentinel with that email, or import a suitable local fixture. The seed script never creates, updates, deletes or changes the password of this account. Do not export production passwords or use production Auth tokens in an emulator.

The Place ID file is a JSON array of **genuine IDs previously obtained from Google Places**, for example `['ID exported from Places', ...]` (use JSON double quotes in the actual file). Supply 100–150 eligible unique IDs. Existing saved `places/pl_<googlePlaceId>` entries are read and reused first; the merged IDs are sorted and capped at 150. Places referenced by the protected user's reviews or personal List are excluded. No Google Places calls are made by the seed tooling, and no IDs or restaurant details are invented. ID syntax validation cannot prove an ID exists: the source export is responsible for authenticity. If fewer than 100 remain, all writes stop with the eligible count. Existing synthetic IDs such as `mock:`, `emulator...` and `v1_...` are rejected.

With 150 places, the plan creates 30 diners, 1,561 reviews and matching List entries, mutual accepted friendships and pending requests. One diner has 150 reviews, another has 110, one has one review, two have none, and three have no social connections. All reviewers share a popular venue; the last venue has only one review. Ratings include 0.00, 5.00, exact ties, differences of 0.01, optional category scores and timestamps spanning about 18 months. Firestore numbers do not retain trailing zero formatting; the values are rounded to hundredths. Profiles use realistic names and unique usernames within the app's existing profile schema.

The first run freezes its anchor date and Place IDs. An optional `--anchor 2026-10-19T00:00:00.000Z` makes the initial date reproducible across environments. Subsequent commands use the saved inputs: you may omit `--places-file` and `--anchor`. Repeating the first seed command also works if its file content and explicit anchor are unchanged. A changed file is rejected before writes.

## Ownership, reruns and cleanup

Accounts use UIDs `seed_<namespace>_<00..29>`, emails `list.seed.<namespace>.<index>@example.test`, and the `listSeed` Auth claim. The namespace is 3–8 lowercase alphanumeric characters starting with a letter. To sign in, use one of those emails and `SEED_USER_PASSWORD`; user 0 has the largest List. Existing account passwords are never changed by reruns.

Ownership is recorded under `seedRuns/<namespace>` and `seedRuns/<namespace>/documents/<hash>`. These paths have no client access under the existing rules. Each record contains its exact path and original content hash. Seed metadata is kept out of application documents because the rules reject additional fields. Application review, profile, List, friendship and place schemas remain unchanged. Lists and preview use `features/myList.ts`, including weighted category scores and score/time/place-ID tie breaking. `listMeta/state` starts initialized so the app does not rebuild the seeded List on first load.

The seed only creates missing documents and seed accounts. It never updates an existing real profile, username reservation, review, friendship, List or Place document. Existing Place documents are reused without adding ownership. A collision, changed seed document, protected-user reference or unknown Auth ownership halts the command. There is no reset, force, overwrite or database-wide deletion option. A crash after some Firestore batches is recoverable by rerunning; batches atomically create documents and their ledger entries. Auth and Firestore cannot commit together: a crash between Auth creation and claim installation fails closed on the unclaimed account. Inspect such an account manually; the tool will not automatically adopt or delete it.

Cleanup validates the ledger against the frozen plan, checks original content hashes, checks for unowned reviews, username reservations, friendships and user subcollection data, and then deletes only recorded paths and owned accounts. It retains seeded Places referenced by outside reviews or Lists, along with their ownership records. Reused Places are never deleted. Modified seed data blocks cleanup instead of discarding testing changes. Missing recorded documents are tolerated by cleanup. Auth deletion is per UID, never bulk deletion. Repeating cleanup after success is a no-op.

**Use a quiescent test environment for seed and cleanup.** Per-document transactions prevent overwrites and detect concurrent changes, but there is no global lock across Auth and Firestore or across external users adding references. Stop testers and other writers before maintenance. Cleanup does not recursively delete arbitrary subcollections, Storage files or external systems.

`seed:verify` is read-only. It checks expected content, account ownership, exact review and friendship counts, sequential List ranks, ratings, timestamps, and full List/review synchronization using the shared ranking function. After deliberately editing seeded data in the app, verification reports drift; it does not silently restore the fixture. Use a fresh namespace or clean up before making edits if you need an exact baseline again.

## Real Firebase: approval required

Do not run live seed or cleanup until the owner approves the specific project, dry-run report and namespace. Prefer an isolated staging project. Read-only inspection also requires explicitly selecting real mode. These commands are instructions only; implementation work does not grant approval to run them.

After approval, remove both emulator host variables and set:

```powershell
Remove-Item Env:FIREBASE_AUTH_EMULATOR_HOST -ErrorAction SilentlyContinue
Remove-Item Env:FIRESTORE_EMULATOR_HOST -ErrorAction SilentlyContinue
$env:GOOGLE_APPLICATION_CREDENTIALS = 'C:\private\staging-service-account.json'
$env:SEED_FIREBASE_PROJECT_ID = '<verified-project-id>'
npm run seed:dry-run -- --real --project-id <verified-project-id> --namespace v1seed --places-file C:\fixtures\google-place-ids.json
```

Confirm the project in Firebase Console and review the printed protected UID and counts. The credential JSON's `project_id` must match the selected project and `SEED_FIREBASE_PROJECT_ID`. Pass the printed `anchor` as `--anchor` when applying the reviewed initial plan, especially if approval comes on a different day. After reviewing and approving that concrete report:

```powershell
$env:SEED_ALLOW_REAL_WRITE = '<verified-project-id>'
$env:SEED_USER_PASSWORD = '<disposable test password>'
npm run seed -- --real --project-id <verified-project-id> --confirm-project <verified-project-id> --namespace v1seed --places-file C:\fixtures\google-place-ids.json --anchor <anchor-from-dry-run>
npm run seed:verify -- --real --project-id <verified-project-id> --namespace v1seed
# Cleanup also requires the exact project confirmation and write environment variable.
npm run seed:cleanup -- --real --project-id <verified-project-id> --confirm-project <verified-project-id> --namespace v1seed
Remove-Item Env:SEED_ALLOW_REAL_WRITE
```

Use the existing Place IDs without a file when sufficient eligible saved venues already exist. A service account from another project, mixed emulator/live configuration, or missing confirmation is rejected before Firebase initialization. The code gates enforce explicit targeting; human approval remains an operational requirement.

## Validation and V1 acceptance

`npm run test:seed` exercises deterministic generation, both dataset bounds, duplicate prevention, protected references, target gating, tie breaking, ranking preview/edit/delete projections, filters and Home/restaurant joins at 150-entry scale. Its generated identifiers exist only in memory and are never written to Firebase. Existing `npm run test:ratings` and `npm run test:v1` cover additional application logic. `npm run verify:v1` exercises client security rules and V1 integration on emulators using its separate existing fixtures.

After a real-ID emulator seed, run `seed:verify`, then use a client explicitly connected to the same emulator Auth/Firestore project. The current app configuration does not automatically connect to emulators merely because these Admin environment variables are set; do not point the UI at live Firebase by accident. Google Places search/detail still needs its existing Places configuration and can make live billable calls. Avoid repeatedly opening the 150-entry List, because the existing app fetches live venue details for each entry; the seed script itself makes zero Places calls.

Record pass/fail for this checklist in a test session:

| Area | Check |
| --- | --- |
| Search and details | Search for a genuine seeded venue, resolve the canonical Place ID, open details and check review counts and own review. |
| Personal List | Sign in as user 0, load 100+ entries, inspect top/middle/bottom ranks; combine text, cuisine, area and minimum-rating filters without changing global ranks. |
| Friends | Check both directions of an accepted friendship, a pending sender and recipient, and isolated user 27; pending requests must not expose friend ratings. Compare friend averages with displayed reviews. |
| Home / For You | Check recent own reviews, accepted-friend activity, highly rated recommendations, reviewed/unreviewed ordering and empty states for user 29. |
| Profile and relationships | Search the namespace usernames, change one seed profile, send/accept/cancel a seed-only request and remove a seed-only friendship. Never interact with the protected account. |
| Review mutations | On a generated account and eligible venue, create, edit and delete a review. Check its List projection immediately after each operation and compare preview rank with saved rank for tied and near-tied ratings. |
| Performance | Time cold and warm loads of user 0's List, filter response and review save; inspect Firestore request counts and Places calls. Capture timings/device/network; no universal performance threshold is assumed. |

UI flow validation and real-ID integration remain pending until a genuine ID corpus and a configured emulator client are available. Passing pure data tests is not a claim that browser/device flows or live Places responses were exercised.

Firebase references: [Auth emulator Admin connection](https://firebase.google.com/docs/emulator-suite/connect_auth), [Firestore emulator Admin connection](https://firebase.google.com/docs/emulator-suite/connect_firestore), [transactions](https://firebase.google.com/docs/firestore/manage-data/transactions).

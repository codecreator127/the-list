import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
// tsx loads this project's .ts helpers as CommonJS. Use the same Firebase SDK
// instance here: mixing its ESM and CJS exports breaks Firestore instanceof checks.
const require = createRequire(import.meta.url);
const { deleteApp, initializeApp } = require('firebase/app');
const { connectAuthEmulator, createUserWithEmailAndPassword, getAuth, signOut } = require('firebase/auth');
const { collection, connectFirestoreEmulator, doc, getDoc, getDocs, getDocsFromServer, disableNetwork, enableNetwork, getFirestore, orderBy, query, serverTimestamp, setDoc, updateDoc, deleteDoc, where, writeBatch } = require('firebase/firestore');
import { createBatchedReads } from '../services/batchedReads.ts';
import { createPersonalizedData } from '../services/personalizedData.ts';
import { filterPersonalList } from '../features/listFilters.ts';
import { rankListEntries, reviewRankingCandidate } from '../features/myList.ts';
import { createCombinedListData } from '../services/combinedListData.ts';

// Never run against production: the CLI must supply both emulator endpoints.
assert.ok(process.env.FIREBASE_AUTH_EMULATOR_HOST, 'Run with npm run verify:v1');
assert.ok(process.env.FIRESTORE_EMULATOR_HOST, 'Firestore emulator is required');
const projectId = 'demo-the-list';
function client(name) {
  const app = initializeApp({projectId, apiKey: 'demo-api-key', authDomain: `${projectId}.firebaseapp.com`}, `v1-${name}`);
  const auth = getAuth(app);
  connectAuthEmulator(auth, `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`, {disableWarnings: true});
  const db = getFirestore(app);
  const [host, port] = process.env.FIRESTORE_EMULATOR_HOST.split(':');
  connectFirestoreEmulator(db, host, Number(port));
  const batched = createBatchedReads(db);
  const fromReview = row => { const raw = row.data(); return {...raw, id: row.id, date: 'Today', createdAt: raw.createdAt.toDate(), updatedAt: raw.updatedAt.toDate()}; };
  const fromPlace = row => ({id: row.id, googlePlaceId: row.data().googlePlaceId, name: `Restaurant ${row.id}`, category: 'Cafe', cuisine: Number(row.id.split('_').at(-1)) % 2 ? 'Japanese' : 'Cafe', area: 'Sydney', address: '', image: '', price: '', description: '', averageRating: 0, reviewCount: 0});
  const repository = {
    async getPlace(id) {const row = await getDoc(doc(db, 'places', id)); return row.exists() ? fromPlace(row) : null;},
    async getPlacesByIds(ids) {return (await batched.places(ids)).map(fromPlace);},
    async getUsers(ids) {return (await batched.profiles(ids)).map(row => {const data = row.data(); return {id: data.uid, name: data.displayName, handle: data.username, initials: data.displayName[0], color: '#888'};});},
    async getReviewsForPlace(id) {return (await getDocs(query(collection(db, 'reviews'), where('placeId', '==', id)))).docs.map(fromReview);},
    async getReviewsByUser(id) {return (await getDocs(query(collection(db, 'reviews'), where('userId', '==', id)))).docs.map(fromReview);},
    async getReviewsByUsers(ids) {return (await batched.reviewsByUsers(ids)).map(fromReview);},
    async getRecentReviewsByUsers(ids) {return (await batched.recentFriendReviews(ids)).map(fromReview);},
    async listFriendships(id,requireServer=false) {const request=query(collection(db, 'friendships'), where('userIds', 'array-contains', id));return (await (requireServer?getDocsFromServer(request):getDocs(request))).docs.map(row => ({...row.data(), id: row.id}));},
  };
  return {app, auth, db, batched, repository, loader: createPersonalizedData(repository, async place => place)};
}
const alice = client('alice');
const bob = client('bob');
try {
  const aliceUid = (await createUserWithEmailAndPassword(alice.auth, 'v1-alice@example.test', 'v1-testing-password')).user.uid;
  const bobUid = (await createUserWithEmailAndPassword(bob.auth, 'v1-bob@example.test', 'v1-testing-password')).user.uid;
  for (const [account, uid, username] of [[alice, aliceUid, 'v1_alice'], [bob, bobUid, 'v1_bob']]) {
    const batch = writeBatch(account.db);
    const profile = {username, usernameNormalized: username, displayName: username, createdAt: serverTimestamp(), updatedAt: serverTimestamp()};
    batch.set(doc(account.db, 'users', uid), profile);
    batch.set(doc(account.db, 'usernames', username), {...profile, uid});
    await batch.commit();
    const empty = await account.loader.home(uid);
    assert.equal(empty.friendCount, 0);
    assert.equal(empty.recent.length, 0);
    assert.equal(empty.activity.length, 0);
    assert.equal(empty.highlyRated.length, 0);
  }
  console.log('PASS: two new accounts with no friends or reviews.');

  const places = Array.from({length: 125}, (_, i) => `pl_v1_${i}`);
  // Small batches keep rule document-access counts below Firestore's batch limit.
  for (let offset = 0; offset < places.length; offset += 10) {
    const batch = writeBatch(alice.db);
    for (const placeId of places.slice(offset, offset + 10)) batch.set(doc(alice.db, 'places', placeId), {googlePlaceId: placeId.slice(3), createdAt: serverTimestamp(), updatedAt: serverTimestamp()});
    await batch.commit();
  }
  for (let offset = 0; offset < places.length; offset += 10) {
    const batch = writeBatch(alice.db);
    for (const [i, placeId] of places.slice(offset, offset + 10).entries()) batch.set(doc(alice.db, 'reviews', `${aliceUid}_${placeId}`), {userId: aliceUid, placeId, rating: i % 2 ? 4.75 : 4.25, ratingScale: 5, text: `Meal at ${placeId}`, createdAt: serverTimestamp(), updatedAt: serverTimestamp()});
    await batch.commit();
  }
  const own = await alice.repository.getReviewsByUser(aliceUid);
  const ranked = rankListEntries(own.map(reviewRankingCandidate));
  for (let offset = 0; offset < ranked.length; offset += 10) {
    const batch = writeBatch(alice.db);
    for (const row of ranked.slice(offset, offset + 10)) batch.set(doc(alice.db, 'users', aliceUid, 'list', row.placeId), {...row, ratingScale: 5});
    await batch.commit();
  }
  const before = (await getDocs(query(collection(alice.db, 'users', aliceUid, 'list'), orderBy('rank')))).docs.map(row => row.data());
  const resolved = new Map((await alice.repository.getPlacesByIds(places)).map(place => [place.id, place]));
  const items = ranked.map(row => ({...row, place: resolved.get(row.placeId)}));
  const filtered = filterPersonalList(items, {search: 'restaurant', cuisine: 'Japanese', area: 'Sydney', minimumRating: 4.5});
  assert.ok(filtered.length > 0);
  assert.ok(filtered.every(row => row.rank === items.find(item => item.placeId === row.placeId).rank));
  const after = (await getDocs(query(collection(alice.db, 'users', aliceUid, 'list'), orderBy('rank')))).docs.map(row => row.data());
  assert.deepEqual(after, before);
  assert.equal((await alice.loader.home(aliceUid)).recent.length, 3);
  console.log('PASS: 125-entry persisted List, batched place reads, combined filters, unchanged global ranks/data.');

  const shared = places[0];
  await setDoc(doc(bob.db, 'reviews', `${bobUid}_${shared}`), {userId: bobUid, placeId: shared, rating: 4.5, ratingScale: 5, text: 'Bob recommends this restaurant.', createdAt: serverTimestamp(), updatedAt: serverTimestamp()});
  assert.equal((await bob.loader.restaurant(shared, bobUid)).friendReviews.length, 0);
  const pairId = [aliceUid, bobUid].sort().join('_');
  await setDoc(doc(alice.db, 'friendships', pairId), {userIds: [aliceUid, bobUid].sort(), requesterId: aliceUid, recipientId: bobUid, status: 'pending', createdAt: serverTimestamp(), updatedAt: serverTimestamp()});
  assert.equal((await bob.loader.home(bobUid)).activity.length, 0);
  const combinedSession=createCombinedListData(bob.repository,async place=>place,bobUid);
  await assert.rejects(()=>combinedSession.load([bobUid,aliceUid]),/accepted friends/,'pending participants cannot be combined');
  await updateDoc(doc(bob.db, 'friendships', pairId), {status: 'accepted', updatedAt: serverTimestamp()});
  assert.equal((await combinedSession.participants()).length,2);
  const combined=await combinedSession.load([aliceUid,bobUid]);
  assert.equal(combined.items.length,125,'Combined List reads full histories, not the bounded Home sample');
  const sharedCombined=combined.items.find(row=>row.placeId===shared);
  assert.equal(sharedCombined.reviewerCount,2);assert.equal(sharedCombined.average,4.375);assert.equal(sharedCombined.rating,4.38);
  const combinedFiltered=filterPersonalList(combined.items,{search:'Restaurant',cuisines:['Japanese','Cafe'],area:'Sydney',minimumRating:4.5});
  assert.ok(combinedFiltered.length>0);
  assert.ok(combinedFiltered.every(row=>row.rank===combined.items.find(item=>item.placeId===row.placeId).rank));
  const detailedCombined=await bob.loader.restaurant(shared,bobUid,[aliceUid,bobUid]);
  assert.equal(detailedCombined.combined.contributions.length,2);
  const persistedAfterCombined=(await getDocs(query(collection(alice.db,'users',aliceUid,'list'),orderBy('rank')))).docs.map(row=>row.data());
  assert.deepEqual(persistedAfterCombined,before,'combining and filtering do not change persisted ranks or reviews');
  await disableNetwork(bob.db);
  await assert.rejects(()=>combinedSession.load([aliceUid,bobUid]),/offline|unavailable|server/i,'offline friendship cache cannot authorize a new combined calculation');
  await enableNetwork(bob.db);
  console.log('PASS: accepted-only Combined Lists, complete 125-review histories, shared averages/contributors, multi-cuisine filters and unchanged persisted ranks.');
  const aliceRestaurant = await alice.loader.restaurant(shared, aliceUid);
  const bobRestaurant = await bob.loader.restaurant(shared, bobUid);
  assert.deepEqual(aliceRestaurant.friendReviews.map(row => row.userId), [bobUid]);
  assert.equal(aliceRestaurant.friendAverage, 4.5);
  assert.equal(bobRestaurant.friendReviews[0].userId, aliceUid);
  assert.equal(bobRestaurant.myReview.userId, bobUid);
  assert.equal((await bob.repository.getRecentReviewsByUsers([aliceUid])).length, 60, 'friend query is bounded');
  assert.equal((await bob.batched.recentFriendReviews([])).length, 0);
  assert.equal((await bob.batched.profiles([])).length, 0);
  assert.equal((await bob.batched.places([])).length, 0);
  const bobHome = await bob.loader.home(bobUid);
  assert.equal(bobHome.friendCount, 1);
  assert.equal(bobHome.activity.length, 4);
  assert.ok(bobHome.activity.every(row => row.userId === aliceUid));
  assert.ok(bobHome.highlyRated.every(row => row.average >= 4));
  assert.equal(bobHome.highlyRated[0].reviewed, false);
  await assert.rejects(() => getDoc(doc(bob.db, 'users', aliceUid)), /permission-denied/i);
  await assert.rejects(() => updateDoc(doc(bob.db, 'reviews', `${aliceUid}_${shared}`), {text: 'Forbidden'}), /permission-denied/i);
  console.log('PASS: both directions of friend restaurant ratings, bounded Home queries, unseen recommendations, private profile and ownership rules.');

  await deleteDoc(doc(bob.db, 'friendships', pairId));
  await assert.rejects(()=>combinedSession.load([aliceUid,bobUid]),/accepted friends/,'cached selections cannot bypass removal');
  await assert.rejects(()=>bob.loader.restaurant(shared,bobUid,[aliceUid,bobUid]),/accepted friends/,'detail URLs cannot bypass removal');
  assert.equal((await bob.loader.restaurant(shared, bobUid)).friendReviews.length, 0);
  assert.equal((await bob.loader.home(bobUid)).activity.length, 0);
  await assert.rejects(() => getDoc(doc(bob.db, 'users', aliceUid, 'list', shared)), /permission-denied/i);
  await signOut(bob.auth);
  await assert.rejects(() => bob.loader.restaurant(shared, bobUid), /permission-denied/i);
  await assert.rejects(() => bob.batched.recentFriendReviews([aliceUid]), /permission-denied/i);
  console.log('PASS: removing a friend clears social sections, List access is revoked, signed-out reads are denied.');
} finally {
  await Promise.all([deleteApp(alice.app), deleteApp(bob.app)]);
}

import assert from 'node:assert/strict';
import { deleteApp, initializeApp } from 'firebase/app';
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth, signInWithEmailAndPassword, signOut, updateProfile } from 'firebase/auth';
import { addDoc, collection, connectFirestoreEmulator, deleteDoc, doc, getDoc, getDocs, initializeFirestore, orderBy, query, runTransaction, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore';

const projectId = 'demo-the-list';
const authEmulator = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '127.0.0.1:9099';
const firestoreEmulator = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';
const [firestoreHost, firestorePort] = firestoreEmulator.split(':');
function createClient(name) {
  const app = initializeApp({ apiKey: 'demo-api-key', authDomain: `${projectId}.firebaseapp.com`, projectId }, name);
  const auth = getAuth(app);
  connectAuthEmulator(auth, `http://${authEmulator}`, { disableWarnings: true });
  const db = initializeFirestore(app, {});
  connectFirestoreEmulator(db, firestoreHost, Number(firestorePort));
  return { app, auth, db };
}

const alice = createClient('alice');
const bob = createClient('bob');
const aliceCredential = await createUserWithEmailAndPassword(alice.auth, 'alice@example.test', 'testing-password-1');
const bobCredential = await createUserWithEmailAndPassword(bob.auth, 'bob@example.test', 'testing-password-2');
await updateProfile(aliceCredential.user, { displayName: 'Alice' });
await updateProfile(bobCredential.user, { displayName: 'Bob' });
const aliceUid = aliceCredential.user.uid;
const bobUid = bobCredential.user.uid;
const aliceProfile = doc(alice.db, 'users', aliceUid);
const bobProfile = doc(bob.db, 'users', bobUid);

async function ensureUserProfile(db, user) {
  const reference = doc(db, 'users', user.uid);
  await runTransaction(db, async transaction => {
    const prior = await transaction.get(reference);
    const data = { displayName: user.displayName ?? user.email.split('@')[0], email: user.email, updatedAt: serverTimestamp() };
    if (prior.exists()) transaction.set(reference, data, { merge: true });
    else transaction.set(reference, { ...data, createdAt: serverTimestamp() });
  });
}

await ensureUserProfile(alice.db, aliceCredential.user);
await ensureUserProfile(bob.db, bobCredential.user);
const aliceCreatedAt = (await getDoc(aliceProfile)).data().createdAt.toMillis();
assert.equal((await getDoc(doc(bob.db, 'users', aliceUid))).data().displayName, 'Alice', 'signed-in users can read other user profiles');

const googlePlaceId = 'emulator_place_123';
const placeRef = doc(alice.db, 'places', `pl_${googlePlaceId}`);
await setDoc(placeRef, { googlePlaceId, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
const placeId = placeRef.id;
const extraListPlaceIds = ['rank_b', 'rank_c', 'rank_d'].map(googleId => `pl_${googleId}`);
for (const [index, id] of extraListPlaceIds.entries()) {
  const googleId = id.slice(3);
  await setDoc(doc(alice.db, 'places', id), { googlePlaceId: googleId, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
}
const aliceReviews = collection(alice.db, 'reviews');
const aliceReview1 = doc(aliceReviews, `${aliceUid}_${placeId}`);
await setDoc(aliceReview1, { userId: aliceUid, placeId, rating: 10, ratingScale: 10, subRatings: { food: 9, service: 8 }, text: 'Nice.', createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
await assert.rejects(() => addDoc(aliceReviews, { userId: aliceUid, placeId, rating: 8, ratingScale: 10, text: 'A second note for the same place.', createdAt: serverTimestamp(), updatedAt: serverTimestamp() }), /permission-denied/i, 'reviews must use the unique user and place document ID');
const bobReviews = collection(bob.db, 'reviews');
await updateDoc(doc(bob.db, 'places', placeId), { updatedAt: serverTimestamp() });
assert.equal((await getDocs(query(collection(bob.db, 'places'), where('googlePlaceId', '==', googlePlaceId)))).size, 1, 'both users resolve the same Google place to one Firestore Place');
const bobReview = doc(bobReviews, `${bobUid}_${placeId}`);
await setDoc(bobReview, { userId: bobUid, placeId, rating: 8, ratingScale: 10, text: 'Great food, and I would happily return.', createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
const aliceListEntry = doc(alice.db, 'users', aliceUid, 'list', placeId);
const bobListEntry = doc(bob.db, 'users', bobUid, 'list', placeId);
const listEntry = { placeId, rank: 1, rating: 10, updatedAt: serverTimestamp() };
await setDoc(aliceListEntry, listEntry);
for (const [index, id] of extraListPlaceIds.entries()) await setDoc(doc(alice.db, 'users', aliceUid, 'list', id), { placeId: id, rank: index + 2, rating: [9, 8, 6][index], updatedAt: serverTimestamp() });
await setDoc(bobListEntry, { ...listEntry, rating: 8 });
const aliceOrderedList = await getDocs(query(collection(alice.db, 'users', aliceUid, 'list'), orderBy('rank', 'asc')));
assert.deepEqual(aliceOrderedList.docs.map(row => row.data().rank), [1, 2, 3, 4], 'a user can read their persisted ranked List in order');
await assert.rejects(() => getDoc(doc(bob.db, 'users', aliceUid, 'list', placeId)), /permission-denied/i, 'users cannot read another user’s List');
await assert.rejects(() => setDoc(doc(bob.db, 'users', aliceUid, 'list', placeId), { ...listEntry, rating: 1 }), /permission-denied/i, 'users cannot modify another user’s List');
await assert.rejects(() => getDoc(doc(alice.db, 'users', bobUid, 'list', placeId)), /permission-denied/i, 'users cannot read another user’s List in the reverse direction');
await signOut(alice.auth);
const allForPlace = await getDocs(query(bobReviews, where('placeId', '==', placeId)));
assert.equal(allForPlace.size, 2, 'different users can each review the same place, including a short note');
const onlyBob = await getDocs(query(bobReviews, where('userId', '==', bobUid), where('placeId', '==', placeId)));
assert.equal(onlyBob.size, 1, 'My Reviews query is scoped to the authenticated UID');

await assert.rejects(() => addDoc(bobReviews, { userId: aliceUid, placeId, rating: 2, ratingScale: 10, text: 'Trying to write as another user.', createdAt: serverTimestamp(), updatedAt: serverTimestamp() }), /permission-denied/i, 'spoofing another review owner is rejected');
await assert.rejects(() => updateDoc(doc(bob.db, 'reviews', aliceReview1.id), { text: 'Bob cannot edit Alice’s review.' }), /permission-denied/i, 'users cannot edit another user’s review');
await assert.rejects(() => deleteDoc(doc(bob.db, 'reviews', aliceReview1.id)), /permission-denied/i, 'users cannot delete another user’s review');
await assert.rejects(() => updateDoc(doc(bob.db, 'users', aliceUid), { displayName: 'Changed by Bob', updatedAt: serverTimestamp() }), /permission-denied/i, 'users cannot edit another user’s profile');
await assert.rejects(() => updateDoc(bobReview, { userId: aliceUid, updatedAt: serverTimestamp() }), /permission-denied/i, 'review owners cannot change their UID');
await updateDoc(bobReview, { text: 'My own review can be edited to add detail.', updatedAt: serverTimestamp() });
await deleteDoc(bobReview);
await signOut(bob.auth);
await assert.rejects(() => getDoc(doc(alice.db, 'places', placeId)), /permission-denied/i, 'unauthenticated application data access is rejected');
await assert.rejects(() => getDoc(doc(alice.db, 'users', aliceUid)), /permission-denied/i, 'unauthenticated users cannot read profiles');
await assert.rejects(() => getDocs(collection(alice.db, 'reviews')), /permission-denied/i, 'unauthenticated users cannot read reviews');
await assert.rejects(() => getDoc(bobListEntry), /permission-denied/i, 'unauthenticated users cannot read a personal List');

const aliceReload = createClient('alice-reloaded');
const aliceReturning = await signInWithEmailAndPassword(aliceReload.auth, 'alice@example.test', 'testing-password-1');
await ensureUserProfile(aliceReload.db, aliceReturning.user);
assert.equal((await getDoc(doc(aliceReload.db, 'users', aliceUid))).data().createdAt.toMillis(), aliceCreatedAt, 'returning sign-in keeps profile creation time');
assert.equal((await getDocs(query(collection(aliceReload.db, 'reviews'), where('userId', '==', aliceUid)))).size, 1, 'review data remains after a client reinitialization and is limited to one per place');
assert.equal((await getDocs(query(collection(aliceReload.db, 'users', aliceUid, 'list'), orderBy('rank', 'asc')))).size, 4, 'the ranked List remains persisted after a client reinitialization');

console.log('Firestore schema verification passed: two users, one review per user and place, shared place reviews, UID-scoped My Reviews, ownership enforcement, and unauthenticated denial.');
await Promise.all([alice.app, bob.app, aliceReload.app].map(app => deleteApp(app)));

import assert from 'node:assert/strict';
import { deleteApp, initializeApp } from 'firebase/app';
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth, signInWithEmailAndPassword, signOut, updateProfile } from 'firebase/auth';
import { addDoc, collection, connectFirestoreEmulator, deleteDoc, doc, endAt, getDoc, getDocs, initializeFirestore, limit, orderBy, query, runTransaction, serverTimestamp, setDoc, startAt, updateDoc, where } from 'firebase/firestore';
import { connectStorageEmulator, deleteObject, getBytes, getStorage, ref, uploadBytes } from 'firebase/storage';

const projectId = 'demo-the-list';
const authEmulator = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '127.0.0.1:9099';
const firestoreEmulator = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';
const [firestoreHost, firestorePort] = firestoreEmulator.split(':');
const storageEmulator = process.env.FIREBASE_STORAGE_EMULATOR_HOST ?? '127.0.0.1:9199';
const [storageHost, storagePort] = storageEmulator.split(':');
function createClient(name) {
  const app = initializeApp({ apiKey: 'demo-api-key', authDomain: `${projectId}.firebaseapp.com`, projectId, storageBucket: `${projectId}.appspot.com` }, name);
  const auth = getAuth(app);
  connectAuthEmulator(auth, `http://${authEmulator}`, { disableWarnings: true });
  const db = initializeFirestore(app, {});
  connectFirestoreEmulator(db, firestoreHost, Number(firestorePort));
  const storage = getStorage(app);
  connectStorageEmulator(storage, storageHost, Number(storagePort));
  return { app, auth, db, storage };
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
const alicePublicProfile = doc(alice.db, 'usernames', 'alice_test');

async function ensureUserProfile(db, user, username, displayName = user.displayName ?? 'List member') {
  const reference = doc(db, 'users', user.uid);
  await runTransaction(db, async transaction => {
    const [prior, reservation] = await Promise.all([
      transaction.get(reference),
      transaction.get(doc(db, 'usernames', username)),
    ]);
    const oldUsername = prior.data()?.usernameNormalized;
    const oldReservation = oldUsername && oldUsername !== username
      ? await transaction.get(doc(db, 'usernames', oldUsername))
      : undefined;
    const now = serverTimestamp();
    const priorDisplayName = prior.data()?.displayName;
    const resolvedDisplayName = priorDisplayName && priorDisplayName !== 'List member' ? priorDisplayName : displayName;
    const data = { username, usernameNormalized: username, displayName: resolvedDisplayName, updatedAt: now };
    const publicData = { uid: user.uid, ...data };
    if (!reservation.exists()) transaction.set(doc(db, 'usernames', username), { ...publicData, createdAt: now });
    else transaction.update(doc(db, 'usernames', username), publicData);
    if (oldReservation?.exists() && oldReservation.data().uid === user.uid) transaction.delete(doc(db, 'usernames', oldUsername));
    if (prior.exists()) transaction.update(reference, data);
    else transaction.set(reference, { ...data, createdAt: now });
  });
}

await ensureUserProfile(alice.db, aliceCredential.user, 'member_alice', 'List member');
await ensureUserProfile(alice.db, aliceCredential.user, 'alice_test', 'Alice');
await ensureUserProfile(bob.db, bobCredential.user, 'bob_test');
const aliceCreatedAt = (await getDoc(aliceProfile)).data().createdAt.toMillis();
assert.equal((await getDoc(alicePublicProfile)).data().displayName, 'Alice', 'users can read their public username profile');
assert.equal((await getDoc(alicePublicProfile)).data().usernameNormalized, 'alice_test', 'the chosen username is saved to the public profile index');
assert.equal((await getDocs(query(collection(bob.db, 'usernames'), where('uid', '==', aliceUid)))).docs[0].data().displayName, 'Alice', 'signup profile repairs a placeholder name before friends load it');
assert.equal((await getDocs(query(collection(bob.db, 'usernames'), where('uid', '==', aliceUid)))).size, 1, 'friend profiles can be looked up by account ID without reading private profile data');
await assert.rejects(() => getDoc(doc(bob.db, 'users', aliceUid)), /permission-denied/i, 'other users cannot read private profile documents');
assert.equal((await getDoc(aliceProfile)).data().email, undefined, 'public profiles do not contain email addresses');
assert.equal((await getDocs(query(collection(alice.db, 'usernames'), orderBy('usernameNormalized'), startAt('bob'), endAt('bob\uf8ff'), limit(20)))).size, 1, 'profiles can be discovered by case-insensitive username prefix');
await assert.rejects(() => setDoc(doc(alice.db, 'usernames', 'bob_test'), { uid: aliceUid, createdAt: serverTimestamp() }), /permission-denied/i, 'users cannot claim another user’s username');
await runTransaction(alice.db, async transaction => {
  const newUsernameRef = doc(alice.db, 'usernames', 'alice_eats');
  const [profile, reservation] = await Promise.all([transaction.get(aliceProfile), transaction.get(newUsernameRef)]);
  assert.equal(reservation.exists(), false, 'the replacement username is available');
  transaction.set(newUsernameRef, { uid: aliceUid, username: 'alice_eats', usernameNormalized: 'alice_eats', displayName: 'Alice', createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  transaction.delete(doc(alice.db, 'usernames', 'alice_test'));
  transaction.update(aliceProfile, { username: 'alice_eats', usernameNormalized: 'alice_eats', updatedAt: serverTimestamp() });
});
assert.equal((await getDocs(query(collection(alice.db, 'usernames'), where('usernameNormalized', '==', 'alice_eats')))).size, 1, 'profile username changes atomically update the searchable username');

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
await setDoc(aliceReview1, { userId: aliceUid, placeId, rating: 4.73, ratingScale: 5, subRatings: { food: 9, service: 8 }, text: 'Nice.', createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
await assert.rejects(() => addDoc(aliceReviews, { userId: aliceUid, placeId, rating: 8, ratingScale: 10, text: 'A second note for the same place.', createdAt: serverTimestamp(), updatedAt: serverTimestamp() }), /permission-denied/i, 'reviews must use the unique user and place document ID');
const bobReviews = collection(bob.db, 'reviews');
await updateDoc(doc(bob.db, 'places', placeId), { updatedAt: serverTimestamp() });
assert.equal((await getDocs(query(collection(bob.db, 'places'), where('googlePlaceId', '==', googlePlaceId)))).size, 1, 'both users resolve the same Google place to one Firestore Place');
const bobReview = doc(bobReviews, `${bobUid}_${placeId}`);
await setDoc(bobReview, { userId: bobUid, placeId, rating: 4.25, ratingScale: 5, text: 'Great food, and I would happily return.', createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
const aliceListEntry = doc(alice.db, 'users', aliceUid, 'list', placeId);
const bobListEntry = doc(bob.db, 'users', bobUid, 'list', placeId);
const listEntry = { placeId, rank: 1, rating: 4.73, ratingScale: 5, updatedAt: serverTimestamp() };
await setDoc(aliceListEntry, listEntry);
for (const [index, id] of extraListPlaceIds.entries()) await setDoc(doc(alice.db, 'users', aliceUid, 'list', id), { placeId: id, rank: index + 2, rating: [4.5, 4.25, 3][index], ratingScale: 5, updatedAt: serverTimestamp() });
await setDoc(bobListEntry, { ...listEntry, rating: 4.25 });
const aliceOrderedList = await getDocs(query(collection(alice.db, 'users', aliceUid, 'list'), orderBy('rank', 'asc')));
assert.deepEqual(aliceOrderedList.docs.map(row => row.data().rank), [1, 2, 3, 4], 'a user can read their persisted ranked List in order');
await assert.rejects(() => getDoc(doc(bob.db, 'users', aliceUid, 'list', placeId)), /permission-denied/i, 'users cannot read another user’s List');
await assert.rejects(() => setDoc(doc(bob.db, 'users', aliceUid, 'list', placeId), { ...listEntry, rating: 1 }), /permission-denied/i, 'users cannot modify another user’s List');
await assert.rejects(() => getDoc(doc(alice.db, 'users', bobUid, 'list', placeId)), /permission-denied/i, 'users cannot read another user’s List in the reverse direction');

const friendshipDocumentId = [aliceUid, bobUid].sort().join('_');
const friendshipRef = doc(alice.db, 'friendships', friendshipDocumentId);
const pendingFriendship = {
  userIds: [aliceUid, bobUid].sort(),
  requesterId: aliceUid,
  recipientId: bobUid,
  status: 'pending',
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
};
await assert.rejects(() => setDoc(friendshipRef, { ...pendingFriendship, requesterId: bobUid, recipientId: aliceUid }), /permission-denied/i, 'a user cannot create a request on behalf of another user');
await assert.rejects(() => setDoc(doc(alice.db, 'friendships', `${aliceUid}_${aliceUid}`), { ...pendingFriendship, userIds: [aliceUid, aliceUid], requesterId: aliceUid, recipientId: aliceUid }), /permission-denied/i, 'users cannot send friend requests to themselves');
assert.equal((await getDoc(friendshipRef)).exists(), false, 'signed-in users can read an absent pair document before requesting');
await setDoc(friendshipRef, pendingFriendship);
assert.equal((await getDoc(doc(bob.db, 'friendships', friendshipDocumentId))).data().status, 'pending', 'the request recipient can read an incoming request');
assert.equal((await getDocs(query(collection(bob.db, 'friendships'), where('userIds', 'array-contains', bobUid)))).size, 1, 'a user can query only friendship documents involving their UID');
await assert.rejects(() => setDoc(friendshipRef, pendingFriendship), /permission-denied/i, 'duplicate pending friend requests are rejected');
await assert.rejects(() => updateDoc(doc(alice.db, 'friendships', friendshipDocumentId), { status: 'accepted', updatedAt: serverTimestamp() }), /permission-denied/i, 'the sender cannot accept their own request');
await updateDoc(doc(bob.db, 'friendships', friendshipDocumentId), { status: 'accepted', updatedAt: serverTimestamp() });
assert.equal((await getDoc(doc(bob.db, 'users', aliceUid, 'list', placeId))).data().rank, 1, 'accepted friends can read each other’s personal Lists');
assert.equal((await getDocs(query(collection(bob.db, 'users', aliceUid, 'list'), orderBy('rank', 'asc')))).size, 4, 'friends can query the complete ordered personal List');
assert.equal((await getDoc(doc(alice.db, 'users', bobUid, 'list', placeId))).data().rating, 4.25, 'friend List visibility works in both directions');
await runTransaction(alice.db, async transaction => {
  const profile = await transaction.get(aliceProfile);
  const publicProfileRef = doc(alice.db, 'usernames', profile.data().usernameNormalized);
  await transaction.get(publicProfileRef);
  const update = { displayName: 'Alice Updated', avatarUrl: 'https://images.example.test/alice-updated.jpg', updatedAt: serverTimestamp() };
  transaction.update(aliceProfile, update);
  transaction.update(publicProfileRef, update);
});
const updatedPublicProfile = (await getDoc(doc(bob.db, 'usernames', 'alice_eats'))).data();
assert.equal(updatedPublicProfile.displayName, 'Alice Updated', 'friends see the latest display name from the live profile index');
assert.equal(updatedPublicProfile.avatarUrl, 'https://images.example.test/alice-updated.jpg', 'friends see the latest avatar from the live profile index');
const aliceReviewAfterProfileEdit = await getDoc(doc(bob.db, 'reviews', `${aliceUid}_${placeId}`));
const reviewAuthorProfiles = await getDocs(query(collection(bob.db, 'usernames'), where('uid', '==', aliceReviewAfterProfileEdit.data().userId)));
assert.equal(reviewAuthorProfiles.docs[0].data().displayName, 'Alice Updated', 'existing reviews resolve the author’s updated display name without changing review ownership');
assert.equal(reviewAuthorProfiles.docs[0].data().avatarUrl, 'https://images.example.test/alice-updated.jpg', 'existing reviews resolve the author’s updated avatar without changing review ownership');
assert.equal(aliceReviewAfterProfileEdit.data().userId, aliceUid, 'profile edits preserve the review owner UID');
const avatarBytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
const aliceAvatar = ref(alice.storage, `users/${aliceUid}/profile/test.png`);
await uploadBytes(aliceAvatar, avatarBytes, { contentType: 'image/png' });
assert.deepEqual([...new Uint8Array(await getBytes(ref(bob.storage, `users/${aliceUid}/profile/test.png`)))], [...avatarBytes], 'authenticated friends can load profile pictures');
await assert.rejects(
  () => uploadBytes(ref(bob.storage, `users/${aliceUid}/profile/forbidden.png`), avatarBytes, { contentType: 'image/png' }),
  /storage\/unauthorized|unauthorized/i,
  'users cannot upload profile pictures to another user’s Storage path',
);
await assert.rejects(
  () => uploadBytes(ref(alice.storage, `users/${aliceUid}/profile/too-large.png`), new Uint8Array(5 * 1024 * 1024 + 1), { contentType: 'image/png' }),
  /storage\/unauthorized|unauthorized/i,
  'profile picture uploads larger than 5 MB are rejected by Storage rules',
);
await assert.rejects(() => deleteObject(ref(bob.storage, `users/${aliceUid}/profile/test.png`)), /storage\/unauthorized|unauthorized/i, 'users cannot delete another user’s profile pictures');
await deleteObject(aliceAvatar);
await assert.rejects(() => setDoc(friendshipRef, pendingFriendship), /permission-denied/i, 'an accepted friendship cannot be duplicated or reset to pending');
await assert.rejects(() => updateDoc(doc(bob.db, 'users', aliceUid, 'list', placeId), { rating: 1 }), /permission-denied/i, 'friends cannot edit another user’s List');
await deleteDoc(doc(bob.db, 'friendships', friendshipDocumentId));
await assert.rejects(() => getDoc(doc(bob.db, 'users', aliceUid, 'list', placeId)), /permission-denied/i, 'removing a friend revokes access to their List');
await setDoc(friendshipRef, pendingFriendship);
await updateDoc(doc(bob.db, 'friendships', friendshipDocumentId), { status: 'declined', updatedAt: serverTimestamp() });
assert.equal((await getDoc(friendshipRef)).data().status, 'declined', 'the request recipient can decline a request');
await updateDoc(friendshipRef, { requesterId: aliceUid, recipientId: bobUid, status: 'pending', createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
await deleteDoc(friendshipRef);
assert.equal((await getDoc(doc(bob.db, 'friendships', friendshipDocumentId))).exists(), false, 'the sender can cancel an outgoing request');
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
await ensureUserProfile(aliceReload.db, aliceReturning.user, 'alice_eats');
assert.equal((await getDoc(doc(aliceReload.db, 'users', aliceUid))).data().createdAt.toMillis(), aliceCreatedAt, 'returning sign-in keeps profile creation time');
assert.equal((await getDocs(query(collection(aliceReload.db, 'reviews'), where('userId', '==', aliceUid)))).size, 1, 'review data remains after a client reinitialization and is limited to one per place');
assert.equal((await getDocs(query(collection(aliceReload.db, 'users', aliceUid, 'list'), orderBy('rank', 'asc')))).size, 4, 'the ranked List remains persisted after a client reinitialization');

console.log('Firebase verification passed: two users, live profile data in friends and reviews, atomic username reservations, owner-only 5 MB image uploads, friendship lifecycle, List visibility, and review ownership.');
await Promise.all([alice.app, bob.app, aliceReload.app].map(app => deleteApp(app)));

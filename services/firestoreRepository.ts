import { collection, deleteField, doc, endAt, getDoc, getDocs, getDocsFromServer, limit, onSnapshot, orderBy, query, runTransaction, serverTimestamp, startAt, where } from 'firebase/firestore';
import { createBatchedReads } from './batchedReads';
import type { PersonalListEntry, Place, Review, User } from '../types/models';
import { firestore } from './firebase';
import { firebaseAuth } from './auth';
import type { CreateReview, FoodRepository, Friendship, UpdateReview, UserProfileInput } from './repositories';
import { rankListEntries, reviewRankingCandidate } from '../features/myList';
import { normalizeRating, normalizeStoredRating } from '../features/ratings';

const db = () => { if (!firestore) throw new Error('Firebase is not configured.'); return firestore; };
const asDate = (value: any): Date | undefined => value?.toDate ? value.toDate() : value instanceof Date ? value : undefined;
const placeDocumentId = (googlePlaceId: string) => `pl_${googlePlaceId}`;
function fromPlace(id: string, raw: any): Place { return { id, googlePlaceId: raw.googlePlaceId, name: '', address: '', latitude: undefined, longitude: undefined, category: 'Food & drink', area: '', image: '', price: '$$', description: '', averageRating: 0, reviewCount: 0, createdAt: asDate(raw.createdAt), updatedAt: asDate(raw.updatedAt) }; }
function fromReview(id: string, raw: any): Review { const createdAt=asDate(raw.createdAt);return { id, placeId:raw.placeId, userId:raw.userId, rating:normalizeStoredRating(raw.rating,raw.ratingScale,5), subRatings:raw.subRatings, photo:raw.photo, text:raw.text, date:createdAt?.toLocaleDateString('en-AU',{day:'numeric',month:'short',year:'numeric'})??'Recently', createdAt, updatedAt:asDate(raw.updatedAt) }; }
function toUser(id: string, profile: any): User { const name=profile.displayName||'List member';const username=profile.username||'';return {id,name,handle:username||name.toLowerCase().replace(/\s+/g,''),username,usernameNormalized:profile.usernameNormalized,initials:name.split(/\s+/).map((part:string)=>part[0]).join('').slice(0,2).toUpperCase(),color:'#8CA79A',avatarUrl:profile.avatarUrl,createdAt:asDate(profile.createdAt),updatedAt:asDate(profile.updatedAt)}; }
function friendshipId(userA:string,userB:string):string { return [userA,userB].sort().join('_'); }
function fromFriendship(id:string,raw:any):Friendship { return {id,userIds:raw.userIds,requesterId:raw.requesterId,recipientId:raw.recipientId,status:raw.status,createdAt:asDate(raw.createdAt),updatedAt:asDate(raw.updatedAt)}; }
const placesCollection = () => collection(db(), 'places');
const reviewsCollection = () => collection(db(), 'reviews');
const friendshipsCollection = () => collection(db(), 'friendships');
const usernameReservation = (username:string) => doc(db(),'usernames',username);
const userListCollection = (userId: string) => collection(db(), 'users', userId, 'list');
const userListLock = (userId: string) => doc(db(), 'users', userId, 'listMeta', 'state');
function fromListEntry(raw: any): PersonalListEntry { return { placeId:raw.placeId, rank:raw.rank, rating:normalizeStoredRating(raw.rating,raw.ratingScale,10), updatedAt:asDate(raw.updatedAt)??new Date(0) }; }
function projectReviews(reviews: Review[]) { return rankListEntries(reviews.map(reviewRankingCandidate)); }
function persistListProjection(transaction: any, userId: string, listSnapshot: any, reviews: Review[], changedPlace?: { placeId: string; updatedAt: any }) {
 const ranked=projectReviews(reviews);const retained=new Set(ranked.map(entry=>entry.placeId));
 for(const entry of ranked)transaction.set(doc(db(),'users',userId,'list',entry.placeId),{...entry,ratingScale:5,updatedAt:entry.placeId===changedPlace?.placeId?changedPlace.updatedAt:entry.updatedAt});
 for(const row of listSnapshot.docs)if(!retained.has(row.id))transaction.delete(row.ref);
}
function reviewQueryForUser(userId: string) { return query(reviewsCollection(),where('userId','==',userId)); }
async function readProjectionInputs(transaction: any, userId: string) {
 const lockRef=userListLock(userId);const lockSnapshot=await transaction.get(lockRef);
 // The Web SDK transaction API reads documents, not queries. Query while holding
 // the revision document, then transaction-read every result so concurrent
 // repository mutations conflict and retry with a fresh query result.
 const [reviewSnapshot,listSnapshot]=await Promise.all([getDocs(reviewQueryForUser(userId)),getDocs(userListCollection(userId))]);
 const [reviewDocs,listDocs]=await Promise.all([Promise.all(reviewSnapshot.docs.map((row:any)=>transaction.get(row.ref))),Promise.all(listSnapshot.docs.map((row:any)=>transaction.get(row.ref)))]);
 return {lockRef,lockSnapshot,reviewSnapshot:{docs:reviewDocs.filter((row:any)=>row.exists())},listSnapshot:{docs:listDocs.filter((row:any)=>row.exists())}};
}
function advanceListRevision(transaction: any, inputs: any) {
 transaction.set(inputs.lockRef,{revision:(inputs.lockSnapshot.data()?.revision??0)+1,initialized:true,updatedAt:serverTimestamp()});
}

export const firestoreRepository: FoodRepository = {
 async getPlacesByIds(ids) {
  return (await createBatchedReads(db()).places(ids)).map(row => fromPlace(row.id, row.data()));
 },
 async getUsers(ids) {
  const rows = await createBatchedReads(db()).profiles(ids);
  const profiles = new Map<string, User>();
  for (const row of rows) {
   const profile = toUser(row.data().uid, row.data());
   const prior = profiles.get(profile.id);
   if (!prior || (profile.updatedAt?.getTime() ?? 0) > (prior.updatedAt?.getTime() ?? 0)) profiles.set(profile.id, profile);
  }
  return [...new Set(ids)].map(id => profiles.get(id) ?? toUser(id, { displayName: 'List member' }));
 },
 async getReviewsByUsers(ids) { return (await createBatchedReads(db()).reviewsByUsers(ids)).map(row => fromReview(row.id, row.data())); },
 watchFriendships(userId,onChange,onError) { return onSnapshot(query(friendshipsCollection(),where('userIds','array-contains',userId)),snapshot=>onChange(snapshot.docs.map(row=>fromFriendship(row.id,row.data()))),onError); },
 async getRecentReviewsByUsers(ids) {
  return (await createBatchedReads(db()).recentFriendReviews(ids)).map(row => fromReview(row.id, row.data()));
 },
 async listPlaces() { const snapshot=await getDocs(placesCollection());return snapshot.docs.map(row=>fromPlace(row.id,row.data())); },
 async getPlace(id) { const snapshot=await getDoc(doc(db(),'places',id));return snapshot.exists()?fromPlace(snapshot.id,snapshot.data()):null; },
 async savePlace(place) {
  if (!place.googlePlaceId || place.googlePlaceId.startsWith('mock:')) throw new Error('A real Google Place ID is required to save this place.');
  const id=placeDocumentId(place.googlePlaceId);const reference=doc(db(),'places',id);
  await runTransaction(db(),async transaction=>{const prior=await transaction.get(reference);const now=serverTimestamp();if(prior.exists())transaction.update(reference,{updatedAt:now});else transaction.set(reference,{googlePlaceId:place.googlePlaceId,createdAt:now,updatedAt:now});});
  return {...place,id};
 },
 async getReviewsForPlace(placeId) { const snapshot=await getDocs(query(reviewsCollection(),where('placeId','==',placeId)));return snapshot.docs.map(row=>fromReview(row.id,row.data())); },
 async getRecentReviews() { const snapshot=await getDocs(reviewsCollection());return snapshot.docs.map(row=>fromReview(row.id,row.data())); },
 async getMyList(userId) {
  if(firebaseAuth?.currentUser?.uid!==userId) {
   const snapshot=await getDocs(query(userListCollection(userId),orderBy('rank','asc')));
   if(snapshot.size)return snapshot.docs.map(row=>fromListEntry(row.data()));
   const reviews=await getDocs(reviewQueryForUser(userId));
   return projectReviews(reviews.docs.map(row=>fromReview(row.id,row.data())));
  }
  const lock=await getDoc(userListLock(userId));
  if(!lock.exists()||lock.data().initialized!==true)await this.rebuildMyListFromReviews(userId);
  const snapshot=await getDocs(query(userListCollection(userId),orderBy('rank','asc')));
  return snapshot.docs.map(row=>fromListEntry(row.data()));
 },
 async rebuildMyListFromReviews(userId) { await runTransaction(db(),async transaction=>{const inputs=await readProjectionInputs(transaction,userId);const reviews=inputs.reviewSnapshot.docs.map((row:any)=>fromReview(row.id,row.data()));persistListProjection(transaction,userId,inputs.listSnapshot,reviews);advanceListRevision(transaction,inputs);}); },
 async createReview(input:CreateReview) {
  const currentUser=firebaseAuth?.currentUser;if(!currentUser)throw new Error('Sign in before sharing a review.');
  const userId=currentUser.uid;const reference=doc(db(),'reviews',`${userId}_${input.placeId}`);let created!:Review;
  await runTransaction(db(),async transaction=>{
   const inputs=await readProjectionInputs(transaction,userId);const [prior,placeSnapshot]=await Promise.all([transaction.get(reference),transaction.get(doc(db(),'places',input.placeId))]);
   if(prior.exists()||inputs.reviewSnapshot.docs.some((row:any)=>row.data().placeId===input.placeId))throw new Error('You have already left a review for this place.');
   if(!placeSnapshot.exists())throw new Error('This place is not saved yet. Reopen it from search and try again.');
   const rating=normalizeRating(input.rating);const now=serverTimestamp();const nowDate=new Date();created={id:reference.id,placeId:input.placeId,userId,rating,...(input.subRatings?{subRatings:input.subRatings}:{}),text:input.text,...(input.photo?{photo:input.photo}:{}),date:'Just now',createdAt:nowDate,updatedAt:nowDate};
   transaction.set(reference,{placeId:input.placeId,userId,rating,ratingScale:5,...(input.subRatings?{subRatings:input.subRatings}:{}),text:input.text,...(input.photo?{photo:input.photo}:{}),createdAt:now,updatedAt:now});
   const reviews=inputs.reviewSnapshot.docs.map((row:any)=>fromReview(row.id,row.data()));persistListProjection(transaction,userId,inputs.listSnapshot,[...reviews,created],{placeId:input.placeId,updatedAt:now});advanceListRevision(transaction,inputs);
  });
  return created;
 },
 async updateReview(reviewId:string,input:UpdateReview) {
  const currentUser=firebaseAuth?.currentUser;if(!currentUser)throw new Error('Sign in before updating a review.');const userId=currentUser.uid;const reference=doc(db(),'reviews',reviewId);let updated!:Review;
  await runTransaction(db(),async transaction=>{
   const inputs=await readProjectionInputs(transaction,userId);const prior=await transaction.get(reference);
   if(!prior.exists()||prior.data().userId!==userId)throw new Error('This review could not be found.');
   const before=fromReview(prior.id,prior.data());const now=serverTimestamp();const nowDate=new Date();
   const rating=normalizeRating(input.rating);updated={...before,rating,text:input.text,...(input.photo!==undefined?{photo:input.photo??undefined}:{}),...(input.subRatings!==undefined?{subRatings:input.subRatings}:{}),date:nowDate.toLocaleDateString('en-AU',{day:'numeric',month:'short',year:'numeric'}),updatedAt:nowDate};
   transaction.update(reference,{rating,ratingScale:5,text:input.text,...(input.photo!==undefined?{photo:input.photo??deleteField()}:{}),...(input.subRatings!==undefined?{subRatings:input.subRatings}:{}),updatedAt:now});
   const reviews=inputs.reviewSnapshot.docs.map((row:any)=>row.id===reviewId?updated:fromReview(row.id,row.data()));persistListProjection(transaction,userId,inputs.listSnapshot,reviews,{placeId:before.placeId,updatedAt:now});advanceListRevision(transaction,inputs);
  });
  return updated;
 },
 async deleteReview(reviewId:string,userId:string) {
  const currentUser=firebaseAuth?.currentUser;if(!currentUser||currentUser.uid!==userId)throw new Error('You can only delete your own reviews.');const reference=doc(db(),'reviews',reviewId);
  await runTransaction(db(),async transaction=>{
   const inputs=await readProjectionInputs(transaction,userId);const prior=await transaction.get(reference);
   if(!prior.exists()||prior.data().userId!==userId)throw new Error('This review could not be found.');
   transaction.delete(reference);const reviews=inputs.reviewSnapshot.docs.filter((row:any)=>row.id!==reviewId).map((row:any)=>fromReview(row.id,row.data()));persistListProjection(transaction,userId,inputs.listSnapshot,reviews);advanceListRevision(transaction,inputs);
  });
 },
 async getReviewsByUser(userId) { const snapshot=await getDocs(query(reviewsCollection(),where('userId','==',userId)));return snapshot.docs.map(row=>fromReview(row.id,row.data())); },
 async getUser(userId) {
  const snapshot=await getDocs(query(collection(db(),'usernames'),where('uid','==',userId)));
  const profiles=snapshot.docs.map(row=>row.data()).sort((left,right)=>
   (asDate(right.updatedAt)?.getTime()??asDate(right.createdAt)?.getTime()??0)
    -(asDate(left.updatedAt)?.getTime()??asDate(left.createdAt)?.getTime()??0));
  return profiles.length?toUser(userId,profiles[0]):toUser(userId,{displayName:'List member'});
 },
 async ensureUserProfile(profile:UserProfileInput) {
  const reference=doc(db(),'users',profile.userId);
  await runTransaction(db(),async transaction=>{
   const prior=await transaction.get(reference);
   const username=profile.username?.trim().toLowerCase()||prior.data()?.usernameNormalized||`member_${profile.userId.slice(-8).toLowerCase()}`;
   const reservation=usernameReservation(username);
   const claimed=await transaction.get(reservation);
   if(claimed.exists()&&claimed.data().uid!==profile.userId)throw new Error('That username is already taken. Choose another username in Profile.');
   const priorUsername=prior.data()?.usernameNormalized;
   const previousReservation=priorUsername&&priorUsername!==username?await transaction.get(usernameReservation(priorUsername)):undefined;
   const now=serverTimestamp();
   const priorDisplayName=prior.data()?.displayName;
   const displayName=priorDisplayName&&priorDisplayName!=='List member'?priorDisplayName:profile.displayName.trim();
   const avatarUrl=prior.data()?.avatarUrl||profile.avatarUrl;
   const data={username,usernameNormalized:username,displayName,updatedAt:now,...(avatarUrl?{avatarUrl}:{})};
   const publicData={uid:profile.userId,...data};
   if(!claimed.exists())transaction.set(reservation,{...publicData,createdAt:now});
   else transaction.update(reservation,publicData);
   if(previousReservation?.exists()&&previousReservation.data().uid===profile.userId)transaction.delete(usernameReservation(priorUsername!));
   if(prior.exists())transaction.update(reference,{...data,email:deleteField()});
   else transaction.set(reference,{...data,createdAt:now});
  });
 },
 async saveUserProfile(userId,username,displayName,avatarUrl) {
  const normalized=username.trim().toLowerCase();
  const name=displayName.trim();
  if(!/^[a-z0-9][a-z0-9_]{2,19}$/.test(normalized))throw new Error('Usernames must be 3–20 characters using letters, numbers, or underscores.');
  if(!name||name.length>40)throw new Error('Display names must be between 1 and 40 characters.');
  const currentUser=firebaseAuth?.currentUser;
  if(!currentUser||currentUser.uid!==userId)throw new Error('Sign in before editing your profile.');
  const reference=doc(db(),'users',userId);
  await runTransaction(db(),async transaction=>{
   const [profile,reservation]=await Promise.all([transaction.get(reference),transaction.get(usernameReservation(normalized))]);
   if(!profile.exists())throw new Error('Your profile could not be found. Please sign in again.');
   if(reservation.exists()&&reservation.data().uid!==userId)throw new Error('That username is already taken.');
   const oldUsername=profile.data().usernameNormalized;
   const oldReservation=oldUsername&&oldUsername!==normalized?await transaction.get(usernameReservation(oldUsername)):undefined;
   const now=serverTimestamp();
   const resolvedAvatarUrl=avatarUrl===undefined?profile.data().avatarUrl:avatarUrl;
   const avatarData=resolvedAvatarUrl?{avatarUrl:resolvedAvatarUrl}:{};
   const data={uid:userId,username:normalized,usernameNormalized:normalized,displayName:name,updatedAt:now,...avatarData};
   if(reservation.exists())transaction.update(usernameReservation(normalized),{...data,...(!resolvedAvatarUrl?{avatarUrl:deleteField()}:{})});
   else transaction.set(usernameReservation(normalized),{...data,createdAt:now});
   if(oldReservation?.exists()&&oldReservation.data().uid===userId)transaction.delete(usernameReservation(oldUsername));
   transaction.update(reference,{username:normalized,usernameNormalized:normalized,displayName:name,updatedAt:now,...avatarData,...(!resolvedAvatarUrl?{avatarUrl:deleteField()}:{}),email:deleteField()});
  });
 },
 async searchUsers(usernamePrefix) {
  const prefix=usernamePrefix.trim().toLowerCase();
  if(!prefix)return [];
  const snapshot=await getDocs(query(collection(db(),'usernames'),orderBy('usernameNormalized'),startAt(prefix),endAt(`${prefix}\uf8ff`),limit(50)));
  const profilesByUser=new Map<string,any>();
  for(const row of snapshot.docs) {
   const profile=row.data();
   const prior=profilesByUser.get(profile.uid);
   const profileDate=asDate(profile.updatedAt)?.getTime()??asDate(profile.createdAt)?.getTime()??0;
   const priorDate=asDate(prior?.updatedAt)?.getTime()??asDate(prior?.createdAt)?.getTime()??0;
   if(!prior||profileDate>priorDate)profilesByUser.set(profile.uid,profile);
  }
  return [...profilesByUser.entries()].slice(0,20).map(([userId,profile])=>toUser(userId,profile));
 },
 async getFriendship(userId,otherUserId) {
  if(userId===otherUserId)return null;
  const snapshot=await getDoc(doc(db(),'friendships',friendshipId(userId,otherUserId)));
  return snapshot.exists()?fromFriendship(snapshot.id,snapshot.data()):null;
 },
 async listFriendships(userId,requireServer=false) {
  const request=query(friendshipsCollection(),where('userIds','array-contains',userId));
  const snapshot=await (requireServer?getDocsFromServer(request):getDocs(request));
  return snapshot.docs.map(row=>fromFriendship(row.id,row.data()));
 },
 async sendFriendRequest(userId,recipientId) {
  const currentUser=firebaseAuth?.currentUser;
  if(!currentUser||currentUser.uid!==userId)throw new Error('Sign in before adding a friend.');
  if(userId===recipientId)throw new Error('You cannot add yourself as a friend.');
  const reference=doc(db(),'friendships',friendshipId(userId,recipientId));
  await runTransaction(db(),async transaction=>{
   const prior=await transaction.get(reference);
   if(prior.exists()&&(prior.data().status==='pending'||prior.data().status==='accepted'))throw new Error('A request already exists or you are already friends.');
   const now=serverTimestamp();
   const data={userIds:[userId,recipientId].sort(),requesterId:userId,recipientId,status:'pending',createdAt:now,updatedAt:now};
   if(prior.exists())transaction.update(reference,data);
   else transaction.set(reference,data);
  });
 },
 async respondToFriendRequest(userId,friendshipDocumentId,response) {
  const currentUser=firebaseAuth?.currentUser;
  if(!currentUser||currentUser.uid!==userId)throw new Error('Sign in before changing a friend request.');
  const reference=doc(db(),'friendships',friendshipDocumentId);
  await runTransaction(db(),async transaction=>{
   const snapshot=await transaction.get(reference);
   if(!snapshot.exists()||snapshot.data().status!=='pending')throw new Error('This friend request is no longer available.');
   const request=snapshot.data();
   if(response==='accepted'||response==='declined') {
    if(request.recipientId!==userId)throw new Error('Only the recipient can respond to this request.');
    transaction.update(reference,{status:response,updatedAt:serverTimestamp()});
   } else {
    if(request.requesterId!==userId)throw new Error('Only the sender can cancel this request.');
    transaction.delete(reference);
   }
  });
 },
 async removeFriend(userId,friendshipDocumentId) {
  const currentUser=firebaseAuth?.currentUser;
  if(!currentUser||currentUser.uid!==userId)throw new Error('Sign in before removing a friend.');
  const reference=doc(db(),'friendships',friendshipDocumentId);
  await runTransaction(db(),async transaction=>{
   const snapshot=await transaction.get(reference);
   if(!snapshot.exists()||snapshot.data().status!=='accepted'||!snapshot.data().userIds.includes(userId))throw new Error('This friendship could not be found.');
   transaction.delete(reference);
  });
 },
};

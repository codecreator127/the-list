import { collection, doc, getDoc, getDocs, orderBy, query, runTransaction, serverTimestamp, where } from 'firebase/firestore';
import type { PersonalListEntry, Place, Review, User } from '../types/models';
import { firestore } from './firebase';
import { firebaseAuth } from './auth';
import type { CreateReview, FoodRepository, UpdateReview, UserProfileInput } from './repositories';
import { rankListEntries } from '../features/myList';
import { getWeightedReviewRating } from '../features/reviewScoring';

const db = () => { if (!firestore) throw new Error('Firebase is not configured.'); return firestore; };
const asDate = (value: any): Date | undefined => value?.toDate ? value.toDate() : value instanceof Date ? value : undefined;
const placeDocumentId = (googlePlaceId: string) => `pl_${googlePlaceId}`;
function fromPlace(id: string, raw: any): Place { return { id, googlePlaceId: raw.googlePlaceId, name: '', address: '', latitude: undefined, longitude: undefined, category: 'Food & drink', area: '', image: '', price: '$$', description: '', averageRating: 0, reviewCount: 0, createdAt: asDate(raw.createdAt), updatedAt: asDate(raw.updatedAt) }; }
function fromReview(id: string, raw: any): Review { const createdAt=asDate(raw.createdAt);return { id, placeId:raw.placeId, userId:raw.userId, rating:raw.ratingScale===10?raw.rating:raw.rating*2, subRatings:raw.subRatings, text:raw.text, date:createdAt?.toLocaleDateString('en-AU',{day:'numeric',month:'short',year:'numeric'})??'Recently', createdAt, updatedAt:asDate(raw.updatedAt) }; }
function toUser(id: string, profile: any): User { const name=profile.displayName||'List member';return {id,name,handle:name.toLowerCase().replace(/\s+/g,''),initials:name.split(/\s+/).map((part:string)=>part[0]).join('').slice(0,2).toUpperCase(),color:'#8CA79A',avatarUrl:profile.avatarUrl}; }
const placesCollection = () => collection(db(), 'places');
const reviewsCollection = () => collection(db(), 'reviews');
const userListCollection = (userId: string) => collection(db(), 'users', userId, 'list');
const userListLock = (userId: string) => doc(db(), 'users', userId, 'listMeta', 'state');
function fromListEntry(raw: any): PersonalListEntry { return { placeId:raw.placeId, rank:raw.rank, rating:raw.rating, updatedAt:asDate(raw.updatedAt)??new Date(0) }; }
function projectReviews(reviews: Review[]) { return rankListEntries(reviews.map(review=>({placeId:review.placeId,rating:review.rating,weightedRating:getWeightedReviewRating(review),updatedAt:review.updatedAt??review.createdAt,reviewId:review.id}))); }
function persistListProjection(transaction: any, userId: string, listSnapshot: any, reviews: Review[], changedPlace?: { placeId: string; updatedAt: any }) {
 const ranked=projectReviews(reviews);const retained=new Set(ranked.map(entry=>entry.placeId));
 for(const entry of ranked)transaction.set(doc(db(),'users',userId,'list',entry.placeId),{...entry,updatedAt:entry.placeId===changedPlace?.placeId?changedPlace.updatedAt:entry.updatedAt});
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
 async getMyList(userId) { const lock=await getDoc(userListLock(userId));if(!lock.exists()||lock.data().initialized!==true)await this.rebuildMyListFromReviews(userId);const snapshot=await getDocs(query(userListCollection(userId),orderBy('rank','asc')));return snapshot.docs.map(row=>fromListEntry(row.data())); },
 async rebuildMyListFromReviews(userId) { await runTransaction(db(),async transaction=>{const inputs=await readProjectionInputs(transaction,userId);const reviews=inputs.reviewSnapshot.docs.map((row:any)=>fromReview(row.id,row.data()));persistListProjection(transaction,userId,inputs.listSnapshot,reviews);advanceListRevision(transaction,inputs);}); },
 async createReview(input:CreateReview) {
  const currentUser=firebaseAuth?.currentUser;if(!currentUser)throw new Error('Sign in before sharing a review.');
  const userId=currentUser.uid;const reference=doc(db(),'reviews',`${userId}_${input.placeId}`);let created!:Review;
  await runTransaction(db(),async transaction=>{
   const inputs=await readProjectionInputs(transaction,userId);const [prior,placeSnapshot]=await Promise.all([transaction.get(reference),transaction.get(doc(db(),'places',input.placeId))]);
   if(prior.exists()||inputs.reviewSnapshot.docs.some((row:any)=>row.data().placeId===input.placeId))throw new Error('You have already left a review for this place.');
   if(!placeSnapshot.exists())throw new Error('This place is not saved yet. Reopen it from search and try again.');
   const now=serverTimestamp();const nowDate=new Date();created={id:reference.id,placeId:input.placeId,userId,rating:input.rating,...(input.subRatings?{subRatings:input.subRatings}:{}),text:input.text,date:'Just now',createdAt:nowDate,updatedAt:nowDate};
   transaction.set(reference,{placeId:input.placeId,userId,rating:input.rating,ratingScale:10,...(input.subRatings?{subRatings:input.subRatings}:{}),text:input.text,createdAt:now,updatedAt:now});
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
   updated={...before,rating:input.rating,text:input.text,...(input.subRatings!==undefined?{subRatings:input.subRatings}:{}),date:nowDate.toLocaleDateString('en-AU',{day:'numeric',month:'short',year:'numeric'}),updatedAt:nowDate};
   transaction.update(reference,{rating:input.rating,ratingScale:10,text:input.text,...(input.subRatings!==undefined?{subRatings:input.subRatings}:{}),updatedAt:now});
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
 async getUser(userId) { const snapshot=await getDoc(doc(db(),'users',userId));return snapshot.exists()?toUser(userId,snapshot.data()):toUser(userId,{displayName:'List member'}); },
 async ensureUserProfile(profile:UserProfileInput) {
  const reference=doc(db(),'users',profile.userId);
  await runTransaction(db(),async transaction=>{const prior=await transaction.get(reference);const data={displayName:profile.displayName,email:profile.email,updatedAt:serverTimestamp(),...(profile.avatarUrl?{avatarUrl:profile.avatarUrl}:{})};if(prior.exists())transaction.set(reference,data,{merge:true});else transaction.set(reference,{...data,createdAt:serverTimestamp()});});
 },
};

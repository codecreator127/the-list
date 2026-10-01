import { places, reviews as seedReviews, users } from '../data/mock';
import type { PersonalListEntry, Place, Review, User } from '../types/models';
import type { CreateReview, FoodRepository, UpdateReview } from './repositories';
import { applyPlaceScores } from './placeScoring';
import { rankListEntries } from '../features/myList';
import { getWeightedReviewRating } from '../features/reviewScoring';

function seedDate(label: string): Date {
 const match=label.match(/(\d+)\s+(day|week|month)/i);const amount=match?Number(match[1]):1;const unit=match?.[2]?.toLowerCase();const days=unit==='month'?amount*30:unit==='week'?amount*7:amount;return new Date(Date.now()-days*24*60*60*1000);
}
let liveReviews: Review[] = seedReviews.map(review=>({...review,rating:review.rating*2,createdAt:review.createdAt??seedDate(review.date)}));
let livePlaces = [...places];
const projectedLists = new Map<string, PersonalListEntry[]>();
function rebuildUserList(userId:string) { projectedLists.set(userId,rankListEntries(liveReviews.filter(review=>review.userId===userId).map(review=>({placeId:review.placeId,rating:review.rating,weightedRating:getWeightedReviewRating(review),updatedAt:review.updatedAt??review.createdAt,reviewId:review.id})))); }
rebuildUserList('u1');
const aggregate = (place: Place): Place => applyPlaceScores([place],liveReviews)[0];
export const mockRepository: FoodRepository & { getReviewsWithUsers(placeId?: string): Promise<(Review & {user:User})[]>; getReviewsByUserWithPlace(userId:string): Promise<(Review & {user:User;place:Place})[]> } = {
 async listPlaces() { return livePlaces.map(aggregate); },
 async getPlace(id) { const place = livePlaces.find(item=>item.id===id); return place ? aggregate(place) : null; },
 async savePlace(place) { const existing=livePlaces.findIndex(item=>item.id===place.id);if(existing<0)livePlaces=[place,...livePlaces];else livePlaces=livePlaces.map(item=>item.id===place.id?place:item);return place; },
 async getReviewsForPlace(placeId) { return liveReviews.filter(review=>review.placeId===placeId); },
 async getRecentReviews() { return liveReviews; },
 async getReviewsByUser(userId) { return liveReviews.filter(review=>review.userId===userId); },
 async getMyList(userId) { return [...(projectedLists.get(userId)??[])].sort((a,b)=>a.rank-b.rank); },
 async rebuildMyListFromReviews(userId) { rebuildUserList(userId); },
 async createReview(input:CreateReview) { if(liveReviews.some(review=>review.userId==='u1'&&review.placeId===input.placeId))throw new Error('You have already left a review for this place.');const now=new Date();const review:Review={...input,userId:'u1',id:`r${Date.now()}`,date:'Just now',createdAt:now,updatedAt:now};liveReviews=[review,...liveReviews];rebuildUserList('u1');return review; },
 async updateReview(reviewId:string,input:UpdateReview) { const prior=liveReviews.find(review=>review.id===reviewId&&review.userId==='u1');if(!prior)throw new Error('This review could not be found.');const updated:Review={...prior,rating:input.rating,text:input.text,...(input.subRatings!==undefined?{subRatings:input.subRatings}:{}),updatedAt:new Date()};liveReviews=liveReviews.map(review=>review.id===reviewId?updated:review);rebuildUserList('u1');return updated; },
 async deleteReview(reviewId:string,userId:string) { if(userId!=='u1')throw new Error('You can only delete your own reviews.');const existing=liveReviews.some(review=>review.id===reviewId&&review.userId===userId);if(!existing)throw new Error('This review could not be found.');liveReviews=liveReviews.filter(review=>review.id!==reviewId);rebuildUserList(userId); },
 async getUser(userId) { return users.find(user=>user.id===userId)??users[0]; },
 async ensureUserProfile() {},
 async getReviewsWithUsers(placeId) { return liveReviews.filter(review=>!placeId||review.placeId===placeId).map(review=>({...review,user:users.find(user=>user.id===review.userId)??users[0]})); },
 async getReviewsByUserWithPlace(userId) { return liveReviews.filter(review=>review.userId===userId).map(review=>({...review,user:users.find(row=>row.id===review.userId)??users[0],place:aggregate(livePlaces.find(place=>place.id===review.placeId)!)})).filter(review=>!!review.place); },
};

import { places, reviews as seedReviews, users } from '../data/mock';
import type { PersonalListEntry, Place, Review, User } from '../types/models';
import type { CreateReview, FoodRepository, Friendship, UpdateReview } from './repositories';
import { applyPlaceScores } from './placeScoring';
import { rankListEntries, reviewRankingCandidate } from '../features/myList';
import { normalizeRating } from '../features/ratings';

function seedDate(label: string): Date {
 const match=label.match(/(\d+)\s+(day|week|month)/i);const amount=match?Number(match[1]):1;const unit=match?.[2]?.toLowerCase();const days=unit==='month'?amount*30:unit==='week'?amount*7:amount;return new Date(Date.now()-days*24*60*60*1000);
}
let liveReviews: Review[] = seedReviews.map(review=>({...review,rating:normalizeRating(review.rating),createdAt:review.createdAt??seedDate(review.date)}));
let livePlaces = [...places];
let liveUsers = [...users];
const liveFriendships = new Map<string, Friendship>();
const projectedLists = new Map<string, PersonalListEntry[]>();
function friendshipId(userA:string,userB:string) { return [userA,userB].sort().join('_'); }
function rebuildUserList(userId:string) { projectedLists.set(userId,rankListEntries(liveReviews.filter(review=>review.userId===userId).map(reviewRankingCandidate))); }
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
 async createReview(input:CreateReview) { if(liveReviews.some(review=>review.userId==='u1'&&review.placeId===input.placeId))throw new Error('You have already left a review for this place.');const now=new Date();const review:Review={...input,rating:normalizeRating(input.rating),userId:'u1',id:`u1_${input.placeId}`,date:'Just now',createdAt:now,updatedAt:now};liveReviews=[review,...liveReviews];rebuildUserList('u1');return review; },
 async updateReview(reviewId:string,input:UpdateReview) { const prior=liveReviews.find(review=>review.id===reviewId&&review.userId==='u1');if(!prior)throw new Error('This review could not be found.');const updated:Review={...prior,rating:normalizeRating(input.rating),text:input.text,...(input.subRatings!==undefined?{subRatings:input.subRatings}:{}),updatedAt:new Date()};liveReviews=liveReviews.map(review=>review.id===reviewId?updated:review);rebuildUserList('u1');return updated; },
 async deleteReview(reviewId:string,userId:string) { if(userId!=='u1')throw new Error('You can only delete your own reviews.');const existing=liveReviews.some(review=>review.id===reviewId&&review.userId===userId);if(!existing)throw new Error('This review could not be found.');liveReviews=liveReviews.filter(review=>review.id!==reviewId);rebuildUserList(userId); },
 async getUser(userId) { return liveUsers.find(user=>user.id===userId)??users[0]; },
 async ensureUserProfile() {},
 async saveUserProfile(userId,username,displayName,avatarUrl) { const normalized=username.trim().toLowerCase();if(!/^[a-z0-9][a-z0-9_]{2,19}$/.test(normalized))throw new Error('Usernames must be 3–20 characters using letters, numbers, or underscores.');if(!displayName.trim()||displayName.trim().length>40)throw new Error('Display names must be between 1 and 40 characters.');if(liveUsers.some(user=>user.id!==userId&&user.handle.toLowerCase()===normalized))throw new Error('That username is already taken.');liveUsers=liveUsers.map(user=>user.id===userId?{...user,name:displayName.trim(),handle:normalized,username:normalized,usernameNormalized:normalized,...(avatarUrl===undefined?{}:avatarUrl?{avatarUrl}:{avatarUrl:undefined})}:user); },
 async searchUsers(usernamePrefix) { const prefix=usernamePrefix.trim().toLowerCase();return prefix?liveUsers.filter(user=>(user.usernameNormalized??user.handle.toLowerCase()).startsWith(prefix)):[]; },
 async getFriendship(userId,otherUserId) { return userId===otherUserId?null:liveFriendships.get(friendshipId(userId,otherUserId))??null; },
 async listFriendships(userId) { return [...liveFriendships.values()].filter(friendship=>friendship.userIds.includes(userId)); },
 async sendFriendRequest(userId,recipientId) { if(userId===recipientId)throw new Error('You cannot add yourself as a friend.');if(!liveUsers.some(user=>user.id===recipientId))throw new Error('This user could not be found.');const id=friendshipId(userId,recipientId);const prior=liveFriendships.get(id);if(prior?.status==='pending'||prior?.status==='accepted')throw new Error('A request already exists or you are already friends.');const now=new Date();liveFriendships.set(id,{id,userIds:[userId,recipientId].sort() as [string,string],requesterId:userId,recipientId,status:'pending',createdAt:now,updatedAt:now}); },
 async respondToFriendRequest(userId,friendshipDocumentId,response) { const prior=liveFriendships.get(friendshipDocumentId);if(!prior||prior.status!=='pending')throw new Error('This friend request is no longer available.');if(response==='cancelled'){if(prior.requesterId!==userId)throw new Error('Only the sender can cancel this request.');liveFriendships.delete(friendshipDocumentId);return;}if(prior.recipientId!==userId)throw new Error('Only the recipient can respond to this request.');liveFriendships.set(friendshipDocumentId,{...prior,status:response,updatedAt:new Date()}); },
 async removeFriend(userId,friendshipDocumentId) { const prior=liveFriendships.get(friendshipDocumentId);if(!prior||prior.status!=='accepted'||!prior.userIds.includes(userId))throw new Error('This friendship could not be found.');liveFriendships.delete(friendshipDocumentId); },
 async getReviewsWithUsers(placeId) { return liveReviews.filter(review=>!placeId||review.placeId===placeId).map(review=>({...review,user:liveUsers.find(user=>user.id===review.userId)??liveUsers[0]})); },
 async getReviewsByUserWithPlace(userId) { return liveReviews.filter(review=>review.userId===userId).map(review=>({...review,user:liveUsers.find(row=>row.id===review.userId)??liveUsers[0],place:aggregate(livePlaces.find(place=>place.id===review.placeId)!)})).filter(review=>!!review.place); },
};

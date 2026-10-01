import type { Place, PlaceSearchResult, Review, User } from '../types/models';
import { firestoreRepository } from './firestoreRepository';
import { hasGooglePlacesConfig, googlePlaces } from './googlePlaces';
import { isFirebaseRepositoryEnabled } from './firebase';
import { mockRepository } from './mockRepository';
import type { FoodRepository } from './repositories';
import { firebaseAuth } from './auth';
import { applyPlaceScores, calculatePlaceScores } from './placeScoring';
import type { RankedPlace } from '../features/myList';

const repository: FoodRepository = isFirebaseRepositoryEnabled ? firestoreRepository : mockRepository;
const sortReviews = (rows:Review[]) => rows.sort((a,b)=>(b.createdAt?.getTime()??0)-(a.createdAt?.getTime()??0));
function mockSearchResult(place:Place):PlaceSearchResult{return {googlePlaceId:place.googlePlaceId??`mock:${place.id}`,mockPlaceId:place.id,name:place.name,address:place.address,category:place.category,cuisine:place.cuisine,area:place.area,photoUrl:place.image,latitude:place.latitude,longitude:place.longitude,listAverageRating:place.reviewCount?place.averageRating:undefined,listReviewCount:place.reviewCount,latestReviewAt:place.latestReviewAt};}
function placeFromGoogle(result:PlaceSearchResult):Place{return {id:`pl_${result.googlePlaceId}`,googlePlaceId:result.googlePlaceId,name:result.name,address:result.address,latitude:result.latitude,longitude:result.longitude,googleRating:result.googleRating,photoAttributions:result.photoAttributions,category:result.category,cuisine:result.cuisine,area:result.area,image:result.photoUrl??'',price:'',description:'',averageRating:0,reviewCount:0};}
async function refreshPlace(stored:Place):Promise<Place>{if(stored.googlePlaceId&&hasGooglePlacesConfig&&!stored.googlePlaceId.startsWith('mock:')){const detail=await googlePlaces.getDetails(stored.googlePlaceId);return {...placeFromGoogle(detail),id:stored.id,createdAt:stored.createdAt,updatedAt:stored.updatedAt};}return stored;}
async function withAggregate(place:Place):Promise<Place>{return applyPlaceScores([place],await repository.getReviewsForPlace(place.id))[0];}

export const foodService = {
 async getPlaces(query=''):Promise<Place[]>{
  const q=query.trim().toLowerCase();
  const all=(await repository.listPlaces()).filter(place=>!isFirebaseRepositoryEnabled||!place.googlePlaceId?.startsWith('mock:'));
  const refreshed=await Promise.all(all.map(refreshPlace));
  const filtered=refreshed.filter(place=>!q||`${place.name} ${place.cuisine??''} ${place.category} ${place.area} ${place.address}`.toLowerCase().includes(q));
  return applyPlaceScores(filtered,await repository.getRecentReviews());
 },
 async searchPlaces(query:string,origin:{latitude:number;longitude:number},radiusMeters=15000):Promise<PlaceSearchResult[]>{
  let results:PlaceSearchResult[];
  if(hasGooglePlacesConfig) results=await googlePlaces.search(query,origin,radiusMeters);
  else if(isFirebaseRepositoryEnabled) throw new Error('Google Places is not configured. Add a Places API key to search live venues.');
  else results=(await mockRepository.listPlaces()).filter(place=>!query.trim()||`${place.name} ${place.cuisine??''} ${place.category} ${place.area} ${place.address}`.toLowerCase().includes(query.trim().toLowerCase())).map(mockSearchResult);

  const [savedPlaces,reviews]=await Promise.all([repository.listPlaces(),repository.getRecentReviews()]);
  const scores=calculatePlaceScores(savedPlaces,reviews);
  const savedByGoogleId=new Map(savedPlaces.filter(place=>place.googlePlaceId).map(place=>[place.googlePlaceId!,place]));
  return results.map(result=>{
   const saved=result.mockPlaceId?savedPlaces.find(place=>place.id===result.mockPlaceId):savedByGoogleId.get(result.googlePlaceId);
   const score=saved?scores.get(saved.id):undefined;
   return {...result,cuisine:result.cuisine??saved?.cuisine,listAverageRating:score?.reviewCount?score.averageRating:undefined,listReviewCount:score?.reviewCount??0,latestReviewAt:score?.latestReviewAt};
  });
 },
 async resolveSearchResult(result:PlaceSearchResult):Promise<Place>{if(result.mockPlaceId){const mockPlace=await mockRepository.getPlace(result.mockPlaceId);if(repository===mockRepository)return mockPlace!;throw new Error('Sample places are available only in local mock mode.');}const place=placeFromGoogle(result);return repository.savePlace(place);},
 async getPlace(id:string):Promise<Place|undefined>{const stored=await repository.getPlace(id);if(!stored||isFirebaseRepositoryEnabled&&stored.googlePlaceId?.startsWith('mock:'))return undefined;const place=await refreshPlace(stored);return withAggregate(place);},
 async getReviews(placeId?:string):Promise<(Review&{user:User})[]>{const rows=placeId?await repository.getReviewsForPlace(placeId):await repository.getRecentReviews();const ordered=sortReviews(rows);return Promise.all(ordered.map(async review=>({...review,user:await repository.getUser(review.userId)})));},
 async addReview(placeId:string,rating:number,text:string,subRatings?:Review['subRatings']):Promise<void>{if(isFirebaseRepositoryEnabled&&!firebaseAuth?.currentUser)throw new Error('Sign in to share your review.');const categories=Object.fromEntries(Object.entries(subRatings??{}).filter((entry):entry is [string,number]=>typeof entry[1]==='number'));await repository.createReview({placeId,rating,text,...(Object.keys(categories).length?{subRatings:categories as Review['subRatings']}:{})});},
 async getMyReview(placeId:string):Promise<Review|undefined>{const userId=isFirebaseRepositoryEnabled?firebaseAuth?.currentUser?.uid:'u1';if(!userId)return undefined;const rows=(await repository.getReviewsByUser(userId)).filter(review=>review.placeId===placeId);return rows.sort((a,b)=>(b.updatedAt?.getTime()??b.createdAt?.getTime()??0)-(a.updatedAt?.getTime()??a.createdAt?.getTime()??0))[0];},
 async getUser(id:string):Promise<User>{return repository.getUser(id);},
 async getCurrentUserReviews():Promise<(Review&{user:User;place:Place})[]>{const userId=isFirebaseRepositoryEnabled?firebaseAuth?.currentUser?.uid:'u1';if(!userId)return [];const rows=await repository.getReviewsByUser(userId);const ordered=sortReviews(rows);const joined=await Promise.all(ordered.map(async review=>{const place=await this.getPlace(review.placeId);return place?{...review,user:await repository.getUser(review.userId),place}:undefined;}));return joined.filter((review):review is Review&{user:User;place:Place}=>!!review);},
 async getMyList():Promise<RankedPlace[]>{const userId=isFirebaseRepositoryEnabled?firebaseAuth?.currentUser?.uid:'u1';if(!userId)return [];const entries=await repository.getMyList(userId);const joined=await Promise.all(entries.map(async entry=>{const stored=await repository.getPlace(entry.placeId);if(!stored||isFirebaseRepositoryEnabled&&stored.googlePlaceId?.startsWith('mock:'))return undefined;const place=await refreshPlace(stored);return {...entry,place};}));return joined.filter((entry):entry is RankedPlace=>!!entry);},
 async rebuildMyListFromReviews():Promise<void>{const userId=isFirebaseRepositoryEnabled?firebaseAuth?.currentUser?.uid:'u1';if(!userId)throw new Error('Sign in before rebuilding your List.');await repository.rebuildMyListFromReviews(userId);},
 async updateReview(placeId:string,rating:number,text:string,subRatings?:Review['subRatings']):Promise<void>{const existing=await this.getMyReview(placeId);if(!existing)throw new Error('You have not reviewed this place yet.');const categories=Object.fromEntries(Object.entries(subRatings??{}).filter((entry):entry is [string,number]=>typeof entry[1]==='number'));await repository.updateReview(existing.id,{rating,text,...(subRatings!==undefined?{subRatings:categories as Review['subRatings']}: {})});},
 async deleteReview(placeId:string):Promise<void>{const userId=isFirebaseRepositoryEnabled?firebaseAuth?.currentUser?.uid:'u1';if(!userId)throw new Error('Sign in before deleting a review.');const existing=await this.getMyReview(placeId);if(!existing)throw new Error('You have not reviewed this place yet.');await repository.deleteReview(existing.id,userId);},
 async ensureCurrentUserProfile():Promise<void>{const user=firebaseAuth?.currentUser;if(!user)throw new Error('Sign in before saving your profile.');await repository.ensureUserProfile({userId:user.uid,displayName:user.displayName??user.email?.split('@')[0]??'List member',email:user.email??'',avatarUrl:user.photoURL});},
};

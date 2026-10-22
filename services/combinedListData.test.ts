import test from 'node:test';
import assert from 'node:assert/strict';
import { createCombinedListData } from './combinedListData';
import { createPersonalizedData } from './personalizedData';
import type { Place, Review, User } from '../types/models';
import type { FoodRepository, Friendship } from './repositories';

const user=(id:string):User=>({id,name:id,handle:id,initials:id[0],color:'#888'});
const place=(id:string):Place=>({id,name:`Restaurant ${id}`,category:'Cafe',area:'Sydney',address:'',image:'',price:'',description:'',averageRating:0,reviewCount:0});
const review=(id:string,userId:string,placeId:string,rating=4):Review=>({id,userId,placeId,rating,text:'',date:'',updatedAt:new Date(1)});
const accepted:Friendship={id:'me_friend',userIds:['me','friend'],requesterId:'me',recipientId:'friend',status:'accepted'};
function fixture(count=125) {
  let friendships=[accepted];
  const places=Array.from({length:count},(_,i)=>place(`p${i}`));
  const reviews=[...places.map(p=>review(`me_${p.id}`,'me',p.id)),review('friend_p0','friend','p0',5)];
  const calls={reviews:[] as string[][],places:[] as string[][],profiles:[] as string[][],hydrate:[] as string[]};
  const repository={
    async listFriendships(){return friendships;},
    async getUsers(ids:string[]){calls.profiles.push(ids);return ids.map(user);},
    async getReviewsByUsers(ids:string[]){calls.reviews.push(ids);return reviews.filter(r=>ids.includes(r.userId));},
    async getPlacesByIds(ids:string[]){calls.places.push(ids);return places.filter(p=>ids.includes(p.id));},
  };
  const hydrate=async(p:Place)=>{calls.hydrate.push(p.id);return p;};
  return {repository,hydrate,calls,places,reviews,revoke:()=>{friendships=[];}};
}

test('uses full histories and batched joins, reusing cached users and restaurants across selections',async()=>{
  const f=fixture(); const data=createCombinedListData(f.repository,f.hydrate,'me');
  assert.deepEqual((await data.participants()).map(p=>p.id),['me','friend']);
  assert.equal((await data.load(['me'])).items.length,125,'must not use Home’s 60-review cap');
  const combined=await data.load(['me','friend']);
  assert.equal(combined.items[0].placeId,'p0');assert.equal(combined.items[0].rating,4.5);
  await data.load(['friend']);await data.load(['me','friend']);
  assert.deepEqual(f.calls.reviews,[['me'],['friend']]);
  assert.equal(f.calls.places.length,1);assert.equal(f.calls.hydrate.length,125);assert.equal(f.calls.profiles.length,1);
});

test('rejects nonfriends before reading reviews and revalidates cached and in-flight selections after removal',async()=>{
  const f=fixture(2); const data=createCombinedListData(f.repository,f.hydrate,'me');
  await assert.rejects(data.load(['stranger']),/accepted friends/);assert.equal(f.calls.reviews.length,0);
  await data.load(['me','friend']);f.revoke();
  await assert.rejects(data.load(['friend']),/accepted friends/);
  assert.equal((await data.load(['me'])).items.length,2);
  const g=fixture(2);
  const read=g.repository.getReviewsByUsers;
  g.repository.getReviewsByUsers=async ids=>{const rows=await read(ids);g.revoke();return rows;};
  await assert.rejects(createCombinedListData(g.repository,g.hydrate,'me').load(['friend']),/accepted friends/);
});

test('concurrent selections share pending review reads; missing/failed metadata is handled without losing other places',async()=>{
  const f=fixture(2);
  const data=createCombinedListData(f.repository,async p=>{if(p.id==='p1')throw Error('Places unavailable');return f.hydrate(p);},'me');
  const [a,b]=await Promise.all([data.load(['me']),data.load(['me','friend'])]);
  assert.equal(f.calls.reviews.filter(ids=>ids.includes('me')).length,1);
  assert.equal(a.items.length,2);assert.equal(b.items.length,2);
  f.reviews.push(review('missing','friend','missing-place'));
  const missing=await createCombinedListData(f.repository,f.hydrate,'me').load(['friend']);
  assert.equal(missing.unavailablePlaces,1);assert.equal(missing.items.length,1);
  assert.deepEqual(await data.load([]),{items:[],unavailablePlaces:0});
});

test('restaurant detail contributors are limited to the validated selection and share public profile joins',async()=>{
  const f=fixture(1);
  f.reviews.push(review('stranger','stranger','p0',0));
  const repository={...f.repository,
    async getPlace(){return f.places[0];},async getReviewsForPlace(){return f.reviews;},
  } as unknown as FoodRepository;
  const data=createPersonalizedData(repository,f.hydrate);
  const detail=await data.restaurant('p0','me',['friend','me']);
  assert.equal(detail.combined?.average,4.5);
  assert.deepEqual(detail.combined?.contributions.map(row=>row.user.id),['friend','me']);
  assert.equal(f.calls.profiles.length,1);
  await assert.rejects(data.restaurant('p0','me',['stranger']),/accepted friends/);
  f.revoke();await assert.rejects(data.restaurant('p0','me',['friend']),/accepted friends/);
});
test('new combined calculations require server verification and fail closed offline',async()=>{
  const f=fixture(1);const requests:boolean[]=[];
  f.repository.listFriendships=async (_id?:string,requireServer?:boolean)=>{requests.push(!!requireServer);return [accepted];};
  await createCombinedListData(f.repository,f.hydrate,'me').load(['me','friend']);
  assert.deepEqual(requests,[true,true]);
  f.repository.listFriendships=async()=>{throw Error('Server unavailable');};
  await assert.rejects(createCombinedListData(f.repository,f.hydrate,'me').load(['friend']),/Server unavailable/);
});

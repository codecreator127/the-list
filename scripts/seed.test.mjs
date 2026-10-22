import test from 'node:test';
import assert from 'node:assert/strict';
import { makePlan, digest, roster, assertUnprotected } from './seed-plan.mjs';
import { options } from './seed.mjs';
import { getListPlacementPreview, rankListCandidates, reviewRankingCandidate } from '../features/myList.ts';
import { filterPersonalList } from '../features/listFilters.ts';
import { createPersonalizedData } from '../services/personalizedData.ts';

// In-memory identifiers ONLY; never sent to Firebase or described as genuine Places data.
const ids=Array.from({length:150},(_,i)=>`unit_fixture_${String(i).padStart(4,'0')}`);
const anchor='2026-10-19T00:00:00.000Z';
const plan=makePlan('v1seed',ids,anchor);
test('deterministic inputs, paths, usernames and review pairs',()=>{
  assert.equal(digest(plan),digest(makePlan('v1seed',[...ids].reverse(),anchor)));
  assert.equal(new Set(plan.documents.map(d=>d.path)).size,plan.documents.length);
  assert.equal(new Set(plan.accounts.map(a=>a.username)).size,30);
  assert.equal(new Set(plan.accounts.map(a=>a.email)).size,30);
  for(const a of plan.accounts)assert.match(a.username,/^[a-z0-9][a-z0-9_]{2,19}$/);
});
test('target sizes and realistic edge cases at both venue bounds',()=>{
  for(const count of [100,150]) {
    const p=makePlan('v1seed',ids.slice(0,count),anchor);
    assert.ok(p.reviews.length>=1000 && p.reviews.length<=2000);
    assert.equal(new Set(p.documents.map(d=>d.path)).size,p.documents.length);
    assert.equal(p.reviews.filter(r=>r.userId===p.accounts[28].uid).length,0);
    assert.equal(p.reviews.filter(r=>r.userId===p.accounts[2].uid).length,1);
    assert.equal(p.reviews.filter(r=>r.placeId===p.places.at(-1).id).length,1);
    assert.ok(p.reviews.filter(r=>r.placeId===p.places[0].id).length>10);
    assert.ok(p.reviews.some(r=>r.rating===0));assert.ok(p.reviews.some(r=>r.rating===5));
    assert.ok(p.reviews.some(r=>r.rating===4.25));assert.ok(p.reviews.some(r=>r.rating===4.26));
    assert.ok(p.reviews.every(r=>Math.abs(r.rating*100-Math.round(r.rating*100))<1e-8));
    assert.ok(p.reviews.some(r=>r.createdAt.getTime()===new Date(anchor).getTime()));
    assert.ok(p.reviews.some(r=>r.createdAt<new Date('2025-10-19')));
  }
});
test('friendships have canonical unique IDs and seed-only participants',()=>{
  const uids=new Set(plan.accounts.map(a=>a.uid));
  assert.ok(plan.friendships.some(f=>f.status==='pending'));
  assert.ok(plan.friendships.some(f=>f.status==='accepted'));
  for(const f of plan.friendships) {
    assert.notEqual(f.requesterId,f.recipientId);
    assert.deepEqual(f.userIds,[f.requesterId,f.recipientId].sort());
    assert.ok(f.userIds.every(uid=>uids.has(uid)));
    assert.ok(!f.userIds.includes(plan.accounts[27].uid));
  }
});
test('materialized rankings, equal score ties and preview edit/delete agree',()=>{
  const own=plan.reviews.filter(r=>r.userId===plan.accounts[0].uid);
  const ranked=rankListCandidates(own.map(reviewRankingCandidate));
  assert.equal(ranked.length,150);
  const tied=own.slice(2,4).map(reviewRankingCandidate);
  assert.equal(tied[0].rating,tied[1].rating);
  assert.equal(tied[0].updatedAt.getTime(),tied[1].updatedAt.getTime());
  assert.deepEqual(rankListCandidates(tied).map(r=>r.placeId),tied.map(r=>r.placeId).sort((a,b)=>a.localeCompare(b,'en')));
  for(const proposed of [reviewRankingCandidate(own[10]),{...reviewRankingCandidate(own[10]),rating:4.99,weightedRating:4.99,updatedAt:new Date(anchor)}]) {
    const input=own.map(reviewRankingCandidate);
    const preview=getListPlacementPreview(input,proposed);
    const saved=rankListCandidates([...input.filter(r=>r.placeId!==proposed.placeId),proposed]);
    assert.equal(preview.rank,saved.find(r=>r.placeId===proposed.placeId).rank);
    assert.equal(rankListCandidates(saved.filter(r=>r.placeId!==proposed.placeId)).length,149);
  }
  const items=ranked.map(row=>({...row,place:{name:'Sample meal',cuisine:'Japanese',area:'Sydney'}}));
  const filtered=filterPersonalList(items,{search:'meal',cuisine:'Japanese',area:'Sydney',minimumRating:4});
  assert.ok(filtered.length);assert.ok(filtered.every(r=>r.rank===ranked.find(x=>x.placeId===r.placeId).rank));
});
test('Home and restaurant joins expose accepted friends, averages and empty users',async()=>{
  const repository={
    async getPlace(id){return {id,name:'In-memory restaurant'};},
    async getPlacesByIds(ids){return ids.map(id=>({id,name:'In-memory restaurant'}));},
    async getUsers(ids){return ids.map(id=>({id,name:'Seed diner'}));},
    async getReviewsForPlace(id){return plan.reviews.filter(r=>r.placeId===id);},
    async getReviewsByUser(id){return plan.reviews.filter(r=>r.userId===id);},
    async getRecentReviewsByUsers(ids){return plan.reviews.filter(r=>ids.includes(r.userId));},
    async listFriendships(id){return plan.friendships.filter(f=>f.userIds.includes(id));},
  };
  const loader=createPersonalizedData(repository,async p=>p);
  const home=await loader.home(plan.accounts[0].uid);
  assert.ok(home.friendCount>0);assert.ok(home.activity.length>0);
  const detail=await loader.restaurant(plan.places[0].id,plan.accounts[0].uid);
  assert.ok(detail.friendReviews.length);
  assert.equal(detail.friendAverage,detail.friendReviews.reduce((s,r)=>s+r.rating,0)/detail.friendReviews.length);
  const empty=await loader.home(plan.accounts[29].uid);
  assert.equal(empty.friendCount,0);assert.equal(empty.activity.length,0);assert.equal(empty.recent.length,0);
});
test('protected UID checks cover nested references, paths and email',()=>{
  for(const [path,data] of [['users/protected/list/a',{}],['friendships/a',{userIds:['a','protected']}],['reviews/a',{nested:{owner:'protected'}}],['users/a',{email:'TEST@gmail.com'}]]) assert.throws(()=>assertUnprotected(path,data,'protected'));
  for(const d of plan.documents) assertUnprotected(d.path,d.data,'protected');
});
test('fails closed on missing/mixed/remote emulators and accidental real writes',()=>{
  assert.throws(()=>options(['seed'],{}));
  const local={FIREBASE_AUTH_EMULATOR_HOST:'127.0.0.1:32199',FIRESTORE_EMULATOR_HOST:'localhost:32180'};
  assert.equal(options(['dry-run'],local).projectId,'demo-the-list');
  assert.throws(()=>options(['seed','--project-id','live-project'],local));
  assert.throws(()=>options(['seed'],{...local,FIRESTORE_EMULATOR_HOST:'remote:8080'}));
  assert.throws(()=>options(['seed','--real','--project-id','live-project'],{}));
  const real={SEED_FIREBASE_PROJECT_ID:'live-project'};
  assert.throws(()=>options(['seed','--real','--project-id','live-project','--confirm-project','live-project'],real));
  assert.equal(options(['dry-run','--real','--project-id','live-project'],real).real,true);
  assert.throws(()=>options(['seed','--unknown'],local));
  assert.throws(()=>roster('../oops'));
  assert.throws(()=>makePlan('v1seed',ids.slice(0,99),anchor));
  assert.throws(()=>makePlan('v1seed',['mock:123',...ids],anchor));
});

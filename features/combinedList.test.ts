import test from 'node:test';
import assert from 'node:assert/strict';
import { combineReviews, parseCombinedParticipants, validateParticipants } from './combinedList';
import { filterPersonalList, listCuisines, personalListOptions } from './listFilters';
import type { Place, Review } from '../types/models';
import type { Friendship } from '../services/repositories';

const place=(id:string, cuisine?:string, area='Sydney'):Place=>({id,name:`Restaurant ${id}`,category:'Restaurant',cuisine,area,address:'',image:'',price:'',description:'',averageRating:0,reviewCount:0});
const review=(id:string,userId:string,placeId:string,rating:number,time=1):Review=>({id,userId,placeId,rating,text:'',date:'',updatedAt:new Date(time)});
const friendship=(id:string,status:Friendship['status']='accepted'):Friendship=>({id,userIds:['me',id],requesterId:'me',recipientId:id,status});

test('arithmetic means use selected users only, canonical place IDs and one latest review per person',()=>{
  const reviews=[review('old','me','a',1),review('new','me','a',5,2),review('f-a','f','a',4),review('f-b','f','b',0),review('outsider','other','a',0),review('solo','me','c',3)];
  const places=[place('a'),place('b'),place('c')]; places[1].name=places[0].name;
  const before=JSON.stringify(reviews);
  const rows=combineReviews(reviews,['me','f','me'],places);
  assert.deepEqual(rows.map(row=>[row.placeId,row.average,row.reviewerCount,row.rank]),[['a',4.5,2,1],['c',3,1,2],['b',0,1,3]]);
  assert.deepEqual(rows[0].contributions.map(row=>row.rating),[4,5]);
  assert.deepEqual(combineReviews(reviews,['f'],places).map(row=>[row.placeId,row.rating]),[['a',4],['b',0]]);
  assert.deepEqual(combineReviews(reviews,[],places),[]);
  assert.equal(JSON.stringify(reviews),before);
});

test('sort uses unrounded means first, then reviewer count, then stable place ID',()=>{
  const rows:Review[]=[];
  for(const [id,ratings] of Object.entries({a:[4.5,4.51,4.5],b:[4.5,4.5,4.5,4.51],c:[4.5,4.5],d:[4.5],e:[4.5]}))ratings.forEach((rating,i)=>rows.push(review(`${id}-${i}`,`u${i}`,id,rating)));
  const ranked=combineReviews(rows,['u0','u1','u2','u3'],['e','d','c','b','a'].map(id=>place(id)));
  assert.deepEqual(ranked.map(row=>row.placeId),['a','b','c','d','e']);
  assert.ok(ranked.every(row=>row.rating===4.5));
  assert.deepEqual(combineReviews([...rows].reverse(),['u3','u2','u1','u0'],['a','b','c','d','e'].map(id=>place(id))),ranked);
});

test('multi-cuisine filters compose with search, area and rating, preserving global ranks and references',()=>{
  const places=[place('a','Japanese','Newtown'),place('b','Italian','Newtown'),place('c','Japanese / Korean','Newtown'),place('d',undefined,'Newtown'),place('e','Italian','Sydney')];
  const combined=combineReviews(places.map((p,i)=>review(p.id,'me',p.id,5-i*0.25)),['me'],places);
  const personal=combined.map(({placeId,place,rank,rating,updatedAt})=>({placeId,place,rank,rating,updatedAt}));
  for(const items of [combined,personal]) {
    const before=JSON.stringify(items);
    const filtered=filterPersonalList(items,{search:'Restaurant',cuisines:['Japanese','Korean'],area:'newtown',minimumRating:4.5});
    assert.deepEqual(filtered.map(row=>row.rank),[1,3]);
    assert.equal(filtered[1],items[2]);
    assert.equal(JSON.stringify(items),before);
    assert.deepEqual(filterPersonalList(items,{search:'',cuisines:[],area:'',minimumRating:0}),items);
    assert.deepEqual(filterPersonalList(items,{search:'',cuisines:['Other / unspecified'],area:'',minimumRating:0}).map(row=>row.rank),[4]);
  }
  assert.deepEqual(listCuisines({...place('x'),cuisine:' ',category:''}),['Other / unspecified']);
  assert.deepEqual(listCuisines(place('x','Japanese / Korean')),['Japanese','Korean']);
  assert.deepEqual(personalListOptions(combined).cuisines,['Italian','Japanese','Korean','Other / unspecified']);
});

test('selection accepts self and accepted friends, rejecting pending, unrelated and forged IDs',()=>{
  const friendships=[friendship('f'),friendship('pending','pending'),{...friendship('elsewhere'),userIds:['a','b'] as [string,string]}];
  assert.deepEqual(validateParticipants('me',['f','me','f'],friendships),['f','me']);
  assert.deepEqual(validateParticipants('me',['f'],friendships),['f']);
  for(const id of ['pending','a','stranger'])assert.throws(()=>validateParticipants('me',[id],friendships),/accepted friends/);
  assert.deepEqual(parseCombinedParticipants('["me","f","me"]'),['me','f']);
  for(const value of ['not json','{"user":"me"}','[null]'])assert.throws(()=>parseCombinedParticipants(value),/invalid/);
});

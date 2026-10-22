import { createHash } from 'node:crypto';
import { rankListEntries, reviewRankingCandidate } from '../features/myList.ts';

export const VERSION = 1;
export function canonical(value) {
  if (value instanceof Date) return value.toISOString();
  if (value?.toDate) return value.toDate().toISOString();
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  return value;
}
export const digest = value => createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
export const invariant = (condition, message) => { if (!condition) throw new Error(message); };
export function roster(namespace) {
  invariant(/^[a-z][a-z0-9]{2,7}$/.test(namespace), 'Namespace must be 3–8 lowercase alphanumeric characters, starting with a letter.');
  const names = ['Amelia Chen','Oliver Patel','Isla Nguyen','Noah Wilson','Mia Thompson','Leo Williams','Ava Kim','Henry Taylor','Sofia Garcia','Lucas Martin','Chloe Ahmed','Jack Brown','Grace Lee','Ethan Singh','Lily Wong','Oscar Davis','Zoe Anderson','Charlie Scott','Ella Robinson','Thomas Clark','Ruby Walker','William Hall','Aria Lewis','James Young','Evie King','Hugo Wright','Matilda Green','Archie Baker','Freya Adams','Luca Rossi'];
  return names.map((displayName, i) => ({uid: `seed_${namespace}_${String(i).padStart(2,'0')}`, email: `list.seed.${namespace}.${i}@example.test`, username: `${namespace}_${displayName.split(' ')[0].toLowerCase()}${i}`, displayName}));
}
export function makePlan(namespace, googleIds, anchor) {
  const accounts = roster(namespace);
  const ids = [...new Set(googleIds)].sort().slice(0,150);
  invariant(ids.length >= 100, `Need at least 100 eligible real Google Place IDs; found ${ids.length}. Supply --places-file with IDs exported from Google Places. No IDs will be fabricated.`);
  invariant(ids.every(id => typeof id === 'string' && /^[A-Za-z0-9_-]{10,}$/.test(id) && !/^(mock|emulator|v1_|seed)/i.test(id)), 'Invalid or synthetic Place ID in input.');
  const date = new Date(anchor);
  invariant(Number.isFinite(date.getTime()), 'Invalid anchor date.');
  const documents = [];
  const add = (path, data) => documents.push({path, data});
  const places = ids.map(googlePlaceId => ({id:`pl_${googlePlaceId}`, googlePlaceId}));
  for (const p of places) add(`places/${p.id}`, {googlePlaceId:p.googlePlaceId, createdAt:date, updatedAt:date});
  const reviews = [];
  const counts = accounts.map((_,i) => i === 0 ? places.length : i === 1 ? 110 : i === 2 ? 1 : i >= 28 ? 0 : 52);
  for (const [i,account] of accounts.entries()) {
    const profile = {username:account.username, usernameNormalized:account.username, displayName:account.displayName, createdAt:date, updatedAt:date};
    add(`users/${account.uid}`, profile);
    add(`usernames/${account.username}`, {uid:account.uid,...profile});
    const own = [];
    for (let j=0; j<Math.min(counts[i],places.length-(i===0?0:1)); j++) {
      // Last venue belongs only to the highly active user. Every other venue is covered.
      const p = places[i === 0 ? j : j===0 ? 0 : 1 + (j-1+i*7) % (places.length-2)];
      const cents = j===0 ? (i===0?0:400+i%70) : j===1 ? 500 : j===2 || j===3 ? 425 : j===4 ? 426 : 180 + ((i*73+j*47)%321);
      const createdAt = new Date(date.getTime() - ((j===2 || j===3 ? 5 : (i*13+j*11)%540) * 86400000));
      const rating = cents/100;
      const text = rating>=4 ? `A lovely meal with thoughtful service. I would come back for another relaxed dinner.` : rating>=3 ? `Enjoyed the meal overall. The flavours worked well, though service was a little slow.` : `A mixed visit. The food and atmosphere did not quite meet my expectations this time.`;
      const review = {id:`${account.uid}_${p.id}`,userId:account.uid,placeId:p.id,rating,ratingScale:5,text,createdAt,updatedAt:createdAt,
        ...(j>4 && j%3===0 ? {subRatings:{food:Math.max(1,Math.round(rating*2)),service:6,atmosphere:8,value:7}} : {})};
      own.push(review); reviews.push(review);
      const {id,...data} = review; add(`reviews/${id}`,data);
    }
    for (const row of rankListEntries(own.map(reviewRankingCandidate))) add(`users/${account.uid}/list/${row.placeId}`,{...row,ratingScale:5});
    add(`users/${account.uid}/listMeta/state`,{revision:1,initialized:true,updatedAt:date});
  }
  const friendships=[];
  for (let i=0;i<27;i++) for(let j=i+1;j<27;j++) {
    if ((i+j)%7!==0 && j!==i+1) continue;
    const userIds=[accounts[i].uid,accounts[j].uid].sort();
    const data={userIds,requesterId:accounts[i].uid,recipientId:accounts[j].uid,status:(i+j)%4===0?'pending':'accepted',createdAt:date,updatedAt:date};
    friendships.push(data); add(`friendships/${userIds.join('_')}`,data);
  }
  invariant(reviews.length>=1000 && reviews.length<=2000,'Review count outside target.');
  return {accounts,places,reviews,friendships,documents,summary:{users:30,restaurants:places.length,reviews:reviews.length,listEntries:reviews.length,friendships:friendships.filter(f=>f.status==='accepted').length,pendingRequests:friendships.filter(f=>f.status==='pending').length,largestList:places.length,zeroReviewUsers:2,isolatedUsers:3}};
}

export function assertUnprotected(path, data, protectedUid) {
  invariant(!path.split('/').includes(protectedUid), `Protected UID in path: ${path}`);
  function visit(value) {
    if (typeof value==='string') invariant(value!==protectedUid && value.toLowerCase()!=='test@gmail.com','Protected user reference detected.');
    else if(Array.isArray(value)) value.forEach(visit);
    else if(value && typeof value==='object' && !(value instanceof Date) && !value.toDate) Object.values(value).forEach(visit);
  }
  visit(data);
}

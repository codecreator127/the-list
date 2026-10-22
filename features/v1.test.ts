import assert from 'node:assert/strict';
import test from 'node:test';
import { acceptedFriendIds, friendsAtPlace, latestReviews, selectHomeReviews } from './personalization';
import { filterPersonalList, personalListOptions } from './listFilters';
import { queryBatches } from '../services/queryBatches';
import { createPersonalizedData } from '../services/personalizedData';
import { mockRepository } from '../services/mockRepository';
import type { Review, Place, User } from '../types/models';
import type { Friendship, FoodRepository } from '../services/repositories';
import type { RankedPlace } from './myList';

const user = (id: string): User => ({id, name: id, handle: id, initials: id, color: '#888'});
const place = (id: string): Place => ({id, name: `Restaurant ${id}`, category: 'Cafe', cuisine: 'Cafe', area: 'Sydney', address: '', image: '', price: '', description: '', averageRating: 0, reviewCount: 0});
const review = (id: string, userId: string, placeId: string, rating = 4, time = 1): Review => ({id, userId, placeId, rating, text: 'Good food', date: 'Today', createdAt: new Date(time), updatedAt: new Date(time)});
const friendship = (id: string, status: Friendship['status'] = 'accepted'): Friendship => ({id, userIds: ['me', id], requesterId: 'me', recipientId: id, status});

test('only accepted mutual friendships enter personalized sections; self and unrelated requests are excluded', () => {
  assert.deepEqual(acceptedFriendIds('me', [friendship('friend'), friendship('pending', 'pending'), friendship('declined', 'declined'), {...friendship('stranger'), userIds: ['other', 'stranger']}, friendship('friend')]), ['friend']);
});
test('friend averages exclude self/nonfriends and use only the latest rating per friend', () => {
  const result = friendsAtPlace([review('old', 'a', 'p', 1), review('new', 'a', 'p', 4.75, 2), review('b', 'b', 'p', 4.5), review('me', 'me', 'p', 5), review('stranger', 'c', 'p', 0)], ['a', 'b']);
  assert.equal(result.reviews.length, 2);
  assert.equal(result.average?.toFixed(2), '4.63');
  assert.equal(friendsAtPlace([], ['a']).average, undefined);
});
test('Home prioritizes unseen strong venues, deduplicates friends and orders recent edits deterministically', () => {
  const own = [review('own', 'me', 'seen', 5)];
  const friends = [review('a', 'a', 'seen', 5), review('b', 'b', 'unseen', 4.25), review('c', 'c', 'weak', 3.99), review('d', 'b', 'unseen', 4.5, 2)];
  assert.deepEqual(selectHomeReviews(own, friends).highlyRated.map(row => row.placeId), ['unseen', 'seen']);
  assert.equal(latestReviews(friends)[0].rating, 4.5);
  assert.deepEqual(selectHomeReviews([], []), {recent: [], activity: [], highlyRated: []});
});
test('combined filters preserve references, global ranks and ranking order on a 500-place List', () => {
  const items: RankedPlace[] = Array.from({length: 500}, (_, i) => ({placeId: String(i), rank: i + 1, rating: i % 2 ? 4.75 : 3, updatedAt: new Date(0), place: {...place(String(i)), cuisine: i % 2 ? 'Japanese' : 'Cafe', area: i % 3 ? 'Newtown' : 'Sydney'}}));
  const before = JSON.stringify(items);
  const rows = filterPersonalList(items, {search: ' RESTAURANT 1 ', cuisine: 'japanese', area: 'newtown', minimumRating: 4.5});
  assert.ok(rows.length > 0);
  assert.ok(rows.every(row => row.place.name.includes('1') && row.place.cuisine === 'Japanese' && row.place.area === 'Newtown' && row.rating >= 4.5));
  assert.equal(rows[0], items[1]);
  assert.equal(rows[0].rank, 2);
  assert.deepEqual(rows.map(row => row.rank), rows.map(row => row.rank).sort((a,b) => a-b));
  assert.equal(JSON.stringify(items), before);
  assert.deepEqual(filterPersonalList(items, {search: '', cuisine: '', area: '', minimumRating: 0}), items);
  assert.equal(filterPersonalList(items, {search: 'missing', cuisine: '', area: '', minimumRating: 0}).length, 0);
  assert.deepEqual(personalListOptions(items), {cuisines: ['Cafe', 'Japanese'], areas: ['Newtown', 'Sydney']});
});
test('query batches handle empty, duplicate, and more than 30 IDs without exceeding Firestore limits', () => {
  assert.deepEqual(queryBatches([]), []);
  const ids = Array.from({length: 125}, (_, i) => String(i));
  const batches = queryBatches([...ids, '1']);
  assert.deepEqual(batches.map(row => row.length), [30,30,30,30,5]);
  assert.deepEqual(batches.flat(), ids);
});

function fixture() {
  const calls = {profiles: 0, places: 0, reviews: 0, refreshed: [] as string[]};
  const reviews = [review('own', 'me', 'shared'), review('friend', 'friend', 'shared', 4.75), review('other', 'stranger', 'shared', 1), review('new', 'friend', 'new', 4.5, 2)];
  const repository: FoodRepository = {...mockRepository,
    async getReviewsByUser(id) { return reviews.filter(row => row.userId === id); },
    async getReviewsForPlace(id) { calls.reviews++; return reviews.filter(row => row.placeId === id); },
    async listFriendships() { return [friendship('friend'), friendship('stranger', 'pending')]; },
    async getRecentReviewsByUsers(ids) { return reviews.filter(row => ids.includes(row.userId)); },
    async getUsers(ids) { calls.profiles++; return [...new Set(ids)].map(user); },
    async getPlace(id) { return place(id); },
    async getPlacesByIds(ids) { calls.places++; return ids.map(place); },
    async getUser() { throw new Error('Unexpected per-review profile query'); },
  };
  const loader = createPersonalizedData(repository, async row => {calls.refreshed.push(row.id); return row;});
  return {loader, calls, repository};
}
test('restaurant loading shares one review query and batches profiles across all authors', async () => {
  const {loader, calls} = fixture();
  const result = await loader.restaurant('shared', 'me');
  assert.equal(result.reviews.length, 3);
  assert.deepEqual(result.friendReviews.map(row => row.userId), ['friend']);
  assert.equal(result.friendAverage, 4.75);
  assert.equal(result.myReview?.userId, 'me');
  assert.equal(calls.profiles, 1);
  assert.equal(calls.reviews, 1);
});
test('Home batches visible place and profile joins once and never hydrates the same place twice', async () => {
  const {loader, calls} = fixture();
  const result = await loader.home('me');
  assert.equal(result.friendCount, 1);
  assert.equal(result.recent.length, 1);
  assert.equal(result.activity.length, 2);
  assert.equal(result.highlyRated[0].place.id, 'new');
  assert.equal(calls.profiles, 1);
  assert.equal(calls.places, 1);
  assert.deepEqual(calls.refreshed.sort(), ['new', 'shared']);
});
test('new users skip friend queries, and unavailable Google details do not erase all Home content', async () => {
  const {repository} = fixture();
  const empty: FoodRepository = {...repository, async getReviewsByUser() { return []; }, async listFriendships() { return []; }, async getRecentReviewsByUsers() { throw new Error('Must skip empty friend queries'); }};
  const home = await createPersonalizedData(empty, async row => row).home('new');
  assert.equal(home.friendCount, 0);
  assert.deepEqual(home.activity, []);
  const partial = await createPersonalizedData(repository, async row => {if(row.id === 'new') throw new Error('Places unavailable'); return row;}).home('me');
  assert.equal(partial.unavailablePlaces, 1);
  assert.equal(partial.recent.length, 1);
});

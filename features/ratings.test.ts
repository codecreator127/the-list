import assert from 'node:assert/strict';
import test from 'node:test';
import type { ListRankingCandidate } from './myList';
import { getListPlacementPreview, rankListEntries, reviewRankingCandidate } from './myList';
import { normalizeRating, normalizeStoredRating, ratingCents, ratingFromSliderProgress } from './ratings';
import { getWeightedReviewRating } from './reviewScoring';
import { mockRepository } from '../services/mockRepository';

const date = (seconds: number) => new Date(seconds * 1000);
const entry = (placeId: string, rating: number, updatedAt: Date, weightedRating = rating): ListRankingCandidate => ({
  placeId, rating, weightedRating, updatedAt, reviewId: `user_${placeId}`,
});

test('normalizes numeric ratings and legacy review scales to two decimals', () => {
  assert.equal(normalizeRating(4), 4);
  assert.equal(normalizeRating(4.5), 4.5);
  assert.equal(normalizeRating(4.735), 4.74);
  assert.equal(normalizeStoredRating(8, 10), 4);
  assert.equal(normalizeStoredRating(4.5, undefined, 5), 4.5);
  assert.throws(() => normalizeRating(5.01), RangeError);
});

test('maps slider movement to each hundredth and clamps both ends', () => {
  assert.equal(ratingFromSliderProgress(0), 0);
  assert.equal(ratingFromSliderProgress(0.946), 4.73);
  assert.equal(ratingFromSliderProgress(-1), 0);
  assert.equal(ratingFromSliderProgress(2), 5);
});

test('normalizes weighted scores after converting 10-point category details', () => {
  const weighted = getWeightedReviewRating({
    id: 'review', placeId: 'place', userId: 'user', rating: 4.73, subRatings: { food: 9, service: 8 }, text: '', date: '',
  });
  assert.ok(Math.abs(weighted - 4.682) < 0.000001);
});

test('preserves weighted-score precision below hundredths when ranking', () => {
  const lower = entry('lower', 4.5, date(1), 4.733);
  const higher = entry('higher', 4.5, date(1), 4.734);
  assert.equal(ratingCents(lower.weightedRating!), ratingCents(higher.weightedRating!));
  assert.deepEqual(rankListEntries([lower, higher]).map(row => row.placeId), ['higher', 'lower']);
});

test('preview matches saved ranking and excludes the existing place when editing', () => {
  const rows = [
    entry('place-a', 4.81, date(1)),
    entry('place-b', 4.65, date(2)),
    entry('place-c', 4.2, date(3)),
  ];
  const preview = getListPlacementPreview(rows, entry('place-b', 4.73, date(4)));
  assert.deepEqual({ rank: preview.rank, total: preview.total }, { rank: 2, total: 3 });
  assert.equal(preview.above?.placeId, 'place-a');
  assert.equal(preview.below?.placeId, 'place-c');
  assert.deepEqual(rankListEntries([...rows.filter(row => row.placeId !== 'place-b'), entry('place-b', 4.73, date(4))]).map(row => row.placeId), ['place-a', 'place-b', 'place-c']);
});

test('preview handles empty Lists and first and last place positions', () => {
  const empty = getListPlacementPreview([], entry('new', 0, date(1)));
  assert.deepEqual({ rank: empty.rank, total: empty.total, above: empty.above, below: empty.below }, { rank: 1, total: 1, above: undefined, below: undefined });

  const rows = [entry('middle', 3, date(1))];
  const first = getListPlacementPreview(rows, entry('top', 5, date(2)));
  assert.equal(first.rank, 1);
  assert.equal(first.below?.placeId, 'middle');
  const last = getListPlacementPreview(rows, entry('bottom', 0, date(2)));
  assert.equal(last.rank, 2);
  assert.equal(last.above?.placeId, 'middle');
  assert.equal(last.below, undefined);
});

test('equal ratings use update time and then place ID as deterministic tie-breakers', () => {
  const rows = [entry('z-place', 4.5, date(1)), entry('a-place', 4.5, date(1))];
  assert.deepEqual(rankListEntries(rows).map(row => row.placeId), ['a-place', 'z-place']);
  assert.deepEqual(rankListEntries([entry('older', 4.5, date(1)), entry('newer', 4.5, date(2))]).map(row => row.placeId), ['newer', 'older']);
});

test('preview handles more than one hundred ranked entries without changing rank rules', () => {
  const rows = Array.from({ length: 125 }, (_, index) => entry(`place-${String(index).padStart(3, '0')}`, 5 - index / 100, date(index)));
  const preview = getListPlacementPreview(rows, entry('new-place', 4.73, date(200)));
  assert.equal(preview.total, 126);
  assert.equal(preview.rank, 28);
  assert.equal(preview.above?.placeId, 'place-026');
  assert.equal(preview.below?.placeId, 'place-027');
});

test('every slider step matches the save projection in a large List, including weighted ties and duplicate reviews', () => {
  const rows = Array.from({ length: 150 }, (_, index) => entry(
    `place-${index}`, (index % 51) / 10, date(index),
  ));
  rows.push(entry('place-1', 5, date(-1)));
  const before = structuredClone(rows);
  for (const editing of [false, true]) {
    for (let cents = 0; cents <= 500; cents++) {
      const proposed = reviewRankingCandidate({
        id: 'proposed-review', placeId: editing ? 'place-1' : 'new-place', userId: 'u1',
        rating: cents / 100, subRatings: { food: 9, service: 8 },
        text: '', date: '', updatedAt: date(200),
      });
      const preview = getListPlacementPreview(rows, proposed);
      const persisted = rankListEntries([...rows.filter(row => row.placeId !== proposed.placeId), proposed]);
      assert.equal(preview.rank, persisted.find(row => row.placeId === proposed.placeId)?.rank);
      assert.equal(preview.total, editing ? 150 : 151);
      assert.equal(preview.above?.placeId, persisted[preview.rank - 2]?.placeId);
      assert.equal(preview.below?.placeId, persisted[preview.rank]?.placeId);
    }
  }
  assert.deepEqual(rows, before, 'dragging must leave loaded List data unchanged');
});

test('preview uses deterministic ties for new reviews and edits', () => {
  const rows = [entry('a', 4.73, date(1)), entry('z', 4.73, date(2))];
  assert.equal(getListPlacementPreview(rows, entry('new', 4.73, date(3))).rank, 1);
  assert.equal(getListPlacementPreview(rows, entry('a', 4.73, date(3))).rank, 1);
  const simultaneous = getListPlacementPreview(rows, entry('b', 4.73, date(2)));
  assert.equal(simultaneous.rank, 1);
  assert.equal(simultaneous.below?.placeId, 'z');
});

test('creating, editing, and deleting a review keeps the persisted mock List projection in sync', async () => {
  const [places, reviews] = await Promise.all([
    mockRepository.listPlaces(),
    mockRepository.getReviewsByUser('u1'),
  ]);
  const place = places.find(candidate => !reviews.some(review => review.placeId === candidate.id));
  assert.ok(place, 'fixture must include a place without the current user’s review');

  const preview = getListPlacementPreview(reviews.map(reviewRankingCandidate), reviewRankingCandidate({
    id: `u1_${place.id}`, placeId: place.id, userId: 'u1', rating: 4.73,
    text: '', date: '', updatedAt: new Date(),
  }));
  const created = await mockRepository.createReview({ placeId: place.id, rating: 4.73, text: 'New review' });
  const afterCreate = await mockRepository.getMyList('u1');
  const createdEntry = afterCreate.find(row => row.placeId === place.id);
  assert.equal(createdEntry?.rating, 4.73);
  assert.ok(createdEntry);
  assert.equal(createdEntry.rank, preview.rank);
  assert.equal(afterCreate.length, preview.total);
  await assert.rejects(() => mockRepository.createReview({ placeId: place.id, rating: 4, text: 'Duplicate' }), /already left a review/i);

  const editPreview = getListPlacementPreview(
    (await mockRepository.getReviewsByUser('u1')).map(reviewRankingCandidate),
    reviewRankingCandidate({ ...created, rating: 5, subRatings: { food: 10, service: 10 }, updatedAt: new Date() }),
  );
  await mockRepository.updateReview(created.id, { rating: 5, subRatings: { food: 10, service: 10 }, text: 'Edited review' });
  const afterEdit = await mockRepository.getMyList('u1');
  assert.equal(afterEdit.find(row => row.placeId === place.id)?.rating, 5);
  assert.equal(afterEdit.find(row => row.placeId === place.id)?.rank, editPreview.rank);
  assert.equal(afterEdit.length, editPreview.total);
  assert.ok(afterEdit.findIndex(row => row.placeId === place.id) < afterCreate.findIndex(row => row.placeId === place.id));
  await mockRepository.updateReview(created.id, { rating: 0, subRatings: {}, text: 'Second edit' });
  const afterSecondEdit = await mockRepository.getMyList('u1');
  assert.equal(afterSecondEdit.find(row => row.placeId === place.id)?.rating, 0);
  assert.equal(afterSecondEdit.findIndex(row => row.placeId === place.id), afterSecondEdit.length - 1);

  await mockRepository.deleteReview(created.id, 'u1');
  assert.equal((await mockRepository.getMyList('u1')).some(row => row.placeId === place.id), false);
});
import { getReviewScore } from './reviewScoring';
import { combineReviews } from './combinedList';
import { friendsAtPlace } from './personalization';
import { calculatePlaceScores } from '../services/placeScoring';
import type { Place, Review } from '../types/models';

test('weighted score matches preview, personal List, cards, friends and combined averages', () => {
  const place = { id: 'consistent' } as Place;
  const review: Review = { id: 'r', placeId: place.id, userId: 'u', rating: 4.73, subRatings: { food: 9, service: 8 }, text: '', date: '' };
  const candidate = reviewRankingCandidate(review);
  assert.equal(getReviewScore(review), 4.68);
  assert.equal(rankListEntries([candidate])[0].rating, 4.68);
  assert.equal(getListPlacementPreview([], candidate).rank, 1);
  assert.equal(friendsAtPlace([review], ['u']).average, 4.68);
  assert.equal(combineReviews([review], ['u'], [place])[0].rating, 4.68);
  assert.equal(combineReviews([review], ['u'], [place])[0].contributions[0].rating, 4.68);
  assert.equal(calculatePlaceScores([place], [review]).get(place.id)?.averageRating, 4.68);
  assert.equal(getReviewScore({ rating: 4.73 }), 4.73);
  assert.equal(getReviewScore({ rating: 4, subRatings: { food: 8 } }), 4);
});

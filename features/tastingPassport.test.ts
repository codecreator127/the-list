import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getPassportProgress } from './tastingPassport';

test('stamps cuisines once and counts only first reviews of saved places in the local week', () => {
  const now = new Date(2026, 5, 3, 12);
  const places = [
    { id: 'a', cuisine: '  Japanese ', category: 'Sushi restaurant' },
    { id: 'b', category: 'Ramen restaurant' },
    { id: 'c', category: 'French restaurant' },
    { id: 'd', category: 'Restaurant' },
    { id: 'e', category: 'Restaurant' },
  ];
  const progress = getPassportProgress(places, [
    { placeId: 'a', createdAt: new Date(2026, 4, 31, 23, 59) },
    { placeId: 'a', createdAt: new Date(2026, 5, 2) },
    { placeId: 'b', createdAt: new Date(2026, 5, 1) },
    { placeId: 'b', createdAt: new Date(2026, 5, 2) },
    { placeId: 'c', createdAt: new Date(2026, 5, 3) },
    { placeId: 'd', createdAt: new Date(2026, 5, 3, 13) },
    { placeId: 'e' },
    { placeId: 'deleted', createdAt: new Date(2026, 5, 3) },
  ], now);

  assert.deepEqual([...progress.stampedCuisines], ['Japanese', 'French']);
  assert.equal(progress.weeklyCount, 2);
  assert.deepEqual(progress.badges.map(badge => badge.earned), [true, false, false]);
});

test('earns milestones at five cuisines and ten places', () => {
  const progress = getPassportProgress(
    ['Greek', 'Thai', 'Chinese', 'French', 'Japanese', 'Cafe', 'Cafe', 'Cafe', 'Cafe', 'Cafe']
      .map((cuisine, index) => ({ id: String(index), cuisine, category: cuisine })),
    [],
    new Date(2026, 5, 3),
  );
  assert.deepEqual(progress.badges.map(badge => badge.earned), [true, true, true]);
});

import { averageReviewScore, getReviewScore } from './reviewScoring';
import type { Place, Review } from '../types/models';
import type { Friendship } from '../services/repositories';
import type { RankedPlace } from './myList';
import { acceptedFriendIds, latestReviews } from './personalization';

export type CombinedRating = { userId: string; rating: number; reviewId: string };
export type CombinedPlace = RankedPlace & { average: number; reviewerCount: number; contributions: CombinedRating[] };

export function validateParticipants(currentUserId: string, selectedIds: string[], friendships: Friendship[]): string[] {
  const allowed = new Set([currentUserId, ...acceptedFriendIds(currentUserId, friendships)]);
  const ids = [...new Set(selectedIds)].sort();
  if (ids.some(id => !allowed.has(id))) throw new Error('Combined Lists can only include you and your accepted friends. Update your selection.');
  return ids;
}

/** Canonical place IDs are the same IDs used by reviews, place documents and personal Lists. */
export function combineReviews(reviews: Review[], selectedIds: string[], places: Place[]): CombinedPlace[] {
  const selected = new Set(selectedIds);
  const byPlace = new Map(places.map(place => [place.id, place]));
  const groups = new Map<string, Review[]>();
  // Reuse review de-duplication: a participant contributes at most once per restaurant.
  for (const review of latestReviews(reviews.filter(row => selected.has(row.userId)))) {
    if (!byPlace.has(review.placeId) || !Number.isFinite(review.rating) || review.rating < 0 || review.rating > 5) continue;
    const rows = groups.get(review.placeId) ?? [];
    rows.push(review); groups.set(review.placeId, rows);
  }
  return [...groups].map(([placeId, rows]) => {
    // Ratings use two-decimal precision; sum cents to avoid floating-point order differences.
    const average = averageReviewScore(rows);
    return { placeId, place: byPlace.get(placeId)!, average, rating: Math.round((average + Number.EPSILON) * 100) / 100,
      reviewerCount: rows.length, updatedAt: new Date(0), rank: 0,
      contributions: rows.map(row => ({ userId: row.userId, rating: getReviewScore(row), reviewId: row.id })).sort((a,b) => a.userId < b.userId ? -1 : a.userId > b.userId ? 1 : 0) };
  }).sort((a,b) => b.average - a.average || b.reviewerCount - a.reviewerCount || (a.placeId < b.placeId ? -1 : a.placeId > b.placeId ? 1 : 0))
    .map((row,index) => ({ ...row, rank: index + 1 }));
}

export function parseCombinedParticipants(value?: string | string[]): string[] | undefined {
  if (value === undefined) return undefined;
  try {
    const parsed = JSON.parse(Array.isArray(value) ? value[0] : value);
    if (!Array.isArray(parsed) || parsed.some(id => typeof id !== 'string' || !id)) throw new Error();
    return [...new Set(parsed as string[])];
  } catch { throw new Error('This Combined List selection is invalid. Return to your List and select participants again.'); }
}

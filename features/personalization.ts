import { averageReviewScore } from './reviewScoring';
import { normalizeRating } from './ratings';
import type { Review } from '../types/models';
import type { Friendship } from '../services/repositories';

export function acceptedFriendIds(userId: string, friendships: Friendship[]): string[] {
  return [...new Set(friendships.filter(row => row.status === 'accepted' && row.userIds.includes(userId))
    .flatMap(row => row.userIds.filter(id => id !== userId)))];
}

const reviewTime = (review: Review) => (review.updatedAt ?? review.createdAt)?.getTime() ?? 0;

/** Legacy duplicates count once per person/place; edits replace the previous rating. */
export function latestReviews(reviews: Review[]): Review[] {
  const latest = new Map<string, Review>();
  for (const review of reviews) {
    const key = JSON.stringify([review.userId, review.placeId]);
    const prior = latest.get(key);
    if (!prior || reviewTime(review) > reviewTime(prior)
      || reviewTime(review) === reviewTime(prior) && review.id < prior.id) latest.set(key, review);
  }
  return [...latest.values()].sort((a, b) => reviewTime(b) - reviewTime(a) || a.id.localeCompare(b.id));
}

export function friendsAtPlace(reviews: Review[], friendIds: string[]) {
  const friends = new Set(friendIds);
  const rows = latestReviews(reviews.filter(review => friends.has(review.userId)));
  return { reviews: rows, average: rows.length ? normalizeRating(averageReviewScore(rows)) : undefined };
}

export function selectHomeReviews(ownReviews: Review[], friendReviews: Review[]) {
  const own = latestReviews(ownReviews);
  const friends = latestReviews(friendReviews);
  const reviewed = new Set(own.map(row => row.placeId));
  const grouped = new Map<string, Review[]>();
  for (const review of friends) grouped.set(review.placeId, [...(grouped.get(review.placeId) ?? []), review]);
  const highlyRated = [...grouped].map(([placeId, rows]) => ({
    placeId, average: normalizeRating(averageReviewScore(rows)),
    friendCount: rows.length, reviewed: reviewed.has(placeId), latestAt: reviewTime(rows[0]),
  })).filter(row => row.average >= 4).sort((a, b) => Number(a.reviewed) - Number(b.reviewed)
    || b.average - a.average || b.friendCount - a.friendCount || b.latestAt - a.latestAt || a.placeId.localeCompare(b.placeId)).slice(0, 4);
  return { recent: own.slice(0, 3), activity: friends.slice(0, 4), highlyRated };
}

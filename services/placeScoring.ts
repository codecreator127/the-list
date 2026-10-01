import type { Place, Review } from '../types/models';
import { getWeightedReviewRating } from '../features/reviewScoring';

export type PlaceScore = { averageRating: number; reviewCount: number; latestReviewAt?: Date };

/** Derives List scores from reviews; no aggregate score is persisted as source data. */
export function calculatePlaceScores(places: Place[], reviews: Review[]): Map<string, PlaceScore> {
  const grouped = new Map<string, Review[]>();
  for (const review of reviews) {
    const rows = grouped.get(review.placeId) ?? [];
    rows.push(review);
    grouped.set(review.placeId, rows);
  }

  return new Map(places.map(place => {
    const rows = grouped.get(place.id) ?? [];
    const total = rows.reduce((sum, review) => sum + getWeightedReviewRating(review), 0);
    const latest = rows.reduce<Date | undefined>((newest, review) => {
      const date = review.createdAt ?? review.updatedAt;
      return date && (!newest || date > newest) ? date : newest;
    }, undefined);
    return [place.id, {
      averageRating: rows.length ? Math.round((total / rows.length) * 10) / 10 : 0,
      reviewCount: rows.length,
      latestReviewAt: latest,
    }];
  }));
}

export function applyPlaceScores(places: Place[], reviews: Review[]): Place[] {
  const scores = calculatePlaceScores(places, reviews);
  return places.map(place => ({ ...place, ...scores.get(place.id)! }));
}

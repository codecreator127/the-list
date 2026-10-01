import type { Review } from '../types/models';

/** Optional category ratings contribute at most 10% of a review's score. */
export function getWeightedReviewRating(review: Review): number {
  const categoryRatings = Object.values(review.subRatings ?? {}).filter((rating): rating is number => typeof rating === 'number');
  if (!categoryRatings.length) return review.rating;
  const categoryAverage = categoryRatings.reduce((sum, rating) => sum + rating, 0) / categoryRatings.length;
  return review.rating * 0.9 + categoryAverage * 0.1;
}

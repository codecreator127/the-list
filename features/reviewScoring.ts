import type { Review } from '../types/models';
import { normalizeRating } from './ratings';

/** Optional category ratings contribute at most 10% of a review's score. */
export function getWeightedReviewRating(review: Pick<Review, 'rating' | 'subRatings'> & Partial<Review>): number {
  const categoryRatings = Object.values(review.subRatings ?? {}).filter((rating): rating is number => typeof rating === 'number');
  if (!categoryRatings.length) return review.rating;
  const categoryAverage = categoryRatings.reduce((sum, rating) => sum + rating, 0) / categoryRatings.length / 2;
  return review.rating * 0.9 + categoryAverage * 0.1;
}

/** The score shown everywhere; keep the unrounded weighted value for ranking. */
export function getReviewScore(review: Pick<Review, 'rating' | 'subRatings'> & Partial<Review>): number {
  return normalizeRating(getWeightedReviewRating(review));
}

/** Average the displayed contributions in integer hundredths to avoid float drift. */
export function averageReviewScore(reviews: Review[]): number {
  if (!reviews.length) return 0;
  const cents = reviews.reduce((sum, review) => sum + Math.round(getReviewScore(review) * 100), 0);
  return cents / (100 * reviews.length);
}

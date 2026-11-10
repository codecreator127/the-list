import { CUISINE_TERMS } from '../data/searchOptions';
import type { Place, Review } from '../types/models';
import { PODIUM_MINIMUM_PLACES } from './podium';

export const isTastingPassportEnabled = process.env.EXPO_PUBLIC_TASTING_PASSPORT_ENABLED === 'true';

export const passportCuisines = [
  'Japanese', 'Chinese', 'Korean', 'Thai', 'Vietnamese', 'Italian',
  'Mexican', 'Indian', 'French', 'Greek', 'Seafood',
] as const;

export const weeklyTastingTarget = 2;

function getCuisine(place: Pick<Place, 'cuisine' | 'category'>) {
  const cuisine = place.cuisine?.trim().toLowerCase();
  const exact = passportCuisines.find(name => name.toLowerCase() === cuisine);
  if (exact) return exact;

  const classification = [cuisine, place.category.toLowerCase()].filter(Boolean).join(' ');
  return passportCuisines.find(name => CUISINE_TERMS[name].some(term => classification.includes(term)));
}

export function getPassportProgress(
  places: readonly Pick<Place, 'id' | 'cuisine' | 'category'>[],
  reviews: readonly Pick<Review, 'placeId' | 'createdAt'>[],
  now: Date,
) {
  const stampedCuisines = new Set(places.map(getCuisine).filter(cuisine => cuisine !== undefined));
  const firstReviewDates = new Map<string, number>();
  for (const review of reviews) {
    const created = review.createdAt?.getTime();
    if (created === undefined || !Number.isFinite(created)) continue;
    const previous = firstReviewDates.get(review.placeId);
    if (previous === undefined || created < previous) firstReviewDates.set(review.placeId, created);
  }
  const weekStart = new Date(now);
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() - (weekStart.getDay() + 6) % 7);

  const weeklyCount = places.filter(place => {
    const firstReview = firstReviewDates.get(place.id);
    return firstReview !== undefined && firstReview >= weekStart.getTime() && firstReview <= now.getTime();
  }).length;

  return {
    stampedCuisines,
    weeklyCount,
    badges: [
      { title: 'First bite', description: 'Review your first restaurant.', earned: places.length > 0 },
      { title: 'Five cuisines', description: 'Collect five different cuisine stamps.', earned: stampedCuisines.size >= 5 },
      { title: 'Ten on the List', description: 'Add ten restaurants to your List.', earned: places.length >= PODIUM_MINIMUM_PLACES },
    ],
  };
}

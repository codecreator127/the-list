import type { PersonalListEntry, Place } from '../types/models';

export type RankedPlace = PersonalListEntry & { place: Place };

export type ListRankingCandidate = {
  placeId: string;
  rating: number;
  weightedRating?: number;
  updatedAt?: Date;
  reviewId?: string;
};

/** Sorts review-derived candidates and assigns the persisted sequential ranks. */
export function rankListEntries(entries: ListRankingCandidate[]): PersonalListEntry[] {
  const currentByPlace = new Map<string, ListRankingCandidate>();

  for (const entry of entries) {
    const current = currentByPlace.get(entry.placeId);
    const entryTime = entry.updatedAt?.getTime() ?? 0;
    const currentTime = current?.updatedAt?.getTime() ?? 0;
    if (!current
      || entryTime > currentTime
      || (entryTime === currentTime && (entry.weightedRating ?? entry.rating) > (current.weightedRating ?? current.rating))
      || (entryTime === currentTime && (entry.weightedRating ?? entry.rating) === (current.weightedRating ?? current.rating) && (entry.reviewId ?? '') < (current.reviewId ?? ''))) {
      currentByPlace.set(entry.placeId, entry);
    }
  }

  return [...currentByPlace.values()]
    .sort((a, b) => (b.weightedRating ?? b.rating) - (a.weightedRating ?? a.rating)
      || (b.updatedAt?.getTime() ?? 0) - (a.updatedAt?.getTime() ?? 0)
      || a.placeId.localeCompare(b.placeId, 'en'))
    .map((entry, index) => ({
      placeId: entry.placeId,
      rank: index + 1,
      rating: entry.rating,
      updatedAt: entry.updatedAt ?? new Date(0),
    }));
}

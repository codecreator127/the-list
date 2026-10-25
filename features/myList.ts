import type { PersonalListEntry, Place, Review } from '../types/models';
import { normalizeRating } from './ratings';
import { getWeightedReviewRating } from './reviewScoring';

export type RankedPlace = PersonalListEntry & { place: Place };
export type RankedListCandidate = ListRankingCandidate & { rank: number; weightedRating: number; updatedAt: Date };
const RANKING_PRECISION = 100_000;

export type ListRankingCandidate = {
  placeId: string;
  rating: number;
  weightedRating?: number;
  updatedAt?: Date;
  reviewId?: string;
};

/** Keep preview inputs identical to the inputs used when saving a review. */
export function reviewRankingCandidate(review: Review): ListRankingCandidate {
  const rating = normalizeRating(review.rating);
  return {
    placeId: review.placeId,
    rating,
    weightedRating: getWeightedReviewRating({ ...review, rating }),
    updatedAt: review.updatedAt ?? review.createdAt,
    reviewId: review.id,
  };
}

function rankingScore(entry: ListRankingCandidate): number {
  const score = entry.weightedRating ?? normalizeRating(entry.rating);
  return Math.round(score * RANKING_PRECISION);
}

/** Applies the shared de-duplication and deterministic ordering used by persisted Lists. */
export function rankListCandidates(entries: ListRankingCandidate[]): RankedListCandidate[] {
  const currentByPlace = new Map<string, ListRankingCandidate>();

  for (const entry of entries) {
    const current = currentByPlace.get(entry.placeId);
    const entryTime = entry.updatedAt?.getTime() ?? 0;
    const currentTime = current?.updatedAt?.getTime() ?? 0;
    const entryScore = rankingScore(entry);
    const currentScore = current ? rankingScore(current) : 0;
    if (!current
      || entryTime > currentTime
      || (entryTime === currentTime && entryScore > currentScore)
      || (entryTime === currentTime && entryScore === currentScore && (entry.reviewId ?? '') < (current.reviewId ?? ''))) {
      currentByPlace.set(entry.placeId, entry);
    }
  }

  return [...currentByPlace.values()]
    .sort((a, b) => rankingScore(b) - rankingScore(a)
      || (b.updatedAt?.getTime() ?? 0) - (a.updatedAt?.getTime() ?? 0)
      || a.placeId.localeCompare(b.placeId, 'en'))
    .map((entry, index) => ({
      ...entry,
      rank: index + 1,
      rating: normalizeRating(entry.rating),
      weightedRating: entry.weightedRating ?? normalizeRating(entry.rating),
      updatedAt: entry.updatedAt ?? new Date(0),
    }));
}

/** Sorts review-derived candidates and assigns the persisted sequential ranks. */
export function rankListEntries(entries: ListRankingCandidate[]): PersonalListEntry[] {
  return rankListCandidates(entries).map(entry => ({
    placeId: entry.placeId,
    rank: entry.rank,
    rating: normalizeRating(entry.weightedRating),
    updatedAt: entry.updatedAt,
  }));
}

export type ListPlacementPreview = {
  rank: number;
  total: number;
  above?: RankedListCandidate;
  below?: RankedListCandidate;
};

/** Computes a proposed placement without changing or persisting the current List. */
export function getListPlacementPreview(
  entries: ListRankingCandidate[],
  proposed: ListRankingCandidate,
): ListPlacementPreview {
  const ranked = rankListCandidates([
    ...entries.filter(entry => entry.placeId !== proposed.placeId),
    proposed,
  ]);
  const index = ranked.findIndex(entry => entry.placeId === proposed.placeId);
  if (index < 0) throw new Error(`Could not rank proposed place ${proposed.placeId}.`);
  return {
    rank: index + 1,
    total: ranked.length,
    above: ranked[index - 1],
    below: ranked[index + 1],
  };
}

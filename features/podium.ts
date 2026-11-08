import type { PersonalListEntry } from '../types/models';

export const PODIUM_MINIMUM_PLACES = 10;
const podiumRanks = [1, 2, 3] as const;
export type PodiumChange = { rank: typeof podiumRanks[number]; placeId: string };

type Ranking = readonly Pick<PersonalListEntry, 'placeId' | 'rank'>[];

export function getPodiumChanges(before: Ranking, after: Ranking): PodiumChange[] {
  if (after.length < PODIUM_MINIMUM_PLACES) return [];
  return podiumRanks.flatMap(rank => {
    const placeId = after.find(entry => entry.rank === rank)?.placeId;
    return placeId && before.find(entry => entry.rank === rank)?.placeId !== placeId
      ? [{ rank, placeId }]
      : [];
  });
}

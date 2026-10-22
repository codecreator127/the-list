import type { Place, Review, User } from '../types/models';
import type { FoodRepository } from './repositories';
import { acceptedFriendIds, friendsAtPlace, latestReviews, selectHomeReviews } from '../features/personalization';
import { applyPlaceScores } from './placeScoring';
import { combineReviews, validateParticipants } from '../features/combinedList';

export type AuthoredReview = Review & { user: User };
export type HomeReview = AuthoredReview & { place: Place };
export type HomeData = {
  user: User; friendCount: number; recent: HomeReview[]; activity: HomeReview[];
  highlyRated: { place: Place; average: number; friendCount: number; reviewed: boolean }[];
  unavailablePlaces: number;
};
const fallbackUser = (id: string): User => ({ id, name: 'List member', handle: '', initials: 'L', color: '#8CA79A' });

/** Request-scoped joins: no per-review profile reads or persistent social caches. */
export function createPersonalizedData(repository: FoodRepository, refreshPlace: (place: Place) => Promise<Place>) {
  return {
    async restaurant(placeId: string, userId: string, combinedParticipantIds?: string[]) {
      const [stored, reviews, friendships] = await Promise.all([
        repository.getPlace(placeId), repository.getReviewsForPlace(placeId), repository.listFriendships(userId, combinedParticipantIds !== undefined),
      ]);
      const combinedIds=combinedParticipantIds===undefined?undefined:validateParticipants(userId,combinedParticipantIds,friendships);
      const profiles = await repository.getUsers([...new Set(reviews.map(row => row.userId))]);
      const byUser = new Map(profiles.map(user => [user.id, user]));
      const authored = (rows: Review[]): AuthoredReview[] => rows.map(review => ({ ...review, user: byUser.get(review.userId) ?? fallbackUser(review.userId) }));
      const friendSummary = friendsAtPlace(reviews, acceptedFriendIds(userId, friendships));
      const place = stored ? applyPlaceScores([await refreshPlace(stored)], reviews)[0] : undefined;
      if(combinedIds)validateParticipants(userId,combinedIds,await repository.listFriendships(userId,true));
      const combined=combinedIds && place?combineReviews(reviews,combinedIds,[place])[0]:undefined;
      return {
        combined:combined?{...combined,contributions:combined.contributions.map(row=>({...row,user:byUser.get(row.userId)??fallbackUser(row.userId)}))}:undefined,
        place, reviews: authored(latestReviews(reviews)),
        myReview: latestReviews(reviews.filter(row => row.userId === userId))[0],
        friendReviews: authored(friendSummary.reviews), friendAverage: friendSummary.average,
      };
    },
    async home(userId: string): Promise<HomeData> {
      const [ownReviews, friendships] = await Promise.all([repository.getReviewsByUser(userId), repository.listFriendships(userId)]);
      const friendIds = acceptedFriendIds(userId, friendships);
      // Bounded recent sample per 30 friends, rather than reading every user's history.
      const friendReviews = friendIds.length ? await repository.getRecentReviewsByUsers(friendIds) : [];
      const friendSet = new Set(friendIds);
      const selected = selectHomeReviews(ownReviews, friendReviews.filter(row => friendSet.has(row.userId)));
      const placeIds = [...new Set([...selected.recent, ...selected.activity, ...selected.highlyRated].map(row => row.placeId))];
      const [stored, users] = await Promise.all([
        repository.getPlacesByIds(placeIds),
        repository.getUsers([userId, ...selected.activity.map(row => row.userId)]),
      ]);
      const refreshed = await Promise.allSettled(stored.map(refreshPlace));
      const places = new Map<string, Place>();
      refreshed.forEach(row => { if (row.status === 'fulfilled') places.set(row.value.id, row.value); });
      const profiles = new Map(users.map(user => [user.id, user]));
      const joined = (reviews: Review[]): HomeReview[] => reviews.flatMap(review => {
        const place = places.get(review.placeId);
        return place ? [{ ...review, place, user: profiles.get(review.userId) ?? fallbackUser(review.userId) }] : [];
      });
      return {
        user: profiles.get(userId) ?? fallbackUser(userId), friendCount: friendIds.length,
        recent: joined(selected.recent), activity: joined(selected.activity),
        highlyRated: selected.highlyRated.flatMap(row => {
          const place = places.get(row.placeId);
          return place ? [{ ...row, place }] : [];
        }),
        unavailablePlaces: placeIds.length - places.size,
      };
    },
  };
}

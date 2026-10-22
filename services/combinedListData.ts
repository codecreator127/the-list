import type { FoodRepository } from './repositories';
import type { Place, Review } from '../types/models';
import { combineReviews, validateParticipants } from '../features/combinedList';
import { acceptedFriendIds } from '../features/personalization';

type Repository = Pick<FoodRepository, 'listFriendships' | 'getUsers' | 'getReviewsByUsers' | 'getPlacesByIds'>;

/** Screen-scoped, read-only cache. Revalidates friendships before and after asynchronous reads. */
export function createCombinedListData(repository: Repository, hydrate: (place: Place) => Promise<Place>, userId: string) {
  const reviews = new Map<string, Review[]>();
  const pendingReviews = new Map<string, Promise<void>>();
  const places = new Map<string, Promise<Place>>();
  const loadedPlaceIds = new Set<string>();
  const pendingPlaces = new Map<string, Promise<void>>();
  async function validate(ids: string[]) {
    const friendships = await repository.listFriendships(userId, true);
    const allowed = new Set([userId, ...acceptedFriendIds(userId, friendships)]);
    for (const id of reviews.keys()) if (!allowed.has(id)) reviews.delete(id);
    return validateParticipants(userId, ids, friendships);
  }
  return {
    async participants() {
      const friendships = await repository.listFriendships(userId, true);
      const ids = [userId, ...acceptedFriendIds(userId, friendships).sort()];
      const users = await repository.getUsers(ids);
      return ids.map(id => users.find(user => user.id === id) ?? {id, name: 'List member', handle: '', initials: 'L', color: '#8CA79A'});
    },
    async load(selectedIds: string[]) {
      const ids = await validate(selectedIds);
      if (!ids.length) return {items: [], unavailablePlaces: 0};
      const missing = ids.filter(id => !reviews.has(id) && !pendingReviews.has(id));
      if (missing.length) {
        const request = repository.getReviewsByUsers(missing).then(rows => {
          for (const id of missing) reviews.set(id, rows.filter(row => row.userId === id));
        }).finally(() => { for (const id of missing) pendingReviews.delete(id); });
        for (const id of missing) pendingReviews.set(id, request);
      }
      await Promise.all([...new Set(ids.map(id => pendingReviews.get(id)).filter((request): request is Promise<void> => !!request))]);
      const selectedReviews = ids.flatMap(id => reviews.get(id) ?? []);
      const placeIds = [...new Set(selectedReviews.map(row => row.placeId))];
      const missingPlaces = placeIds.filter(id => !loadedPlaceIds.has(id) && !pendingPlaces.has(id));
      if (missingPlaces.length) {
        const request=repository.getPlacesByIds(missingPlaces).then(stored=>{
          // Hydrate each unique restaurant once per screen, including shared restaurants.
          for (const place of stored) if (!places.has(place.id)) places.set(place.id, hydrate(place).catch(() => ({...place, name: place.name || 'Restaurant details unavailable'})));
          missingPlaces.forEach(id=>loadedPlaceIds.add(id));
        }).finally(()=>{missingPlaces.forEach(id=>pendingPlaces.delete(id));});
        missingPlaces.forEach(id=>pendingPlaces.set(id,request));
      }
      await Promise.all([...new Set(placeIds.map(id=>pendingPlaces.get(id)).filter((request):request is Promise<void>=>!!request))]);
      const hydrated = await Promise.all(placeIds.flatMap(id => places.has(id) ? [places.get(id)!] : []));
      await validate(ids);
      return {items: combineReviews(selectedReviews, ids, hydrated), unavailablePlaces: placeIds.length - hydrated.length};
    },
  };
}

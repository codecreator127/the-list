import { collection, documentId, getDocs, limit, orderBy, query, where, type Firestore } from 'firebase/firestore';
import { queryBatches, FRIEND_REVIEW_BATCH_LIMIT } from './queryBatches';

/** Shared by the repositories and emulator verification; never issue an empty `in` query. */
export function createBatchedReads(db: Firestore) {
  return {
    async reviewsByUsers(ids: string[]) {
      const snapshots = await Promise.all(queryBatches(ids).map(batch => getDocs(query(collection(db, 'reviews'), where('userId', 'in', batch)))));
      return snapshots.flatMap(snapshot => snapshot.docs);
    },
    async places(ids: string[]) {
      const snapshots = await Promise.all(queryBatches(ids).map(batch => getDocs(query(collection(db, 'places'), where(documentId(), 'in', batch)))));
      return snapshots.flatMap(snapshot => snapshot.docs);
    },
    async profiles(ids: string[]) {
      const snapshots = await Promise.all(queryBatches(ids).map(batch => getDocs(query(collection(db, 'usernames'), where('uid', 'in', batch)))));
      return snapshots.flatMap(snapshot => snapshot.docs);
    },
    async recentFriendReviews(ids: string[]) {
      const snapshots = await Promise.all(queryBatches(ids).map(batch => getDocs(query(collection(db, 'reviews'), where('userId', 'in', batch), orderBy('createdAt', 'desc'), limit(FRIEND_REVIEW_BATCH_LIMIT)))));
      return snapshots.flatMap(snapshot => snapshot.docs);
    },
  };
}

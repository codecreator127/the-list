/** Firestore `in` queries support up to 30 values. Also skip empty queries. */
export function queryBatches(ids: string[]): string[][] {
  const unique = [...new Set(ids)];
  return Array.from({ length: Math.ceil(unique.length / 30) }, (_, index) => unique.slice(index * 30, index * 30 + 30));
}
export const FRIEND_REVIEW_BATCH_LIMIT = 60;

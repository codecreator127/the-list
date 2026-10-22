import type { ReviewPhoto } from '../types/models';
export type PhotoCleanupResult = { cleanupPending?: ReviewPhoto };

// Never delete the previous image until the review/List transaction has committed.
// Cleanup failure is distinct from save failure: callers must not roll back a saved photo.
export async function persistThenCleanup(
  previous: ReviewPhoto | undefined,
  next: ReviewPhoto | null | undefined,
  persist: () => Promise<unknown>,
  remove: (photo: ReviewPhoto) => Promise<void>,
): Promise<PhotoCleanupResult> {
  await persist();
  if (previous && next !== undefined && previous.path !== next?.path) {
    try { await remove(previous); } catch { return { cleanupPending: previous }; }
  }
  return {};
}

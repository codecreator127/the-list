import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { FieldPath, Timestamp, getFirestore, type DocumentData, type DocumentReference, type DocumentSnapshot, type Query } from 'firebase-admin/firestore';
import type { Review } from '../types/models';
import { rankListCandidates } from '../features/myList';
import { getWeightedReviewRating } from '../features/reviewScoring';
import { normalizeStoredRating } from '../features/ratings';

type StoredDocument = { ref: DocumentReference; snapshot: DocumentSnapshot };
type Write = { kind: 'update' | 'create' | 'delete'; ref: DocumentReference; data?: DocumentData };

function parseArguments(args: string[]) {
  let projectId = '';
  let confirmProject = '';
  let apply = false;
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--project-id') projectId = args[++index] ?? '';
    else if (argument === '--confirm-project') confirmProject = args[++index] ?? '';
    else if (argument === '--apply') apply = true;
    else throw new Error(`Unknown argument: ${argument}`);
  }
  if (!projectId) throw new Error('Pass --project-id <firebase-project-id>.');
  if (apply && confirmProject !== projectId) {
    throw new Error('Applying changes requires --confirm-project to exactly match --project-id.');
  }
  if (!apply && confirmProject) throw new Error('--confirm-project is only valid together with --apply.');
  return { projectId, apply };
}

async function readAll(query: Query): Promise<StoredDocument[]> {
  const results: StoredDocument[] = [];
  let cursor: DocumentSnapshot | undefined;
  while (true) {
    let page = query.orderBy(FieldPath.documentId()).limit(400);
    if (cursor) page = page.startAfter(cursor);
    const snapshot = await page.get();
    results.push(...snapshot.docs.map(document => ({ ref: document.ref, snapshot: document })));
    if (snapshot.size < 400) return results;
    cursor = snapshot.docs[snapshot.docs.length - 1];
  }
}

function asDate(value: unknown): Date | undefined {
  if (value && typeof (value as { toDate?: unknown }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate();
  }
  return value instanceof Date ? value : undefined;
}

async function commitWrites(writes: Write[]) {
  for (let offset = 0; offset < writes.length; offset += 450) {
    const batch = getFirestore().batch();
    for (const write of writes.slice(offset, offset + 450)) {
      if (write.kind === 'delete') batch.delete(write.ref);
      else if (write.kind === 'create') batch.create(write.ref, write.data!);
      else batch.update(write.ref, write.data!);
    }
    await batch.commit();
  }
}

async function main() {
  const { projectId, apply } = parseArguments(process.argv.slice(2));
  initializeApp({ credential: applicationDefault(), projectId });
  const db = getFirestore();
  const [reviewDocuments, listDocuments] = await Promise.all([
    readAll(db.collection('reviews')),
    readAll(db.collectionGroup('list')),
  ]);

  const reviewsByUser = new Map<string, StoredDocument[]>();
  const listsByUser = new Map<string, StoredDocument[]>();
  const allUserIds = new Set<string>();
  for (const document of reviewDocuments) {
    const userId = document.snapshot.get('userId') as string | undefined;
    if (!userId) throw new Error(`Review ${document.ref.path} is missing userId.`);
    const rows = reviewsByUser.get(userId) ?? [];
    rows.push(document);
    reviewsByUser.set(userId, rows);
    allUserIds.add(userId);
  }
  for (const document of listDocuments) {
    const userId = document.ref.parent.parent?.id;
    if (!userId) throw new Error(`Could not resolve the owner of ${document.ref.path}.`);
    const rows = listsByUser.get(userId) ?? [];
    rows.push(document);
    listsByUser.set(userId, rows);
    allUserIds.add(userId);
  }

  const writes: Write[] = [];
  let reviewUpdates = 0;
  let listUpdates = 0;
  let listCreates = 0;
  let listDeletes = 0;
  const rankChanges: Array<{ userId: string; placeId: string; from?: number; to: number }> = [];
  const reviewChanges: Array<{ path: string; from: number; to: number }> = [];
  const staleListEntryPaths: string[] = [];

  for (const document of reviewDocuments) {
    const raw = document.snapshot.data()!;
    const rating = normalizeStoredRating(raw.rating, raw.ratingScale, 5);
    if (raw.rating !== rating || raw.ratingScale !== 5) {
      writes.push({ kind: 'update', ref: document.ref, data: { rating, ratingScale: 5 } });
      reviewUpdates += 1;
      if (reviewChanges.length < 25) reviewChanges.push({ path: document.ref.path, from: raw.rating, to: rating });
    }
  }

  for (const userId of allUserIds) {
    const reviewRows = reviewsByUser.get(userId) ?? [];
    const listRows = listsByUser.get(userId) ?? [];
    const candidates = reviewRows.map(({ ref, snapshot }) => {
      const raw = snapshot.data()!;
      if (typeof raw.placeId !== 'string' || !raw.placeId) throw new Error(`Review ${ref.path} is missing a valid placeId.`);
      const review: Review = {
        id: ref.id,
        placeId: raw.placeId,
        userId,
        rating: normalizeStoredRating(raw.rating, raw.ratingScale, 5),
        subRatings: raw.subRatings,
        text: raw.text ?? '',
        date: '',
        createdAt: asDate(raw.createdAt),
        updatedAt: asDate(raw.updatedAt),
      };
      return {
        placeId: review.placeId,
        rating: review.rating,
        weightedRating: getWeightedReviewRating(review),
        updatedAt: review.updatedAt ?? review.createdAt,
        reviewId: review.id,
      };
    });
    const ranked = rankListCandidates(candidates);
    const rankedByPlace = new Map(ranked.map(entry => [entry.placeId, entry]));
    const existingByPlace = new Map(listRows.map(row => [row.ref.id, row]));

    for (const entry of ranked) {
      const existing = existingByPlace.get(entry.placeId);
      if (!existing) {
        const updatedAt = entry.updatedAt ? Timestamp.fromDate(entry.updatedAt) : Timestamp.fromMillis(0);
        writes.push({
          kind: 'create',
          ref: db.doc(`users/${userId}/list/${entry.placeId}`),
          data: { placeId: entry.placeId, rank: entry.rank, rating: entry.rating, ratingScale: 5, updatedAt },
        });
        listCreates += 1;
      } else {
        const raw = existing.snapshot.data()!;
        if (raw.rank !== entry.rank || raw.rating !== entry.rating || raw.ratingScale !== 5) {
          writes.push({
            kind: 'update',
            ref: existing.ref,
            data: { rank: entry.rank, rating: entry.rating, ratingScale: 5 },
          });
          listUpdates += 1;
          if (raw.rank !== entry.rank && rankChanges.length < 25) {
            rankChanges.push({ userId, placeId: entry.placeId, from: raw.rank, to: entry.rank });
          }
        }
      }
    }

    for (const existing of listRows) {
      if (!rankedByPlace.has(existing.ref.id)) {
        writes.push({ kind: 'delete', ref: existing.ref });
        listDeletes += 1;
        if (staleListEntryPaths.length < 25) staleListEntryPaths.push(existing.ref.path);
      }
    }
  }

  const summary = {
    projectId,
    mode: apply ? 'apply' : 'dry-run',
    reviewsScanned: reviewDocuments.length,
    reviewsToUpdate: reviewUpdates,
    listEntriesScanned: listDocuments.length,
    listEntriesToUpdate: listUpdates,
    listEntriesToCreate: listCreates,
    staleListEntriesToDelete: listDeletes,
    usersScanned: allUserIds.size,
    rankChanges,
    reviewRatingChanges: reviewChanges,
    staleListEntryPaths,
  };
  console.log(JSON.stringify(summary, null, 2));

  if (apply) {
    await commitWrites(writes);
    console.log(`Applied ${writes.length} idempotent Firestore updates to project ${projectId}.`);
  } else {
    console.log('Dry run only. Review the summary, then rerun with --apply --confirm-project <same-project-id> to write changes.');
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

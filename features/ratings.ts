export const RATING_SCALE = 5;
export const RATING_PRECISION = 100;

export function normalizeRating(value: number): number {
  if (!Number.isFinite(value) || value < 0 || value > RATING_SCALE) {
    throw new RangeError(`Rating must be between 0 and ${RATING_SCALE}.`);
  }
  return Math.round((value + Number.EPSILON) * RATING_PRECISION) / RATING_PRECISION;
}

export function normalizeStoredRating(value: number, scale?: number, legacyScale: 5 | 10 = 5): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError('Stored rating must be a finite number.');
  }
  const sourceScale = scale ?? legacyScale;
  if (sourceScale !== 5 && sourceScale !== 10) {
    throw new RangeError(`Unsupported stored rating scale: ${sourceScale}.`);
  }
  return normalizeRating(value * RATING_SCALE / sourceScale);
}

export function ratingCents(value: number): number {
  return Math.round(normalizeRating(value) * RATING_PRECISION);
}

export function ratingFromSliderProgress(progress: number): number {
  if (!Number.isFinite(progress)) throw new RangeError('Slider progress must be a finite number.');
  const boundedProgress = Math.max(0, Math.min(1, progress));
  return normalizeRating(Math.round(boundedProgress * RATING_SCALE * RATING_PRECISION) / RATING_PRECISION);
}

import type { PlaceSearchResult } from '../types/models';
import { CUISINE_TERMS } from '../data/searchOptions';

export type SearchSort = 'recommended' | 'highest-rated' | 'most-reviewed' | 'newest-reviewed';
export type SearchFilters = {
  query?: string;
  cuisine?: string;
  area?: string;
  distanceKm?: number;
  origin?: { latitude: number; longitude: number };
  sort?: SearchSort;
};

export function matchesSearchText(place: PlaceSearchResult, query: string): boolean {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return true;
  const searchable = [place.name, place.category, place.cuisine, place.area, place.address]
    .filter(Boolean).join(' ').toLocaleLowerCase();
  return terms.every(term => searchable.includes(term));
}

export function matchesCuisine(place: PlaceSearchResult, cuisine: string): boolean {
  if (!cuisine || cuisine === 'All cuisines') return true;
  const source = [place.cuisine, place.category, place.name].filter(Boolean).join(' ').toLocaleLowerCase();
  const terms = CUISINE_TERMS[cuisine] ?? [cuisine.toLocaleLowerCase()];
  return terms.some(term => source.includes(term));
}

export function normalizeArea(area: string): string {
  const value = area.trim().toLocaleLowerCase();
  if (!value) return '';
  if (value === 'cbd' || value === 'sydney' || value.includes('sydney cbd')) return 'sydney cbd';
  if (value.includes('darling harbour')) return 'darling harbour';
  return value;
}

export function matchesArea(place: PlaceSearchResult, area: string): boolean {
  if (!area || area === 'All areas') return true;
  const selected = normalizeArea(area);
  return normalizeArea(place.area) === selected || normalizeArea(place.address).includes(selected);
}

export function haversineDistanceKm(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }): number {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const latitudeDelta = radians(b.latitude - a.latitude);
  const longitudeDelta = radians(b.longitude - a.longitude);
  const h = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(radians(a.latitude)) * Math.cos(radians(b.latitude)) * Math.sin(longitudeDelta / 2) ** 2;
  const boundedH = Math.min(1, Math.max(0, h));
  return 6371 * 2 * Math.atan2(Math.sqrt(boundedH), Math.sqrt(1 - boundedH));
}

export function filterAndSortPlaces(places: PlaceSearchResult[], filters: SearchFilters): PlaceSearchResult[] {
  const origin = filters.origin;
  const filtered = places.filter(place => {
    if (!matchesSearchText(place, filters.query ?? '')) return false;
    if (!matchesCuisine(place, filters.cuisine ?? 'All cuisines')) return false;
    if (!matchesArea(place, filters.area ?? 'All areas')) return false;
    if (filters.distanceKm !== undefined) {
      if (!origin || place.latitude === undefined || place.longitude === undefined) return false;
      if (haversineDistanceKm(origin, { latitude: place.latitude, longitude: place.longitude }) > filters.distanceKm) return false;
    }
    return true;
  });

  const decorated = filtered.map((place, index) => ({ place, index }));
  decorated.sort((a, b) => {
    let difference = 0;
    switch (filters.sort ?? 'recommended') {
      case 'highest-rated':
        difference = (b.place.listReviewCount > 0 ? b.place.listAverageRating ?? 0 : -1)
          - (a.place.listReviewCount > 0 ? a.place.listAverageRating ?? 0 : -1);
        if (difference === 0) difference = b.place.listReviewCount - a.place.listReviewCount;
        break;
      case 'most-reviewed': difference = b.place.listReviewCount - a.place.listReviewCount; break;
      case 'newest-reviewed': difference = (b.place.latestReviewAt?.getTime() ?? 0) - (a.place.latestReviewAt?.getTime() ?? 0); break;
    }
    return difference || a.index - b.index;
  });
  return decorated.map(item => item.place);
}

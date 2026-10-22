import type { RankedPlace } from './myList';

export type ListFilters = { search: string; cuisines?: string[]; cuisine?: string; area: string; minimumRating: number };
const normalized = (value: string) => value.trim().toLocaleLowerCase('en-AU');
const genericCategories = new Set(['restaurant', 'food & drink', 'food and drink', 'food', 'establishment', 'point of interest', 'other / unspecified', 'unknown', 'other', 'unspecified']);
export function listCuisines(place: RankedPlace['place']): string[] {
  const useful = (value?: string) => !!value?.trim() && !genericCategories.has(normalized(value));
  const metadata = useful(place.cuisine) ? place.cuisine! : useful(place.category) ? place.category : '';
  const labels = metadata.split(/[,;|/]/).map(value => value.trim()).filter(Boolean);
  return labels.length ? [...new Map(labels.map(value => [normalized(value), value])).values()] : ['Other / unspecified'];
}
export function filterPersonalList<T extends RankedPlace>(items: T[], filters: ListFilters): T[] {
  const search = normalized(filters.search);
  const cuisines = new Set((filters.cuisines ?? (filters.cuisine ? [filters.cuisine] : [])).map(normalized));
  // Preserve input order, references, and original global ranks. Never project rankings here.
  return items.filter(item => (!search || normalized(item.place.name).includes(search))
    && (!cuisines.size || listCuisines(item.place).some(value => cuisines.has(normalized(value))))
    && (!filters.area || normalized(item.place.area) === normalized(filters.area))
    && item.rating >= filters.minimumRating);
}

export function personalListOptions(items: RankedPlace[]) {
  const unique = (values: string[]) => [...new Map(values.filter(value => value.trim()).map(value => [normalized(value), value.trim()])).values()]
    .sort((a, b) => a.localeCompare(b));
  return { cuisines: unique(items.flatMap(item => listCuisines(item.place))), areas: unique(items.map(item => item.place.area)) };
}

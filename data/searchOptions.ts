export const CUISINE_OPTIONS = [
  'All cuisines', 'Japanese', 'Chinese', 'Korean', 'Thai', 'Vietnamese', 'Italian',
  'Mexican', 'Indian', 'Burgers', 'Pizza', 'Cafe', 'Dessert', 'French', 'Greek', 'Seafood',
] as const;

// Includes Sydney suburbs represented by the mock data and useful nearby search areas.
export const AREA_OPTIONS = [
  'All areas', 'Sydney CBD', 'Surry Hills', 'Newtown', 'Barangaroo', 'Haymarket',
  'Chatswood', 'Crows Nest', 'St Leonards', 'Pyrmont', 'Darling Harbour',
  'Bondi', 'Paddington', 'Alexandria', 'Potts Point',
] as const;

export const DISTANCE_OPTIONS = [
  { label: 'Any distance', km: undefined },
  { label: 'Within 1 km', km: 1 },
  { label: 'Within 3 km', km: 3 },
  { label: 'Within 5 km', km: 5 },
  { label: 'Within 10 km', km: 10 },
  { label: 'Within 15 km', km: 15 },
] as const;

// Fallback center when current device/browser location is unavailable or denied.
export const DEFAULT_SEARCH_ORIGIN = { latitude: -33.8688, longitude: 151.2093, label: 'Sydney CBD' };

export const CUISINE_TERMS: Record<string, string[]> = {
  Japanese: ['japanese', 'sushi', 'ramen', 'izakaya', 'udon', 'tempura'],
  Chinese: ['chinese', 'cantonese', 'sichuan', 'dumpling'],
  Korean: ['korean', 'korean bbq'],
  Thai: ['thai'],
  Vietnamese: ['vietnamese', 'pho', 'banh mi'],
  Italian: ['italian', 'pizza', 'pasta', 'trattoria'],
  Mexican: ['mexican', 'taco', 'taqueria'],
  Indian: ['indian', 'curry'],
  Burgers: ['burger', 'hamburger'],
  Pizza: ['pizza', 'pizzeria'],
  Cafe: ['cafe', 'coffee', 'bakery', 'brunch'],
  Dessert: ['dessert', 'ice cream', 'gelato', 'patisserie'],
  French: ['french', 'bistro'],
  Greek: ['greek'],
  Seafood: ['seafood', 'fish'],
};

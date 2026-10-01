import * as Location from 'expo-location';

export type SearchOrigin = { latitude: number; longitude: number; label: string };
export type LocationAccessResult =
  | { status: 'granted'; origin: SearchOrigin }
  | { status: 'denied' | 'unavailable' };

/** Requests foreground-only access when the user chooses a distance filter. */
export async function requestSearchLocation(): Promise<LocationAccessResult> {
  try {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== 'granted') return { status: 'denied' };

    const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    return {
      status: 'granted',
      origin: {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        label: 'your location',
      },
    };
  } catch {
    // This also handles browser geolocation errors and unavailable device providers.
    return { status: 'unavailable' };
  }
}

import * as Location from 'expo-location';

import { BLUE_DOT_UPDATE_DISTANCE_M, BLUE_DOT_UPDATE_INTERVAL_S } from '@/shared/config';
import type { LocationFix, PermissionResult } from '@/state/locationStore';

const MS_PER_SECOND = 1000;

function toPermissionResult(response: Location.LocationPermissionResponse): PermissionResult {
  if (response.granted) return { permission: 'granted', canAskAgain: response.canAskAgain };
  return {
    permission: response.status === Location.PermissionStatus.UNDETERMINED ? 'undetermined' : 'denied',
    canAskAgain: response.canAskAgain,
  };
}

function toFix(location: Location.LocationObject): LocationFix {
  const { coords } = location;
  return {
    lat: coords.latitude,
    lon: coords.longitude,
    accuracyM: coords.accuracy,
    headingDeg: coords.heading,
    speedMps: coords.speed,
    timestampMs: location.timestamp,
    mocked: location.mocked ?? false,
  };
}

// Reads the current foreground permission without showing a prompt
export async function checkLocationPermission(): Promise<PermissionResult> {
  return toPermissionResult(await Location.getForegroundPermissionsAsync());
}

// Shows the system prompt. Foreground only: background location is never requested (app.json blocks it).
export async function askLocationPermission(): Promise<PermissionResult> {
  return toPermissionResult(await Location.requestForegroundPermissionsAsync());
}

// Starts foreground position updates and returns the function that stops them
export async function watchLocation(onFix: (fix: LocationFix) => void): Promise<() => void> {
  const subscription = await Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.High,
      timeInterval: BLUE_DOT_UPDATE_INTERVAL_S * MS_PER_SECOND,
      distanceInterval: BLUE_DOT_UPDATE_DISTANCE_M,
    },
    (location) => onFix(toFix(location)),
  );
  return () => subscription.remove();
}

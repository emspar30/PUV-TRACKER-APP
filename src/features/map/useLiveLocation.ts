import { useState } from 'react';
import { Linking } from 'react-native';

import { TILESET } from '@/data/map/tileset';
import { askLocationPermission } from '@/services/location';
import { boundsContainPoint } from '@/shared/geo/bounds';
import type { LatLon } from '@/shared/geo/haversine';
import { selectShowExplainer, useLocationStore, type LocationFix } from '@/state/locationStore';

import { useLocationTracking } from './useLocationTracking';

// Location on the Live tab, from the partner's GPS work (b21b0c1) in our structure: the blue dot,
// following it, "Locate me" behind the explainer on its first tap (PRD 4.2), and the manual origin
// pin by long-press when location is off. Foreground only; nothing is stored or sent.
// `onFollow` moves the camera to a new fix while following.
export function useLiveLocation(onFollow: (center: LatLon) => void) {
  useLocationTracking();

  const permission = useLocationStore((state) => state.permission);
  const canAskAgain = useLocationStore((state) => state.canAskAgain);
  const fix = useLocationStore((state) => state.fix);
  const explainer = useLocationStore((state) => state.explainer);
  const showExplainer = useLocationStore(selectShowExplainer);
  const acceptExplainer = useLocationStore((state) => state.acceptExplainer);
  const dismissExplainer = useLocationStore((state) => state.dismissExplainer);
  const reopenExplainer = useLocationStore((state) => state.reopenExplainer);
  const requestPermission = useLocationStore((state) => state.requestPermission);
  const setManualOrigin = useLocationStore((state) => state.setManualOrigin);

  // The camera follows the rider after "Locate me" until they move the map by hand
  const [following, setFollowing] = useState(false);
  const [followedFix, setFollowedFix] = useState<LocationFix | null>(null);

  const locationAllowed = permission === 'granted';
  const fixOnMap = fix !== null && boundsContainPoint(TILESET.bounds, fix);
  // The "location is off" notice appears only once the user has asked for location
  const reducedMode = (permission === 'undetermined' || permission === 'denied') && explainer !== 'idle' && !showExplainer;

  // Follow each new fix, while rendering rather than in an effect
  if (following && fixOnMap && fix !== followedFix) {
    setFollowedFix(fix);
    onFollow({ lat: fix.lat, lon: fix.lon });
  }

  const locateMe = () => {
    if (locationAllowed) {
      // A new follow starts from the current fix
      setFollowedFix(null);
      setFollowing(true);
      return;
    }
    // Android stops showing the prompt after repeated denials; Settings is then the only way
    if (permission === 'denied' && !canAskAgain) {
      void Linking.openSettings();
      return;
    }
    reopenExplainer();
  };

  const continueExplainer = () => {
    acceptExplainer();
    setFollowing(true);
    void requestPermission(askLocationPermission);
  };

  return {
    fix,
    following,
    fixOnMap,
    locationAllowed,
    canAskAgain,
    showExplainer,
    reducedMode,
    locateMe,
    continueExplainer,
    dismissExplainer,
    stopFollowing: () => setFollowing(false),
    setManualOrigin: (point: LatLon) => {
      if (!locationAllowed) setManualOrigin(point);
    },
  };
}

import { Layer } from '@maplibre/maplibre-react-native';
import { useMemo, type ComponentType } from 'react';

import { labelLayers } from '@/data/map/labelLayers';
import { useTheme } from '@/theme';

// The layer specs come from pure data (src/data/map/labelLayers.ts), typed loosely there
const SpecLayer = Layer as unknown as ComponentType<Record<string, unknown>>;

// City, barangay, road and street names (LB1b), as map layers on the offline tile source. OfflineMap
// draws them before its children, so the route lines, stops and vehicles sit on top. Dimming only
// changes their paint; the map style is not reloaded.
export function MapLabels({ dimmed }: { dimmed: boolean }) {
  const { mapLabels } = useTheme();
  const layers = useMemo(() => labelLayers(mapLabels, dimmed), [mapLabels, dimmed]);
  return (
    <>
      {layers.map((spec) => (
        <SpecLayer key={spec.id} {...spec} />
      ))}
    </>
  );
}

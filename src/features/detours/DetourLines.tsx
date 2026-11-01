import { GeoJSONSource, Layer } from '@maplibre/maplibre-react-native';
import type { FeatureCollection, LineString } from 'geojson';
import { useMemo } from 'react';

import { STOP_LAYER_ID } from '@/features/map/StopDots';
import { DETOUR_DASH, DETOUR_WIDTH } from '@/shared/config';
import type { Detour } from '@/shared/routing/detours';
import { useTheme } from '@/theme';

const SOURCE = 'detours';
const FLAT = { 'line-cap': 'butt', 'line-join': 'round' } as const;

// DT1 (PRD 10.5): the active detours, drawn dashed yellow under the stops. Rendered as a child of
// OfflineMap.
export function DetourLines({ detours }: { detours: readonly Detour[] }) {
  const { colors } = useTheme();
  const data = useMemo<FeatureCollection<LineString>>(
    () => ({
      type: 'FeatureCollection',
      features: detours.map((detour) => ({ type: 'Feature', id: detour.id, properties: { name: detour.name }, geometry: { type: 'LineString', coordinates: detour.coordinates } })),
    }),
    [detours],
  );
  if (detours.length === 0) return null;
  return (
    <>
      <GeoJSONSource id={SOURCE} data={data} />
      <Layer
        id={`${SOURCE}-line`}
        type="line"
        beforeId={STOP_LAYER_ID}
        source={SOURCE}
        layout={FLAT}
        paint={{ 'line-color': colors.warning, 'line-width': DETOUR_WIDTH, 'line-dasharray': [...DETOUR_DASH] }}
      />
    </>
  );
}

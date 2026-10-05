import { GeoJSONSource, Layer } from '@maplibre/maplibre-react-native';
import { useMemo } from 'react';

import { GLYPH_FONT_MEDIUM } from '@/data/map/glyphset';
import { vehicleMarkerFeatures } from '@/shared/telemetry/markers';
import type { VehicleSnapshot } from '@/shared/telemetry/vehicle';
import { MAP_GEOMETRY, spacing, useTheme } from '@/theme';

const POINTS = 'vehicles';
const CONES = 'vehicle-cones';

type VehicleMarkersProps = {
  vehicles: readonly VehicleSnapshot[];
  nowMs: number;
  // The route colour of the selected route
  color: string;
  // Camera zoom, so the heading cone keeps its size on screen
  zoom: number;
  // True when the style has local glyphs (LB1a); the plate labels need them
  labels: boolean;
  // The tapped vehicle, drawn larger with a halo (restyle)
  selectedId?: string | null;
  onPressVehicle?: (id: string) => void;
};

// Touch area around a marker, in dp
const HITBOX = { top: spacing.lg, right: spacing.lg, bottom: spacing.lg, left: spacing.lg };

// Vehicle markers (AF3, restyle): a dot in the route colour with a ring in its seat-tier colour, a
// heading cone, a white centre while stopped, greyed while Stale, and the plate beside it ("DEMO 01"
// on simulated vehicles). Tapping one selects it; the selected one has a halo.
// The two sources keep their ids, so each refresh only replaces their data; the layers are never remounted.
export function VehicleMarkers({ vehicles, nowMs, color, zoom, labels, selectedId = null, onPressVehicle }: VehicleMarkersProps) {
  const { mapPaint, colors, baseMap } = useTheme();
  const g = MAP_GEOMETRY.vehicle;
  const data = useMemo(
    () => vehicleMarkerFeatures(vehicles, nowMs, { lengthPx: g.coneLengthPx, halfAngleDeg: g.coneHalfAngleDeg, zoom }),
    [vehicles, nowMs, zoom, g.coneLengthPx, g.coneHalfAngleDeg],
  );

  // Paints are built once per theme and colour, so a refresh does not touch them
  const paints = useMemo(() => {
    const fill = ['case', ['get', 'stale'], mapPaint.stale, color];
    const tier = ['match', ['get', 'tier'], 'green', mapPaint.occupancyGreen, 'amber', mapPaint.occupancyAmber, mapPaint.occupancyRed];
    const fade = ['case', ['get', 'stale'], g.staleOpacity, 1];
    return {
      cone: { 'fill-color': fill, 'fill-opacity': ['*', fade, g.coneOpacity] },
      dot: {
        'circle-radius': g.radius,
        'circle-color': fill,
        'circle-opacity': fade,
        'circle-stroke-color': tier,
        'circle-stroke-width': g.ringWidth,
        'circle-stroke-opacity': fade,
      },
      stopped: { 'circle-radius': g.stoppedRadius, 'circle-color': mapPaint.locationDotStroke, 'circle-opacity': fade },
      badge: {
        layout: {
          'text-field': ['get', 'label'],
          'text-font': [GLYPH_FONT_MEDIUM],
          'text-size': g.badgeTextSize,
          'text-offset': [g.badgeOffsetEm, 0],
          'text-anchor': 'left',
          'text-allow-overlap': false,
          'text-optional': true,
        },
        paint: { 'text-color': colors.textPrimary, 'text-halo-color': baseMap.land, 'text-halo-width': g.badgeHalo, 'text-opacity': fade },
      },
    };
  }, [mapPaint, colors.textPrimary, baseMap.land, color, g]);

  return (
    <>
      <GeoJSONSource id={CONES} data={data.cones}>
        <Layer id={`${CONES}-fill`} type="fill" paint={paints.cone as never} />
      </GeoJSONSource>
      <GeoJSONSource
        id={POINTS}
        data={data.points}
        hitbox={HITBOX}
        onPress={
          onPressVehicle
            ? (event) => {
                const id: unknown = event.nativeEvent.features[0]?.properties?.id;
                if (typeof id === 'string') onPressVehicle(id);
              }
            : undefined
        }
      >
        <Layer
          id={`${POINTS}-halo`}
          type="circle"
          filter={['==', ['get', 'id'], selectedId ?? ''] as never}
          paint={{ 'circle-radius': g.selectedHaloRadius, 'circle-color': color, 'circle-opacity': g.selectedHaloOpacity } as never}
        />
        <Layer id={`${POINTS}-dot`} type="circle" paint={paints.dot as never} />
        <Layer id={`${POINTS}-stopped`} type="circle" filter={['get', 'stopped'] as never} paint={paints.stopped as never} />
        {labels ? (
          <Layer
            id={`${POINTS}-label`}
            type="symbol"
            layout={paints.badge.layout as never}
            paint={paints.badge.paint as never}
          />
        ) : null}
      </GeoJSONSource>
    </>
  );
}

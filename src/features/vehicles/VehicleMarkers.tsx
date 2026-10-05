import { GeoJSONSource, Images, Layer } from '@maplibre/maplibre-react-native';
import { useMemo } from 'react';

import { GLYPH_FONT_MEDIUM } from '@/data/map/glyphset';
import { vehicleMarkerFeatures } from '@/shared/telemetry/markers';
import type { VehicleSnapshot } from '@/shared/telemetry/vehicle';
import { MAP_GEOMETRY, spacing, useTheme } from '@/theme';

const POINTS = 'vehicles';
const ICON = 'puv';
const ICON_IMAGES = { [ICON]: require('../../../assets/map/puv.png') };

type VehicleMarkersProps = {
  vehicles: readonly VehicleSnapshot[];
  nowMs: number;
  // The route colour of the selected route: the halo of the tapped vehicle
  color: string;
  // Camera zoom: unused since the icon replaced the cone (it keeps its size on screen by itself)
  zoom?: number;
  // True when the style has local glyphs (LB1a); the plate labels need them
  labels: boolean;
  // The tapped vehicle, drawn with a halo (restyle)
  selectedId?: string | null;
  onPressVehicle?: (id: string) => void;
  // While one vehicle is tracked (L2) the others fade to this opacity
  othersOpacity?: number;
};

// Touch area around a marker, in dp
const HITBOX = { top: spacing.lg, right: spacing.lg, bottom: spacing.lg, left: spacing.lg };

// Vehicle markers (AF3, Live map pass): a multicab seen from above, rotated to its heading, so the
// way it is going reads at a glance. Its dark body with a white edge stands apart from the route
// line. Behind it, a soft halo in the seat-tier colour; greyed while Stale; the plate beside it
// ("DEMO 01" on simulated vehicles). Tapping one selects it; the selected one has a route-colour halo.
// The source keeps its id, so each refresh only replaces its data; the layers are never remounted.
export function VehicleMarkers({ vehicles, nowMs, color, labels, selectedId = null, onPressVehicle, othersOpacity = 1 }: VehicleMarkersProps) {
  const { mapPaint, colors, baseMap } = useTheme();
  const g = MAP_GEOMETRY.vehicle;
  // Points only: they do not depend on the zoom, so zooming never re-sends the vehicles to the map
  const points = useMemo(
    () => vehicleMarkerFeatures(vehicles, nowMs, { lengthPx: g.coneLengthPx, halfAngleDeg: g.coneHalfAngleDeg, zoom: 0 }).points,
    [vehicles, nowMs, g.coneLengthPx, g.coneHalfAngleDeg],
  );

  // Paints are built once per theme and colour, so a refresh does not touch them
  const paints = useMemo(() => {
    const tier = ['case', ['get', 'stale'], mapPaint.stale, ['match', ['get', 'tier'], 'green', mapPaint.occupancyGreen, 'amber', mapPaint.occupancyAmber, mapPaint.occupancyRed]];
    // Stale vehicles are greyed; while one is tracked, the others fade too
    const fade = [
      '*',
      ['case', ['get', 'stale'], g.staleOpacity, 1],
      ['case', ['==', ['get', 'id'], selectedId ?? ''], 1, othersOpacity],
    ];
    return {
      halo: {
        'circle-radius': g.tierHaloRadius,
        'circle-color': tier,
        'circle-opacity': ['*', fade, g.tierHaloOpacity],
        'circle-stroke-color': tier,
        'circle-stroke-width': g.tierHaloStroke,
        'circle-stroke-opacity': fade,
      },
      icon: {
        layout: {
          'icon-image': ICON,
          'icon-size': g.iconSize,
          'icon-rotate': ['get', 'heading'],
          'icon-rotation-alignment': 'map',
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
        },
        paint: { 'icon-opacity': fade },
      },
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
  }, [mapPaint, colors.textPrimary, baseMap.land, g, selectedId, othersOpacity]);

  return (
    <>
      <Images images={ICON_IMAGES} />
      <GeoJSONSource
        id={POINTS}
        data={points}
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
          id={`${POINTS}-selected`}
          type="circle"
          filter={['==', ['get', 'id'], selectedId ?? ''] as never}
          paint={{ 'circle-radius': g.selectedHaloRadius + spacing.xs, 'circle-color': color, 'circle-opacity': g.selectedHaloOpacity } as never}
        />
        <Layer id={`${POINTS}-halo`} type="circle" paint={paints.halo as never} />
        <Layer id={`${POINTS}-icon`} type="symbol" layout={paints.icon.layout as never} paint={paints.icon.paint as never} />
        {labels ? <Layer id={`${POINTS}-label`} type="symbol" layout={paints.badge.layout as never} paint={paints.badge.paint as never} /> : null}
      </GeoJSONSource>
    </>
  );
}

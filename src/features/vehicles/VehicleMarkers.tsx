import { GeoJSONSource, Images, Layer } from '@maplibre/maplibre-react-native';
import { useMemo } from 'react';

import { GLYPH_FONT_MEDIUM } from '@/data/map/glyphset';
import type { LineCoordinates } from '@/shared/geo/line';
import { vehicleMarkerFeatures } from '@/shared/telemetry/markers';
import type { VehicleSnapshot } from '@/shared/telemetry/vehicle';
import type { StatusRelay } from '@/shared/telemetry/vehicleStatus';
import { strings } from '@/strings';
import { MAP_GEOMETRY, spacing, useTheme } from '@/theme';

import { useGhostClock } from './useGhostClock';

const POINTS = 'vehicles';
const ICON = 'puv';
const ICON_IMAGES = {
  [ICON]: require('../../../assets/map/puv.png'),
  'status-stopped': require('../../../assets/map/status-stopped.png'),
  'status-loading': require('../../../assets/map/status-loading.png'),
  'status-traffic': require('../../../assets/map/status-traffic.png'),
};

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
  // CF1: a vehicle's line by its id, so an Estimated marker moves along it
  lineOf?: (lineId: string) => LineCoordinates | undefined;
  // VS1: recent relays naming a multicab, for its status mark
  relays?: readonly StatusRelay[];
};

const NO_RELAYS: readonly StatusRelay[] = [];

// Touch area around a marker, in dp
const HITBOX = { top: spacing.lg, right: spacing.lg, bottom: spacing.lg, left: spacing.lg };

// Vehicle markers (AF3, Live map pass): a multicab seen from above, rotated to its heading, so the
// way it is going reads at a glance. Its dark body with a white edge stands apart from the route
// line. Behind it, a soft halo in the seat-tier colour; greyed while Stale; the plate beside it
// ("DEMO 01" on simulated vehicles). Tapping one selects it; the selected one has a route-colour halo.
// CF1: a vehicle silent for 90 s to 5 minutes moves along its line at its recent speed, fainter,
// with "Estimated" after its plate; positions are worked out every second while one shows.
// VS1: a mark at the top right says Stopped, Loading passengers or Heavy traffic, each its own shape.
// The source keeps its id, so each refresh only replaces its data; the layers are never remounted.
export function VehicleMarkers({ vehicles, nowMs, color, labels, selectedId = null, onPressVehicle, othersOpacity = 1, lineOf, relays = NO_RELAYS }: VehicleMarkersProps) {
  const { mapPaint, colors, baseMap } = useTheme();
  const g = MAP_GEOMETRY.vehicle;
  const clockMs = useGhostClock(vehicles, nowMs);
  // Points only: they do not depend on the zoom, so zooming never re-sends the vehicles to the map
  const points = useMemo(
    () => vehicleMarkerFeatures(vehicles, clockMs, { lengthPx: g.coneLengthPx, halfAngleDeg: g.coneHalfAngleDeg, zoom: 0 }, lineOf, relays).points,
    [vehicles, clockMs, g.coneLengthPx, g.coneHalfAngleDeg, lineOf, relays],
  );

  // Paints are built once per theme and colour, so a refresh does not touch them
  const paints = useMemo(() => {
    const tier = ['case', ['get', 'stale'], mapPaint.stale, ['match', ['get', 'tier'], 'green', mapPaint.occupancyGreen, 'amber', mapPaint.occupancyAmber, mapPaint.occupancyRed]];
    // Stale vehicles are greyed, Estimated ones fainter still; while one is tracked, the others fade too
    const fade = [
      '*',
      ['case', ['get', 'ghost'], g.ghostOpacity, ['get', 'stale'], g.staleOpacity, 1],
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
      status: {
        layout: {
          'icon-image': ['match', ['get', 'status'], 'stopped', 'status-stopped', 'loading', 'status-loading', 'status-traffic'],
          'icon-size': g.statusIconSize,
          'icon-offset': g.statusOffsetPx,
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
        },
        paint: { 'icon-opacity': fade },
      },
      badge: {
        layout: {
          'text-field': ['case', ['get', 'ghost'], ['concat', ['get', 'label'], strings.live.vehicle.estimatedSuffix], ['get', 'label']],
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
        <Layer
          id={`${POINTS}-status`}
          type="symbol"
          filter={['!=', ['get', 'status'], 'moving'] as never}
          layout={paints.status.layout as never}
          paint={paints.status.paint as never}
        />
        {labels ? <Layer id={`${POINTS}-label`} type="symbol" layout={paints.badge.layout as never} paint={paints.badge.paint as never} /> : null}
      </GeoJSONSource>
    </>
  );
}

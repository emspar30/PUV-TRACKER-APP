import { GeoJSONSource, Layer, type LineLayerSpecification } from '@maplibre/maplibre-react-native';
import type { Feature, FeatureCollection, LineString } from 'geojson';
import { Fragment, useMemo } from 'react';

import type { DirectedLine as RouteLine, RouteDirection } from '@/shared/routing/types';
import { directionArrows } from '@/shared/geo/arrows';
import { returnStyledIds } from '@/shared/ui/routeVisibility';
import { MAP_GEOMETRY, useTheme } from '@/theme';

type LinePaint = NonNullable<LineLayerSpecification['paint']>;
type ZoomStops = readonly (readonly [zoom: number, size: number])[];

const ROUND = { 'line-cap': 'round', 'line-join': 'round' } as const;
const FLAT = { 'line-cap': 'butt', 'line-join': 'round' } as const;

// A size that grows with zoom: [zoom, size] stops, scaled and padded
function zoomRamp(stops: ZoomStops, scale = 1, extra = 0): LinePaint['line-width'] {
  const flat = stops.flatMap(([zoom, size]) => [zoom, size * scale + extra]);
  return ['interpolate', ['linear'], ['zoom'], ...flat] as unknown as LinePaint['line-width'];
}

function arrowCollection(line: RouteLine, sizeM: number, spacingM: number): FeatureCollection<LineString> {
  const arrows = directionArrows(line.coordinates, {
    sizeM,
    spacingM,
    wingAngleDeg: MAP_GEOMETRY.arrowWingAngleDeg,
    startOffsetM: spacingM * MAP_GEOMETRY.arrowStartFraction[line.direction],
  });
  return {
    type: 'FeatureCollection',
    features: arrows.map((coordinates) => ({
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates },
    })),
  };
}

type RouteLinesProps = {
  lines: RouteLine[];
  // Directions to draw; a direction that is switched off is not drawn at all
  visible: Record<RouteDirection, boolean>;
  // Opacity per line id (UX3: other routes are faint); lines not listed are drawn at full opacity
  opacity?: Readonly<Record<string, number>>;
};

// Draws each directed route line with an outline in the map colour, in its route colour, with direction arrows.
// The return direction is a lighter band with dashes. Rendered as a child of OfflineMap.
// Layers are added in this order, bottom to top: outlines, lines, return dashes, arrows.
export function RouteLines({ lines, visible, opacity }: RouteLinesProps) {
  const { mapRoute, routeColor } = useTheme();
  // The stored route colour in dark mode; a colour readable on the light map in light mode
  const colorOf = (line: RouteLine) => routeColor(line.routeCode, line.color);
  // Keep the GeoJSON objects stable between renders so the map does not reload them
  const prepared = useMemo(
    () =>
      lines.map((line) => ({
        line,
        source: `route-${line.id}`,
        feature: {
          type: 'Feature',
          properties: {},
          geometry: { type: 'LineString', coordinates: line.coordinates },
        } satisfies Feature<LineString>,
        arrowBands: MAP_GEOMETRY.arrowBands.map((band, index) => ({
          band,
          source: `route-${line.id}-arrows-${index}`,
          data: arrowCollection(line, band.sizeM, band.spacingM),
        })),
      })),
    [lines],
  );

  const shown = prepared.filter(({ line }) => visible[line.direction]);
  // The return style only for a return beside its outbound; a single stored leg draws solid (RR1)
  const returnStyled = useMemo(() => returnStyledIds(lines), [lines]);
  const isReturn = (line: RouteLine) => returnStyled.has(line.id);
  const alpha = (line: RouteLine) => opacity?.[line.id] ?? 1;

  return (
    <>
      {shown.map(({ line, source, feature, arrowBands }) => (
        <Fragment key={source}>
          <GeoJSONSource id={source} data={feature} />
          {arrowBands.map((arrows) => (
            <GeoJSONSource key={arrows.source} id={arrows.source} data={arrows.data} />
          ))}
        </Fragment>
      ))}

      {shown.map(({ line, source }) => (
        <Layer
          key={`${source}-casing`}
          id={`${source}-casing`}
          type="line"
          source={source}
          layout={ROUND}
          paint={{
            'line-color': mapRoute.casingColor,
            'line-opacity': alpha(line),
            'line-width': zoomRamp(mapRoute.lineWidthStops, 1, mapRoute.casingExtraWidth),
          }}
        />
      ))}

      {shown.map(({ line, source }) => (
        <Layer
          key={`${source}-line`}
          id={`${source}-line`}
          type="line"
          source={source}
          layout={ROUND}
          paint={{
            'line-color': colorOf(line),
            'line-opacity': (isReturn(line) ? mapRoute.returnBandOpacity : 1) * alpha(line),
            'line-width': zoomRamp(mapRoute.lineWidthStops),
          }}
        />
      ))}

      {shown
        .filter(({ line }) => isReturn(line))
        .map(({ line, source }) => (
          <Layer
            key={`${source}-dashes`}
            id={`${source}-dashes`}
            type="line"
            source={source}
            layout={FLAT}
            paint={{
              'line-color': mapRoute.returnDashColor,
              'line-opacity': alpha(line),
              'line-width': zoomRamp(mapRoute.lineWidthStops, mapRoute.returnDashWidthRatio),
              'line-dasharray': [...mapRoute.returnDashPattern],
            }}
          />
        ))}

      {shown.flatMap(({ line, arrowBands }) =>
        arrowBands.flatMap(({ band, source }) => [
          <Layer
            key={`${source}-casing`}
            id={`${source}-casing`}
            type="line"
            source={source}
            minzoom={band.minZoom}
            maxzoom={band.maxZoom}
            layout={ROUND}
            paint={{
              'line-color': mapRoute.casingColor,
              'line-opacity': alpha(line),
              'line-width': zoomRamp(mapRoute.arrowWidthStops, 1, mapRoute.casingExtraWidth),
            }}
          />,
          <Layer
            key={`${source}-arrow`}
            id={`${source}-arrow`}
            type="line"
            source={source}
            minzoom={band.minZoom}
            maxzoom={band.maxZoom}
            layout={ROUND}
            paint={{
              'line-color': isReturn(line) ? mapRoute.returnArrowColor : colorOf(line),
              'line-opacity': alpha(line),
              'line-width': zoomRamp(mapRoute.arrowWidthStops),
            }}
          />,
        ]),
      )}
    </>
  );
}

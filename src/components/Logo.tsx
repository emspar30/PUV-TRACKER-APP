import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { useTheme } from '@/theme';

type LogoProps = {
  size: number;
};

// Placeholder brand mark, drawn as vectors in the theme colours: a route line with three stops
// on a rounded tile. Used inside the app; the launcher icon and native splash are separate image
// files that only change with a native rebuild.
export function Logo({ size }: LogoProps) {
  const { colors, mapPaint } = useTheme();
  return (
    <Svg width={size} height={size} viewBox="0 0 96 96" accessibilityRole="image">
      <Rect x={0} y={0} width={96} height={96} rx={24} fill={colors.primaryContainer} />
      <Path
        d="M20 68 C 34 68, 34 40, 48 40 S 62 28, 76 28"
        stroke={colors.primary}
        strokeWidth={8}
        strokeLinecap="round"
        fill="none"
      />
      <Circle cx={20} cy={68} r={8} fill={mapPaint.stop} stroke={mapPaint.stopStroke} strokeWidth={3} />
      <Circle cx={48} cy={40} r={6} fill={mapPaint.stop} stroke={mapPaint.stopStroke} strokeWidth={3} />
      <Circle cx={76} cy={28} r={8} fill={mapPaint.stopSelected} stroke={mapPaint.stopStroke} strokeWidth={3} />
    </Svg>
  );
}

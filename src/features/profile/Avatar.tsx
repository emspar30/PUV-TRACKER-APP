import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { colors } from '@/theme';

// Twelve preset avatars: four simple shapes in three colours. They are drawings, not photos;
// there is no upload. The choice is stored on the phone and shown only on the Profile screen.
const SHAPES = ['circle', 'square', 'triangle', 'diamond'] as const;
const TINTS = [colors.cyan, colors.amber, colors.emerald] as const;

export const AVATAR_COUNT = SHAPES.length * TINTS.length;
export const AVATAR_IDS = Array.from({ length: AVATAR_COUNT }, (_, id) => id);

type AvatarProps = {
  id: number;
  size: number;
};

export function Avatar({ id, size }: AvatarProps) {
  const safeId = Number.isInteger(id) && id >= 0 && id < AVATAR_COUNT ? id : 0;
  const shape = SHAPES[safeId % SHAPES.length];
  const tint = TINTS[Math.floor(safeId / SHAPES.length)];

  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" accessibilityRole="image">
      <Circle cx={32} cy={32} r={32} fill={colors.canvas} />
      {shape === 'circle' ? <Circle cx={32} cy={32} r={16} fill={tint} /> : null}
      {shape === 'square' ? <Rect x={17} y={17} width={30} height={30} rx={6} fill={tint} /> : null}
      {shape === 'triangle' ? <Path d="M32 14 L50 46 L14 46 Z" fill={tint} strokeLinejoin="round" /> : null}
      {shape === 'diamond' ? <Path d="M32 12 L52 32 L32 52 L12 32 Z" fill={tint} strokeLinejoin="round" /> : null}
    </Svg>
  );
}

import { Image } from 'react-native';

import { radii } from '@/theme';

type LogoProps = {
  size: number;
};

// The Tunton app logo (Emjay, 2026-10-05). The launcher icon and the native splash use the same
// image after the next native rebuild (app.json change, approved separately).
const LOGO = require('../../assets/Tunton APP logo.png');
// The image is a rounded tile; this rounds the corners a little more at small sizes
const CORNER_SHARE = 0.22;

export function Logo({ size }: LogoProps) {
  return (
    <Image
      source={LOGO}
      style={{ width: size, height: size, borderRadius: Math.min(radii.lg, size * CORNER_SHARE) }}
      accessibilityRole="image"
      accessibilityLabel="Tunton"
    />
  );
}

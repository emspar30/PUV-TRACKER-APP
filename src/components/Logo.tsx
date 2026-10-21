import { Image } from 'react-native';

import { radii, useTheme } from '@/theme';

type LogoProps = {
  size: number;
};

// The Tunton logo (Emjay). CA1.1 (2026-10-22): it follows the app's theme, so it stands out from the
// page: the dark tile with a light bus on the light theme, the light tile with a dark bus on the dark
// theme (256 px copies in assets/logo of tunton-icon.png and tunton-icon-light.png). The launcher icon
// cannot follow a theme on Android; the native splash does, by the phone's own dark mode (app.json).
const LOGOS = {
  light: require('../../assets/logo/tunton-dark.png'),
  dark: require('../../assets/logo/tunton-light.png'),
} as const;
// The image is a rounded tile; this rounds the corners a little more at small sizes
const CORNER_SHARE = 0.22;

export function Logo({ size }: LogoProps) {
  const { scheme } = useTheme();
  return (
    <Image
      source={LOGOS[scheme]}
      style={{ width: size, height: size, borderRadius: Math.min(radii.lg, size * CORNER_SHARE) }}
      accessibilityRole="image"
      accessibilityLabel="Tunton"
    />
  );
}

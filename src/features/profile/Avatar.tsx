import type { ReactNode } from 'react';
import Svg, { Circle, ClipPath, Defs, G, Path, Rect } from 'react-native-svg';

import { AVATAR_ART } from '@/theme/tokens';

// Twelve preset avatars, drawn in code: no photos and no upload (PRD 19, D3). Ids 0 to 5 form the
// set for "Male" and 6 to 11 the set for "Female"; "Prefer not to say" uses all twelve. Hair,
// accessories, skin tone and colours vary across both sets. The avatar is shown only to the user.

type Hair = 'short' | 'buzz' | 'curly' | 'bun' | 'side' | 'long' | 'ponytail' | 'bob' | 'pixie' | 'curlyLong' | 'cap';
type Extra = 'glasses' | 'headphones' | null;
type Outfit = keyof typeof AVATAR_ART.outfits;
type HairColour = keyof typeof AVATAR_ART.hair;

type AvatarSpec = { skin: 0 | 1 | 2 | 3; hair: Hair; hairColour: HairColour; outfit: Outfit; extra: Extra };

// Index = avatar id. The sets are AVATAR_IDS_MALE and AVATAR_IDS_FEMALE in the config.
const SPECS: readonly AvatarSpec[] = [
  { skin: 0, hair: 'short', hairColour: 'black', outfit: 'teal', extra: null },
  { skin: 1, hair: 'curly', hairColour: 'darkBrown', outfit: 'amber', extra: 'glasses' },
  { skin: 2, hair: 'cap', hairColour: 'black', outfit: 'blue', extra: null },
  { skin: 3, hair: 'bun', hairColour: 'black', outfit: 'green', extra: null },
  { skin: 1, hair: 'buzz', hairColour: 'grey', outfit: 'purple', extra: 'glasses' },
  { skin: 2, hair: 'side', hairColour: 'brown', outfit: 'rose', extra: 'headphones' },
  { skin: 0, hair: 'long', hairColour: 'black', outfit: 'orange', extra: null },
  { skin: 3, hair: 'pixie', hairColour: 'darkBrown', outfit: 'teal', extra: 'glasses' },
  { skin: 1, hair: 'ponytail', hairColour: 'brown', outfit: 'blue', extra: null },
  { skin: 2, hair: 'bob', hairColour: 'black', outfit: 'amber', extra: null },
  { skin: 3, hair: 'curlyLong', hairColour: 'black', outfit: 'green', extra: null },
  { skin: 0, hair: 'cap', hairColour: 'darkBrown', outfit: 'purple', extra: 'headphones' },
];


// Hair drawn behind the head (long styles)
function backHair(hair: Hair, colour: string): ReactNode {
  switch (hair) {
    case 'long':
      return <Path d="M19 28 C19 16 25 13 32 13 C39 13 45 16 45 28 L46 47 C41 49 23 49 18 47 Z" fill={colour} />;
    case 'bob':
      return <Path d="M19 27 C19 16 25 13 32 13 C39 13 45 16 45 27 L45 38 C42 39 41 38 40 36 L24 36 C23 38 22 39 19 38 Z" fill={colour} />;
    case 'ponytail':
      return <Path d="M40 17 C50 19 51 34 45 42 C46 33 44 25 39 21 Z" fill={colour} />;
    case 'curlyLong':
      return (
        <G fill={colour}>
          <Circle cx={20} cy={25} r={6} />
          <Circle cx={21} cy={35} r={6} />
          <Circle cx={44} cy={25} r={6} />
          <Circle cx={43} cy={35} r={6} />
        </G>
      );
    default:
      return null;
  }
}

// Hair or headwear drawn over the head
function frontHair(hair: Hair, colour: string): ReactNode {
  switch (hair) {
    case 'short':
    case 'ponytail':
      return <Path d="M21 27 C21 18 26 14 32 14 C38 14 43 18 43 27 C40 22 36 20 32 20 C28 20 24 22 21 27 Z" fill={colour} />;
    case 'buzz':
      return <Path d="M22 24 C23 18 27 16 32 16 C37 16 41 18 42 24 C38 21 26 21 22 24 Z" fill={colour} />;
    case 'curly':
      return (
        <G fill={colour}>
          <Circle cx={24} cy={20} r={5} />
          <Circle cx={30} cy={16} r={5} />
          <Circle cx={36} cy={16} r={5} />
          <Circle cx={41} cy={21} r={5} />
          <Circle cx={22} cy={26} r={3.5} />
          <Circle cx={42} cy={27} r={3.5} />
        </G>
      );
    case 'curlyLong':
      return (
        <G fill={colour}>
          <Circle cx={25} cy={18} r={6} />
          <Circle cx={32} cy={15} r={6} />
          <Circle cx={39} cy={18} r={6} />
        </G>
      );
    case 'bun':
      return (
        <G fill={colour}>
          <Circle cx={32} cy={11} r={5} />
          <Path d="M21 27 C21 18 26 14 32 14 C38 14 43 18 43 27 C40 22 36 20 32 20 C28 20 24 22 21 27 Z" />
        </G>
      );
    case 'side':
    case 'pixie':
      return <Path d="M20 28 C20 17 27 13 34 14 C40 15 44 20 44 27 C40 21 33 19 26 23 C24 24 22 26 20 28 Z" fill={colour} />;
    case 'long':
    case 'bob':
      return <Path d="M21 26 C21 18 26 14 32 14 C38 14 43 18 43 26 C38 21 26 21 21 26 Z" fill={colour} />;
    case 'cap':
      return (
        <G>
          <Path d="M21 27 C21 22 23 20 25 20 L39 20 C41 20 43 22 43 27 Z" fill={colour} />
          <Path d="M20 22 C20 15 26 12 32 12 C38 12 44 15 44 22 Z" fill={AVATAR_ART.cap} />
          <Rect x={30} y={20} width={20} height={3.5} rx={1.75} fill={AVATAR_ART.cap} />
        </G>
      );
  }
}

function extraFor(extra: Extra): ReactNode {
  if (extra === 'glasses') {
    return (
      <G stroke={AVATAR_ART.ink} strokeWidth={1.2} fill="none">
        <Circle cx={27.5} cy={28} r={3.5} />
        <Circle cx={36.5} cy={28} r={3.5} />
        <Path d="M31 28 L33 28" />
      </G>
    );
  }
  if (extra === 'headphones') {
    return (
      <G fill={AVATAR_ART.ink}>
        <Path d="M19 29 C19 13 45 13 45 29" stroke={AVATAR_ART.ink} strokeWidth={2.5} fill="none" />
        <Rect x={16.5} y={25} width={5} height={9} rx={2} />
        <Rect x={42.5} y={25} width={5} height={9} rx={2} />
      </G>
    );
  }
  return null;
}

type AvatarProps = {
  id: number;
  size: number;
};

export function Avatar({ id, size }: AvatarProps) {
  const safeId = Number.isInteger(id) && id >= 0 && id < SPECS.length ? id : 0;
  const spec = SPECS[safeId];
  const [shirt, background] = AVATAR_ART.outfits[spec.outfit];
  const skin = AVATAR_ART.skin[spec.skin];
  const hairColour = AVATAR_ART.hair[spec.hairColour];
  const clipId = `avatar-clip-${safeId}`;

  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" accessibilityRole="image">
      <Defs>
        <ClipPath id={clipId}>
          <Circle cx={32} cy={32} r={32} />
        </ClipPath>
      </Defs>
      <G clipPath={`url(#${clipId})`}>
        <Circle cx={32} cy={32} r={32} fill={background} />
        {backHair(spec.hair, hairColour)}
        <Path d="M12 66 C12 51 21 44 32 44 C43 44 52 51 52 66 Z" fill={shirt} />
        <Rect x={28} y={35} width={8} height={10} rx={3} fill={skin} />
        <Circle cx={32} cy={28} r={11} fill={skin} />
        <Circle cx={27.5} cy={28} r={1.4} fill={AVATAR_ART.ink} />
        <Circle cx={36.5} cy={28} r={1.4} fill={AVATAR_ART.ink} />
        <Path d="M28.5 33 Q32 35.5 35.5 33" stroke={AVATAR_ART.ink} strokeWidth={1.4} strokeLinecap="round" fill="none" />
        {frontHair(spec.hair, hairColour)}
        {extraFor(spec.extra)}
      </G>
    </Svg>
  );
}

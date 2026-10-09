import { Image } from 'react-native';

import { AVATAR_COUNT } from '@/shared/config';

// The preset avatars (PRD 19, D3): no photos and no upload. ST2-C: Emjay's illustrations
// (assets/profile avatars, trimmed to 256 px in assets/avatars). Ids 0 to 10 form the set for
// "Male" and 11 to 15 the set for "Female"; "Prefer not to say" uses all of them. The avatar is
// shown only to the user.

// Index = avatar id. The sets are AVATAR_IDS_MALE and AVATAR_IDS_FEMALE in the config.
const ART = [
  require('../../../assets/avatars/avatar-00.png'),
  require('../../../assets/avatars/avatar-01.png'),
  require('../../../assets/avatars/avatar-02.png'),
  require('../../../assets/avatars/avatar-03.png'),
  require('../../../assets/avatars/avatar-04.png'),
  require('../../../assets/avatars/avatar-05.png'),
  require('../../../assets/avatars/avatar-06.png'),
  require('../../../assets/avatars/avatar-07.png'),
  require('../../../assets/avatars/avatar-08.png'),
  require('../../../assets/avatars/avatar-09.png'),
  require('../../../assets/avatars/avatar-10.png'),
  require('../../../assets/avatars/avatar-11.png'),
  require('../../../assets/avatars/avatar-12.png'),
  require('../../../assets/avatars/avatar-13.png'),
  require('../../../assets/avatars/avatar-14.png'),
  require('../../../assets/avatars/avatar-15.png'),
] as const;

type AvatarProps = { id: number; size: number };

export function Avatar({ id, size }: AvatarProps) {
  const safeId = Number.isInteger(id) && id >= 0 && id < Math.min(AVATAR_COUNT, ART.length) ? id : 0;
  return <Image source={ART[safeId]} style={{ width: size, height: size, borderRadius: size / 2 }} accessibilityRole="image" />;
}

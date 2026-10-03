// The bottom tabs, in order (plan v2, Revision 2: three tabs; the fare is part of My Ride).
// Pure data so a unit test can check it; the tab layout adds the icons.

import { strings } from '../strings';

export const TAB_ROUTES = [
  { name: 'index', title: strings.tabs.live },
  { name: 'checkin', title: strings.tabs.checkin },
  { name: 'ride', title: strings.tabs.ride },
] as const;

export type TabRouteName = (typeof TAB_ROUTES)[number]['name'];

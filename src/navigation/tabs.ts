// The bottom tabs, in order (restyle 2026-10-05: Map, Check-in, My Rides, Crowdsource; the fare
// is part of My Rides).
// Pure data so a unit test can check it; the tab layout adds the icons.

import { strings } from '../strings';

export const TAB_ROUTES = [
  { name: 'index', title: strings.tabs.live },
  { name: 'checkin', title: strings.tabs.checkin },
  { name: 'ride', title: strings.tabs.ride },
  { name: 'crowdsource', title: strings.tabs.crowdsource },
] as const;

export type TabRouteName = (typeof TAB_ROUTES)[number]['name'];

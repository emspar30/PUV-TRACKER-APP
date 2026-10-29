import { useIsFocused } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';

import { useRouteData } from '@/data/RouteDataProvider';
import { DEMO_SEED } from '@/shared/config';
import { demoFeed, demoVehicleIdOf, type FeedPost } from '@/shared/demo/feed';
import type { StatusRelay } from '@/shared/telemetry/vehicleStatus';
import { routeCodesOf } from '@/shared/ui/routeVisibility';
import { useCrowd } from '@/state/crowdStore';
import { useSettingsStore } from '@/state/settingsStore';

// The feed is read again this often while the Map is in front, as the Crowdsource tab does
const REFRESH_MS = 30000;

// VS1: recent relays that name a multicab, for the status mark on its marker. Live: the server feed
// (live-map and Crowdsource relays alike). Demo: the made-up feed as well, its posts pointed at the
// demo multicabs they name. Read only while the Map is in front.
export function useVehicleRelays(): readonly StatusRelay[] {
  const focused = useIsFocused();
  const demo = useSettingsStore((state) => state.demoData);
  const { lines } = useRouteData();
  const crowd = useCrowd();
  const [state, setState] = useState<{ posts: readonly FeedPost[]; nowMs: number }>({ posts: [], nowMs: 0 });

  useEffect(() => {
    if (!focused) return undefined;
    let current = true;
    const load = () => {
      const nowMs = Date.now();
      crowd.reports
        .recent()
        .catch(() => null)
        .then((posts) => {
          if (current) setState({ posts: posts ?? [], nowMs });
        });
    };
    const first = setTimeout(load, 0);
    const timer = setInterval(load, REFRESH_MS);
    return () => {
      current = false;
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [focused, crowd]);

  return useMemo(() => {
    const made = demo && state.nowMs > 0 ? demoFeed(routeCodesOf(lines), state.nowMs, DEMO_SEED) : [];
    return [...state.posts, ...made]
      .filter((post) => post.vehicleId !== null && post.phrase !== null)
      .map((post) => ({ vehicleId: post.demo && post.vehicleId ? demoVehicleIdOf(post.vehicleId) : post.vehicleId, phrase: post.phrase, postedMs: post.postedMs }));
  }, [state, demo, lines]);
}

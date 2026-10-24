import { CircleCheck, Clock, RadioTower } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Vibration } from 'react-native';

import { RELAY_CAP_ANSWER_MIN, RELAY_CHECK_S, RELAY_HEARTBEAT_MIN, RELAY_SESSION_CAP_H } from '@/shared/config';
import type { LatLon } from '@/shared/geo/haversine';
import type { RelayBroadcast, RelayPost } from '@/shared/relay/broadcast';
import { askedWatch, capDue, idleLimitMin, relayEnd, watchRelay, type RelayEnd } from '@/shared/relay/limits';
import { endRelayPost, keepRelayPost } from '@/state/crowdStore';
import { showDialog } from '@/state/dialogStore';
import { useRelayStore } from '@/state/relayStore';
import { showToast } from '@/state/toastStore';
import { strings } from '@/strings';

const MS_PER_S = 1000;
const MS_PER_MIN = 60_000;
// While the arrival countdown runs, the clock is looked at every second so it ends on time
const COUNTDOWN_TICK_S = 1;

function endToast(end: RelayEnd, session: RelayBroadcast) {
  const t = strings.report;
  switch (end) {
    case 'arrived':
      return { icon: CircleCheck, title: t.arrivedTitle(session.destination.name), body: t.arrivedBody };
    case 'idle': {
      const idle = useRelayStore.getState().watch.idle;
      return { icon: RadioTower, title: t.idleTitle, body: t.idleBody(idle ? idleLimitMin(session, idle.at) : 0) };
    }
    case 'capped':
      return { icon: RadioTower, title: t.cappedTitle, body: t.cappedBody };
  }
}

// B4, RL1: keeps the relay's GPS sharing going until it ends by itself (shared/relay/limits): at the
// destination after the arrival countdown, after standing still (held in high-traffic zones), or
// when "Still riding?" gets no answer after the 3-hour cap. The watch is brought up to date with each
// position and every RELAY_CHECK_S (every second during the arrival countdown); the end comes with a
// short vibration and a toast. Returns the running session, or null.
// RL2a (D12): a Crowdsource relay's post is kept up by a "still riding" signal every
// RELAY_HEARTBEAT_MIN (no coordinates), and ended on the server when the relay ends, however it ends.
// If the battery runs out, no signal comes and the post lapses by itself.
export function useRelayBroadcast(position: LatLon | null): RelayBroadcast | null {
  const session = useRelayStore((store) => store.session);
  const watch = useRelayStore((store) => store.watch);
  const setWatch = useRelayStore((store) => store.setWatch);
  const renew = useRelayStore((store) => store.renew);
  const stop = useRelayStore((store) => store.stop);
  const [nowMs, setNowMs] = useState(Date.now);
  const arriving = watch.arrivingSinceMs !== null;

  useEffect(() => {
    if (!session) return undefined;
    const timer = setInterval(() => setNowMs(Date.now()), (arriving ? COUNTDOWN_TICK_S : RELAY_CHECK_S) * MS_PER_S);
    return () => clearInterval(timer);
  }, [session, arriving]);

  // A still phone gets no new fixes, so the same position is looked at again on each tick
  useEffect(() => {
    if (!session) return;
    setWatch(watchRelay(useRelayStore.getState().watch, session, position, Date.now()));
  }, [session, position, nowMs, setWatch]);

  const due = session !== null && capDue(watch, nowMs);
  useEffect(() => {
    if (!due) return;
    setWatch(askedWatch(useRelayStore.getState().watch, Date.now()));
    showDialog({
      tone: 'primary',
      icon: Clock,
      title: strings.report.stillRidingTitle,
      body: strings.report.stillRidingBody(RELAY_SESSION_CAP_H, RELAY_CAP_ANSWER_MIN),
      actions: [
        { label: strings.report.keepSharing, onPress: () => renew(Date.now()) },
        { label: strings.report.stopSharing, variant: 'secondary', onPress: stop },
      ],
    });
  }, [due, setWatch, renew, stop]);

  const post = session?.post ?? null;
  useEffect(() => {
    if (!post) return undefined;
    const timer = setInterval(() => {
      void keepRelayPost(post).then((up) => {
        // The server no longer keeps it (hidden by flags, or lapsed too long ago): the relay is over
        if (up || useRelayStore.getState().session?.post !== post) return;
        stop();
        showToast({ icon: RadioTower, title: strings.report.lapsedTitle, body: strings.report.lapsedBody });
      });
    }, RELAY_HEARTBEAT_MIN * MS_PER_MIN);
    return () => clearInterval(timer);
  }, [post, stop]);

  // The post leaves Crowdsource when its relay ends, whichever way. Not when this screen goes away:
  // the relay outlives it, and a relay lost with the app lapses by itself
  const lastPost = useRef<RelayPost | null>(null);
  useEffect(() => {
    const previous = lastPost.current;
    lastPost.current = post;
    if (previous && previous !== post) void endRelayPost(previous);
  }, [post]);

  const end = session ? relayEnd(session, watch, Math.max(nowMs, session.startedMs)) : null;
  useEffect(() => {
    if (!session || !end) return;
    const toast = endToast(end, session);
    stop();
    Vibration.vibrate();
    showToast(toast);
  }, [session, end, stop]);

  return session;
}

import { ShieldAlert, ShieldCheck } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';

import { VERIFY_CHECK_S } from '@/shared/config';
import type { LineCoordinates } from '@/shared/geo/line';
import { relayVerification } from '@/shared/relay/verification';
import type { WindowFix } from '@/shared/verification/verifyWindow';
import { verifyRelayPost } from '@/state/crowdStore';
import { useLocationStore } from '@/state/locationStore';
import { useRelayStore } from '@/state/relayStore';
import { showToast } from '@/state/toastStore';
import { strings } from '@/strings';

const MS_PER_S = 1000;
const KMH_PER_MPS = 3.6;

// V1a (PRD 10.2, 8.1 step 6): checks a running relay with the verification window. The rider's GPS
// fixes since the relay was released (mocked ones left out, RK1) are judged on the relay's route lines
// with each new fix and every VERIFY_CHECK_S, until the window decides. Verified: a toast, and the
// relay's Crowdsource post is marked verified. Not verified: a toast with the reason; the relay goes on,
// unverified. The live map's marker is judged by the server the same way (ingest).
// detours (DT1): the relay's route's active detour lines
export function useRelayVerification(lines: readonly LineCoordinates[], detours: readonly LineCoordinates[] = []): void {
  const session = useRelayStore((store) => store.session);
  const status = useRelayStore((store) => store.verification?.status ?? null);
  const fix = useLocationStore((store) => store.fix);
  const fixes = useRef<WindowFix[]>([]);
  const [nowMs, setNowMs] = useState(Date.now);
  const startedMs = session?.startedMs ?? null;
  const checking = session !== null && status === 'pending';

  // A new relay starts with no fixes
  useEffect(() => {
    fixes.current = [];
  }, [startedMs]);

  useEffect(() => {
    if (!checking || !fix || fix.mocked || startedMs === null || fix.timestampMs < startedMs) return;
    if (fixes.current.some((known) => known.atMs === fix.timestampMs)) return;
    fixes.current.push({
      lat: fix.lat,
      lon: fix.lon,
      atMs: fix.timestampMs,
      accuracyM: fix.accuracyM,
      speedKmh: fix.speedMps === null ? null : fix.speedMps * KMH_PER_MPS,
    });
    setNowMs(Date.now());
  }, [checking, fix, startedMs]);

  useEffect(() => {
    if (!checking) return undefined;
    const timer = setInterval(() => setNowMs(Date.now()), VERIFY_CHECK_S * MS_PER_S);
    return () => clearInterval(timer);
  }, [checking]);

  useEffect(() => {
    if (!checking || !session) return;
    const result = relayVerification({ fixes: fixes.current, lines, detours, startedMs: session.startedMs, nowMs, demo: session.demo === true });
    if (result.status === 'pending') return;
    const store = useRelayStore.getState();
    if (store.session !== session) return;
    store.setVerification(result);
    const t = strings.report.verify;
    if (result.status === 'verified') {
      if (session.post) void verifyRelayPost(session.post);
      showToast({ inbox: true, icon: ShieldCheck, title: t.verifiedTitle, body: t.verifiedBody });
    } else {
      const reason = result.reasons[0];
      showToast({ inbox: true, icon: ShieldAlert, title: t.failedTitle, body: t.failedBody(reason ? t.reasons[reason] : '') });
    }
  }, [checking, session, lines, detours, nowMs]);
}

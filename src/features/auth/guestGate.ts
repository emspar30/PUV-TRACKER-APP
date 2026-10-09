import { router } from 'expo-router';
import { Lock } from 'lucide-react-native';

import { showDialog } from '@/state/dialogStore';
import { useSessionStore, type SessionStatus } from '@/state/sessionStore';
import { strings } from '@/strings';

// ST2-D: a guest (someone who chose "Continue without an account") cannot check in, relay, read the
// crowdsourced feed or track a multicab. Those controls show a lock, and tapping one asks them to
// sign in. While the saved session is still being read nobody counts as a guest, so no lock flashes.
export const isGuest = (status: SessionStatus) => status === 'signed-out' || status === 'unconfigured';

export function useIsGuest(): boolean {
  return useSessionStore((state) => isGuest(state.status));
}

export function promptSignIn(): void {
  showDialog({
    tone: 'primary',
    icon: Lock,
    title: strings.guest.title,
    body: strings.guest.body,
    actions: [
      { label: strings.guest.signIn, onPress: () => router.push('/sign-in') },
      { label: strings.guest.notNow, variant: 'secondary' },
    ],
  });
}

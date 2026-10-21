import { router } from 'expo-router';
import { Lock } from 'lucide-react-native';

import { showDialog } from '@/state/dialogStore';
import { strings } from '@/strings';

// AU1: everyone in the app is signed in (PRD 7.1), so this is asked only when the server answers that
// the session is gone (signed out elsewhere, or the account was removed)
export function promptSignIn(): void {
  showDialog({
    tone: 'primary',
    icon: Lock,
    title: strings.signInAgain.title,
    body: strings.signInAgain.body,
    actions: [
      { label: strings.signInAgain.signIn, onPress: () => router.push('/sign-in') },
      { label: strings.signInAgain.notNow, variant: 'secondary' },
    ],
  });
}

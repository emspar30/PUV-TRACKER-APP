import { router } from 'expo-router';
import { Trash2 } from 'lucide-react-native';

import { deleteMyAccount } from '@/services/auth';
import { showDialog } from '@/state/dialogStore';
import { resetApp } from '@/state/resetApp';
import { showToast } from '@/state/toastStore';
import { strings } from '@/strings';

// PRD 15.1, D10: Delete account in Settings. Signed in, the server removes the account and all it
// holds first (delete_my_account); only then is this phone cleared, so a failure (offline) removes
// nothing. Signed out there is no account on the server, so only the phone is cleared.
export function confirmDeleteAccount(signedIn: boolean): void {
  const t = strings.settings;
  showDialog({
    tone: 'danger',
    icon: Trash2,
    title: t.deleteTitle,
    body: signedIn ? t.deleteBody : t.deleteLocalBody,
    actions: [
      { label: t.deleteConfirm, variant: 'danger', onPress: () => void deleteAccount(signedIn) },
      { label: strings.common.close, variant: 'secondary' },
    ],
  });
}

async function deleteAccount(signedIn: boolean): Promise<void> {
  const t = strings.settings;
  if (signedIn) {
    showToast({ icon: Trash2, title: t.deleting });
    const result = await deleteMyAccount();
    if (!result.ok) {
      showDialog({ tone: 'danger', title: t.deleteFailedTitle, body: t.deleteFailedBody });
      return;
    }
  }
  resetApp();
  router.dismissAll();
  router.replace('/');
  showToast({ icon: Trash2, title: t.deletedTitle });
}

import { loadAvatarId, saveAvatarId } from '@/services/profile';
import { isAvatarId } from '@/shared/profile/avatarPick';

import { useProfileStore } from './profileStore';

// 2026-11-13 (Emjay): the preset avatar follows the account, so every phone signed in to it shows
// the same one. Only the avatar's number goes to the server (profiles.avatar_id, readable only by
// the account); nothing else from the profile store does (privacy.test checks this file).
// - On sign-in the server's avatar wins: a phone that drew a random one shows the saved one instead.
// - A phone uploads only when the server has none yet, or when the rider picks or shuffles the avatar
//   themselves (avatarChosen). A random draw on a new phone never overwrites the saved avatar.

let signedIn = false;
// The server has been read for this sign-in
let checked = false;
// The rider picked an avatar before the server was read: it is sent instead of taking the server's
let chosenBeforeCheck = false;

export async function syncAvatar(): Promise<void> {
  signedIn = true;
  const fromServer = await loadAvatarId();
  if (!signedIn) return;
  checked = true;
  const { avatarId, avatarAssigned } = useProfileStore.getState();
  if (fromServer !== null && isAvatarId(fromServer) && !chosenBeforeCheck) {
    if (avatarId !== fromServer || !avatarAssigned) useProfileStore.setState({ avatarId: fromServer, avatarAssigned: true });
    return;
  }
  chosenBeforeCheck = false;
  if (avatarAssigned && avatarId !== fromServer) await saveAvatarId(avatarId);
}

// Signed out: the next sign-in reads the server again
export function stopAvatarSync(): void {
  signedIn = false;
  checked = false;
  chosenBeforeCheck = false;
}

// Called right after the rider picks or shuffles their avatar
export function avatarChosen(): void {
  if (!signedIn || !checked) {
    chosenBeforeCheck = true;
    return;
  }
  void saveAvatarId(useProfileStore.getState().avatarId);
}

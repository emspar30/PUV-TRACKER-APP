import { File, UploadType } from 'expo-file-system';

import { REGISTRATION_INBOX_POLL_MS } from '@/shared/config';
import { readCheckCode } from '@/shared/driver/registration';
import { photoTooBig } from '@/shared/driver/registrationFlow';

import { addHeatmapSmsListener, drainInbox } from '../../../../modules/tunton-sms';

// DRG4: the phone's side of registering (PRD 9.5): reading the number check from the SMS inbox, and
// uploading a photo to the link the registration function gave.

const HTTP_OK_MIN = 200;
const HTTP_OK_MAX = 299;

// Calls onCode once, with the first number-check code that reaches the inbox (the native receiver
// keeps it like a heatmap message, as data on the heatmap port or a text under its prefix). Looks on
// each new message and every REGISTRATION_INBOX_POLL_MS. Nothing is set up yet, so any other message
// drained meanwhile means nothing and is dropped. Returns the stop function.
export function watchForCheckCode(onCode: (code: string) => void): () => void {
  let stopped = false;
  let looking = false;
  const look = async () => {
    if (stopped || looking) return;
    looking = true;
    try {
      const entries = await drainInbox();
      const code = entries.map(readCheckCode).find((found): found is string => found !== null);
      if (code && !stopped) {
        stopped = true;
        onCode(code);
      }
    } catch {
      // The next look tries again
    } finally {
      looking = false;
    }
  };
  const arrived = addHeatmapSmsListener(() => void look());
  const timer = setInterval(() => void look(), REGISTRATION_INBOX_POLL_MS);
  void look();
  return () => {
    stopped = true;
    arrived?.remove();
    clearInterval(timer);
  };
}

export type UploadOutcome = 'ok' | 'too_big' | 'failed' | 'offline';

// Sends the photo as it is (a JPEG) to its short-lived upload link
export async function uploadPhoto(uri: string, url: string): Promise<UploadOutcome> {
  const file = new File(uri);
  if (photoTooBig(file.size)) return 'too_big';
  try {
    const result = await file.upload(url, {
      httpMethod: 'PUT',
      uploadType: UploadType.BINARY_CONTENT,
      headers: { 'Content-Type': 'image/jpeg', 'x-upsert': 'true' },
    });
    return result.status >= HTTP_OK_MIN && result.status <= HTTP_OK_MAX ? 'ok' : 'failed';
  } catch {
    return 'offline';
  }
}

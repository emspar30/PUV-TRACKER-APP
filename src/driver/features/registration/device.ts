import { File, UploadType } from 'expo-file-system';

import { photoTooBig } from '@/shared/driver/registrationFlow';

// DRG4: the phone's side of registering (PRD 9.5): uploading a photo to the link the registration
// function gave.

const HTTP_OK_MIN = 200;
const HTTP_OK_MAX = 299;

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

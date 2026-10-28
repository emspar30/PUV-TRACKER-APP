import type { SupabaseClient } from '@supabase/supabase-js';

import { CONSOLE_PHOTO_LINK_TTL_S, REGISTRATION_NOTICE_TTL_MIN } from '@/shared/config';
import { hashAdminPin } from '@/shared/driver/provisioning';
import type { ConsoleDriver, ConsoleRegistration } from '@/shared/driver/registrationConsole';

// DRG5: everything the console does (PRD 9.5). It goes through the console_* database functions, which
// check is_admin() first, and the private photo bucket, which only the admin account may read and
// delete. Every call answers { ok: true, value } or { ok: false, error }: not_admin, not_pending,
// offline, or the server's own message.

export const PHOTO_BUCKET = 'driver-registrations';
// The PIN's salt, as hashAdminPin takes it
const SALT_BYTES = 16;
const NOT_ADMIN_CODE = '42501';

export type Outcome<T> = { ok: true; value: T } | { ok: false; error: string };

function failure(error: { code?: string; message: string }): { ok: false; error: string } {
  if (error.code === NOT_ADMIN_CODE) return { ok: false, error: 'not_admin' };
  if (error.message === 'not_pending') return { ok: false, error: 'not_pending' };
  if (/failed to fetch|network/i.test(error.message)) return { ok: false, error: 'offline' };
  return { ok: false, error: error.message };
}

function randomHex(bytes: number): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(bytes)), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function consoleApi(client: SupabaseClient) {
  async function rpc<T>(name: string, args?: Record<string, unknown>): Promise<Outcome<T>> {
    try {
      const { data, error } = await client.rpc(name, args);
      return error ? failure(error) : { ok: true, value: data as T };
    } catch {
      return { ok: false, error: 'offline' };
    }
  }

  // Whether any of the photos is still in the bucket (each registration's photos share one folder)
  async function stillStored(paths: string[]): Promise<boolean> {
    for (const folder of new Set(paths.map((path) => path.split('/')[0]))) {
      const { data } = await client.storage.from(PHOTO_BUCKET).list(folder);
      if ((data ?? []).some((file) => paths.includes(`${folder}/${file.name}`))) return true;
    }
    return false;
  }

  // Deletes the photos, then records that they are gone. Storage answers without an error even when it
  // deleted nothing, so a short answer is checked against the bucket before anything is recorded.
  async function deletePhotos(registrationId: string, paths: string[]): Promise<Outcome<boolean>> {
    if (paths.length > 0) {
      try {
        const { data, error } = await client.storage.from(PHOTO_BUCKET).remove(paths);
        if (error) return failure(error);
        if (data.length < paths.length && (await stillStored(paths))) return { ok: false, error: 'photos_not_deleted' };
      } catch {
        return { ok: false, error: 'offline' };
      }
    }
    return rpc<boolean>('console_photos_deleted', { registration: registrationId });
  }

  return {
    // Waiting first, then the newest (at most 200)
    registrations: () => rpc<ConsoleRegistration[]>('console_registrations'),

    // Short-lived links to the photos, by path
    async photoLinks(paths: string[]): Promise<Outcome<Record<string, string>>> {
      if (paths.length === 0) return { ok: true, value: {} };
      try {
        const { data, error } = await client.storage.from(PHOTO_BUCKET).createSignedUrls(paths, CONSOLE_PHOTO_LINK_TTL_S);
        if (error) return failure(error);
        const links: Record<string, string> = {};
        for (const link of data) if (link.path && link.signedUrl && !link.error) links[link.path] = link.signedUrl;
        return { ok: true, value: links };
      } catch {
        return { ok: false, error: 'offline' };
      }
    },

    // Approves (which queues the "approved" text) or rejects with the reason, then deletes both
    // photos (D1). If the deletion does not finish, the next load of the list finishes it.
    async decide(registrationId: string, approve: boolean, reason: string | null): Promise<Outcome<null>> {
      const decided = await rpc<{ id_photo_path: string | null; vehicle_photo_path: string | null }[]>('console_decide', {
        registration: registrationId,
        approve,
        decision_reason: approve ? null : reason,
        notice_ttl_min: REGISTRATION_NOTICE_TTL_MIN,
      });
      if (!decided.ok) return decided;
      const paths = decided.value.flatMap((row) => [row.id_photo_path, row.vehicle_photo_path]).filter((path): path is string => path !== null);
      await deletePhotos(registrationId, paths);
      return { ok: true, value: null };
    },

    deletePhotos,

    drivers: () => rpc<ConsoleDriver[]>('console_drivers'),

    // Retires the phone and gives its vehicle a new beacon secret nobody holds; first it queues one
    // text, a notice signed with the phone's key, so the driver app says it was removed
    retire: (deviceId: string) => rpc<boolean>('console_retire', { device: deviceId, notice_ttl_min: REGISTRATION_NOTICE_TTL_MIN }),

    pinIsSet: () => rpc<boolean>('console_pin_is_set'),

    // Only the salted hash leaves the page (D5), in the form the setup payload carries
    setPin(pin: string): Promise<Outcome<null>> {
      const salt = randomHex(SALT_BYTES);
      return rpc<null>('console_set_pin', { pin_hash: hashAdminPin(pin, salt), pin_salt: salt });
    },
  };
}

export type ConsoleApi = ReturnType<typeof consoleApi>;

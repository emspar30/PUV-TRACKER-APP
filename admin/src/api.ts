import type { SupabaseClient } from '@supabase/supabase-js';

import { CONSOLE_LOG_ROWS, CONSOLE_PHOTO_LINK_TTL_S, REGISTRATION_NOTICE_TTL_MIN } from '@/shared/config';
import { hashAdminPin } from '@/shared/driver/provisioning';
import {
  decideThenDelete,
  deletePhotos as deleteThenRecord,
  type ConsoleDriver,
  type ConsoleLogEntry,
  type ConsoleRegistration,
  type ConsoleResult,
  type DecidedPhotos,
} from '@/shared/driver/registrationConsole';
import type { FlaggedPost, ModerationWaiting, PendingAppeal, Suspension } from '@/shared/moderation/console';

// DRG5: everything the console does (PRD 9.5). It goes through the console_* database functions, which
// check is_admin() first, and the private photo bucket, which only the admin account may read and
// delete. Every call answers { ok: true, value } or { ok: false, error }: not_admin, not_pending,
// offline, or the server's own message.

export const PHOTO_BUCKET = 'driver-registrations';
// The PIN's salt, as hashAdminPin takes it
const SALT_BYTES = 16;
const NOT_ADMIN_CODE = '42501';

export type Outcome<T> = ConsoleResult<T>;

// The database's own refusals, which errors.ts words for the admin
const KNOWN_ERRORS = [
  'not_pending',
  'checks_not_passed',
  'no_failed_check',
  'reason_needed',
  'invalid_checks',
  // 2026-11-23: moderation
  'already_struck',
  'no_such_post',
  'no_such_appeal',
  'not_suspended',
];

function failure(error: { code?: string; message: string }): { ok: false; error: string } {
  if (error.code === NOT_ADMIN_CODE) return { ok: false, error: 'not_admin' };
  if (KNOWN_ERRORS.includes(error.message)) return { ok: false, error: error.message };
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

  // Deletes the photos, then records that they are gone (the order is in deletePhotos, shared and tested)
  async function remove(paths: readonly string[]): Promise<Outcome<number>> {
    try {
      const { data, error } = await client.storage.from(PHOTO_BUCKET).remove([...paths]);
      return error ? failure(error) : { ok: true, value: data.length };
    } catch {
      return { ok: false, error: 'offline' };
    }
  }

  async function stillStoredSafe(paths: readonly string[]): Promise<boolean> {
    try {
      return await stillStored([...paths]);
    } catch {
      return true;
    }
  }

  const deletePhotos = (registrationId: string, paths: string[]): Promise<Outcome<boolean>> =>
    deleteThenRecord(paths, { remove, stillStored: stillStoredSafe }, () => rpc<boolean>('console_photos_deleted', { registration: registrationId }));

  return {
    // Waiting first, then the newest (at most 200), with the LTFRB name, document and checks
    registrations: () => rpc<ConsoleRegistration[]>('console_registrations_ltfrb'),

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

    // Approves (which queues the "approved" text) or rejects with the reason, then deletes both photos
    // (D1). If the deletion does not finish, the next load of the list finishes it. Since 2026-11-23 no
    // checklist is sent (a plain Approve or Reject, migration 20261123000003).
    decide: (registrationId: string, approve: boolean, reason: string | null): Promise<Outcome<null>> =>
      decideThenDelete(
        () =>
          rpc<DecidedPhotos[]>('console_decide', {
            registration: registrationId,
            approve,
            review: null,
            decision_reason: approve ? null : reason,
            notice_ttl_min: REGISTRATION_NOTICE_TTL_MIN,
          }),
        (paths) => deletePhotos(registrationId, paths),
      ),

    deletePhotos,

    drivers: () => rpc<ConsoleDriver[]>('console_drivers'),

    // Retires the phone and gives its vehicle a new beacon secret nobody holds; first it queues one
    // text, a notice signed with the phone's key, so the driver app says it was removed
    retire: (deviceId: string) => rpc<boolean>('console_retire', { device: deviceId, notice_ttl_min: REGISTRATION_NOTICE_TTL_MIN }),

    pinIsSet: () => rpc<boolean>('console_pin_is_set'),

    // 2026-11-22: the newest admin actions (approve, reject, retire, PIN change), with who and when
    adminLog: () => rpc<ConsoleLogEntry[]>('console_admin_log', { max_rows: CONSOLE_LOG_ROWS }),

    // 2026-11-23: moderation (migration 20261123000000_auto_moderation.sql)
    moderationWaiting: async (): Promise<Outcome<ModerationWaiting>> => {
      const result = await rpc<ModerationWaiting[]>('console_moderation_waiting');
      return result.ok ? { ok: true, value: result.value[0] ?? { reviews: 0, appeals: 0 } } : result;
    },
    flaggedPosts: () => rpc<FlaggedPost[]>('console_flagged_posts'),
    confirmReport: (postId: number) => rpc<number>('console_confirm_report', { post: postId }),
    dismissReport: (postId: number) => rpc<null>('console_dismiss_report', { post: postId }),
    appeals: () => rpc<PendingAppeal[]>('console_appeals'),
    decideAppeal: (appealId: number, upheld: boolean) => rpc<null>('console_decide_appeal', { appeal: appealId, upheld }),
    suspensions: () => rpc<Suspension[]>('console_suspensions'),
    lift: (accountId: string) => rpc<null>('console_lift', { account: accountId }),

    // Only the salted hash leaves the page (D5), in the form the setup payload carries
    setPin(pin: string): Promise<Outcome<null>> {
      const salt = randomHex(SALT_BYTES);
      return rpc<null>('console_set_pin', { pin_hash: hashAdminPin(pin, salt), pin_salt: salt });
    },
  };
}

export type ConsoleApi = ReturnType<typeof consoleApi>;

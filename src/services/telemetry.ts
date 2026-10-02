import { encodePacket, type TelemetryPacket } from '@/shared/telemetry/packet';

import { getSupabase } from './supabase';

const INGEST_FUNCTION = 'ingest';

export type SendResult =
  | { ok: true; status: 'accepted' | 'ignored' }
  | { ok: false; error: string };

// Sends one position to the ingest Edge Function, the only writer of the live-map table.
// The Supabase client adds the publishable key (`apikey`) and the signed-in user's access
// token (`Authorization`). The server refuses accounts that are not on the team allowlist.
export async function sendTelemetry(packet: TelemetryPacket): Promise<SendResult> {
  try {
    const { data, error } = await getSupabase().functions.invoke<{ status?: 'accepted' | 'ignored'; error?: string }>(
      INGEST_FUNCTION,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: encodePacket(packet) },
    );
    if (error) return { ok: false, error: error.message };
    if (!data?.status) return { ok: false, error: data?.error ?? 'unexpected_response' };
    return { ok: true, status: data.status };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

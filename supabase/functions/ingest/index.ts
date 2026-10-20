// Telemetry ingest Edge Function (Deno). The only writer of public.telemetry_latest.
//
// A client calls it with the publishable key in the `apikey` header and the signed-in user's
// access token in `Authorization: Bearer <token>`. All rules live in ../_shared/ingestCore.ts;
// this file only connects them to Supabase. It uses the service role, which stays on the server.

import { createClient } from 'npm:@supabase/supabase-js@2';

import { handleIngest, type IngestDeps } from '../_shared/ingestCore.ts';
import { INGEST_LOG_RETENTION_DAYS } from '../_shared/serverConfig.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
if (!supabaseUrl || !serviceRoleKey) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const MS_PER_DAY = 86400000;

const deps: IngestDeps = {
  nowMs: () => Date.now(),

  // Asks Supabase Auth whether the token is a valid, unexpired session of a real user
  getUserId: async (accessToken) => {
    const { data, error } = await admin.auth.getUser(accessToken);
    return error ? null : (data.user?.id ?? null);
  },

  isAllowedWriter: async (userId) => {
    const { data, error } = await admin.from('team_accounts').select('user_id').eq('user_id', userId).maybeSingle();
    if (error) throw error;
    return data !== null;
  },

  getVehicle: async (vehicleId) => {
    const { data, error } = await admin.from('vehicles').select('active').eq('vehicle_id', vehicleId).maybeSingle();
    if (error) throw error;
    return data;
  },

  getLatest: async (vehicleId) => {
    const { data, error } = await admin
      .from('telemetry_latest')
      .select('packet_ts, stopped_since')
      .eq('vehicle_id', vehicleId)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  upsertLatest: async (row) => {
    const { error } = await admin
      .from('telemetry_latest')
      .upsert({ ...row, updated_at: new Date().toISOString() }, { onConflict: 'vehicle_id' });
    if (error) throw error;
  },

  getHistoryNewest: async (vehicleId) => {
    const { data, error } = await admin
      .from('telemetry_raw')
      .select('packet_ts')
      .eq('vehicle_id', vehicleId)
      .order('packet_ts', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data?.packet_ts ?? null;
  },

  // SB1: accepted positions are kept server-side for speed samples (retention: supabase/cron)
  insertHistory: async (rows) => {
    const { error } = await admin.from('telemetry_raw').insert(rows);
    if (error) {
      console.error('telemetry history insert failed', error.message);
      throw error;
    }
  },

  // The audit trail must never fail a request, so its errors are only reported
  log: async (entry) => {
    const { error } = await admin.from('telemetry_ingest_log').insert(entry);
    if (error) console.error('ingest log insert failed', error.message);
    const cutoff = new Date(Date.now() - INGEST_LOG_RETENTION_DAYS * MS_PER_DAY).toISOString();
    const purge = await admin.from('telemetry_ingest_log').delete().lt('received_at', cutoff);
    if (purge.error) console.error('ingest log purge failed', purge.error.message);
  },
};

const JSON_HEADERS = { 'Content-Type': 'application/json' };

Deno.serve(async (request) => {
  try {
    const response = await handleIngest(
      {
        method: request.method,
        authorization: request.headers.get('Authorization'),
        body: await request.text(),
      },
      deps,
    );
    return new Response(JSON.stringify(response.body), { status: response.status, headers: JSON_HEADERS });
  } catch (error) {
    console.error('ingest failed', error instanceof Error ? error.message : error);
    return new Response(JSON.stringify({ error: 'server_error' }), { status: 500, headers: JSON_HEADERS });
  }
});

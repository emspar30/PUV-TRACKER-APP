import { getSupabase, isSupabaseConfigured } from './supabase';

// B4, DR8: the multicab a verified beacon names. The Relay panel uses it instead of the manual pickers.
export type BleVehicle = {
  routeCode: string;
  vehicleId: string;
  // The plate as shown to riders, e.g. "MCB 123"
  plate: string;
};

// DR8: why a code was not accepted. network: no answer (offline, or the function is not on the
// server yet); sign_in: signed out
export type BeaconFailure = 'beacon_invalid' | 'beacon_expired' | 'unknown_vehicle' | 'too_many_checks' | 'network' | 'sign_in';

export type BeaconVerdict = { ok: true; vehicle: BleVehicle } | { ok: false; reason: BeaconFailure };

const STATUSES: readonly BeaconFailure[] = ['beacon_invalid', 'beacon_expired', 'unknown_vehicle', 'too_many_checks'];
const SIGNED_OUT = '28000';

type Row = { vehicle_id: string | null; route_id: string | null; plate: string | null; status: string };

// DR8: the verify_beacon port. The server checks the rotating code against the vehicle's secret
// (which never leaves it) and answers the vehicle, its route and plate, or why not.
export async function verifyBeaconCode(payloadHex: string): Promise<BeaconVerdict> {
  if (!isSupabaseConfigured()) return { ok: false, reason: 'network' };
  try {
    const { data, error } = await getSupabase().rpc('verify_beacon', { payload_hex: payloadHex });
    if (error) return { ok: false, reason: error.code === SIGNED_OUT ? 'sign_in' : 'network' };
    const [row] = (data ?? []) as Row[];
    if (row?.status === 'ok' && row.vehicle_id && row.route_id && row.plate) {
      return { ok: true, vehicle: { vehicleId: row.vehicle_id, routeCode: row.route_id, plate: row.plate } };
    }
    const reason = STATUSES.find((status) => status === row?.status);
    return { ok: false, reason: reason ?? 'beacon_invalid' };
  } catch {
    return { ok: false, reason: 'network' };
  }
}

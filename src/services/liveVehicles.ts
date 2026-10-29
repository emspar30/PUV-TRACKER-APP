import type { LiveVehiclesPort } from '@/data/live/liveVehicles';
import { LIVE_ROW_COLUMNS, type LiveRow } from '@/shared/telemetry/liveRow';

import { getSupabase } from './supabase';

let channelCount = 0;

// The Supabase side of the live vehicles repository (L1). Row Level Security decides what comes
// back: team accounts only in v0, and at night only stationary vehicles.
export const supabaseVehiclesPort: LiveVehiclesPort = {
  async load(routeCode) {
    const supabase = getSupabase();
    const vehicles = await supabase.from('vehicles').select('vehicle_id').eq('route_id', routeCode).eq('active', true);
    if (vehicles.error) throw new Error(vehicles.error.message);
    const vehicleIds = vehicles.data.map((vehicle) => vehicle.vehicle_id as string).sort();
    if (vehicleIds.length === 0) return { vehicleIds, rows: [] };
    const latest = await supabase.from('telemetry_latest').select(LIVE_ROW_COLUMNS).in('vehicle_id', vehicleIds);
    if (latest.error) throw new Error(latest.error.message);
    return { vehicleIds, rows: latest.data as LiveRow[] };
  },

  // NM1: the night stop view; open to every signed-in account, names no vehicle
  async nightStops(routeCode) {
    const result = await getSupabase().rpc('night_stop_updates', { route: routeCode });
    if (result.error) throw new Error(result.error.message);
    return (result.data ?? []) as { stop_code: string; passed_at: string }[];
  },

  watch(vehicleIds, onRow) {
    if (vehicleIds.length === 0) return () => undefined;
    const supabase = getSupabase();
    channelCount += 1;
    const channel = supabase
      .channel(`telemetry-latest-${channelCount}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'telemetry_latest', filter: `vehicle_id=in.(${vehicleIds.join(',')})` },
        (change) => {
          if (change.eventType !== 'DELETE') onRow(change.new as LiveRow);
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  },
};

// T1: the route's active multicabs, for the relay's vehicle picker (read by team accounts only)
export async function fetchRouteVehicles(routeCode: string): Promise<{ id: string; label: string }[]> {
  const { data, error } = await getSupabase()
    .from('vehicles')
    .select('vehicle_id, plate')
    .eq('route_id', routeCode)
    .eq('active', true)
    .order('vehicle_id');
  if (error) throw new Error(error.message);
  return data.map((vehicle) => ({ id: vehicle.vehicle_id as string, label: vehicle.plate as string }));
}

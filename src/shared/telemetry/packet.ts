// The telemetry packet and its validator live beside the Edge Function, which can only load
// files from its own folder. This re-export gives the app the same code under src/shared.
export * from '../../../supabase/functions/_shared/packet.ts';

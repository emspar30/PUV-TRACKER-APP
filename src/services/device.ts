import { getAndroidId } from 'expo-application';
import { Platform } from 'react-native';

import { getSupabase, isSupabaseConfigured } from './supabase';

// Device ban (PRD 10.3; owner, 2026-11-22): after each sign-in the phone tells the server its Android
// ID, so a suspension also covers the other accounts used on this phone. The server keeps only a keyed
// HMAC of it (migration 20261122000001_device_ban.sql); the ID itself is kept nowhere. Best effort: a
// failure is ignored, and a suspension the server finds shows through the usual suspended checks.
let registeredFor: string | null = null;

export async function registerDevice(userId: string | null): Promise<void> {
  if (!userId || registeredFor === userId || Platform.OS !== 'android' || !isSupabaseConfigured()) return;
  let androidId: string | null = null;
  try {
    androidId = getAndroidId();
  } catch {
    return;
  }
  if (!androidId) return;
  registeredFor = userId;
  try {
    const { error } = await getSupabase().rpc('register_device', { android_id: androidId });
    if (error) registeredFor = null;
  } catch {
    registeredFor = null;
  }
}

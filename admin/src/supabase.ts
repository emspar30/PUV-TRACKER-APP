import { createClient } from '@supabase/supabase-js';

import { consoleApi } from './api';

// The one Supabase client of the console, signed in as the admin account (D4). It keeps the session in
// this browser, so the console stays signed in until Sign out. Null when the build has no address.
const url = import.meta.env.EXPO_PUBLIC_SUPABASE_URL;
const key = import.meta.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const client = url && key ? createClient(url, key) : null;
export const api = client ? consoleApi(client) : null;

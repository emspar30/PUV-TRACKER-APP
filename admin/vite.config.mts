import path from 'node:path';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// DRG5: the admin console (admin/README.md). It uses the app's pure code (src/shared, the strings and
// the colour tokens) through the app's @ alias. The Supabase address and publishable key come from the
// repository's .env when run locally, or from Render's settings when hosted; the prefix lets in only
// those two (both are public: they ship in the apps too).
export default defineConfig({
  root: import.meta.dirname,
  plugins: [react()],
  envDir: path.resolve(import.meta.dirname, '..'),
  envPrefix: 'EXPO_PUBLIC_SUPABASE_',
  resolve: { alias: { '@': path.resolve(import.meta.dirname, '../src') } },
  build: { outDir: path.resolve(import.meta.dirname, 'dist'), emptyOutDir: true },
  server: { port: 5173, strictPort: true },
});

import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';

const rootDir = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, rootDir, '');
  const supabaseUrl = env.VITE_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || '';
  const publishableKey = env.VITE_SUPABASE_PUBLISHABLE_KEY
    || env.SUPABASE_PUBLISHABLE_KEY
    || env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    || '';

  return {
    // Only the public project URL and publishable/anon key are exposed to the browser.
    // Service-role keys, database URLs/passwords, and JWT signing secrets are never mapped.
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(supabaseUrl),
      'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify(publishableKey),
    },
  build: {
    rollupOptions: {
      input: {
        admin: resolve(rootDir, 'index.html'),
        courier: resolve(rootDir, 'mensajero/index.html'),
        tracking: resolve(rootDir, 'seguimiento/index.html'),
        sampleTracking: resolve(rootDir, 'seguimiento/1254/index.html'),
      },
    },
  },
  };
});

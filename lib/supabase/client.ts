// Client Supabase browser-side. A utiliser dans les Client Components.
// Lit/ecrit les cookies de session via @supabase/ssr.

import { createBrowserClient } from '@supabase/ssr';

export function getSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY sont requis',
    );
  }
  return createBrowserClient(url, anonKey);
}

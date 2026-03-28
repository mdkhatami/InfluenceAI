import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let serverClient: SupabaseClient | null = null;

/**
 * Creates a Supabase client for server-side use in packages (non-Next.js context).
 * Uses the service_role key for full access (bypasses RLS).
 */
export function getServiceClient(): SupabaseClient {
  if (serverClient) return serverClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      'Missing SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars'
    );
  }

  serverClient = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  return serverClient;
}

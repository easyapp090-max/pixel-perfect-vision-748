import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseConfig, isSecureBackendConfigured } from "@/lib/backend-config";

let client: SupabaseClient | undefined;

export function getSupabaseClient(): SupabaseClient {
  if (typeof window === "undefined") {
    throw new Error("Supabase operations are only available in the browser.");
  }
  if (client) return client;

  const { url, key } = getSupabaseConfig();
  if (!url || !key || !isSecureBackendConfigured()) {
    throw new Error("Supabase is not configured.");
  }

  client = createClient(url, key, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  });
  return client;
}

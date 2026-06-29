import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { requireSupabaseConfig } from "@/lib/config";

let supabaseAdmin: SupabaseClient | null = null;

export function getSupabaseAdmin() {
  if (!supabaseAdmin) {
    const config = requireSupabaseConfig();
    supabaseAdmin = createClient(
      config.SUPABASE_URL!,
      config.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      },
    );
  }

  return supabaseAdmin;
}

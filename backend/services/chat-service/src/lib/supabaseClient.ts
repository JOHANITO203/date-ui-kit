import { createClient } from "@supabase/supabase-js";
import { env } from "../config";

export const supabaseServiceClient = env.hasSupabase
  ? createClient(env.SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE!, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : null;

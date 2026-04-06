import { createClient } from "@supabase/supabase-js";
import { env } from "../config/env";

export const supabaseServiceClient = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

export const supabaseAnonClient = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

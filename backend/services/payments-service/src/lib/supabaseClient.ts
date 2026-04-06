import { createRequire } from "node:module";
import { env } from "../config.js";

type SupabaseFactory = {
  createClient: (
    url: string,
    key: string,
    options: {
      auth: {
        autoRefreshToken: boolean;
        persistSession: boolean;
      };
    },
  ) => any;
};

const require = createRequire(import.meta.url);

const resolveFactory = (): SupabaseFactory | null => {
  try {
    return require("@supabase/supabase-js") as SupabaseFactory;
  } catch {
    return null;
  }
};

const factory = resolveFactory();

export const supabaseServiceClient =
  env.hasSupabase && factory
    ? factory.createClient(env.SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE!, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      })
    : null;

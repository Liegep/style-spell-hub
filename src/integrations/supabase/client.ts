import { createClient } from "@supabase/supabase-js";

declare global {
  interface Window {
    __LOVE_POTION_ENV__?: {
      VITE_SUPABASE_URL?: string;
      VITE_SUPABASE_ANON_KEY?: string;
    };
  }
}

const runtimeEnv = typeof window !== "undefined" ? window.__LOVE_POTION_ENV__ : undefined;
const supabaseUrl = runtimeEnv?.VITE_SUPABASE_URL || (import.meta.env.VITE_SUPABASE_URL as string | undefined);
const supabaseAnonKey =
  runtimeEnv?.VITE_SUPABASE_ANON_KEY || (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined);

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = createClient(supabaseUrl ?? "https://placeholder.supabase.co", supabaseAnonKey ?? "placeholder", {
  auth: {
    autoRefreshToken: true,
    detectSessionInUrl: true,
    persistSession: true,
  },
});

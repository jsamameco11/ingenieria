import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url =
  (import.meta.env.VITE_FOLIO_SUPABASE_URL as string | undefined) ||
  "https://qfvgksstvdrxcugbdwkv.supabase.co";
const key =
  (import.meta.env.VITE_FOLIO_SUPABASE_ANON_KEY as string | undefined) ||
  "sb_publishable_CrjVMkqm4pXDsec2lQ6yAg_R2BukVAe";

export const FOLIO_URL = url.replace(/\/$/, "");
export const FOLIO_ANON_KEY = key;
export const FOLIO_GOOGLE_WEB_CLIENT_ID =
  (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) ||
  "554728885093-jnn9ibrh5jl7f5nfth67cabipo4i4bd6.apps.googleusercontent.com";
export const GOOGLE_SESSION_URL =
  (import.meta.env.VITE_GOOGLE_SESSION_URL as string | undefined) ||
  "https://qfvgksstvdrxcugbdwkv.supabase.co/functions/v1/google-session";

export const folio: SupabaseClient = createClient(FOLIO_URL, FOLIO_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: "memorcalc-folio-auth",
  },
});

export function folioHeaders(extra?: Record<string, string>): HeadersInit {
  return {
    apikey: FOLIO_ANON_KEY,
    Authorization: `Bearer ${FOLIO_ANON_KEY}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

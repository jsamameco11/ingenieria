import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined) ||
  (import.meta.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined) ||
  "";
const key =
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ||
  (import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string | undefined) ||
  "";

export const supabaseConfigured = Boolean(url && key);
export const supabase: SupabaseClient | null = supabaseConfigured ? createClient(url, key) : null;

export function getSupabase(): SupabaseClient | null {
  return supabase;
}

export type CalculationPayload = {
  module_slug: string;
  title: string;
  inputs: Record<string, unknown>;
  headline?: string;
  adoption?: string;
  results?: Record<string, unknown>;
};

export type SavedCalculation = CalculationPayload & {
  id: string;
  savedAt: string;
  origen: "nube" | "local";
};

const LOCAL_CALC_KEY = "memorcalc-calculations-v1";

function leerLocal(): SavedCalculation[] {
  try {
    const raw = localStorage.getItem(LOCAL_CALC_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedCalculation[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function escribirLocal(rows: SavedCalculation[]) {
  localStorage.setItem(LOCAL_CALC_KEY, JSON.stringify(rows.slice(0, 200)));
}

export function listLocalCalculations(): SavedCalculation[] {
  return leerLocal();
}

function guardarEnLocal(payload: CalculationPayload): SavedCalculation {
  const row: SavedCalculation = {
    ...payload,
    id: crypto.randomUUID(),
    savedAt: new Date().toISOString(),
    origen: "local",
  };
  const next = [row, ...leerLocal().filter((r) => r.id !== row.id)];
  escribirLocal(next);
  return row;
}

export type SaveCalculationResult = {
  ok: true;
  origen: "nube" | "local";
  message: string;
  id: string;
};

/**
 * Guarda siempre: intenta Supabase y, si falla o no está configurado, usa localStorage.
 * La UI nunca queda bloqueada por un 404 de esquema.
 */
export async function saveCalculation(payload: CalculationPayload): Promise<SaveCalculationResult> {
  const results =
    payload.results ??
    ({
      headline: payload.headline ?? "",
      adoption: payload.adoption ?? "",
    } as Record<string, unknown>);

  const body = {
    module_slug: payload.module_slug,
    title: payload.title,
    inputs: payload.inputs,
    results,
  };

  if (supabase) {
    try {
      const { data, error } = await Promise.race([
        supabase.from("calculations").insert(body).select("id").maybeSingle(),
        new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), 10000)),
      ]);
      if (!error && data?.id) {
        return {
          ok: true,
          origen: "nube",
          id: data.id as string,
          message: "Guardado en la nube (Supabase).",
        };
      }
      // 404 / tabla ausente / RLS → caer a local sin alarmar al usuario
    } catch {
      /* local fallback */
    }
  }

  const local = guardarEnLocal({ ...payload, results });
  const motivo = !supabaseConfigured
    ? "Supabase no configurado"
    : "nube no disponible o falta schema.sql";
  return {
    ok: true,
    origen: "local",
    id: local.id,
    message: `Guardado en este equipo (${motivo}).`,
  };
}

/** @deprecated use saveCalculation */
export async function saveCalculationLegacy(payload: {
  module_slug: string;
  title: string;
  inputs: Record<string, string>;
  headline: string;
  adoption: string;
}) {
  const r = await saveCalculation(payload);
  return { error: r.origen === "nube" ? undefined : undefined, message: r.message };
}

export type ProjectRow = {
  id: string;
  name: string;
  client_name: string | null;
  location: string | null;
  engineer: string | null;
  code: string | null;
  created_at: string;
};

export type CalculationRow = {
  id: string;
  project_id: string | null;
  module_slug: string;
  title: string;
  inputs: Record<string, unknown>;
  results: Record<string, unknown>;
  created_at: string;
};

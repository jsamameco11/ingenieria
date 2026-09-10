import { folio } from "./folio";
import { readCachedLaunch } from "./billingLaunch";
import { aplicarPlantilla, identificarPlantilla, type CategoriaPlantilla } from "./presupuesto/plantillas";
import { calcularPresupuesto, savePresupuesto } from "./presupuesto/engine";
import { guardarArchivo, listarNube, type PresupuestoDocumento } from "./presupuesto/archivos";
import { armarDesdeLectura } from "./planos/armar";
import type { LecturaGrok } from "./planos/types";
import type { PresupuestoArchivo, PresupuestoState } from "./presupuesto/types";

export const PRO_SOLES = 20;
export const PDF_SOLES = 4;
export { PLANES_PRO, type PlanProId } from "./culqi";

const PLAN_KEY = "memorcalc-plan-v1";

export type PlanInfo = {
  plan: "free" | "pro";
  paidUntil: string | null;
  email: string;
};

export function applyCulqiPlan(userId: string, email: string, paidUntil: string | null, days: number): PlanInfo {
  const until = paidUntil || new Date(Date.now() + Math.max(1, days) * 86400000).toISOString();
  const info: PlanInfo = { plan: "pro", paidUntil: until, email };
  writeLocalPlan(userId, info);
  return info;
}

export function isProNow(info: PlanInfo | null): boolean {
  if (!info || info.plan !== "pro" || !info.paidUntil) return false;
  return new Date(info.paidUntil).getTime() > Date.now();
}

function readLocalPlan(userId: string): PlanInfo | null {
  try {
    const raw = localStorage.getItem(PLAN_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw) as PlanInfo & { userId?: string };
    if (o.userId && o.userId !== userId) return null;
    return { plan: o.plan === "pro" ? "pro" : "free", paidUntil: o.paidUntil ?? null, email: o.email || "" };
  } catch {
    return null;
  }
}

function writeLocalPlan(userId: string, info: PlanInfo) {
  localStorage.setItem(PLAN_KEY, JSON.stringify({ ...info, userId }));
}

export async function fetchPlan(userId: string, email = ""): Promise<PlanInfo> {
  const local = readLocalPlan(userId);
  try {
    const { data } = await folio.from("memorcalc_plans").select("plan,paid_until,email").eq("user_id", userId).maybeSingle();
    if (data) {
      const info: PlanInfo = {
        plan: data.plan === "pro" ? "pro" : "free",
        paidUntil: data.paid_until || null,
        email: String(data.email || email),
      };
      writeLocalPlan(userId, info);
      return info;
    }
  } catch {
    /* local */
  }
  return local ?? { plan: "free", paidUntil: null, email };
}

export async function registerPayment(opts: {
  userId: string;
  email?: string;
  kind: "pro" | "pdf";
  amount: number;
  voucher: string;
  pdfCount?: number;
  meta?: Record<string, unknown>;
  days?: number;
}): Promise<PlanInfo> {
  if (!opts.voucher.trim().startsWith("chr_")) throw new Error("Falta el cargo Culqi.");
  try {
    const { data, error } = await folio.rpc("memorcalc_register_payment", {
      p_kind: opts.kind,
      p_amount: opts.amount,
      p_voucher: opts.voucher.trim(),
      p_pdf_count: opts.pdfCount ?? 0,
      p_meta: opts.meta ?? {},
    });
    if (error) throw new Error(error.message);
    const row = (data || {}) as { plan?: string; paid_until?: string };
    const info: PlanInfo = {
      plan: row.plan === "pro" || opts.kind === "pro" ? "pro" : "free",
      paidUntil: row.paid_until || (opts.kind === "pro" ? new Date(Date.now() + (opts.days || 31) * 86400000).toISOString() : null),
      email: opts.email || "",
    };
    if (info.plan === "pro") writeLocalPlan(opts.userId, info);
    return info;
  } catch {
    if (opts.kind === "pdf" && opts.voucher.trim().startsWith("chr_")) {
      return { plan: "free", paidUntil: null, email: opts.email || "" };
    }
    throw new Error("El cargo Culqi se cobró, pero no se pudo anotar el plan en la nube. Escriba a soporte con el id del cargo.");
  }
}

export async function emailTienePro(email: string): Promise<boolean> {
  if (!readCachedLaunch().live) return true;
  const mail = email.trim().toLowerCase();
  if (!mail) return false;
  const { data, error } = await folio.rpc("memorcalc_plan_activo", { p_email: mail });
  if (!error) return Boolean(data);
  const { data: row } = await folio.from("memorcalc_plans").select("plan,paid_until").eq("email", mail).maybeSingle();
  if (!row) return false;
  return row.plan === "pro" && row.paid_until && new Date(row.paid_until).getTime() > Date.now();
}

export type CloudBudget = PresupuestoArchivo & { owner?: boolean; members?: string[] };

export async function listarCloudBudgets(userId: string): Promise<CloudBudget[]> {
  const { data, error } = await folio
    .from("memorcalc_budgets")
    .select("id,owner_id,nombre,obra,cliente,lugar,partidas,total,updated_at")
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    id: r.id,
    nombre: r.nombre,
    obra: r.obra ?? "",
    cliente: r.cliente ?? "",
    lugar: r.lugar ?? "",
    partidas: r.partidas ?? 0,
    total: Number(r.total) || 0,
    savedAt: r.updated_at,
    origen: "nube" as const,
    owner: r.owner_id === userId,
  }));
}

export async function leerCloudBudget(id: string): Promise<PresupuestoDocumento | null> {
  const { data, error } = await folio.from("memorcalc_budgets").select("*").eq("id", id).maybeSingle();
  if (error || !data) return null;
  const state = data.payload as PresupuestoState;
  if (!state || !Array.isArray(state.lineas)) return null;
  return {
    id: data.id,
    nombre: data.nombre,
    obra: data.obra,
    cliente: data.cliente,
    lugar: data.lugar,
    partidas: data.partidas,
    total: Number(data.total) || 0,
    savedAt: data.updated_at,
    origen: "nube",
    state,
  };
}

export async function guardarCloudBudget(userId: string, state: PresupuestoState, nombre?: string) {
  const saved = await guardarArchivo(state, { nombre, como: false });
  const calc = calcularPresupuesto(saved.doc.state);
  const { error } = await folio.from("memorcalc_budgets").upsert({
    id: saved.doc.id,
    owner_id: userId,
    nombre: saved.doc.nombre,
    obra: saved.doc.obra,
    cliente: saved.doc.cliente,
    lugar: saved.doc.lugar,
    partidas: saved.doc.partidas,
    total: calc.total,
    payload: saved.doc.state,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
  return saved.doc;
}

export async function borrarCloudBudget(id: string) {
  const { error } = await folio.from("memorcalc_budgets").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function listarMiembros(budgetId: string): Promise<string[]> {
  const { data, error } = await folio.from("memorcalc_budget_members").select("email").eq("budget_id", budgetId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => String(r.email));
}

export async function invitarMiembro(budgetId: string, email: string) {
  const mail = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) throw new Error("Indique un correo válido.");
  const pro = await emailTienePro(mail);
  if (!pro) {
    throw new Error("Esa cuenta no tiene Plan Pro activo. Ambos deben pagar con Culqi (mensual, trimestral o anual).");
  }
  const { error } = await folio.from("memorcalc_budget_members").upsert({
    budget_id: budgetId,
    email: mail,
    role: "editor",
  });
  if (error) throw new Error(error.message);
}

export async function quitarMiembro(budgetId: string, email: string) {
  const { error } = await folio.from("memorcalc_budget_members").delete().eq("budget_id", budgetId).eq("email", email);
  if (error) throw new Error(error.message);
}

export function plantillaDesdePlanos(nombres: string[], obra = "", tipo?: string, lecturaTexto = ""): string {
  return identificarPlantilla({
    obra,
    archivos: nombres,
    tipo: (tipo as CategoriaPlantilla | "") || "",
    lecturaTexto,
  });
}

export async function generarDesdePlanos(opts: {
  userId: string;
  obra: string;
  cliente: string;
  lugar: string;
  files: File[];
  lectura?: LecturaGrok;
  seedPlantilla?: string;
  tipo?: CategoriaPlantilla | "";
}): Promise<PresupuestoState> {
  const nombres = opts.files.map((f) => f.name);
  const lecturaTexto = opts.lectura
    ? [opts.lectura.obra_leida, opts.lectura.especialidad, ...(opts.lectura.hallazgos ?? [])].join(" ")
    : "";
  const seed = opts.seedPlantilla || plantillaDesdePlanos(nombres, opts.obra, opts.tipo, lecturaTexto);
  const state = opts.lectura
    ? armarDesdeLectura(opts.lectura, {
        obra: opts.obra.trim() || "Presupuesto desde planos PDF",
        cliente: opts.cliente.trim(),
        lugar: opts.lugar.trim(),
        files: nombres,
        seedPlantilla: seed,
        tipo: opts.tipo || "",
      })
    : aplicarPlantilla(seed, {
        obra: opts.obra.trim() || "Presupuesto desde planos PDF",
        cliente: opts.cliente.trim(),
        lugar: opts.lugar.trim(),
        observaciones: `Generado a partir de ${opts.files.length} PDF: ${nombres.join("; ")}. Plantilla ${seed}.`,
      });
  if (!state) throw new Error("No se pudo armar el presupuesto.");
  savePresupuesto(state);
  try {
    await guardarCloudBudget(opts.userId, state, state.obra || "Presupuesto PDF");
  } catch {
    /* local PRE-01 */
  }
  return state;
}

export async function listarLocalYNube(): Promise<PresupuestoArchivo[]> {
  try {
    return await listarNube();
  } catch {
    return [];
  }
}

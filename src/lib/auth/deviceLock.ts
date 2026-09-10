import { folio } from "../folio";
import { MSG_EQUIPO_OCUPADO } from "../support";
import { installId } from "./store";

/** El panel Control es solo del titular: ahí no se ancla el equipo. */
export function isControlSurface() {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname.toLowerCase();
  const path = window.location.pathname.toLowerCase();
  return (
    host.startsWith("control-") ||
    host.startsWith("control.") ||
    host.includes("control-ingenieria") ||
    path.includes("control.html") ||
    path === "/control" ||
    path.startsWith("/control/") ||
    document.body?.classList.contains("ctl-body") === true
  );
}

const EPOCH_KEY = "memorcalc-device-epoch";

export function deviceLabel() {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const short = ua.replace(/\(.*?\)/g, "").slice(0, 72).trim();
  return short || "Equipo Windows";
}

export function readLocalEpoch() {
  const n = Number(localStorage.getItem(EPOCH_KEY) || "0");
  return Number.isFinite(n) ? n : 0;
}

export function writeLocalEpoch(n: number) {
  localStorage.setItem(EPOCH_KEY, String(n));
}

export function isDeviceLockMissing(err: unknown) {
  const raw = err instanceof Error ? err.message : String(err ?? "");
  return /does not exist|schema cache|42P01|PGRST|memorcalc_claim_device|memorcalc_device_lock|memorcalc_revoke/i.test(raw);
}

export async function claimThisDevice() {
  const deviceId = installId();
  const { data, error } = await folio.rpc("memorcalc_claim_device", {
    p_device_id: deviceId,
    p_label: deviceLabel(),
  });
  if (error) {
    const raw = error.message || "No se pudo anclar este equipo.";
    if (/otro equipo|activa en otro/i.test(raw)) {
      throw new Error(MSG_EQUIPO_OCUPADO);
    }
    throw new Error(raw);
  }
  const epoch = typeof data === "number" ? data : Number(data);
  if (Number.isFinite(epoch)) writeLocalEpoch(epoch);
  return { deviceId, epoch };
}

export async function thisDeviceIsActive() {
  const { data: sessionData } = await folio.auth.getSession();
  const uid = sessionData.session?.user?.id;
  if (!uid) return true;
  const { data, error } = await folio
    .from("memorcalc_device_lock")
    .select("device_id,session_epoch")
    .eq("user_id", uid)
    .maybeSingle();
  if (error || !data) return true;
  const mine = installId();
  const remote = String(data.device_id || "");
  if (!remote) return false;
  return remote === mine;
}

export async function revokeUserSessions(userId: string) {
  const { error } = await folio.rpc("memorcalc_revoke_sessions", { p_user_id: userId });
  if (error) throw error;
}

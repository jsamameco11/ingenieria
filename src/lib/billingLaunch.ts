import { defaultQuotaMap, mergeQuotaMap } from "./auth/quotas";

export type BillingLaunch = {
  live: boolean;
  liveAt: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
  quotas: Record<string, number>;
};

const KEY = "memorcalc-billing-launch-v1";

const DEFAULT_OWNERS = ["jrenzosamco@gmail.com", "miacademiapreu.pe@gmail.com"];

export const COURTESY_LAUNCH: BillingLaunch = {
  live: false,
  liveAt: null,
  updatedAt: null,
  updatedBy: null,
  quotas: defaultQuotaMap(),
};

function extraOwners() {
  const raw = String(import.meta.env.VITE_OWNER_EMAILS || "");
  return raw.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
}

export function isOwnerEmail(email: string | null | undefined) {
  const mail = String(email || "").trim().toLowerCase();
  if (!mail) return false;
  return new Set([...DEFAULT_OWNERS, ...extraOwners()]).has(mail);
}

function asLaunch(o: Partial<BillingLaunch> | null | undefined): BillingLaunch {
  return {
    live: Boolean(o?.live),
    liveAt: o?.liveAt ?? null,
    updatedAt: o?.updatedAt ?? null,
    updatedBy: o?.updatedBy ?? null,
    quotas: mergeQuotaMap(o?.quotas),
  };
}

export function readCachedLaunch(): BillingLaunch {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return COURTESY_LAUNCH;
    return asLaunch(JSON.parse(raw) as BillingLaunch);
  } catch {
    return COURTESY_LAUNCH;
  }
}

function writeCachedLaunch(info: BillingLaunch) {
  localStorage.setItem(KEY, JSON.stringify(info));
}

export async function fetchBillingLaunch(): Promise<BillingLaunch> {
  try {
    const res = await fetch("/api/billing/launch", { headers: { Accept: "application/json" } });
    if (!res.ok) return readCachedLaunch();
    const data = (await res.json()) as BillingLaunch;
    const info = asLaunch(data);
    writeCachedLaunch(info);
    return info;
  } catch {
    return readCachedLaunch();
  }
}

export async function setBillingLaunch(
  live: boolean,
  accessToken: string,
  quotas?: Record<string, number>,
): Promise<BillingLaunch> {
  const res = await fetch("/api/billing/launch", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ live, quotas }),
  });
  const data = (await res.json().catch(() => ({}))) as BillingLaunch & { message?: string };
  if (!res.ok) throw new Error(data.message || "No se pudo cambiar la operación de los planes.");
  const info = asLaunch(data);
  writeCachedLaunch(info);
  return info;
}

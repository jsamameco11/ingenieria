export type PrintPolicy = {
  cleanPaid: boolean;
  soles: number;
  updatedAt: string | null;
  updatedBy: string | null;
};

const KEY = "memorcalc-print-policy-v1";

export const FREE_PRINT_POLICY: PrintPolicy = {
  cleanPaid: false,
  soles: 0,
  updatedAt: null,
  updatedBy: null,
};

function asMoney(n: unknown) {
  const v = Number(n);
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(999, Math.round(v * 100) / 100));
}

export function asPrintPolicy(o: Partial<PrintPolicy> | null | undefined): PrintPolicy {
  return {
    cleanPaid: Boolean(o?.cleanPaid),
    soles: asMoney(o?.soles),
    updatedAt: o?.updatedAt ?? null,
    updatedBy: o?.updatedBy ?? null,
  };
}

export function readCachedPrintPolicy(): PrintPolicy {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return FREE_PRINT_POLICY;
    return asPrintPolicy(JSON.parse(raw) as PrintPolicy);
  } catch {
    return FREE_PRINT_POLICY;
  }
}

function writeCachedPrintPolicy(info: PrintPolicy) {
  localStorage.setItem(KEY, JSON.stringify(info));
}

export function formatPrintSoles(soles: number) {
  return `S/ ${soles.toLocaleString("es-PE", { minimumFractionDigits: soles % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;
}

export function cleanPrintLabel(policy: PrintPolicy) {
  if (policy.cleanPaid && policy.soles > 0) return `${formatPrintSoles(policy.soles)} por hoja`;
  return "Gratis";
}

export async function fetchPrintPolicy(): Promise<PrintPolicy> {
  try {
    const res = await fetch("/api/billing/print-policy", { headers: { Accept: "application/json" } });
    if (!res.ok) return readCachedPrintPolicy();
    const info = asPrintPolicy((await res.json()) as PrintPolicy);
    writeCachedPrintPolicy(info);
    return info;
  } catch {
    return readCachedPrintPolicy();
  }
}

export async function setPrintPolicy(
  patch: Pick<PrintPolicy, "cleanPaid" | "soles">,
  accessToken: string,
): Promise<PrintPolicy> {
  const res = await fetch("/api/billing/print-policy", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(patch),
  });
  const data = (await res.json().catch(() => ({}))) as PrintPolicy & { message?: string };
  if (!res.ok) throw new Error(data.message || "No se pudo guardar la política de impresión.");
  const info = asPrintPolicy(data);
  writeCachedPrintPolicy(info);
  return info;
}

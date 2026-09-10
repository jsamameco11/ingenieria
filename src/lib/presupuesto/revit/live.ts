import type { RevitPaquete } from "./types";

export type EnlaceRevit = {
  cuenta: string;
  plugin: "conectado" | "esperando" | "desconectado";
  code: string;
  conectadoEn: string | null;
  sincronizadoEn: string | null;
  elementos: number;
  archivo: string;
};

export async function generarCodigoRevit(accessToken: string): Promise<{ code: string; expiresIn: number; email?: string }> {
  const res = await fetch("/api/v1/revit/pair", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
  });
  const raw = (await res.json().catch(() => ({}))) as { code?: string; expiresIn?: number; email?: string; message?: string };
  if (!res.ok || !raw.code) throw new Error(raw.message || "No se pudo generar el código. Inicie sesión con Google.");
  return { code: raw.code, expiresIn: raw.expiresIn ?? 900, email: raw.email };
}

export async function estadoEnlaceRevit(accessToken: string): Promise<EnlaceRevit | null> {
  const res = await fetch("/api/v1/revit/link", {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
  });
  if (res.status === 401) return null;
  const raw = (await res.json().catch(() => ({}))) as EnlaceRevit & { message?: string };
  if (!res.ok) throw new Error(raw.message || "No se pudo leer el estado de la cuenta.");
  return {
    cuenta: raw.cuenta || "",
    plugin: raw.plugin === "conectado" || raw.plugin === "esperando" ? raw.plugin : "desconectado",
    code: raw.code || "",
    conectadoEn: raw.conectadoEn ?? null,
    sincronizadoEn: raw.sincronizadoEn ?? null,
    elementos: Number(raw.elementos) || 0,
    archivo: raw.archivo || "",
  };
}

export async function importarElementosRevit(accessToken: string): Promise<{ paquete: RevitPaquete; recibidoEn: string } | null> {
  const res = await fetch("/api/v1/revit/latest", {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
  });
  if (res.status === 404) return null;
  const raw = (await res.json().catch(() => ({}))) as { paquete?: RevitPaquete; recibidoEn?: string; message?: string };
  if (!res.ok || !raw.paquete) throw new Error(raw.message || "No hay un modelo sincronizado.");
  return { paquete: raw.paquete, recibidoEn: raw.recibidoEn || "" };
}

export const ultimoPaqueteRevit = importarElementosRevit;

export const CULQI_PUBLIC_KEY =
  (import.meta.env.VITE_CULQI_PUBLIC_KEY as string | undefined) || "pk_live_MAEbuxjjTVT0PnB0";

export const PLANES_PRO = [
  { id: "mc-monthly", title: "Mensual", soles: 20, days: 31, blurb: "S/ 20 · 1 mes" },
  { id: "mc-quarterly", title: "Trimestral", soles: 54, days: 93, blurb: "S/ 54 · 3 meses (−10 %)" },
  { id: "mc-annual", title: "Anual", soles: 192, days: 365, blurb: "S/ 192 · 12 meses (−20 %)" },
] as const;

export type PlanProId = (typeof PLANES_PRO)[number]["id"];

export type ChargeResult = {
  chargeId: string;
  planId: string;
  paidUntil: string | null;
  days: number;
  message: string;
};

declare global {
  interface Window {
    Culqi?: {
      publicKey: string;
      token?: { id: string };
      error?: { user_message?: string; merchant_message?: string };
      settings: (c: Record<string, unknown>) => void;
      options: (c: Record<string, unknown>) => void;
      open: () => void;
      close: () => void;
    };
    culqi?: () => void;
  }
}

function loadCulqi(): Promise<void> {
  if (window.Culqi) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[src*="checkout.culqi.com"]');
    if (existing) {
      if (window.Culqi) {
        resolve();
        return;
      }
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("No se pudo cargar Culqi Checkout.")));
      return;
    }
    const s = document.createElement("script");
    s.src = "https://checkout.culqi.com/js/v4";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("No se pudo cargar Culqi Checkout."));
    document.head.appendChild(s);
  });
}

export function openCulqiCheckout(opts: {
  amountSoles: number;
  email: string;
  description: string;
}): Promise<string> {
  const amount = Math.round(opts.amountSoles * 100);
  if (!(amount > 0)) return Promise.reject(new Error("Monto inválido."));
  return loadCulqi().then(
    () =>
      new Promise<string>((resolve, reject) => {
        const C = window.Culqi;
        if (!C) {
          reject(new Error("Culqi no está disponible."));
          return;
        }
        let done = false;
        let timer = 0;
        const finish = (ok: boolean, value: string) => {
          if (done) return;
          done = true;
          window.clearTimeout(timer);
          if (ok) resolve(value);
          else reject(new Error(value));
        };
        timer = window.setTimeout(() => {
          try {
            C.close();
          } catch {
            /* ok */
          }
          finish(false, "Pago cancelado o tiempo agotado.");
        }, 180000);
        window.culqi = () => {
          if (C.token?.id) {
            try {
              C.close();
            } catch {
              /* ok */
            }
            finish(true, C.token.id);
          } else if (C.error) {
            finish(false, C.error.user_message || C.error.merchant_message || "Pago cancelado.");
          }
        };
        C.publicKey = CULQI_PUBLIC_KEY;
        C.settings({
          title: "MemoriaCalc",
          currency: "PEN",
          amount,
          description: opts.description,
          email: opts.email,
        });
        C.options({
          lang: "es",
          installments: false,
          paymentMethods: {
            tarjeta: true,
            yape: true,
            bancaMovil: false,
            agente: false,
            billetera: false,
            cuotealo: false,
          },
        });
        try {
          C.open();
        } catch (e) {
          finish(false, e instanceof Error ? e.message : "No se abrió Culqi.");
        }
      }),
  );
}

export async function confirmCulqiCharge(opts: {
  tokenId: string;
  planId: string;
  email: string;
  amountSoles: number;
  description: string;
  accessToken: string;
  pdfCount?: number;
}): Promise<ChargeResult> {
  const res = await fetch("/api/charges/confirm", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${opts.accessToken}`,
    },
    body: JSON.stringify({
      token_id: opts.tokenId,
      plan_id: opts.planId,
      email: opts.email,
      amount_cents: Math.round(opts.amountSoles * 100),
      description: opts.description,
      pdf_count: opts.pdfCount ?? 0,
    }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    message?: string;
    charge_id?: string;
    plan_id?: string;
    paid_until?: string | null;
    days?: number;
  };
  if (!res.ok) throw new Error(data.message || `Culqi ${res.status}`);
  return {
    chargeId: data.charge_id || "",
    planId: data.plan_id || opts.planId,
    paidUntil: data.paid_until ?? null,
    days: data.days ?? 0,
    message: data.message || "Pago confirmado.",
  };
}

import { useState } from "react";
import { PDF_SOLES, applyCulqiPlan } from "../lib/billing";
import { PLANES_PRO, confirmCulqiCharge, openCulqiCheckout, type PlanProId } from "../lib/culqi";
import { useAuth } from "./AuthProvider";

export function PayBox({
  kind,
  pdfCount = 0,
  pdfFiles = 0,
  counting = false,
  onPaid,
  busy,
  error,
}: {
  kind: "pro" | "pdf";
  pdfCount?: number;
  pdfFiles?: number;
  counting?: boolean;
  onPaid: (chargeId: string, planId: string, days: number, paidUntil: string | null) => void | Promise<void>;
  busy?: string;
  error?: string;
}) {
  const { user, session, openGoogle, refreshPlan, plansLive } = useAuth();
  const [planId, setPlanId] = useState<PlanProId>("mc-monthly");
  const [wait, setWait] = useState("");
  const [localErr, setLocalErr] = useState("");
  const plan = PLANES_PRO.find((p) => p.id === planId) ?? PLANES_PRO[0];
  const amount = kind === "pro" ? plan.soles : pdfCount * PDF_SOLES;
  const description =
    kind === "pro" ? plan.blurb : `Presupuesto desde PDF · ${pdfCount} lámina${pdfCount === 1 ? "" : "s"}`;

  async function pagar() {
    if (kind === "pro" && !plansLive) {
      setLocalErr("Los planes Pro aún no están en operación.");
      return;
    }
    if (!user?.email || !session?.access_token) {
      openGoogle();
      return;
    }
    if (kind === "pdf" && counting) {
      setLocalErr("Espere a que se cuenten las hojas de los PDF.");
      return;
    }
    if (kind === "pdf" && pdfCount < 1) {
      setLocalErr("Adjunte al menos un PDF. El cobro es por hoja, no por archivo.");
      return;
    }
    setWait("Abriendo Culqi…");
    setLocalErr("");
    try {
      const token = await openCulqiCheckout({
        amountSoles: amount,
        email: user.email,
        description,
      });
      setWait("Confirmando el cargo…");
      const paid = await confirmCulqiCharge({
        tokenId: token,
        planId: kind === "pro" ? plan.id : "mc-pdf",
        email: user.email,
        amountSoles: amount,
        description,
        accessToken: session.access_token,
        pdfCount: kind === "pdf" ? pdfCount : 0,
      });
      if (kind === "pro") applyCulqiPlan(user.id, user.email, paid.paidUntil, paid.days || plan.days);
      await refreshPlan();
      setWait(kind === "pdf" ? "Pago confirmado. Generando…" : "Activando Plan Pro…");
      await onPaid(paid.chargeId, paid.planId, paid.days, paid.paidUntil);
    } catch (e) {
      setLocalErr(e instanceof Error ? e.message : "No se completó el pago Culqi.");
    } finally {
      setWait("");
    }
  }

  return (
    <aside className="pay-box">
      <p className="pay-kicker">{kind === "pro" ? (plansLive ? "Plan Pro · Culqi" : "Periodo gratuito") : "Lectura con IA · Culqi"}</p>
      {kind === "pro" ? (
        <div className="pay-plans">
          {PLANES_PRO.map((p) => (
            <button key={p.id} type="button" className={planId === p.id ? "on" : ""} onClick={() => setPlanId(p.id)}>
              <b>{p.title}</b>
              <span>{p.blurb}</span>
            </button>
          ))}
        </div>
      ) : null}
      <strong className="pay-amount">S/ {amount.toLocaleString("es-PE")}</strong>
      <p className="pay-copy">
        {kind === "pro"
          ? plansLive
            ? "Pago con tarjeta o Yape en Culqi. El Plan Pro abre la nube, Revit, el add-in 2023–2026 y queda anclado a un solo equipo."
            : "Periodo gratuito de planes: no se cobra la suscripción. Revit, nube y add-in están abiertos."
          : counting
            ? "Contando las hojas de cada PDF…"
            : `S/ ${PDF_SOLES} por hoja (lámina). ${pdfFiles || 0} archivo${pdfFiles === 1 ? "" : "s"} · ${pdfCount || 0} lámina${pdfCount === 1 ? "" : "s"}. Culqi (tarjeta o Yape).`}
      </p>
      {error || localErr ? <p className="mcd-err">{error || localErr}</p> : null}
      <div className="pay-actions">
        <button type="button" className="btn primary" disabled={Boolean(busy || wait || counting) || (kind === "pro" && !plansLive)} onClick={() => void pagar()}>
          {kind === "pro" && !plansLive ? "Aún no opera" : busy || wait || "Pagar con Culqi"}
        </button>
      </div>
    </aside>
  );
}

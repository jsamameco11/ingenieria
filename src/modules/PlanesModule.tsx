import { useState } from "react";
import { applyCulqiPlan, isProNow } from "../lib/billing";
import { PLANES_PRO, confirmCulqiCharge, openCulqiCheckout, type PlanProId } from "../lib/culqi";
import { SOPORTE_LABEL, SOPORTE_WA } from "../lib/support";
import { useAuth } from "../ui/AuthProvider";
import { BillingLaunchPanel } from "../ui/BillingLaunchPanel";

function when(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-PE", { day: "2-digit", month: "long", year: "numeric" });
}

const BENEFICIOS = [
  "Biblioteca de presupuestos en la nube e invitaciones a colegas Pro.",
  "Pestaña Revit: identificar el modelo, anexar partidas RN y actualizar metrados.",
  "Add-in MemoriaCalc para Autodesk Revit 2023, 2024, 2025 y 2026 (Windows).",
  "Una sola computadora por cuenta. Si cambia de equipo, soporte WhatsApp 977 747 979.",
];

export function PlanesModule() {
  const { user, session, plan, isPro, plansLive, openGoogle, refreshPlan } = useAuth();
  const [sel, setSel] = useState<PlanProId>("mc-monthly");
  const [wait, setWait] = useState("");
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  async function contratar(id: PlanProId) {
    if (!plansLive) {
      setErr("Los cobros aún no están en operación. El titular debe dar la venia.");
      return;
    }
    const p = PLANES_PRO.find((x) => x.id === id) ?? PLANES_PRO[0];
    if (!user?.email || !session?.access_token) {
      openGoogle();
      return;
    }
    setSel(id);
    setWait("Abriendo Culqi…");
    setErr("");
    setMsg("");
    try {
      const token = await openCulqiCheckout({
        amountSoles: p.soles,
        email: user.email,
        description: `Plan Pro ${p.title} · ${p.blurb}`,
      });
      setWait("Confirmando el cargo…");
      const paid = await confirmCulqiCharge({
        tokenId: token,
        planId: p.id,
        email: user.email,
        amountSoles: p.soles,
        description: `Plan Pro ${p.title}`,
        accessToken: session.access_token,
      });
      applyCulqiPlan(user.id, user.email, paid.paidUntil, paid.days || p.days);
      await refreshPlan();
      setMsg(`Plan Pro ${p.title} activo${paid.paidUntil ? ` hasta ${when(paid.paidUntil)}` : ""}. Ya puede usar Revit y el add-in.`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "No se completó el pago Culqi.");
    } finally {
      setWait("");
    }
  }

  return (
    <div className="planes-shell plaza-shell" data-guest-ok>
      <header className="plaza-hero">
        <div>
          <p className="plaza-kicker">PLA-05 · Plan Pro · Culqi</p>
          <h2>Planes</h2>
          <p>
            {plansLive
              ? "Con los planes en operación, cada motor tiene un cupo gratuito (0 a 6) que el titular configura. Al agotarlo, mensual, trimestral o anual habilitan cálculo ilimitado, Revit y la nube. Una cuenta, un equipo. Pague con tarjeta o Yape en Culqi."
              : "Periodo gratuito de planes: Revit, nube y add-in están abiertos. Mensual, trimestral y anual no cobran ni vencen hasta que el titular los ponga en operación. La lectura de planos con IA se cobra aparte (S/ 4 por hoja)."}
          </p>
        </div>
        <dl className="plaza-kpis">
          <div>
            <dt>Estado</dt>
            <dd>{!plansLive ? "Cortesía" : isPro ? "Pro" : "Libre"}</dd>
          </div>
          <div>
            <dt>Vigencia</dt>
            <dd>{!plansLive ? "Sin vencimiento" : isProNow(plan) ? when(plan?.paidUntil) : "—"}</dd>
          </div>
        </dl>
      </header>

      <BillingLaunchPanel />

      {msg ? <p className="mcd-ok planes-banner">{msg}</p> : null}
      {err ? <p className="mcd-err planes-banner">{err}</p> : null}

      <section className="planes-grid" aria-label="Planes Pro">
        {PLANES_PRO.map((p) => {
          const on = sel === p.id;
          const dest = p.id === "mc-monthly" ? "El más directo" : p.id === "mc-quarterly" ? "−10 %" : "−20 %";
          return (
            <article key={p.id} className={`planes-card${on ? " on" : ""}`}>
              <p className="planes-card-kicker">{dest}</p>
              <h3>{p.title}</h3>
              <p className="planes-price">
                <strong>S/ {p.soles.toLocaleString("es-PE")}</strong>
                <span>{p.blurb}</span>
              </p>
              <ul>
                {BENEFICIOS.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
              <button
                type="button"
                className="btn primary"
                disabled={Boolean(wait) || !plansLive}
                onClick={() => void contratar(p.id)}
              >
                {!plansLive ? "Aún no opera" : wait && on ? wait : user ? `Contratar ${p.title}` : "Entrar y contratar"}
              </button>
            </article>
          );
        })}
      </section>

      <aside className="planes-note">
        <p>
          <strong>Un solo equipo.</strong> Si inicia sesión en otra computadora, el ingreso se rechaza. Para liberar la
          cuenta escriba a soporte por WhatsApp al{" "}
          <a href={SOPORTE_WA} target="_blank" rel="noreferrer">
            {SOPORTE_LABEL}
          </a>
          . El titular cierra las sesiones; el usuario no ingresa al panel de control.
        </p>
      </aside>
    </div>
  );
}

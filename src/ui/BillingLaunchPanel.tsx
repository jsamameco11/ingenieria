import { useEffect, useState } from "react";
import { isControlSurface } from "../lib/auth/deviceLock";
import { QUOTA_MAX, quotaFamilies } from "../lib/auth/quotas";
import { setBillingLaunch } from "../lib/billingLaunch";
import { readControlToken } from "../lib/controlGate";
import { useAuth } from "./AuthProvider";

function when(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-PE", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function BillingLaunchPanel({ force = false }: { force?: boolean }) {
  const control = force || isControlSurface();
  const { session, isOwner, plansLive, launch, refreshLaunch } = useAuth();
  const [wait, setWait] = useState("");
  const [err, setErr] = useState("");
  const [quotas, setQuotas] = useState<Record<string, number>>(launch.quotas);

  useEffect(() => {
    setQuotas(launch.quotas);
  }, [launch]);

  if (!control && !isOwner) return null;

  async function aplicar(live: boolean, nextQuotas = quotas) {
    const token = control ? readControlToken() : session?.access_token || "";
    if (!token) {
      setErr(control ? "Vuelva a entrar al panel con su clave de titular." : "Falta la sesión del titular.");
      return;
    }
    if (
      live &&
      !plansLive &&
      !window.confirm(
        "Al activar, Culqi cobrará S/ 20 / 54 / 192 y las vigencias de Pro empezarán a correr. Los cupos 0–6 de cada motor aplicarán a cuentas sin Plan Pro. ¿Comenzar a operar?"
      )
    ) {
      return;
    }
    setWait(live ? "Guardando operación y cupos…" : "Volviendo al periodo gratuito…");
    setErr("");
    try {
      await setBillingLaunch(live, token, nextQuotas);
      await refreshLaunch();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "No se pudo cambiar el estado.");
    } finally {
      setWait("");
    }
  }

  const btnClass = control ? "ctl-btn primary" : "btn primary";
  const ghostClass = control ? "ctl-ghost" : "btn";
  const families = quotaFamilies();

  return (
    <section className="planes-launch" aria-label="Operación de planes">
      <p className="planes-launch-kicker">Titular · operación de cobros</p>
      <h3>{plansLive ? "Planes en operación" : "Los planes aún no cobran"}</h3>
      <p>
        {plansLive
          ? `Mensual, trimestral y anual ya cobran y las vigencias cuentan desde ${when(launch.liveAt)}. Los cupos de abajo son usos gratuitos por motor antes de exigir Plan Pro.`
          : "Mientras no opere, todo se consulta y se calcula sin cobro de suscripción. Cuando active, cada motor usará el cupo 0–6 que usted asigne. La lectura de planos con IA ya se cobra (S/ 4 por hoja)."}
      </p>
      {launch.updatedBy ? <p className="planes-launch-meta">Último cambio: {when(launch.updatedAt)} · {launch.updatedBy}</p> : null}
      {err ? <p className="mcd-err">{err}</p> : null}
      <div className="planes-launch-actions">
        {plansLive ? (
          <button type="button" className={ghostClass} disabled={Boolean(wait)} onClick={() => void aplicar(false)}>
            {wait || "Volver a periodo gratuito"}
          </button>
        ) : (
          <button type="button" className={btnClass} disabled={Boolean(wait)} onClick={() => void aplicar(true)}>
            {wait || "Comenzar a operar con los planes activos"}
          </button>
        )}
        <button type="button" className={ghostClass} disabled={Boolean(wait)} onClick={() => void aplicar(plansLive)}>
          {wait || "Guardar cupos 0–6"}
        </button>
      </div>

      <div className="planes-quotas">
        <h4>Cupos gratuitos por motor (0 a 6)</h4>
        <p>
          0 = sin cortesía (pide Pro al primer cálculo propio). 1–6 = corridas o entregables de cortesía después del
          login. El ejemplo de apertura de cada hoja se sigue viendo sin gastar cupo. Estos números solo rigen cuando
          los planes están en operación.
        </p>
        {families.map((g) => (
          <div key={g.family} className="planes-quota-family">
            <p>{g.family}</p>
            {g.engines.map((e) => (
              <label key={e.id} className="planes-quota-row">
                <span>
                  {e.label}
                  <small>{e.hint}</small>
                </span>
                <select
                  value={quotas[e.id] ?? e.defaultLimit}
                  onChange={(ev) => setQuotas((s) => ({ ...s, [e.id]: Number(ev.target.value) }))}
                  aria-label={`Cupo de ${e.label}`}
                >
                  {Array.from({ length: QUOTA_MAX + 1 }, (_, n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

import { useEffect, useState } from "react";
import {
  borrarCloudBudget,
  invitarMiembro,
  isProNow,
  listarCloudBudgets,
  listarLocalYNube,
  listarMiembros,
  leerCloudBudget,
  quitarMiembro,
  type CloudBudget,
} from "../lib/billing";
import { loadPresupuesto, savePresupuesto } from "../lib/presupuesto/engine";
import type { PresupuestoArchivo } from "../lib/presupuesto/types";
import { useAuth } from "../ui/AuthProvider";
import { PayBox } from "../ui/PayBox";

function money(n: number) {
  return n.toLocaleString("es-PE", { style: "currency", currency: "PEN", maximumFractionDigits: 2 });
}

function when(iso: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-PE", { day: "2-digit", month: "short", year: "numeric" });
}

export function MisPresupuestosModule() {
  const { user, openGoogle, isPro, plan, plansLive, refreshPlan } = useAuth();
  const [cloud, setCloud] = useState<CloudBudget[]>([]);
  const [local, setLocal] = useState<PresupuestoArchivo[]>([]);
  const [sel, setSel] = useState<CloudBudget | null>(null);
  const [members, setMembers] = useState<string[]>([]);
  const [invite, setInvite] = useState("");
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  async function load() {
    if (!user) return;
    try {
      const [c, l] = await Promise.all([listarCloudBudgets(user.id), listarLocalYNube()]);
      setCloud(c);
      setLocal(l);
    } catch (e) {
      const raw = e instanceof Error ? e.message : "No se pudo listar.";
      if (/infinite recursion|policy for relation/i.test(raw)) {
        setErr("No se pudo leer la nube. Se corrigió la política de acceso; recargue la página en unos segundos.");
      } else {
        setErr(raw);
      }
    }
  }

  useEffect(() => {
    void load();
  }, [user, isPro]);

  useEffect(() => {
    if (!sel) return;
    void listarMiembros(sel.id)
      .then(setMembers)
      .catch(() => setMembers([]));
  }, [sel]);

  async function abrir(id: string) {
    const actual = loadPresupuesto();
    const hayTrabajoAbierto = actual.lineas.length > 0 || actual.archivoId != null;
    if (hayTrabajoAbierto) {
      const ok = window.confirm(
        `Tiene abierto "${actual.obra || "un presupuesto"}" con ${actual.lineas.length} partida(s). Si no lo guardó, se perderá al abrir este otro. ¿Continuar de todos modos?`,
      );
      if (!ok) return;
    }
    const doc = await leerCloudBudget(id);
    if (!doc) {
      setErr("No se pudo abrir el presupuesto.");
      return;
    }
    savePresupuesto(doc.state);
    window.dispatchEvent(new CustomEvent("mcd-go", { detail: { page: "presupuestos" } }));
  }

  async function invitar() {
    if (!sel) return;
    setBusy("Invitando…");
    setErr("");
    try {
      await invitarMiembro(sel.id, invite);
      setInvite("");
      setMembers(await listarMiembros(sel.id));
      setMsg("Invitación hecha. El colega verá la obra en Mis presupuestos.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "No se pudo invitar.");
    } finally {
      setBusy("");
    }
  }

  if (!user) {
    return (
      <div className="pdf-shell" data-guest-ok>
        <header className="pdf-hero">
          <p className="doc-kicker">PRE-04 · Biblioteca</p>
          <h2>Mis presupuestos</h2>
          <p>Inicie sesión con Google para ver su biblioteca.</p>
        </header>
        <button type="button" className="btn primary" onClick={openGoogle}>
          Iniciar sesión
        </button>
      </div>
    );
  }

  return (
    <div className="pdf-shell" data-guest-ok>
      <header className="pdf-hero">
        <p className="doc-kicker">PRE-04 · Biblioteca en la nube</p>
        <h2>Mis presupuestos</h2>
        <p>
          {!plansLive
            ? "Periodo gratuito: la biblioteca en la nube está abierta. Los cobros y vigencias empiezan cuando el titular dé la venia."
            : isPro
              ? `Plan Pro vigente${plan?.paidUntil ? ` hasta ${when(plan.paidUntil)}` : ""}. Ya puede compartir sus archivos e invitar a colegas Pro por correo.`
              : "Para compartir sus archivos necesita Plan Pro."}
        </p>
      </header>

      <div className="pdf-grid">
        <section className="pdf-main">
          {msg ? <p className="mcd-ok">{msg}</p> : null}
          {err && isPro ? <p className="mcd-err">{err}</p> : null}
          <h3>Nube {isPro ? "" : "· bloqueada"}</h3>
          {isPro ? (
            <div className="pre-lib-list pdf-lib">
              {cloud.map((a) => (
                <article key={a.id} className={sel?.id === a.id ? "on" : ""}>
                  <button type="button" onClick={() => setSel(a)}>
                    <b>{a.nombre || a.obra || "Presupuesto"}</b>
                    <span>
                      {a.obra} · {a.partidas} partidas · {money(a.total)} · {when(a.savedAt)}
                      {a.owner === false ? " · compartido" : ""}
                    </span>
                  </button>
                  <div>
                    <button type="button" className="btn" onClick={() => void abrir(a.id)}>
                      Abrir
                    </button>
                    {a.owner !== false ? (
                      <button
                        type="button"
                        className="btn secondary"
                        onClick={() => void borrarCloudBudget(a.id).then(load)}
                      >
                        Eliminar
                      </button>
                    ) : null}
                  </div>
                </article>
              ))}
              {cloud.length === 0 ? <p className="mcd-empty">Aún no hay obras en la nube. Guarde desde PRE-01 o genere desde PDF.</p> : null}
            </div>
          ) : (
            <p className="mcd-empty">Active Plan Pro para ver y compartir la biblioteca profesional.</p>
          )}

          {sel && isPro && sel.owner !== false ? (
            <div className="pdf-invite">
              <h3>Equipo de esta obra</h3>
              <p>
                {plansLive
                  ? "Solo correos con Plan Pro activo pueden entrar. Quien no haya pagado no desbloquea la colaboración."
                  : "Periodo gratuito: puede invitar colegas. Cuando operen los planes, ambos deberán tener vigencia Pro."}
              </p>
              <div className="pdf-invite-row">
                <input value={invite} onChange={(e) => setInvite(e.target.value)} placeholder="coleg@estudio.pe" />
                <button type="button" className="btn primary" disabled={Boolean(busy)} onClick={() => void invitar()}>
                  Invitar
                </button>
              </div>
              <ul>
                {members.map((m) => (
                  <li key={m}>
                    {m}
                    <button type="button" onClick={() => void quitarMiembro(sel.id, m).then(() => listarMiembros(sel.id).then(setMembers))}>
                      Quitar
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <h3>En este equipo</h3>
          <p className="pdf-note">Borradores locales. Pasan a la nube cuando guarda con Plan Pro activo.</p>
          <ul className="pdf-local">
            {local.map((a) => (
              <li key={a.id}>
                <b>{a.nombre}</b>
                <span>
                  {money(a.total)} · {when(a.savedAt)}
                </span>
              </li>
            ))}
            {local.length === 0 ? <li>Sin archivos locales.</li> : null}
          </ul>
        </section>
        <div>
          {isProNow(plan) ? (
            <p className="mcd-ok" style={{ marginBottom: 12 }}>
              Plan Pro vigente hasta {plan?.paidUntil ? when(plan.paidUntil) : "—"}. Puede renovar con Culqi cuando quiera.
            </p>
          ) : null}
          <PayBox
            kind="pro"
            onPaid={async () => {
              setMsg("Pago Culqi confirmado. Plan Pro activo: la biblioteca ya se guarda en la nube.");
              setErr("");
              await refreshPlan();
              await load();
            }}
            busy={busy}
            error={isPro ? "" : err}
          />
        </div>
      </div>
    </div>
  );
}

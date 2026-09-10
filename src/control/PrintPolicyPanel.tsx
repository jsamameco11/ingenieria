import { useEffect, useState } from "react";
import { readControlToken } from "../lib/controlGate";
import { cleanPrintLabel, fetchPrintPolicy, setPrintPolicy, type PrintPolicy } from "../lib/printPolicy";

function when(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-PE", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function PrintPolicyPanel() {
  const [policy, setPolicy] = useState<PrintPolicy | null>(null);
  const [cleanPaid, setCleanPaid] = useState(false);
  const [soles, setSoles] = useState("2.00");
  const [wait, setWait] = useState("");
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  useEffect(() => {
    void fetchPrintPolicy().then((next) => {
      setPolicy(next);
      setCleanPaid(next.cleanPaid);
      setSoles(next.soles > 0 ? next.soles.toFixed(2) : "2.00");
    });
  }, []);

  async function guardar() {
    const token = readControlToken();
    if (!token) {
      setErr("Vuelva a entrar al panel con su clave de titular.");
      return;
    }
    const monto = Number(String(soles).replace(",", "."));
    if (cleanPaid && !(monto > 0)) {
      setErr("Indique el monto en soles por cada hoja de cálculo.");
      return;
    }
    setWait("Guardando política…");
    setErr("");
    setOk("");
    try {
      const next = await setPrintPolicy({ cleanPaid, soles: monto }, token);
      setPolicy(next);
      setSoles(next.soles > 0 ? next.soles.toFixed(2) : soles);
      setOk("Política de marca de agua guardada. Ya rige en las hojas de cálculo.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      setWait("");
    }
  }

  return (
    <section className="ctl-wm" aria-label="Marca de agua de las hojas de cálculo">
      <p className="ctl-wm-kicker">Titular · impresión de memorias</p>
      <h3>Marca de agua en las hojas de cálculo</h3>
      <p>
        Al pulsar <b>Imprimir / PDF</b> el ingeniero elige entre copia con marca de agua y documento limpio.
        Hoy ambas salidas son gratuitas. Cuando usted active el cobro, la copia limpia mostrará el monto por hoja.
      </p>

      <div className="ctl-wm-grid">
        <article className="ctl-wm-card">
          <small>Opción 1 · siempre libre</small>
          <b>Con marca de agua</b>
          <span>Gratis</span>
          <p>Copia de trabajo. Diagonal MemoriaCalc y leyenda «Copia gratuita».</p>
        </article>
        <article className={`ctl-wm-card${cleanPaid ? " paid" : ""}`}>
          <small>Opción 2 · la que usted tarifa</small>
          <b>Sin marca de agua</b>
          <span>{cleanPaid ? cleanPrintLabel({ cleanPaid, soles: Number(String(soles).replace(",", ".")) || 0, updatedAt: null, updatedBy: null }) : "Gratis"}</span>
          <p>Documento limpio para expediente. El precio se publica en el diálogo de impresión.</p>
        </article>
      </div>

      <form
        className="ctl-form ctl-wm-form"
        onSubmit={(e) => {
          e.preventDefault();
          void guardar();
        }}
      >
        <label className="ctl-wm-switch">
          <input type="checkbox" checked={cleanPaid} onChange={(e) => setCleanPaid(e.target.checked)} />
          <span>Cobrar por quitar la marca de agua</span>
        </label>
        <label>
          Monto por hoja de cálculo (S/)
          <input
            type="number"
            min="0.50"
            max="999"
            step="0.50"
            inputMode="decimal"
            value={soles}
            onChange={(e) => setSoles(e.target.value)}
            disabled={!cleanPaid}
          />
        </label>
        <p className="ctl-hint">
          {cleanPaid
            ? "El diálogo mostrará el monto. El cobro Culqi de esta partida se conectará cuando lo pida; mientras tanto el precio ya queda publicado."
            : "Mientras el interruptor esté apagado, ambas opciones aparecen como Gratis y se imprimen sin cobro."}
        </p>
        {policy?.updatedAt ? (
          <p className="ctl-hint">Último cambio: {when(policy.updatedAt)}{policy.updatedBy ? ` · ${policy.updatedBy}` : ""}</p>
        ) : null}
        {err ? <p className="ctl-err">{err}</p> : null}
        {ok ? <p className="ctl-ok">{ok}</p> : null}
        <button type="submit" className="ctl-btn primary" disabled={Boolean(wait)}>
          {wait || "Guardar política de impresión"}
        </button>
      </form>
    </section>
  );
}

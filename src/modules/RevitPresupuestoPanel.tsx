import { useEffect, useMemo, useState } from "react";
import { ADDIN_RELEASE, REVIT_YEARS, downloadHref, fetchAddinRelease, type AddinRelease, type RevitYear } from "../lib/presupuesto/revit/addinCatalog";
import { anexarFilas, cruzarPlantilla, parsePaquete, semaforo } from "../lib/presupuesto/revit/engine";
import type { RevitFila, RevitPaquete } from "../lib/presupuesto/revit/types";
import type { LineaPresupuesto } from "../lib/presupuesto/types";
import { useAuth } from "../ui/AuthProvider";

const ESTADO_LABEL: Record<RevitFila["estado"], string> = {
  sugerida: "Sugerida",
  revisar: "Revisar",
  aceptada: "Aceptada",
  anexada: "Anexada",
  fuera_de_plantilla: "Fuera de plantilla",
  sin_identificar: "Sin identificar",
  hueco_plantilla: "Falta en el modelo",
  hueco_modelo: "Sin acero",
  conflicto: "Conflicto",
};

function isWindows() {
  return typeof navigator !== "undefined" && /Windows|Win64|Win32/i.test(navigator.userAgent);
}

export function RevitPresupuestoPanel({
  plantillaId,
  lineas,
  onAnexar,
}: {
  plantillaId?: string;
  lineas: LineaPresupuesto[];
  onAnexar: (next: LineaPresupuesto[]) => void;
}) {
  const { isPro, plansLive, openGoogle, user } = useAuth();
  const puedeVincular = isPro;
  const [rel, setRel] = useState<AddinRelease>(ADDIN_RELEASE);
  const [year, setYear] = useState<RevitYear>(2025);
  const [paquete, setPaquete] = useState<RevitPaquete | null>(null);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    void fetchAddinRelease().then(setRel);
  }, []);

  const filas = useMemo(() => (paquete ? cruzarPlantilla(paquete, plantillaId, lineas) : []), [paquete, plantillaId, lineas]);
  const sem = useMemo(() => semaforo(filas), [filas]);
  const win = isWindows();

  function irPlanes() {
    window.dispatchEvent(new CustomEvent("mcd-go", { detail: { page: "planes" } }));
  }

  async function cargarArchivo(file: File) {
    setErr("");
    setMsg("");
    if (!puedeVincular) {
      setErr("Cuando los planes operen, la vinculación pedirá Plan Pro activo.");
      return;
    }
    try {
      const raw = JSON.parse(await file.text()) as unknown;
      const next = parsePaquete(raw);
      if (!next.grupos.length) throw new Error("El archivo no trae grupos de elementos.");
      setPaquete(next);
      setMsg(`${next.grupos.length} grupo${next.grupos.length === 1 ? "" : "s"} leídos. Revise la identificación y anexe.`);
    } catch (e) {
      setPaquete(null);
      setErr(e instanceof Error ? e.message : "No se pudo leer el archivo .mcrevit.json.");
    }
  }

  function anexar() {
    if (!paquete) return;
    const next = anexarFilas(lineas, filas, paquete);
    onAnexar(next);
    setMsg("Partidas anexadas al presupuesto. Los metrados quedan vinculados al UniqueId del modelo.");
  }

  return (
    <div className="revit-panel">
      <header className="revit-head">
        <p className="doc-kicker">Revit · add-in</p>
        <h2>Modelo y presupuesto</h2>
        <p>
          Descargue el plugin aquí. Identifique familias del RVT, crúcelas con la plantilla RN y anexe metrados.
          {plansLive
            ? " La vinculación del modelo pide Plan Pro activo."
            : " La vinculación es gratuita hasta que operen los planes."}
        </p>
      </header>
      {plansLive && !puedeVincular ? (
        <div className="plaza-empty">
          <h3>Vinculación con Plan Pro</h3>
          <p>El instalador se descarga sin cargo. Conectar el modelo queda reservado al Plan Pro.</p>
          <div className="revit-actions">
            {!user ? (
              <button type="button" className="btn primary" onClick={openGoogle}>
                Iniciar sesión
              </button>
            ) : null}
            <button type="button" className="btn primary" onClick={irPlanes}>
              Ver planes
            </button>
          </div>
        </div>
      ) : null}

      <section className="revit-addin">
        <div>
          <h3>Add-in MemoriaCalc</h3>
          <p>
            Plugin de Autodesk Revit {REVIT_YEARS.join(", ")} · Windows. Versión {rel.version}
            {rel.publishedAt ? ` · ${rel.publishedAt}` : ""}. Ejecute el instalador y abra Revit: se carga la cinta MemoriaCalc.
          </p>
        </div>
        {win ? (
          <div className="revit-dl">
            <label>
              Año
              <select value={year} onChange={(e) => setYear(Number(e.target.value) as RevitYear)}>
                {REVIT_YEARS.map((y) => (
                  <option key={y} value={y}>
                    Revit {y}
                  </option>
                ))}
              </select>
            </label>
            {rel.available && rel.urls[year] ? (
              <a className="btn primary" href={downloadHref(rel, year)} download="MemoriaCalc.Revit.Setup.exe">
                Descargar instalador
              </a>
            ) : (
              <button type="button" className="btn secondary" disabled>
                El instalador se publicará con la primera versión
              </button>
            )}
          </div>
        ) : (
          <p className="revit-os">Este equipo no es Windows. El add-in se instala en la computadora con Revit.</p>
        )}
        <p className="revit-hash">
          {rel.available && rel.sha256 ? `SHA-256 ${rel.sha256} · ${rel.sizeLabel}` : rel.notes}
        </p>
      </section>

      <section className="revit-load">
        <h3>Paquete del modelo</h3>
        <p>Exporte desde el add-in un archivo <code>.mcrevit.json</code> y cárguelo aquí.</p>
        <input
          type="file"
          accept=".json,.mcrevit.json,application/json"
          disabled={!puedeVincular}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void cargarArchivo(f);
          }}
        />
      </section>

      {err ? <p className="mcd-err">{err}</p> : null}
      {msg ? <p className="mcd-ok">{msg}</p> : null}

      {paquete ? (
        <>
          <dl className="revit-kpi">
            <div>
              <dt>Identificados</dt>
              <dd>{sem.identificados}</dd>
            </div>
            <div>
              <dt>A revisar</dt>
              <dd>{sem.revisar}</dd>
            </div>
            <div>
              <dt>Anexados</dt>
              <dd>{sem.anexados}</dd>
            </div>
            <div>
              <dt>Sin partida</dt>
              <dd>{sem.rojos}</dd>
            </div>
          </dl>
          <div className="revit-table-wrap">
            <table className="revit-table">
              <thead>
                <tr>
                  <th>Estado</th>
                  <th>Familia / tipo</th>
                  <th>Partida</th>
                  <th>Metrado</th>
                  <th>Motivo</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((f) => (
                  <tr key={f.id} className={`revit-${f.estado}`}>
                    <td>{ESTADO_LABEL[f.estado]}</td>
                    <td>
                      <b>{f.familia}</b>
                      <small>
                        {f.tipo}
                        {f.nivel ? ` · ${f.nivel}` : ""}
                      </small>
                    </td>
                    <td>
                      <b>{f.codigo || "—"}</b>
                      <small>{f.descripcion}</small>
                    </td>
                    <td>
                      {f.metrado ? `${f.metrado.toLocaleString("es-PE", { maximumFractionDigits: 3 })} ${f.und}` : "—"}
                    </td>
                    <td>{f.motivo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="revit-actions">
            <button type="button" className="btn primary" onClick={anexar}>
              Anexar al presupuesto
            </button>
          </div>
        </>
      ) : (
        <div className="plaza-empty">
          <h3>Sin modelo cargado</h3>
          <p>
            Instale el add-in desde esta página, exporte el paquete en Revit y cárguelo aquí. La vinculación es
            gratuita hasta que operen los planes.
          </p>
        </div>
      )}
    </div>
  );
}

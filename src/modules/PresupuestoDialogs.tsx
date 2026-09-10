import { useEffect, useMemo, useRef, useState } from "react";
import {
  CATEGORIAS_CAPECO,
  INDICES_UNIFICADOS,
  IU_GRUPO_LABEL,
  JORNADAS_TIPICAS,
  KIND_META,
  KIND_ORDER,
  MONEDAS,
  MONEDA_META,
  SISTEMA_CONTRATACION_META,
  UNIDADES_INSUMO,
  categoriaSugerida,
  codigoIU,
  crearInsumoObra,
  indicesParaKind,
  iuSugerido,
  money,
  nombreIU,
  siguienteCodigo,
  simboloIU,
  undSugerida,
  type Insumo,
  type MonedaCodigo,
  type PresupuestoArchivo,
  type PresupuestoState,
  type RecursoKind,
  type SistemaContratacion,
} from "../lib/presupuesto";
import { EXPEDIENTE_PDF_HOJAS, PRINT_HOJAS, type PrintHojaId } from "./PresupuestoPrint";

function fmtFecha(iso: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("es-PE", { dateStyle: "short", timeStyle: "short" });
}

export function ArchivoModal({
  open,
  onClose,
  nube,
  actualId,
  mensaje,
  ocupado,
  configurada,
  onAbrir,
  onBorrar,
  onNuevo,
}: {
  open: boolean;
  onClose: () => void;
  nube: PresupuestoArchivo[];
  actualId?: string;
  mensaje: string;
  ocupado: boolean;
  configurada: boolean;
  onAbrir: (a: PresupuestoArchivo) => void;
  onBorrar: (id: string) => void;
  onNuevo: () => void;
}) {
  if (!open) return null;
  return (
    <div className="pre-modal-back" role="presentation" onClick={onClose}>
      <div className="pre-modal" role="dialog" aria-labelledby="pre-arch-title" onClick={(e) => e.stopPropagation()}>
        <header>
          <div>
            <h3 id="pre-arch-title">Archivos guardados</h3>
            <p>
              Se guardan en este equipo siempre. Si Supabase está configurado y el esquema está creado, también se
              sincronizan en la nube.
            </p>
          </div>
          <button type="button" className="btn secondary" onClick={onClose}>
            Cerrar
          </button>
        </header>
        {mensaje ? <p className="pre-modal-msg">{mensaje}</p> : null}
        {!configurada ? (
          <p className="pre-modal-empty">
            Modo local activo. Para la nube, defina <code>VITE_SUPABASE_URL</code> / <code>VITE_SUPABASE_ANON_KEY</code> y
            ejecute <code>supabase/schema.sql</code> en el SQL Editor.
          </p>
        ) : null}
        <>
            <div className="pre-modal-actions" style={{ justifyContent: "flex-start" }}>
              <button type="button" className="btn" onClick={onNuevo} disabled={ocupado}>
                Guardar este presupuesto
              </button>
            </div>
            <h4>Presupuestos</h4>
            <ArchivoTabla
              rows={nube}
              actualId={actualId}
              vacio="Aún no hay presupuestos. Pulse Guardar para crear el primero."
              ocupado={ocupado}
              onAbrir={onAbrir}
              onBorrar={onBorrar}
            />
          </>
      </div>
    </div>
  );
}

function ArchivoTabla({
  rows,
  actualId,
  vacio,
  ocupado,
  onAbrir,
  onBorrar,
}: {
  rows: PresupuestoArchivo[];
  actualId?: string;
  vacio: string;
  ocupado?: boolean;
  onAbrir: (a: PresupuestoArchivo) => void;
  onBorrar: (id: string) => void;
}) {
  if (!rows.length) return <p className="pre-modal-empty">{vacio}</p>;
  return (
    <div className="pre-table-wrap">
      <table className="pre-table">
        <thead>
          <tr>
            <th>Archivo</th>
            <th>Obra</th>
            <th className="n">Partidas</th>
            <th>Total</th>
            <th>Guardado</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((a) => (
            <tr key={a.id} className={a.id === actualId ? "on" : undefined}>
              <td>
                <button type="button" className="pre-link" onClick={() => onAbrir(a)}>
                  {a.nombre}
                </button>
              </td>
              <td>{a.obra}</td>
              <td className="n">{a.partidas}</td>
              <td className="n mono">{money(a.total)}</td>
              <td>{fmtFecha(a.savedAt)}</td>
              <td>
                <button type="button" className="pre-x" onClick={() => onBorrar(a.id)} title="Eliminar archivo" disabled={ocupado}>
                  ×
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const PRESETS: { id: string; label: string; hojas: PrintHojaId[] }[] = [
  { id: "completo", label: "Expediente completo", hojas: PRINT_HOJAS.map((h) => h.id) },
  { id: "expediente-pdf", label: "Expediente desde planos", hojas: EXPEDIENTE_PDF_HOJAS },
  { id: "presupuesto", label: "Solo presupuesto", hojas: ["formacion", "detallado", "resumen", "partidas", "metrados"] },
  { id: "apu", label: "Solo APU", hojas: ["apu"] },
  { id: "insumos", label: "Solo insumos", hojas: ["insumos", "insumos-partida"] },
  { id: "particionado", label: "Costos particionados", hojas: ["particionado"] },
  { id: "indirectos", label: "GG y fórmula", hojas: ["gg", "formula"] },
  { id: "ets", label: "Especificaciones técnicas", hojas: ["especificaciones"] },
];

const GRUPOS = ["Presupuesto", "Análisis", "Indirectos", "Expediente"] as const;

export function PrintModal({
  open,
  seleccion,
  onToggle,
  onSet,
  onClose,
  onPrint,
}: {
  open: boolean;
  seleccion: PrintHojaId[];
  onToggle: (id: PrintHojaId) => void;
  onSet: (ids: PrintHojaId[]) => void;
  onClose: () => void;
  onPrint: () => void;
}) {
  if (!open) return null;
  return (
    <div className="pre-modal-back" role="presentation" onClick={onClose}>
      <div className="pre-modal" role="dialog" aria-labelledby="pre-print-title" onClick={(e) => e.stopPropagation()}>
        <header>
          <div>
            <h3 id="pre-print-title">Imprimir hojas</h3>
            <p>Elija las hojas del presupuesto, como en S10 / Opus. Se imprimen en un solo PDF (A4).</p>
          </div>
          <button type="button" className="btn secondary" onClick={onClose}>
            Cerrar
          </button>
        </header>
        <div className="pre-print-presets" role="group" aria-label="Conjuntos de hojas">
          {PRESETS.map((p) => (
            <button key={p.id} type="button" className="btn secondary" onClick={() => onSet(p.hojas)}>
              {p.label}
            </button>
          ))}
        </div>
        {GRUPOS.map((g) => (
          <div key={g}>
            <h4>{g}</h4>
            <ul className="pre-print-list">
              {PRINT_HOJAS.filter((h) => h.grupo === g).map((h) => (
                <li key={h.id}>
                  <label>
                    <input type="checkbox" checked={seleccion.includes(h.id)} onChange={() => onToggle(h.id)} />
                    <span>
                      <strong>{h.label}</strong>
                      <small>{h.hint}</small>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        ))}
        <div className="pre-modal-actions">
          <button type="button" className="btn secondary" onClick={() => onSet([])}>
            Ninguna
          </button>
          <button type="button" className="btn" onClick={onPrint} disabled={!seleccion.length}>
            Imprimir / PDF
          </button>
        </div>
      </div>
    </div>
  );
}

export function GuardarComoModal({
  open,
  valor,
  onChange,
  onClose,
  onOk,
}: {
  open: boolean;
  valor: string;
  onChange: (v: string) => void;
  onClose: () => void;
  onOk: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (open) ref.current?.focus();
  }, [open]);
  if (!open) return null;
  return (
    <div className="pre-modal-back" role="presentation" onClick={onClose}>
      <div className="pre-modal pre-modal-sm" role="dialog" onClick={(e) => e.stopPropagation()}>
        <header>
          <div>
            <h3>Guardar presupuesto</h3>
            <p>Se guarda en este equipo y, si la nube está lista, también en Supabase. El nombre identifica la obra.</p>
          </div>
        </header>
        <label className="pre-modal-field">
          Nombre
          <input
            ref={ref}
            value={valor}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onOk();
            }}
          />
        </label>
        <div className="pre-modal-actions">
          <button type="button" className="btn secondary" onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="btn" onClick={onOk} disabled={!valor.trim()}>
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}

export function usePrintHojas() {
  const [seleccion, setSeleccion] = useState<PrintHojaId[]>(["formacion", "detallado", "resumen"]);
  const toggle = (id: PrintHojaId) =>
    setSeleccion((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  return { seleccion, setSeleccion, toggle };
}

const IU_GRUPO_ORDEN: Array<(typeof INDICES_UNIFICADOS)[number]["grupo"]> = [
  "mano-obra",
  "materiales",
  "maquinaria",
  "equipos",
  "servicios",
  "general",
];

export function InsumoObraModal({
  open,
  kindInit,
  kindLocked,
  nombreInit,
  propios,
  edit,
  incorporarApu,
  onClose,
  onSave,
}: {
  open: boolean;
  kindInit: RecursoKind;
  kindLocked: boolean;
  nombreInit: string;
  propios: Insumo[];
  edit?: Insumo;
  incorporarApu: boolean;
  onClose: () => void;
  onSave: (insumo: Insumo) => void;
}) {
  const nombreRef = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<RecursoKind>(kindInit);
  const [codigo, setCodigo] = useState("");
  const [nombre, setNombre] = useState("");
  const [und, setUnd] = useState("und");
  const [precio, setPrecio] = useState(0);
  const [iu, setIu] = useState(39);
  const [categoria, setCategoria] = useState("Agregados");

  useEffect(() => {
    if (!open) return;
    const k = edit?.kind ?? kindInit;
    setKind(k);
    setCodigo(edit?.codigo ?? siguienteCodigo(k, propios));
    setNombre(edit?.nombre ?? nombreInit.trim());
    setUnd(edit?.und ?? undSugerida(k));
    setPrecio(edit?.precio ?? 0);
    setIu(edit?.iu ?? iuSugerido(k));
    setCategoria(edit?.categoria ?? categoriaSugerida(k));
    window.setTimeout(() => nombreRef.current?.focus(), 40);
  }, [open, kindInit, nombreInit, edit?.id]);

  const gruposIu = useMemo(() => {
    const { preferidos } = indicesParaKind(kind);
    const orden = [
      ...IU_GRUPO_ORDEN.filter((g) => preferidos.some((i) => i.grupo === g)),
      ...IU_GRUPO_ORDEN.filter((g) => !preferidos.some((i) => i.grupo === g)),
    ];
    return orden.map((grupo) => ({
      grupo,
      items: INDICES_UNIFICADOS.filter((i) => i.grupo === grupo),
      recomendado: preferidos.some((i) => i.grupo === grupo),
    }));
  }, [kind]);

  const cambiarKind = (k: RecursoKind) => {
    setKind(k);
    if (edit) return;
    setCodigo(siguienteCodigo(k, propios));
    setUnd(undSugerida(k));
    setIu(iuSugerido(k));
    setCategoria(categoriaSugerida(k));
  };

  const guardar = () => {
    const nom = nombre.trim();
    if (!nom) {
      nombreRef.current?.focus();
      return;
    }
    onSave(
      crearInsumoObra(
        {
          id: edit?.id,
          kind,
          codigo,
          nombre: nom,
          und,
          precio,
          iu,
          categoria,
        },
        propios
      )
    );
  };

  if (!open) return null;
  const meta = KIND_META[kind];
  const titulo = edit ? "Editar insumo de esta obra" : "Nuevo insumo de esta obra";
  const cta = edit ? "Guardar cambios" : incorporarApu ? "Crear e incorporar al APU" : "Crear insumo";

  return (
    <div className="pre-modal-back" role="presentation" onClick={onClose}>
      <div
        className="pre-modal pre-modal-lg"
        role="dialog"
        aria-labelledby="pre-insumo-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header>
          <div>
            <h3 id="pre-insumo-title">{titulo}</h3>
            <p>
              Se guarda solo en este presupuesto. El catálogo CAPECO y las plantillas no se modifican. El código se
              asigna en serie ({meta.corto}-siguiente correlativo).
            </p>
          </div>
          <button type="button" className="btn secondary" onClick={onClose}>
            Cerrar
          </button>
        </header>

        <div className="pre-modal-grid">
          <label className="pre-modal-field">
            Tipo de recurso
            <select
              value={kind}
              disabled={kindLocked}
              onChange={(e) => cambiarKind(e.target.value as RecursoKind)}
            >
              {KIND_ORDER.map((k) => (
                <option key={k} value={k}>
                  {KIND_META[k].corto} · {KIND_META[k].label}
                </option>
              ))}
            </select>
          </label>
          <label className="pre-modal-field">
            Código
            <input
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.toUpperCase())}
              spellCheck={false}
              aria-label="Código del insumo"
            />
            <small className="pre-modal-hint">
              Sugerido: {siguienteCodigo(kind, propios.filter((i) => i.id !== edit?.id))}
            </small>
          </label>
          <label className="pre-modal-field wide">
            Descripción
            <input
              ref={nombreRef}
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej. Arena de río lavada"
              onKeyDown={(e) => {
                if (e.key === "Enter") guardar();
              }}
            />
          </label>
          <label className="pre-modal-field">
            Unidad
            <select value={und} onChange={(e) => setUnd(e.target.value)}>
              {UNIDADES_INSUMO.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
              {und && !UNIDADES_INSUMO.includes(und as (typeof UNIDADES_INSUMO)[number]) ? (
                <option value={und}>{und}</option>
              ) : null}
            </select>
          </label>
          <label className="pre-modal-field">
            Precio unitario S/
            <input
              type="number"
              min={0}
              step="0.01"
              value={precio}
              onChange={(e) => setPrecio(parseFloat(e.target.value) || 0)}
            />
          </label>
          <label className="pre-modal-field wide">
            Índice unificado IUPC / INEI
            <select value={iu} onChange={(e) => setIu(Number(e.target.value))}>
              {gruposIu.map((g) => (
                <optgroup
                  key={g.grupo}
                  label={`${IU_GRUPO_LABEL[g.grupo]}${g.recomendado ? " · recomendado" : ""}`}
                >
                  {g.items.map((i) => (
                    <option key={i.codigo} value={i.codigo}>
                      {codigoIU(i.codigo)} — {i.nombre} ({i.simbolo})
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <small className="pre-modal-hint">
              {codigoIU(iu)} — {nombreIU(iu)} ({simboloIU(iu)}). Sirve para la fórmula polinómica de esta obra.
            </small>
          </label>
          <label className="pre-modal-field wide">
            Rubro CAPECO
            <select value={categoria} onChange={(e) => setCategoria(e.target.value)}>
              {CATEGORIAS_CAPECO.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
              {categoria && !CATEGORIAS_CAPECO.includes(categoria as (typeof CATEGORIAS_CAPECO)[number]) ? (
                <option value={categoria}>{categoria}</option>
              ) : null}
            </select>
          </label>
        </div>

        <div className="pre-modal-actions">
          <button type="button" className="btn secondary" onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="btn" onClick={guardar} disabled={!nombre.trim()}>
            {cta}
          </button>
        </div>
      </div>
    </div>
  );
}

export type ProyectoDraft = {
  obra: string;
  lugar: string;
  cliente: string;
  fecha: string;
  gg: number;
  utilidad: number;
  igv: number;
  moneda: MonedaCodigo;
  tipoCambio: number;
  jornada: number;
  entidad: string;
  rucCliente: string;
  contratista: string;
  proyectista: string;
  residente: string;
  direccion: string;
  departamento: string;
  provincia: string;
  distrito: string;
  sistemaContratacion: SistemaContratacion;
  observaciones: string;
};

export function draftDesdeState(s: PresupuestoState): ProyectoDraft {
  return {
    obra: s.obra,
    lugar: s.lugar,
    cliente: s.cliente,
    fecha: s.fecha,
    gg: s.gg,
    utilidad: s.utilidad,
    igv: s.igv,
    moneda: s.moneda,
    tipoCambio: s.tipoCambio,
    jornada: s.jornada,
    entidad: s.entidad,
    rucCliente: s.rucCliente,
    contratista: s.contratista,
    proyectista: s.proyectista,
    residente: s.residente,
    direccion: s.direccion,
    departamento: s.departamento,
    provincia: s.provincia,
    distrito: s.distrito,
    sistemaContratacion: s.sistemaContratacion,
    observaciones: s.observaciones,
  };
}

export function aplicarDraft<T extends PresupuestoState>(state: T, d: ProyectoDraft): T {
  return { ...state, ...d };
}

export function ProyectoModal({
  open,
  modo,
  plantillaNombre,
  aviso,
  inicial,
  onClose,
  onConfirm,
}: {
  open: boolean;
  modo: "nuevo" | "plantilla" | "editar";
  plantillaNombre?: string;
  aviso?: string;
  inicial: PresupuestoState;
  onClose: () => void;
  onConfirm: (d: ProyectoDraft) => void;
}) {
  const [d, setD] = useState(() => draftDesdeState(inicial));
  const obraRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setD(draftDesdeState(inicial));
    window.setTimeout(() => obraRef.current?.focus(), 40);
  }, [open]);

  const patch = (p: Partial<ProyectoDraft>) => setD((s) => ({ ...s, ...p }));

  if (!open) return null;

  const titulo =
    modo === "nuevo" ? "Nueva obra" : modo === "plantilla" ? "Cargar plantilla" : "Datos de la obra";
  const cta = modo === "editar" ? "Guardar datos" : modo === "plantilla" ? "Cargar presupuesto" : "Crear presupuesto";
  const mon = MONEDA_META[d.moneda];

  return (
    <div className="pre-modal-back" role="presentation" onClick={onClose}>
      <div
        className="pre-modal pre-modal-xl"
        role="dialog"
        aria-labelledby="pre-proy-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header>
          <div>
            <h3 id="pre-proy-title">{titulo}</h3>
            <p>
              {modo === "plantilla" && plantillaNombre
                ? `Plantilla: ${plantillaNombre}. Confirme jornada, moneda y datos de la obra; el APU de mano de obra y maquinaria usa Cant. = Cuadrilla × Jornada / Rendimiento.`
                : "Estos datos encabezan el presupuesto. La jornada laboral (h/día) entra en el APU de MO, maquinaria y equipos en hm."}
            </p>
          </div>
          <button type="button" className="btn secondary" onClick={onClose}>
            Cancelar
          </button>
        </header>

        {aviso ? <p className="pre-modal-msg">{aviso}</p> : null}

        <h4>Identificación</h4>
        <div className="pre-modal-grid">
          <label className="pre-modal-field span-2">
            Nombre de la obra
            <input ref={obraRef} value={d.obra} onChange={(e) => patch({ obra: e.target.value })} required />
          </label>
          <label className="pre-modal-field">
            Cliente / propietario
            <input value={d.cliente} onChange={(e) => patch({ cliente: e.target.value })} />
          </label>
          <label className="pre-modal-field">
            RUC
            <input value={d.rucCliente} onChange={(e) => patch({ rucCliente: e.target.value })} inputMode="numeric" />
          </label>
          <label className="pre-modal-field">
            Entidad / contratante
            <input value={d.entidad} onChange={(e) => patch({ entidad: e.target.value })} />
          </label>
          <label className="pre-modal-field">
            Contratista (empresa ejecutora)
            <input value={d.contratista} onChange={(e) => patch({ contratista: e.target.value })} />
          </label>
          <label className="pre-modal-field">
            Fecha
            <input type="date" value={d.fecha} onChange={(e) => patch({ fecha: e.target.value })} />
          </label>
          <label className="pre-modal-field">
            Proyectista / supervisor
            <input value={d.proyectista} onChange={(e) => patch({ proyectista: e.target.value })} />
          </label>
          <label className="pre-modal-field">
            Residente de obra
            <input value={d.residente} onChange={(e) => patch({ residente: e.target.value })} />
          </label>
        </div>

        <h4>Ubicación</h4>
        <div className="pre-modal-grid">
          <label className="pre-modal-field span-2">
            Lugar
            <input value={d.lugar} onChange={(e) => patch({ lugar: e.target.value })} />
          </label>
          <label className="pre-modal-field">
            Departamento
            <input value={d.departamento} onChange={(e) => patch({ departamento: e.target.value })} />
          </label>
          <label className="pre-modal-field">
            Provincia
            <input value={d.provincia} onChange={(e) => patch({ provincia: e.target.value })} />
          </label>
          <label className="pre-modal-field">
            Distrito
            <input value={d.distrito} onChange={(e) => patch({ distrito: e.target.value })} />
          </label>
          <label className="pre-modal-field span-2">
            Dirección / referencia
            <input value={d.direccion} onChange={(e) => patch({ direccion: e.target.value })} />
          </label>
        </div>

        <h4>Condiciones de cálculo</h4>
        <div className="pre-modal-grid">
          <label className="pre-modal-field">
            Moneda
            <select
              value={d.moneda}
              onChange={(e) => {
                const moneda = e.target.value as MonedaCodigo;
                patch({ moneda, tipoCambio: moneda === "PEN" ? 1 : d.tipoCambio <= 1 ? 3.75 : d.tipoCambio });
              }}
            >
              {MONEDAS.map((m) => (
                <option key={m} value={m}>
                  {MONEDA_META[m].simbolo} · {MONEDA_META[m].nombre}
                </option>
              ))}
            </select>
          </label>
          <label className="pre-modal-field">
            Tipo de cambio (S/ por 1 {mon.iso})
            <input
              type="number"
              min={0.0001}
              step="0.001"
              value={d.tipoCambio}
              disabled={d.moneda === "PEN"}
              onChange={(e) => patch({ tipoCambio: parseFloat(e.target.value) || 1 })}
            />
          </label>
          <label className="pre-modal-field">
            Jornada laboral (h/día)
            <input
              type="number"
              min={1}
              max={24}
              step="0.5"
              value={d.jornada}
              onChange={(e) => patch({ jornada: parseFloat(e.target.value) || 8 })}
            />
          </label>
          <div className="pre-modal-field">
            <span>Jornadas típicas</span>
            <div className="pre-jornada-presets">
              {JORNADAS_TIPICAS.map((h) => (
                <button
                  key={h}
                  type="button"
                  className={d.jornada === h ? "on" : ""}
                  onClick={() => patch({ jornada: h })}
                >
                  {h} h
                </button>
              ))}
            </div>
          </div>
          <label className="pre-modal-field">
            Sistema de contratación
            <select
              value={d.sistemaContratacion}
              onChange={(e) => patch({ sistemaContratacion: e.target.value as SistemaContratacion })}
            >
              {(Object.keys(SISTEMA_CONTRATACION_META) as SistemaContratacion[]).map((k) => (
                <option key={k} value={k}>
                  {SISTEMA_CONTRATACION_META[k]}
                </option>
              ))}
            </select>
          </label>
          <label className="pre-modal-field">
            Gastos generales %
            <input type="number" min={0} step="0.1" value={d.gg} onChange={(e) => patch({ gg: parseFloat(e.target.value) || 0 })} />
          </label>
          <label className="pre-modal-field">
            Utilidad %
            <input
              type="number"
              min={0}
              step="0.1"
              value={d.utilidad}
              onChange={(e) => patch({ utilidad: parseFloat(e.target.value) || 0 })}
            />
          </label>
          <label className="pre-modal-field">
            IGV %
            <input type="number" min={0} step="0.1" value={d.igv} onChange={(e) => patch({ igv: parseFloat(e.target.value) || 0 })} />
          </label>
          <p className="pre-modal-hint span-2">
            Fórmula APU (MO, maquinaria y equipos en hm): <code>Cantidad = Cuadrilla × {d.jornada} h / Rendimiento</code>
            . El rendimiento es la producción del recurso en unidades de la partida por día. Los materiales no dependen de
            la jornada. Los precios del catálogo se leen en la moneda del proyecto ({mon.simbolo}).
          </p>
        </div>

        <h4>Observaciones</h4>
        <label className="pre-modal-field">
          Notas para el expediente
          <textarea rows={2} value={d.observaciones} onChange={(e) => patch({ observaciones: e.target.value })} />
        </label>

        <div className="pre-modal-actions">
          <button type="button" className="btn secondary" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => onConfirm({ ...d, obra: d.obra.trim() || "Obra nueva" })}
          >
            {cta}
          </button>
        </div>
      </div>
    </div>
  );
}

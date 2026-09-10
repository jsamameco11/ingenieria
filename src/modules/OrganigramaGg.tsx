import { useMemo } from "react";
import {
  costoPropioNodo,
  costoRama,
  defaultOrganigrama,
  formulaNodo,
  hijosDe,
  idsDescendientes,
  money,
  quitarNodo,
  uidOrg,
} from "../lib/presupuesto";
import type { OrgNodo, OrgNodoTipo } from "../lib/presupuesto";

const BOX_W = 208;
const BOX_H = 104;
const GAP_X = 44;
const GAP_Y = 76;
const PAD = 32;

type Laid = { id: string; x: number; y: number; w: number; h: number };

const TIPO_META: Record<OrgNodoTipo, { label: string; hint: string }> = {
  grupo: { label: "Área o jefatura", hint: "No tiene sueldo propio: suma lo que ganan los cargos a su cargo." },
  persona: { label: "Cargo remunerado", hint: "Parcial = personas × sueldo mensual × meses de obra." },
  gasto: { label: "Gasto fijo", hint: "Oficina, movilidad, comunicaciones u otro monto de la obra." },
};

function num(raw: string) {
  const n = parseFloat(raw);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

function layoutOrganigrama(nodos: OrgNodo[]): { nodes: Laid[]; width: number; height: number } {
  if (!nodos.length) return { nodes: [], width: 520, height: 220 };

  const children = (id: string | null) => nodos.filter((n) => (n.parentId ?? null) === id);
  const widthOf = (id: string): number => {
    const kids = children(id);
    if (!kids.length) return BOX_W;
    const inner = kids.reduce((s, k) => s + widthOf(k.id), 0) + GAP_X * (kids.length - 1);
    return Math.max(BOX_W, inner);
  };

  const placed: Laid[] = [];
  const place = (id: string, left: number, depth: number) => {
    const kids = children(id);
    const sw = widthOf(id);
    placed.push({ id, x: left + (sw - BOX_W) / 2, y: depth * (BOX_H + GAP_Y), w: BOX_W, h: BOX_H });
    const kidsW = kids.length
      ? kids.reduce((s, k) => s + widthOf(k.id), 0) + GAP_X * (kids.length - 1)
      : 0;
    let cx = kids.length && sw > kidsW ? left + (sw - kidsW) / 2 : left;
    for (const k of kids) {
      const kw = widthOf(k.id);
      place(k.id, cx, depth + 1);
      cx += kw + GAP_X;
    }
  };

  const ids = new Set(nodos.map((n) => n.id));
  const roots = [
    ...children(null),
    ...nodos.filter((n) => n.parentId && !ids.has(n.parentId)),
  ];
  let left = 0;
  for (const r of roots) {
    const sw = widthOf(r.id);
    place(r.id, left, 0);
    left += sw + GAP_X * 1.5;
  }

  const maxX = placed.reduce((m, n) => Math.max(m, n.x + n.w), 0);
  const maxY = placed.reduce((m, n) => Math.max(m, n.y + n.h), 0);
  return {
    nodes: placed.map((n) => ({ ...n, x: n.x + PAD, y: n.y + PAD })),
    width: Math.max(520, maxX + PAD * 2),
    height: Math.max(220, maxY + PAD * 2),
  };
}

function nuevoNodo(parentId: string | null, tipo: OrgNodoTipo = "persona"): OrgNodo {
  return {
    id: uidOrg(),
    parentId,
    cargo: tipo === "gasto" ? "Nuevo gasto" : tipo === "grupo" ? "Nueva área" : "Nuevo cargo",
    nombre: "",
    tipo,
    n: tipo === "grupo" ? 0 : 1,
    sueldo: 0,
    meses: tipo === "persona" ? 1 : 0,
    monto: 0,
  };
}

type Props = {
  nodos: OrgNodo[];
  onChange: (nodos: OrgNodo[]) => void;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  activo: boolean;
};

export function OrganigramaGg({ nodos, onChange, selectedId, onSelect, activo }: Props) {
  const layout = useMemo(() => layoutOrganigrama(nodos), [nodos]);
  const byId = useMemo(() => Object.fromEntries(layout.nodes.map((n) => [n.id, n])), [layout.nodes]);
  const selected = nodos.find((n) => n.id === selectedId) ?? null;
  const prohibidos = selected ? new Set([selected.id, ...idsDescendientes(nodos, selected.id)]) : new Set<string>();

  const patchNodo = (id: string, p: Partial<OrgNodo>) => {
    onChange(nodos.map((n) => (n.id === id ? { ...n, ...p } : n)));
  };

  const agregar = (parentId: string | null, tipo?: OrgNodoTipo) => {
    const n = nuevoNodo(parentId, tipo);
    onChange([...nodos, n]);
    onSelect(n.id);
  };

  const eliminar = (id: string) => {
    const next = quitarNodo(nodos, id);
    onChange(next.length ? next : [nuevoNodo(null, "grupo")]);
    onSelect(null);
  };

  return (
    <div className="pre-org">
      <div className="pre-org-toolbar">
        <div>
          <h3>Organigrama de gastos generales</h3>
          <p>
            Usted arma la organización de la obra: cree áreas, cargos y gastos, y asigne a cada uno su remuneración.
            El total del cuadro {activo ? "es el monto de gastos generales del presupuesto." : "queda como referencia hasta que elija calcular los GG con el organigrama."}
          </p>
        </div>
        <div className="pre-org-legend" aria-hidden>
          <span className="pre-org-leg grupo">Área</span>
          <span className="pre-org-leg persona">Cargo</span>
          <span className="pre-org-leg gasto">Gasto</span>
        </div>
        <div className="pre-org-actions">
          <button type="button" className="btn secondary" onClick={() => agregar(null, "grupo")}>
            Nueva área
          </button>
          <button type="button" className="btn secondary" onClick={() => agregar(selected?.id ?? null, "persona")}>
            Nuevo cargo
          </button>
          <button type="button" className="btn secondary" onClick={() => agregar(selected?.id ?? null, "gasto")}>
            Nuevo gasto
          </button>
          <button
            type="button"
            className="btn secondary"
            onClick={() => {
              onChange(defaultOrganigrama());
              onSelect("p-res");
            }}
          >
            Plantilla típica
          </button>
        </div>
      </div>

      <div className="pre-org-work">
        <div className="pre-org-scroll">
          {nodos.length === 0 ? (
            <p className="pre-org-empty">No hay cargos. Cree un área o cargue la plantilla típica de obra.</p>
          ) : (
            <div className="pre-org-board" style={{ width: layout.width, height: layout.height }}>
              <svg className="pre-org-lines" width={layout.width} height={layout.height} aria-hidden>
                {nodos.map((n) => {
                  const child = byId[n.id];
                  const parent = n.parentId ? byId[n.parentId] : null;
                  if (!child || !parent) return null;
                  const x1 = parent.x + parent.w / 2;
                  const y1 = parent.y + parent.h;
                  const x2 = child.x + child.w / 2;
                  const y2 = child.y;
                  const mid = y1 + (y2 - y1) / 2;
                  return (
                    <path
                      key={`l-${n.id}`}
                      d={`M ${x1} ${y1} V ${mid} H ${x2} V ${y2}`}
                      fill="none"
                      stroke="#8a7a5a"
                      strokeWidth="1.4"
                    />
                  );
                })}
              </svg>
              {nodos.map((n) => {
                const box = byId[n.id];
                if (!box) return null;
                const propio = costoPropioNodo(n);
                const rama = costoRama(nodos, n.id);
                const monto = n.tipo === "grupo" ? rama : propio;
                return (
                  <button
                    key={n.id}
                    type="button"
                    className={`pre-org-box ${n.tipo} ${selectedId === n.id ? "on" : ""}`}
                    style={{ left: box.x, top: box.y, width: box.w, height: box.h }}
                    onClick={() => onSelect(n.id)}
                  >
                    <em>{TIPO_META[n.tipo].label}</em>
                    <strong>{n.cargo || "Sin cargo"}</strong>
                    {n.nombre ? <span className="pre-org-name">{n.nombre}</span> : <span className="pre-org-name mute">Sin nombre</span>}
                    <b>S/ {money(monto)}</b>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <aside className="pre-org-insp">
          {selected ? (
            <>
              <header>
                <h4>Ficha del cargo</h4>
                <p>{TIPO_META[selected.tipo].hint}</p>
              </header>
              <label>
                Tipo
                <select
                  value={selected.tipo}
                  onChange={(e) => patchNodo(selected.id, { tipo: e.target.value as OrgNodoTipo })}
                >
                  <option value="grupo">Área o jefatura</option>
                  <option value="persona">Cargo remunerado</option>
                  <option value="gasto">Gasto fijo</option>
                </select>
              </label>
              <label>
                Cargo o partida
                <input value={selected.cargo} onChange={(e) => patchNodo(selected.id, { cargo: e.target.value })} />
              </label>
              <label>
                Nombre de la persona
                <input
                  value={selected.nombre}
                  placeholder="Opcional"
                  onChange={(e) => patchNodo(selected.id, { nombre: e.target.value })}
                />
              </label>
              <label>
                Reporta a
                <select
                  value={selected.parentId ?? ""}
                  onChange={(e) => patchNodo(selected.id, { parentId: e.target.value || null })}
                >
                  <option value="">— Raíz del organigrama —</option>
                  {nodos
                    .filter((n) => !prohibidos.has(n.id))
                    .map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.cargo}
                      </option>
                    ))}
                </select>
              </label>

              {selected.tipo === "persona" ? (
                <div className="pre-org-grid">
                  <label>
                    Personas
                    <input type="number" min={0} step={1} value={selected.n} onChange={(e) => patchNodo(selected.id, { n: num(e.target.value) })} />
                  </label>
                  <label>
                    Sueldo S/ mes
                    <input type="number" min={0} step={50} value={selected.sueldo} onChange={(e) => patchNodo(selected.id, { sueldo: num(e.target.value) })} />
                  </label>
                  <label>
                    Meses de obra
                    <input type="number" min={0} step={0.5} value={selected.meses} onChange={(e) => patchNodo(selected.id, { meses: num(e.target.value) })} />
                  </label>
                </div>
              ) : null}

              {selected.tipo === "gasto" ? (
                <div className="pre-org-grid">
                  <label>
                    Cantidad
                    <input type="number" min={0} step={1} value={selected.n} onChange={(e) => patchNodo(selected.id, { n: num(e.target.value) })} />
                  </label>
                  <label>
                    Monto S/
                    <input type="number" min={0} step={10} value={selected.monto} onChange={(e) => patchNodo(selected.id, { monto: num(e.target.value) })} />
                  </label>
                </div>
              ) : null}

              <div className="pre-org-parcial">
                <span>{formulaNodo(selected)}</span>
                <b>S/ {money(selected.tipo === "grupo" ? costoRama(nodos, selected.id) : costoPropioNodo(selected))}</b>
              </div>

              <div className="pre-org-insp-btns">
                <button type="button" className="btn secondary" onClick={() => agregar(selected.id, "persona")}>
                  Agregar a su cargo
                </button>
                <button type="button" className="btn secondary" onClick={() => eliminar(selected.id)}>
                  Quitar cargo
                </button>
              </div>
            </>
          ) : (
            <div className="pre-org-hint">
              <h4>Cómo armarlo</h4>
              <ol>
                <li>Pulse un recuadro del organigrama para editarlo.</li>
                <li>Indique el cargo, quién lo ocupa y cuánto gana.</li>
                <li>En un cargo remunerado: personas × sueldo mensual × meses.</li>
                <li>En un gasto fijo: el monto de oficina, movilidad u otro.</li>
                <li>Un área solo agrupa: su total es la suma de lo que tiene a cargo.</li>
              </ol>
            </div>
          )}
        </aside>
      </div>

      <div className="pre-org-table-wrap">
        <h4>Cuadro de remuneraciones</h4>
        <table className="pre-table">
          <thead>
            <tr>
              <th>Tipo</th>
              <th>Cargo</th>
              <th>Persona</th>
              <th>Cálculo</th>
              <th className="n">Parcial S/</th>
            </tr>
          </thead>
          <tbody>
            {nodos.map((n) => (
              <tr
                key={n.id}
                className={selectedId === n.id ? "on" : ""}
                onClick={() => onSelect(n.id)}
              >
                <td>{TIPO_META[n.tipo].label}</td>
                <td>
                  {hijosDe(nodos, n.parentId).length && n.parentId ? <span className="pre-org-indent" /> : null}
                  {n.cargo}
                </td>
                <td>{n.nombre || "—"}</td>
                <td>{formulaNodo(n)}</td>
                <td className="n mono">{money(n.tipo === "grupo" ? costoRama(nodos, n.id) : costoPropioNodo(n))}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="pre-grand">
              <td colSpan={4}>Total gastos generales del organigrama</td>
              <td className="n mono">
                S/ {money(nodos.filter((n) => !n.parentId).reduce((s, n) => s + costoRama(nodos, n.id), 0))}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

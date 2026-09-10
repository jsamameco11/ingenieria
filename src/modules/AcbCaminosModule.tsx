import { useMemo, useState } from "react";
import {
  ANCHO_AF_MEJORA,
  ANCHO_AF_REHAB,
  ANCHO_SAF,
  COV,
  DIAS,
  ESTADOS,
  FC_LIG,
  FC_PES,
  GLOSARIO,
  INTERVENCION,
  MESES,
  PBI,
  SUPERFICIES,
  TCP,
  TOPOS,
  VEH,
  ZONAS,
  fcOf,
  pbiDepto,
  tcpDepto,
  type VehKey,
} from "../lib/acb/data";
import { calcAcb, cloneDefaults, money, n1, pct, type AcbInput, type AltDesign, type Partidas } from "../lib/acb/engine";
import { CalcDirtyNote, CalcularButton, useMemoriaOnCalcular } from "../ui/calcular";

type SheetId =
  | "present"
  | "demanda"
  | "oferta"
  | "balance"
  | "costos"
  | "incrementales"
  | "beneficios"
  | "fclig"
  | "fcpes"
  | "tcp"
  | "pbi"
  | "cov"
  | "ancho"
  | "estruct"
  | "glosario";

const SHEETS: { id: SheetId; label: string }[] = [
  { id: "present", label: "PRESENT" },
  { id: "demanda", label: "DEMANDA" },
  { id: "oferta", label: "OFERTA" },
  { id: "balance", label: "OFERTA-DEMANDA" },
  { id: "costos", label: "COSTOS" },
  { id: "incrementales", label: "COSTOS INCREMEN." },
  { id: "beneficios", label: "BENEFICIOS" },
  { id: "fclig", label: "FC LIG" },
  { id: "fcpes", label: "FC PES" },
  { id: "tcp", label: "TCP" },
  { id: "pbi", label: "PBI" },
  { id: "cov", label: "COV" },
  { id: "ancho", label: "ANCHO CALZADA" },
  { id: "estruct", label: "ESTRUCT-PROG" },
  { id: "glosario", label: "GLOSARIO" },
];

const COLS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M"];

function In({
  value,
  onChange,
  type = "text",
  step,
  title,
}: {
  value: string | number;
  onChange: (v: string) => void;
  type?: "text" | "number";
  step?: number;
  title?: string;
}) {
  return (
    <input
      className="xls-in"
      type={type === "number" ? "number" : "text"}
      step={step}
      title={title}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function Sel({ value, onChange, options, title }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; title?: string }) {
  return (
    <select className="xls-in xls-sel" value={value} title={title} onChange={(e) => onChange(e.target.value)}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function years(H: number) {
  return Array.from({ length: H + 1 }, (_, i) => i);
}
function yearsOp(H: number) {
  return Array.from({ length: H }, (_, i) => i + 1);
}

export function AcbCaminosModule() {
  const [inp, setInp] = useState<AcbInput>(() => cloneDefaults());
  const [sheet, setSheet] = useState<SheetId>("demanda");
  const [formula, setFormula] = useState("IMDa = REDONDEAR(IMDS × FC; 0)    ·    Tn = T0 × (1+r)^n    ·    Bcov = COVsp − COVcp + ½ COV generado");
  const live = useMemo(() => calcAcb(inp), [inp]);
  const { doc: published, dirty, calcular } = useMemoriaOnCalcular(live);
  const r = published;

  const set = <K extends keyof AcbInput>(k: K, v: AcbInput[K]) => setInp((s) => ({ ...s, [k]: v }));
  const patch = (p: Partial<AcbInput>) => setInp((s) => ({ ...s, ...p }));
  const setConteo = (veh: VehKey, day: number, v: number) =>
    setInp((s) => {
      const next = s.conteo[veh].slice();
      next[day] = v;
      return { ...s, conteo: { ...s.conteo, [veh]: next } };
    });
  const setPart = (which: "part1" | "part2", k: keyof Partidas, v: number) =>
    setInp((s) => ({ ...s, [which]: { ...s[which], [k]: v } }));
  const setAlt = (which: "alt1" | "alt2", k: keyof AltDesign, v: string | number) =>
    setInp((s) => ({ ...s, [which]: { ...s[which], [k]: v } }));

  const applyPeaje = (lig: string, pes: string, mes: number) => {
    setInp((s) => ({
      ...s,
      peajeLig: lig,
      peajePes: pes,
      mes,
      fcLig: fcOf(FC_LIG, lig, mes),
      fcPes: fcOf(FC_PES, pes, mes),
    }));
  };

  const applyDepto = (depto: string) => {
    setInp((s) => ({ ...s, depto, rvp: tcpDepto(depto), rvc: Math.max(0, pbiDepto(depto)) }));
  };

  const show = (f: string) => setFormula(f);

  return (
    <div className="xls-shell">
      <header className="xls-top">
        <div className="xls-brand">
          <div className="xls-mark">ACB</div>
          <div>
            <strong>Caminos vecinales</strong>
            <p>Guía simplificada · análisis costo-beneficio · SNIP 09 / 10</p>
          </div>
        </div>
        <div className="xls-kpis">
          <div>
            <span>VAN Alt. 1</span>
            <b className={r.eval1.van >= 0 ? "ok" : "bad"}>{money(r.eval1.van, 0)}</b>
          </div>
          <div>
            <span>TIR Alt. 1</span>
            <b>{pct(r.eval1.tir, 2)}</b>
          </div>
          <div>
            <span>B/C Alt. 1</span>
            <b>{n1(r.eval1.bc, 4)}</b>
          </div>
          <div>
            <span>IMDa</span>
            <b>{r.imdaTotal} veh/d</b>
          </div>
        </div>
        <div className="xls-actions">
          <CalcularButton onClick={calcular} dirty={dirty} />
          <button type="button" className="btn secondary" onClick={() => setInp(cloneDefaults())}>
            Ejemplo guía
          </button>
          <button type="button" className="btn" onClick={() => window.print()}>
            Imprimir / PDF
          </button>
        </div>
      </header>

      <div className="xls-formula" title="Fórmula de la celda o paso activo">
        <span>fx</span>
        <em>{formula}</em>
      </div>
      <CalcDirtyNote dirty={dirty} />

      <div className="xls-legend">
        <i className="xls-swatch in" /> Dato a ingresar
        <i className="xls-swatch out" /> Resultado / fórmula
        <i className="xls-swatch tot" /> Total
        <span>Celda amarilla = editable. El resto se calcula al instante, como en el aplicativo MEF.</span>
      </div>

      <div className="xls-body">
        <table className="xls">
          <thead>
            <tr>
              <th className="xls-rn" />
              {COLS.map((c) => (
                <th key={c}>{c}</th>
              ))}
            </tr>
          </thead>
          {sheet === "present" && <Present />}
          {sheet === "demanda" && (
            <Demanda inp={inp} r={r} set={set} patch={patch} setConteo={setConteo} applyPeaje={applyPeaje} applyDepto={applyDepto} show={show} />
          )}
          {sheet === "oferta" && <Oferta inp={inp} set={set} show={show} />}
          {sheet === "balance" && <Balance inp={inp} r={r} setAlt={setAlt} set={set} show={show} />}
          {sheet === "costos" && <Costos inp={inp} r={r} set={set} setPart={setPart} show={show} />}
          {sheet === "incrementales" && <Incrementales inp={inp} r={r} set={set} show={show} />}
          {sheet === "beneficios" && <Beneficios inp={inp} r={r} show={show} />}
          {sheet === "fclig" && <FcTable kind="lig" mes={inp.mes} code={inp.peajeLig} onPick={(c) => applyPeaje(c, inp.peajePes, inp.mes)} />}
          {sheet === "fcpes" && <FcTable kind="pes" mes={inp.mes} code={inp.peajePes} onPick={(c) => applyPeaje(inp.peajeLig, c, inp.mes)} />}
          {sheet === "tcp" && <TcpSheet depto={inp.depto} onPick={applyDepto} />}
          {sheet === "pbi" && <PbiSheet depto={inp.depto} onPick={applyDepto} />}
          {sheet === "cov" && <CovSheet inp={inp} />}
          {sheet === "ancho" && <AnchoSheet />}
          {sheet === "estruct" && <EstructSheet />}
          {sheet === "glosario" && <GlosarioSheet />}
        </table>
      </div>

      <nav className="xls-tabs" aria-label="Hojas del aplicativo">
        {SHEETS.map((s) => (
          <button key={s.id} type="button" className={sheet === s.id ? "on" : ""} onClick={() => setSheet(s.id)}>
            {s.label}
          </button>
        ))}
      </nav>
    </div>
  );
}

function Rn({ n }: { n: number }) {
  return <th className="xls-rn">{n}</th>;
}

function Present() {
  return (
    <tbody>
      <tr className="xls-title">
        <Rn n={1} />
        <td colSpan={13}>Aplicativo de la Guía Simplificada Caminos Vecinales — Análisis Costo Beneficio</td>
      </tr>
      <tr>
        <Rn n={3} />
        <td colSpan={13} className="xls-sec">
          Presentación del aplicativo
        </td>
      </tr>
      <tr>
        <Rn n={4} />
        <td colSpan={13} className="xls-note">
          Herramienta para orientar la formulación y evaluación de PIP de caminos vecinales. Usa los parámetros de los Anexos SNIP 09 y SNIP 10, y datos referenciales con fines didácticos. Hay dos aplicativos: costo-beneficio (este) y costo-efectividad.
        </td>
      </tr>
      <tr>
        <Rn n={6} />
        <td colSpan={13} className="xls-note">
          Incluye: factores de corrección de vehículos ligeros y pesados, PBI, costos de operación vehicular modulares (COV, HDM-III / MTC 2010), ancho de calzada según IMD, estructura funcional programática y glosario. La tasa de crecimiento poblacional se toma de las proyecciones INEI (TCP) del departamento.
        </td>
      </tr>
      <tr>
        <Rn n={8} />
        <td colSpan={13} className="xls-sec">
          Paso a paso del aplicativo
        </td>
      </tr>
      {[
        "1. DEMANDA — Conteos de 7 días, FC estacional, IMDa, proyección Tn = T0(1+r)^n y tráfico generado.",
        "2. OFERTA — Inventario vial de la situación actual (visita de campo).",
        "3. OFERTA-DEMANDA — Dos alternativas técnicas de solución.",
        "4. COSTOS — Presupuesto de obra a precios de mercado y costos de mantenimiento US$/km.",
        "5. COSTOS INCREMEN. — Factores de conversión a precios sociales, cronograma y costos incrementales.",
        "6. BENEFICIOS — Ahorro de COV, regla de la mitad, flujo neto, VAN, TIR y B/C.",
      ].map((t, i) => (
        <tr key={t}>
          <Rn n={9 + i} />
          <td colSpan={13}>{t}</td>
        </tr>
      ))}
    </tbody>
  );
}

function Demanda({
  inp,
  r,
  set,
  patch,
  setConteo,
  applyPeaje,
  applyDepto,
  show,
}: {
  inp: AcbInput;
  r: ReturnType<typeof calcAcb>;
  set: <K extends keyof AcbInput>(k: K, v: AcbInput[K]) => void;
  patch: (p: Partial<AcbInput>) => void;
  setConteo: (veh: VehKey, day: number, v: number) => void;
  applyPeaje: (lig: string, pes: string, mes: number) => void;
  applyDepto: (depto: string) => void;
  show: (f: string) => void;
}) {
  const H = r.H;
  const ys = years(H);
  return (
    <tbody>
      <tr className="xls-title">
        <Rn n={1} />
        <td colSpan={13}>1. GENERALIDADES · Determinación del tránsito y análisis de la demanda</td>
      </tr>
      <tr>
        <Rn n={5} />
        <td>LEYENDA</td>
        <td className="xls-in-cell" colSpan={2}>
          Datos a ingresar
        </td>
        <td colSpan={10} className="xls-muted">
          Conteo de 7 días × 24 h para perfil.
        </td>
      </tr>
      <tr>
        <Rn n={7} />
        <td>Nombre del proyecto</td>
        <td colSpan={8} className="xls-in-cell">
          <In value={inp.proyecto} onChange={(v) => set("proyecto", v)} />
        </td>
        <td colSpan={4} />
      </tr>
      <tr>
        <Rn n={8} />
        <td>Departamento</td>
        <td className="xls-in-cell">
          <Sel
            value={inp.depto}
            onChange={applyDepto}
            options={TCP.filter((t) => t.depto !== "PERÚ").map((t) => ({ value: t.depto, label: t.depto }))}
          />
        </td>
        <td>Provincia</td>
        <td className="xls-in-cell">
          <In value={inp.provincia} onChange={(v) => set("provincia", v)} />
        </td>
        <td>Distrito</td>
        <td className="xls-in-cell">
          <In value={inp.distrito} onChange={(v) => set("distrito", v)} />
        </td>
        <td colSpan={7} />
      </tr>
      <tr>
        <Rn n={9} />
        <td>Zona geográfica</td>
        <td className="xls-in-cell">
          <Sel value={inp.zona} onChange={(v) => set("zona", v)} options={ZONAS.map((z) => ({ value: z, label: z }))} />
        </td>
        <td>Horizonte</td>
        <td className="xls-in-cell">
          <In type="number" value={inp.horizonte} onChange={(v) => set("horizonte", Number(v) || 10)} title="Años de evaluación" />
        </td>
        <td>años</td>
        <td colSpan={8} className="xls-muted">
          Al cambiar el departamento se cargan rvp (TCP 2010-2015) y rvc (PBI 2009/2008).
        </td>
      </tr>
      <tr>
        <Rn n={14} />
        <td colSpan={13} className="xls-sec">
          1. Determinación del tránsito actual
        </td>
      </tr>
      <tr>
        <Rn n={16} />
        <td colSpan={13}>i) Resumir los conteos de tránsito a nivel del día y tipo de vehículo</td>
      </tr>
      <tr>
        <Rn n={18} />
        <td>Mes de conteo</td>
        <td className="xls-in-cell">
          <Sel
            value={String(inp.mes)}
            onChange={(v) => applyPeaje(inp.peajeLig, inp.peajePes, Number(v))}
            options={MESES.map((m, i) => ({ value: String(i), label: m }))}
          />
        </td>
        <td colSpan={11} className="xls-muted">
          El mes alimenta el factor de corrección estacional del peaje.
        </td>
      </tr>
      <tr className="xls-h">
        <Rn n={19} />
        <td>Tipo de vehículo</td>
        {DIAS.map((d) => (
          <td key={d}>{d}</td>
        ))}
        <td>TOTAL</td>
        <td colSpan={4} />
      </tr>
      {VEH.map((v, i) => (
        <tr key={v.key}>
          <Rn n={20 + i} />
          <td>{v.label}</td>
          {inp.conteo[v.key].map((n, d) => (
            <td key={d} className="xls-in-cell n">
              <In
                type="number"
                value={n}
                onChange={(val) => setConteo(v.key, d, Number(val) || 0)}
                title={`${v.label} · ${DIAS[d]}`}
              />
            </td>
          ))}
          <td className="n xls-out" onClick={() => show("TOTAL semana = Σ Vi  (i = lun…dom)")}>
            {r.totalSemana[v.key]}
          </td>
          <td colSpan={4} />
        </tr>
      ))}
      <tr className="xls-tot">
        <Rn n={27} />
        <td>TOTAL</td>
        {r.totalDia.map((n, i) => (
          <td key={i} className="n">
            {n}
          </td>
        ))}
        <td className="n">{Object.values(r.totalSemana).reduce((s, x) => s + x, 0)}</td>
        <td colSpan={4} />
      </tr>
      <tr>
        <Rn n={42} />
        <td colSpan={13} className="xls-muted">
          Nota: conteo de 7 días de 24 horas para proyectos de inversión a nivel de perfil.
        </td>
      </tr>
      <tr>
        <Rn n={44} />
        <td colSpan={13} className="xls-sec">
          ii) Factores de corrección promedio de una estación de peaje cercana
        </td>
      </tr>
      <tr>
        <Rn n={45} />
        <td>Peaje ligeros</td>
        <td className="xls-in-cell" colSpan={2}>
          <Sel
            value={inp.peajeLig}
            onChange={(v) => applyPeaje(v, inp.peajePes, inp.mes)}
            options={FC_LIG.map((p) => ({ value: p.code, label: `${p.code} ${p.nombre}` }))}
          />
        </td>
        <td>F.C.E. ligeros</td>
        <td className="xls-out n" onClick={() => show("FC ligeros = tabla FC LIG (peaje, mes)")}>
          {n1(inp.fcLig, 6)}
        </td>
        <td colSpan={8} className="xls-muted">
          Ejemplo guía: Ambo · agosto
        </td>
      </tr>
      <tr>
        <Rn n={46} />
        <td>Peaje pesados</td>
        <td className="xls-in-cell" colSpan={2}>
          <Sel
            value={inp.peajePes}
            onChange={(v) => applyPeaje(inp.peajeLig, v, inp.mes)}
            options={FC_PES.map((p) => ({ value: p.code, label: `${p.code} ${p.nombre}` }))}
          />
        </td>
        <td>F.C.E. pesados</td>
        <td className="xls-out n" onClick={() => show("FC pesados = tabla FC PES (peaje, mes)")}>
          {n1(inp.fcPes, 6)}
        </td>
        <td colSpan={8} className="xls-muted">
          Ejemplo guía: Chullqui · agosto
        </td>
      </tr>
      <tr>
        <Rn n={51} />
        <td colSpan={13} className="xls-sec">
          iii) IMDS e IMDa — conteo de 7 días
        </td>
      </tr>
      <tr>
        <Rn n={52} />
        <td colSpan={13} className="xls-eq">
          IMDS = (Σ Vi) / 7 &nbsp;&nbsp;·&nbsp;&nbsp; IMDa = REDONDEAR(IMDS × FC ; 0)
        </td>
      </tr>
      <tr className="xls-h">
        <Rn n={63} />
        <td>Tipo</td>
        {DIAS.map((d) => (
          <td key={d}>{d.slice(0, 3)}</td>
        ))}
        <td>TOTAL</td>
        <td>IMDS</td>
        <td>FC</td>
        <td>IMDa</td>
        <td />
      </tr>
      {VEH.map((v, i) => (
        <tr key={v.key} onClick={() => show(`IMDa(${v.label}) = REDONDEAR(${n1(r.imds[v.key], 4)} × ${n1(r.fc[v.key], 6)} ; 0)`)}>
          <Rn n={65 + i} />
          <td>{v.label}</td>
          {r.semana[v.key].map((n, d) => (
            <td key={d} className="n">
              {n}
            </td>
          ))}
          <td className="n xls-out">{r.totalSemana[v.key]}</td>
          <td className="n xls-out">{n1(r.imds[v.key], 3)}</td>
          <td className="n xls-out">{n1(r.fc[v.key], 4)}</td>
          <td className="n xls-out">{r.imda[v.key]}</td>
          <td />
        </tr>
      ))}
      <tr className="xls-tot">
        <Rn n={72} />
        <td>TOTAL</td>
        {r.totalDia.map((n, i) => (
          <td key={i} className="n">
            {n}
          </td>
        ))}
        <td className="n">{Object.values(r.totalSemana).reduce((s, x) => s + x, 0)}</td>
        <td className="n">{n1(Object.values(r.imds).reduce((s, x) => s + x, 0), 2)}</td>
        <td />
        <td className="n">{r.imdaTotal}</td>
        <td />
      </tr>
      <tr>
        <Rn n={74} />
        <td colSpan={13} className="xls-sec">
          2. Análisis de la demanda
        </td>
      </tr>
      <tr className="xls-h">
        <Rn n={78} />
        <td>Tipo de vehículo</td>
        <td>IMD</td>
        <td>Distribución (%)</td>
        <td colSpan={10} />
      </tr>
      {VEH.map((v, i) => (
        <tr key={v.key}>
          <Rn n={80 + i} />
          <td>{v.label}</td>
          <td className="n xls-out">{r.imda[v.key]}</td>
          <td className="n xls-out">{n1(r.dist[v.key], 2)}</td>
          <td colSpan={10} />
        </tr>
      ))}
      <tr className="xls-tot">
        <Rn n={87} />
        <td>IMD</td>
        <td className="n">{r.imdaTotal}</td>
        <td className="n">100.00</td>
        <td colSpan={10} />
      </tr>
      <tr>
        <Rn n={89} />
        <td colSpan={13} className="xls-sec">
          2.2 Demanda proyectada — sin proyecto
        </td>
      </tr>
      <tr>
        <Rn n={91} />
        <td colSpan={13} className="xls-eq" onClick={() => show("Tn = T0 × (1 + r)^n     rvp pasajeros (TCP)    rvc carga (PBI regional)")}>
          Tn = T0 × (1 + r)^n &nbsp;&nbsp; pasajeros r = rvp &nbsp;&nbsp; carga r = rvc
        </td>
      </tr>
      <tr>
        <Rn n={100} />
        <td>rvp % (población)</td>
        <td className="xls-in-cell">
          <In type="number" step={0.1} value={inp.rvp} onChange={(v) => set("rvp", Number(v) || 0)} />
        </td>
        <td colSpan={3}>Tasa anual de la población — vehículos de pasajeros</td>
        <td>rvc % (PBI)</td>
        <td className="xls-in-cell">
          <In type="number" step={0.1} value={inp.rvc} onChange={(v) => set("rvc", Number(v) || 0)} />
        </td>
        <td colSpan={6}>Tasa anual del PBI regional — vehículos de carga</td>
      </tr>
      <tr>
        <Rn n={119} />
        <td>Tipo de intervención</td>
        <td className="xls-in-cell" colSpan={2}>
          <Sel
            value={inp.intervencion}
            onChange={(v) => {
              const pctG = INTERVENCION.find((x) => x.value === v)?.pct ?? 15;
              patch({ intervencion: v, pctGenerado: pctG });
            }}
            options={INTERVENCION.map((x) => ({ value: x.value, label: `${x.label} (${x.pct} % generado)` }))}
          />
        </td>
        <td>% generado</td>
        <td className="xls-in-cell">
          <In type="number" value={inp.pctGenerado} onChange={(v) => set("pctGenerado", Number(v) || 0)} />
        </td>
        <td colSpan={8} className="xls-muted">
          Fuente MTC. El generado arranca en el año 1 (año 0 = inversión).
        </td>
      </tr>
      <tr className="xls-h">
        <Rn n={105} />
        <td>Sin proyecto</td>
        {ys.map((n) => (
          <td key={n}>Año {n}</td>
        ))}
        {H < 12 ? <td colSpan={12 - H} /> : null}
      </tr>
      <tr className="xls-tot">
        <Rn n={106} />
        <td>Tráfico normal</td>
        {ys.map((n) => (
          <td key={n} className="n">
            {r.sinTot[n]}
          </td>
        ))}
        {H < 12 ? <td colSpan={12 - H} /> : null}
      </tr>
      {VEH.map((v, i) => (
        <tr key={v.key}>
          <Rn n={107 + i} />
          <td>{v.label}</td>
          {ys.map((n) => (
            <td key={n} className="n xls-out">
              {r.sin[v.key][n]}
            </td>
          ))}
          {H < 12 ? <td colSpan={12 - H} /> : null}
        </tr>
      ))}
      <tr>
        <Rn n={124} />
        <td colSpan={13} className="xls-sec">
          2.3 Demanda proyectada — con proyecto (normal + generado)
        </td>
      </tr>
      <tr className="xls-h">
        <Rn n={126} />
        <td>Con proyecto</td>
        {ys.map((n) => (
          <td key={n}>Año {n}</td>
        ))}
        {H < 12 ? <td colSpan={12 - H} /> : null}
      </tr>
      <tr className="xls-tot">
        <Rn n={127} />
        <td>Tráfico normal</td>
        {ys.map((n) => (
          <td key={n} className="n">
            {r.sinTot[n]}
          </td>
        ))}
        {H < 12 ? <td colSpan={12 - H} /> : null}
      </tr>
      <tr className="xls-tot">
        <Rn n={135} />
        <td>Tráfico generado</td>
        {ys.map((n) => (
          <td key={n} className="n">
            {r.genTot[n]}
          </td>
        ))}
        {H < 12 ? <td colSpan={12 - H} /> : null}
      </tr>
      {VEH.map((v, i) => (
        <tr key={v.key}>
          <Rn n={136 + i} />
          <td>{v.label} gen.</td>
          {ys.map((n) => (
            <td key={n} className="n xls-out">
              {r.gen[v.key][n]}
            </td>
          ))}
          {H < 12 ? <td colSpan={12 - H} /> : null}
        </tr>
      ))}
      <tr className="xls-tot">
        <Rn n={143} />
        <td>IMD TOTAL</td>
        {ys.map((n) => (
          <td key={n} className="n">
            {r.conTot[n]}
          </td>
        ))}
        {H < 12 ? <td colSpan={12 - H} /> : null}
      </tr>
    </tbody>
  );
}

function Oferta({ inp, set, show }: { inp: AcbInput; set: <K extends keyof AcbInput>(k: K, v: AcbInput[K]) => void; show: (f: string) => void }) {
  return (
    <tbody>
      <tr className="xls-title">
        <Rn n={1} />
        <td colSpan={13}>3. Análisis de oferta · situación actual (visita de campo)</td>
      </tr>
      <tr>
        <Rn n={6} />
        <td>SUPERFICIE (COV)</td>
        <td className="xls-in-cell">
          <Sel value={inp.superficie} onChange={(v) => set("superficie", v)} options={SUPERFICIES.map((x) => ({ value: x.value, label: x.label }))} />
        </td>
        <td>TIPOLOGÍA</td>
        <td className="xls-in-cell">
          <Sel value={inp.tipologia} onChange={(v) => set("tipologia", v)} options={TOPOS.map((x) => ({ value: x.value, label: x.label }))} />
        </td>
        <td colSpan={9} className="xls-muted" onClick={() => show("La superficie y tipología seleccionan la fila COV del MTC (HDM-III 2010).")}>
          Alimentan la tabla COV
        </td>
      </tr>
      <tr>
        <Rn n={11} />
        <td colSpan={13} className="xls-sec">
          1. Características de la vía y pavimento
        </td>
      </tr>
      <tr>
        <Rn n={13} />
        <td>Longitud (km)</td>
        <td className="xls-in-cell">
          <In type="number" step={0.1} value={inp.longitud} onChange={(v) => set("longitud", Number(v) || 0)} />
        </td>
        <td>Material de superficie</td>
        <td className="xls-in-cell" colSpan={2}>
          <In value={inp.materialSup} onChange={(v) => set("materialSup", v)} />
        </td>
        <td>Ancho de calzada (m)</td>
        <td className="xls-in-cell">
          <In type="number" step={0.1} value={inp.anchoActual} onChange={(v) => set("anchoActual", Number(v) || 0)} />
        </td>
        <td colSpan={6} />
      </tr>
      <tr>
        <Rn n={16} />
        <td>Estado de conservación</td>
        <td className="xls-in-cell">
          <Sel value={inp.estadoSin} onChange={(v) => set("estadoSin", v)} options={ESTADOS.map((x) => ({ value: x.value, label: x.label }))} />
        </td>
        <td>Tipo de daño</td>
        <td className="xls-in-cell">
          <In value={inp.tipoDano} onChange={(v) => set("tipoDano", v)} />
        </td>
        <td>Pendiente (%)</td>
        <td className="xls-in-cell">
          <In type="number" step={0.1} value={inp.pendienteActual} onChange={(v) => set("pendienteActual", Number(v) || 0)} />
        </td>
        <td>Bombeo</td>
        <td className="xls-in-cell">
          <In value={inp.bombeoActual} onChange={(v) => set("bombeoActual", v)} />
        </td>
        <td colSpan={5} />
      </tr>
      <tr>
        <Rn n={20} />
        <td>N° de canteras</td>
        <td className="xls-in-cell">
          <In value={inp.canteras} onChange={(v) => set("canteras", v)} />
        </td>
        <td>N° plazoletas de paso</td>
        <td className="xls-in-cell">
          <In value={inp.plazoletasN} onChange={(v) => set("plazoletasN", v)} />
        </td>
        <td>Señalización</td>
        <td className="xls-in-cell">
          <In value={inp.senalizacion} onChange={(v) => set("senalizacion", v)} />
        </td>
        <td colSpan={7} />
      </tr>
      <tr>
        <Rn n={24} />
        <td colSpan={13} className="xls-sec">
          2. Obras de arte
        </td>
      </tr>
      <tr>
        <Rn n={25} />
        <td>N° puentes y luz (m)</td>
        <td className="xls-in-cell">
          <In value={inp.puentes} onChange={(v) => set("puentes", v)} />
        </td>
        <td>Estado</td>
        <td className="xls-in-cell">
          <In value={inp.estPuentes} onChange={(v) => set("estPuentes", v)} />
        </td>
        <td>Pontones y luz</td>
        <td className="xls-in-cell">
          <In value={inp.pontones} onChange={(v) => set("pontones", v)} />
        </td>
        <td>Estado</td>
        <td className="xls-in-cell">
          <In value={inp.estPontones} onChange={(v) => set("estPontones", v)} />
        </td>
        <td colSpan={5} />
      </tr>
      <tr>
        <Rn n={29} />
        <td>Badenes</td>
        <td className="xls-in-cell">
          <In value={inp.badenes} onChange={(v) => set("badenes", v)} />
        </td>
        <td>Estado</td>
        <td className="xls-in-cell">
          <In value={inp.estBadenes} onChange={(v) => set("estBadenes", v)} />
        </td>
        <td>Muros h&lt;4 m</td>
        <td className="xls-in-cell">
          <In value={inp.muros} onChange={(v) => set("muros", v)} />
        </td>
        <td>Estado</td>
        <td className="xls-in-cell">
          <In value={inp.estMuros} onChange={(v) => set("estMuros", v)} />
        </td>
        <td colSpan={5} />
      </tr>
      <tr>
        <Rn n={34} />
        <td colSpan={13} className="xls-sec">
          3. Drenaje
        </td>
      </tr>
      <tr>
        <Rn n={35} />
        <td>Alcantarillas TMC 24"</td>
        <td className="xls-in-cell">
          <In value={inp.alcantarillas} onChange={(v) => set("alcantarillas", v)} />
        </td>
        <td>Estado</td>
        <td className="xls-in-cell">
          <In value={inp.estAlc} onChange={(v) => set("estAlc", v)} />
        </td>
        <td>Tajeas</td>
        <td className="xls-in-cell">
          <In value={inp.tajeas} onChange={(v) => set("tajeas", v)} />
        </td>
        <td>Estado</td>
        <td className="xls-in-cell">
          <In value={inp.estTajeas} onChange={(v) => set("estTajeas", v)} />
        </td>
        <td colSpan={5} />
      </tr>
      <tr>
        <Rn n={39} />
        <td>Cunetas sin revestir</td>
        <td className="xls-in-cell">
          <In value={inp.cunetas} onChange={(v) => set("cunetas", v)} />
        </td>
        <td>Estado</td>
        <td className="xls-in-cell">
          <In value={inp.estCunetas} onChange={(v) => set("estCunetas", v)} />
        </td>
        <td>Canaleta de coronación</td>
        <td className="xls-in-cell">
          <In value={inp.canaleta} onChange={(v) => set("canaleta", v)} />
        </td>
        <td>Botaderos</td>
        <td className="xls-in-cell">
          <In value={inp.botaderos} onChange={(v) => set("botaderos", v)} />
        </td>
        <td colSpan={5} />
      </tr>
      <tr>
        <Rn n={46} />
        <td colSpan={13} className="xls-muted">
          Fuente: Ministerio de Transportes y Comunicaciones — MTC. Estado sin proyecto alimenta COV «Malo»; con proyecto, «Bueno».
        </td>
      </tr>
    </tbody>
  );
}

function AltBlock({
  title,
  start,
  alt,
  which,
  setAlt,
  imd,
}: {
  title: string;
  start: number;
  alt: AltDesign;
  which: "alt1" | "alt2";
  setAlt: (which: "alt1" | "alt2", k: keyof AltDesign, v: string | number) => void;
  imd: number;
}) {
  const row = (n: number, label: string, k: keyof AltDesign, kind: "text" | "number" = "text") => (
    <tr>
      <Rn n={n} />
      <td>{label}</td>
      <td className="xls-in-cell" colSpan={3}>
        <In type={kind} step={0.1} value={alt[k] as string | number} onChange={(v) => setAlt(which, k, kind === "number" ? Number(v) || 0 : v)} />
      </td>
    </tr>
  );
  return (
    <>
      <tr>
        <Rn n={start} />
        <td colSpan={13} className="xls-sec">
          {title}
        </td>
      </tr>
      {row(start + 3, "Tramo", "tramo")}
      {row(start + 5, "Longitud: se toma de OFERTA", "nombre")}
      <tr>
        <Rn n={start + 6} />
        <td>IMD (veh./día)</td>
        <td className="xls-out n">{imd}</td>
        <td colSpan={11} className="xls-muted">
          IMDa actual (hoja DEMANDA)
        </td>
      </tr>
      {row(start + 7, "Velocidad de diseño (km/h)", "vel", "number")}
      {row(start + 8, "Tipo de material de superficie", "superficie")}
      {row(start + 9, "Ancho de calzada (m)", "ancho", "number")}
      {row(start + 10, "Ancho de berma (m)", "berma", "number")}
      {row(start + 11, "Radio mínimo (m)", "radio", "number")}
      {row(start + 12, "Peralte máximo (%)", "peralte", "number")}
      {row(start + 13, "Pendiente máxima (%)", "pendiente", "number")}
      {row(start + 14, "Bombeo (%)", "bombeo", "number")}
      {row(start + 15, "Plazoletas", "plazoletas")}
      {row(start + 16, "Taludes", "taludes")}
      {row(start + 17, "Señalización (unid.)", "senalUnid", "number")}
      <tr>
        <Rn n={start + 19} />
        <td colSpan={13} className="xls-h">
          2. Obras de arte
        </td>
      </tr>
      {row(start + 20, "Pontones", "pontones")}
      {row(start + 21, "Badenes", "badenes")}
      {row(start + 22, "Muros de sostenimiento", "muros")}
      <tr>
        <Rn n={start + 24} />
        <td colSpan={13} className="xls-h">
          3. Drenaje
        </td>
      </tr>
      {row(start + 25, "Alcantarillas", "alcantarillas")}
      {row(start + 26, "Tipo y sección", "seccionAlc")}
      {row(start + 27, "Tajeas", "tajeas")}
      {row(start + 28, "Tipo y sección", "seccionTaj")}
      {row(start + 29, "Cunetas", "cunetas")}
      {row(start + 30, "Tipo y sección", "seccionCun")}
      {row(start + 31, "Canaleta de coronación", "canaleta")}
      {row(start + 32, "Tipo y sección", "seccionCan")}
      <tr>
        <Rn n={start + 34} />
        <td colSpan={13} className="xls-h">
          4. Impacto ambiental
        </td>
      </tr>
      {row(start + 35, "Campamento", "campamento")}
      {row(start + 36, "Patio de maquinaria", "patio")}
      {row(start + 37, "Zona de botaderos", "botaderos")}
    </>
  );
}

function Balance({
  inp,
  r,
  setAlt,
  set,
  show,
}: {
  inp: AcbInput;
  r: ReturnType<typeof calcAcb>;
  setAlt: (which: "alt1" | "alt2", k: keyof AltDesign, v: string | number) => void;
  set: <K extends keyof AcbInput>(k: K, v: AcbInput[K]) => void;
  show: (f: string) => void;
}) {
  return (
    <tbody>
      <tr className="xls-title">
        <Rn n={1} />
        <td colSpan={13}>4. Balance oferta-demanda · alternativas técnicas de solución</td>
      </tr>
      <tr>
        <Rn n={4} />
        <td>Localidad</td>
        <td className="xls-in-cell" colSpan={4}>
          <In value={inp.localidad} onChange={(v) => set("localidad", v)} />
        </td>
        <td>Estado con proyecto (COV)</td>
        <td className="xls-in-cell">
          <Sel value={inp.estadoCon} onChange={(v) => set("estadoCon", v)} options={ESTADOS.map((x) => ({ value: x.value, label: x.label }))} />
        </td>
        <td colSpan={6} className="xls-muted" onClick={() => show("Estado con proyecto = fila COV «Bueno» en el ejemplo de la guía.")}>
          Típico: Bueno
        </td>
      </tr>
      <AltBlock title="ALTERNATIVA TÉCNICA 1" start={3} alt={inp.alt1} which="alt1" setAlt={setAlt} imd={r.imdaTotal} />
      <AltBlock title="ALTERNATIVA TÉCNICA 2" start={42} alt={inp.alt2} which="alt2" setAlt={setAlt} imd={r.imdaTotal} />
    </tbody>
  );
}

const PARTIDAS: { key: keyof Partidas; label: string }[] = [
  { key: "prelim", label: "Obras preliminares" },
  { key: "tierras", label: "Movimiento de tierras" },
  { key: "pavimentos", label: "Pavimentos" },
  { key: "arte", label: "Obras de arte y drenaje" },
  { key: "senal", label: "Señalización" },
  { key: "transporte", label: "Transporte" },
  { key: "ambiental", label: "Impacto ambiental" },
];

function Costos({
  inp,
  r,
  set,
  setPart,
  show,
}: {
  inp: AcbInput;
  r: ReturnType<typeof calcAcb>;
  set: <K extends keyof AcbInput>(k: K, v: AcbInput[K]) => void;
  setPart: (which: "part1" | "part2", k: keyof Partidas, v: number) => void;
  show: (f: string) => void;
}) {
  return (
    <tbody>
      <tr className="xls-title">
        <Rn n={1} />
        <td colSpan={13}>b) Costos en la situación «con proyecto» · presupuesto de obra por alternativa</td>
      </tr>
      <tr>
        <Rn n={5} />
        <td colSpan={13} className="xls-muted">
          En soles a precios de mercado. GG, utilidad, supervisión y estudio definitivo se aplican sobre costos directos; el IGV sobre el subtotal.
        </td>
      </tr>
      <tr className="xls-h">
        <Rn n={8} />
        <td>Concepto</td>
        <td>%</td>
        <td>Alternativa 1 · {inp.alt1.nombre}</td>
        <td>Alternativa 2 · {inp.alt2.nombre}</td>
        <td colSpan={9} />
      </tr>
      {PARTIDAS.map((p, i) => (
        <tr key={p.key}>
          <Rn n={9 + i} />
          <td>{p.label}</td>
          <td />
          <td className="xls-in-cell n">
            <In type="number" step={0.01} value={inp.part1[p.key]} onChange={(v) => setPart("part1", p.key, Number(v) || 0)} />
          </td>
          <td className="xls-in-cell n">
            <In type="number" step={0.01} value={inp.part2[p.key]} onChange={(v) => setPart("part2", p.key, Number(v) || 0)} />
          </td>
          <td colSpan={9} />
        </tr>
      ))}
      <tr className="xls-tot">
        <Rn n={16} />
        <td>Costos directos</td>
        <td />
        <td className="n" onClick={() => show("CD = Σ partidas")}>
          {money(r.pres1.cd)}
        </td>
        <td className="n">{money(r.pres2.cd)}</td>
        <td colSpan={9} />
      </tr>
      <tr>
        <Rn n={17} />
        <td>Gastos generales</td>
        <td className="xls-in-cell n">
          <In type="number" step={0.01} value={inp.gg} onChange={(v) => set("gg", Number(v) || 0)} />
        </td>
        <td className="n xls-out">{money(r.pres1.gg)}</td>
        <td className="n xls-out">{money(r.pres2.gg)}</td>
        <td colSpan={9} />
      </tr>
      <tr>
        <Rn n={18} />
        <td>Utilidad</td>
        <td className="xls-in-cell n">
          <In type="number" step={0.01} value={inp.util} onChange={(v) => set("util", Number(v) || 0)} />
        </td>
        <td className="n xls-out">{money(r.pres1.util)}</td>
        <td className="n xls-out">{money(r.pres2.util)}</td>
        <td colSpan={9} />
      </tr>
      <tr className="xls-tot">
        <Rn n={19} />
        <td>Sub total general</td>
        <td />
        <td className="n">{money(r.pres1.sub)}</td>
        <td className="n">{money(r.pres2.sub)}</td>
        <td colSpan={9} />
      </tr>
      <tr>
        <Rn n={20} />
        <td>IGV</td>
        <td className="xls-in-cell n">
          <In type="number" step={0.01} value={inp.igv} onChange={(v) => set("igv", Number(v) || 0)} />
        </td>
        <td className="n xls-out">{money(r.pres1.igv)}</td>
        <td className="n xls-out">{money(r.pres2.igv)}</td>
        <td colSpan={9} />
      </tr>
      <tr className="xls-tot">
        <Rn n={21} />
        <td>Presupuesto de obra</td>
        <td />
        <td className="n">{money(r.pres1.obra)}</td>
        <td className="n">{money(r.pres2.obra)}</td>
        <td colSpan={9} />
      </tr>
      <tr>
        <Rn n={22} />
        <td>Supervisión de obra</td>
        <td className="xls-in-cell n">
          <In type="number" step={0.01} value={inp.superv} onChange={(v) => set("superv", Number(v) || 0)} />
        </td>
        <td className="n xls-out">{money(r.pres1.superv)}</td>
        <td className="n xls-out">{money(r.pres2.superv)}</td>
        <td colSpan={9} />
      </tr>
      <tr>
        <Rn n={23} />
        <td>Estudio definitivo</td>
        <td className="xls-in-cell n">
          <In type="number" step={0.01} value={inp.estudio} onChange={(v) => set("estudio", Number(v) || 0)} />
        </td>
        <td className="n xls-out">{money(r.pres1.estudio)}</td>
        <td className="n xls-out">{money(r.pres2.estudio)}</td>
        <td colSpan={9} />
      </tr>
      <tr className="xls-tot">
        <Rn n={24} />
        <td>Total de inversión</td>
        <td />
        <td className="n">{money(r.pres1.inversion)}</td>
        <td className="n">{money(r.pres2.inversion)}</td>
        <td colSpan={9} />
      </tr>
      <tr>
        <Rn n={25} />
        <td>Costo US$</td>
        <td />
        <td className="n xls-out" onClick={() => show("US$ = Inversión / tipo de cambio")}>
          {money(r.pres1.usd)}
        </td>
        <td className="n xls-out">{money(r.pres2.usd)}</td>
        <td colSpan={9} />
      </tr>
      <tr>
        <Rn n={26} />
        <td>Costo US$/km</td>
        <td />
        <td className="n xls-out" onClick={() => show("US$/km = US$ / L")}>
          {money(r.pres1.usdKm)}
        </td>
        <td className="n xls-out">{money(r.pres2.usdKm)}</td>
        <td colSpan={9} />
      </tr>
      <tr>
        <Rn n={29} />
        <td colSpan={13} className="xls-sec">
          c) Costos de mantenimiento en US$ · km
        </td>
      </tr>
      <tr>
        <Rn n={34} />
        <td>Mant. rutinario sin proyecto</td>
        <td className="xls-in-cell n">
          <In type="number" step={0.01} value={inp.rutSin} onChange={(v) => set("rutSin", Number(v) || 0)} />
        </td>
        <td>Mant. periódico sin proyecto</td>
        <td className="xls-in-cell n">
          <In type="number" step={0.01} value={inp.perSin} onChange={(v) => set("perSin", Number(v) || 0)} />
        </td>
        <td colSpan={9} className="xls-muted">
          Años 1, 4, 7 y 10 usan el periódico (× 1.10 de operación).
        </td>
      </tr>
      <tr>
        <Rn n={37} />
        <td>Mant. rutinario con proyecto</td>
        <td className="xls-in-cell n">
          <In type="number" step={0.01} value={inp.rutCon} onChange={(v) => set("rutCon", Number(v) || 0)} />
        </td>
        <td>Mant. periódico con proyecto</td>
        <td className="xls-in-cell n">
          <In type="number" step={0.01} value={inp.perCon} onChange={(v) => set("perCon", Number(v) || 0)} />
        </td>
        <td colSpan={9} className="xls-muted">
          Años 3, 6 y 9 usan el periódico. Incluye 10 % de operación sobre el rutinario/periódico.
        </td>
      </tr>
      <tr>
        <Rn n={39} />
        <td colSpan={13} className="xls-muted">
          Fuente: MTC. Costos referenciales de la guía; reemplácelos con el presupuesto de su PIP.
        </td>
      </tr>
    </tbody>
  );
}

function Incrementales({
  inp,
  r,
  set,
  show,
}: {
  inp: AcbInput;
  r: ReturnType<typeof calcAcb>;
  set: <K extends keyof AcbInput>(k: K, v: AcbInput[K]) => void;
  show: (f: string) => void;
}) {
  const ys = years(r.H);
  return (
    <tbody>
      <tr className="xls-title">
        <Rn n={1} />
        <td colSpan={13}>5. Precios sociales · costos incrementales</td>
      </tr>
      <tr className="xls-h">
        <Rn n={4} />
        <td>Obras</td>
        <td>Factor</td>
        <td colSpan={11} />
      </tr>
      <tr>
        <Rn n={5} />
        <td>Inversión</td>
        <td className="xls-in-cell n">
          <In type="number" step={0.01} value={inp.fcInv} onChange={(v) => set("fcInv", Number(v) || 0)} />
        </td>
        <td colSpan={11} className="xls-muted">
          Guía metodológica simplificada
        </td>
      </tr>
      <tr>
        <Rn n={6} />
        <td>Mantenimiento y operación</td>
        <td className="xls-in-cell n">
          <In type="number" step={0.01} value={inp.fcOm} onChange={(v) => set("fcOm", Number(v) || 0)} />
        </td>
        <td colSpan={11} />
      </tr>
      <tr>
        <Rn n={9} />
        <td>Tipo de cambio S//US$</td>
        <td className="xls-in-cell n">
          <In type="number" step={0.01} value={inp.tc} onChange={(v) => set("tc", Number(v) || 0)} />
        </td>
        <td colSpan={11} className="xls-muted">
          Ejemplo guía: 2.87 (BCRP de la época). Actualice al tipo de cambio del estudio.
        </td>
      </tr>
      <tr>
        <Rn n={10} />
        <td>Valor residual (fracción)</td>
        <td className="xls-in-cell n">
          <In type="number" step={0.01} value={inp.residual} onChange={(v) => set("residual", Number(v) || 0)} />
        </td>
        <td colSpan={11} className="xls-muted">
          Se recupera en el año {r.H} como inversión negativa.
        </td>
      </tr>
      <tr>
        <Rn n={14} />
        <td colSpan={13} className="xls-sec">
          Costos de inversión y mantenimiento a precios de mercado
        </td>
      </tr>
      <tr className="xls-h">
        <Rn n={18} />
        <td>Año</td>
        <td>Sin proy. O&M</td>
        <td>Alt. 1 inversión</td>
        <td>Alt. 1 O&M</td>
        <td>Alt. 2 inversión</td>
        <td>Alt. 2 O&M</td>
        <td colSpan={7} />
      </tr>
      {ys.map((n) => (
        <tr key={n} onClick={() => show("O&M = tarifa US$/km × 1.10 × L × TC     Inversión solo en año 0")}>
          <Rn n={19 + n} />
          <td className="n">{n}</td>
          <td className="n xls-out">{n === 0 ? "" : money(r.omSinM[n], 0)}</td>
          <td className="n xls-out">{n === 0 ? money(r.pres1.inversion, 0) : ""}</td>
          <td className="n xls-out">{n === 0 ? "" : money(r.om1M[n], 0)}</td>
          <td className="n xls-out">{n === 0 ? money(r.pres2.inversion, 0) : ""}</td>
          <td className="n xls-out">{n === 0 ? "" : money(r.om2M[n], 0)}</td>
          <td colSpan={7} />
        </tr>
      ))}
      <tr>
        <Rn n={32} />
        <td colSpan={13} className="xls-sec">
          A precios sociales (inversión × {n1(inp.fcInv, 2)} · O&M × {n1(inp.fcOm, 2)})
        </td>
      </tr>
      <tr className="xls-h">
        <Rn n={36} />
        <td>Año</td>
        <td>Sin proy. O&M</td>
        <td>Alt. 1 inversión</td>
        <td>Alt. 1 O&M</td>
        <td>Alt. 2 inversión</td>
        <td>Alt. 2 O&M</td>
        <td colSpan={7} />
      </tr>
      {ys.map((n) => (
        <tr key={n}>
          <Rn n={37 + n} />
          <td className="n">{n}</td>
          <td className="n xls-out">{n === 0 ? "" : money(r.omSinS[n], 0)}</td>
          <td className="n xls-out">{n === 0 ? money(r.eval1.inversion, 0) : n === r.H ? money(-r.eval1.residual, 0) : ""}</td>
          <td className="n xls-out">{n === 0 ? "" : money(r.om1S[n], 0)}</td>
          <td className="n xls-out">{n === 0 ? money(r.eval2.inversion, 0) : n === r.H ? money(-r.eval2.residual, 0) : ""}</td>
          <td className="n xls-out">{n === 0 ? "" : money(r.om2S[n], 0)}</td>
          <td colSpan={7} />
        </tr>
      ))}
      <tr>
        <Rn n={49} />
        <td colSpan={13} className="xls-sec">
          Costos incrementales a precios sociales (con proyecto − sin proyecto)
        </td>
      </tr>
      <tr className="xls-h">
        <Rn n={53} />
        <td>Año</td>
        <td>Alt. 1 inversión</td>
        <td>Alt. 1 O&M inc.</td>
        <td>Alt. 2 inversión</td>
        <td>Alt. 2 O&M inc.</td>
        <td colSpan={8} />
      </tr>
      {ys.map((n) => (
        <tr key={n} onClick={() => show("O&M incremental = O&M con − O&M sin     Año 10: residual = −10 % de la inversión social")}>
          <Rn n={54 + n} />
          <td className="n">{n}</td>
          <td className="n xls-out">{n === 0 ? money(r.eval1.inversion, 0) : n === r.H ? money(-r.eval1.residual, 0) : ""}</td>
          <td className="n xls-out">{n === 0 ? "" : money(r.eval1.omInc[n], 0)}</td>
          <td className="n xls-out">{n === 0 ? money(r.eval2.inversion, 0) : n === r.H ? money(-r.eval2.residual, 0) : ""}</td>
          <td className="n xls-out">{n === 0 ? "" : money(r.eval2.omInc[n], 0)}</td>
          <td colSpan={8} />
        </tr>
      ))}
    </tbody>
  );
}

function Beneficios({ inp, r, show }: { inp: AcbInput; r: ReturnType<typeof calcAcb>; show: (f: string) => void }) {
  const ys = yearsOp(r.H);
  const yAll = years(r.H);
  const covLabs = ["Auto", "Camioneta", "Bus mediano", "Bus grande", "Cam. 2E", "Cam. 3E", "Articulado"];
  return (
    <tbody>
      <tr className="xls-title">
        <Rn n={1} />
        <td colSpan={13}>6. Evaluación · cálculo de beneficios y evaluación económica</td>
      </tr>
      <tr>
        <Rn n={5} />
        <td colSpan={13} className="xls-eq" onClick={() => show("Bcov = COVsp − COVcp_normal + ½ COVcp_generado     (regla de la mitad)")}>
          Bcov = COVsp − COVcp + ½ COV generado &nbsp;&nbsp;·&nbsp;&nbsp; COV anual = IMD × 365 × L × covUS$/km × TC
        </td>
      </tr>
      <tr className="xls-h">
        <Rn n={15} />
        <td>Escenario</td>
        <td>Región</td>
        <td>Tipología</td>
        <td>Superficie</td>
        <td>Estado</td>
        {covLabs.map((x) => (
          <td key={x}>{x}</td>
        ))}
        <td />
      </tr>
      <tr>
        <Rn n={16} />
        <td>Sin proyecto</td>
        <td>{inp.zona}</td>
        <td>{TOPOS.find((t) => t.value === inp.tipologia)?.label}</td>
        <td>{SUPERFICIES.find((t) => t.value === inp.superficie)?.label}</td>
        <td>{ESTADOS.find((t) => t.value === inp.estadoSin)?.label}</td>
        {r.covUsd.sin.map((x, i) => (
          <td key={i} className="n xls-out">
            {n1(x, 4)}
          </td>
        ))}
        <td />
      </tr>
      <tr>
        <Rn n={17} />
        <td>Con proyecto</td>
        <td>{inp.zona}</td>
        <td>{TOPOS.find((t) => t.value === inp.tipologia)?.label}</td>
        <td>{SUPERFICIES.find((t) => t.value === inp.superficie)?.label}</td>
        <td>{ESTADOS.find((t) => t.value === inp.estadoCon)?.label}</td>
        {r.covUsd.con.map((x, i) => (
          <td key={i} className="n xls-out">
            {n1(x, 4)}
          </td>
        ))}
        <td />
      </tr>
      <tr>
        <Rn n={22} />
        <td colSpan={13} className="xls-muted">
          Correspondencia COV ↔ conteo: Auto=Auto · Camioneta=Pick up + C.R. · Bus medio=Micro · Bus grande=Bus · Camión 2E/3E = homónimos.
        </td>
      </tr>
      <tr>
        <Rn n={34} />
        <td colSpan={13} className="xls-sec">
          COV unitario US$/veh-km a precios sociales
        </td>
      </tr>
      <tr className="xls-h">
        <Rn n={35} />
        <td>Tipo</td>
        <td>Sin proyecto</td>
        <td>Con proyecto</td>
        <td colSpan={10} />
      </tr>
      {VEH.map((v, i) => (
        <tr key={v.key}>
          <Rn n={36 + i} />
          <td>{v.label}</td>
          <td className="n xls-out">{n1(r.covUsd.sin[v.cov], 4)}</td>
          <td className="n xls-out">{n1(r.covUsd.con[v.cov], 4)}</td>
          <td colSpan={10} />
        </tr>
      ))}
      <tr>
        <Rn n={44} />
        <td colSpan={13} className="xls-sec">
          Costos de operación vehicular sin proyecto (S/ a precios sociales)
        </td>
      </tr>
      <tr className="xls-h">
        <Rn n={47} />
        <td>Tipo</td>
        {ys.map((n) => (
          <td key={n}>Año {n}</td>
        ))}
        {r.H < 12 ? <td colSpan={12 - r.H} /> : null}
      </tr>
      {VEH.map((v, i) => (
        <tr key={v.key} onClick={() => show(`COV(${v.label}) = IMD × 365 × ${r.L} km × ${n1(r.covUsd.sin[v.cov], 4)} US$ × TC ${inp.tc}`)}>
          <Rn n={49 + i} />
          <td>{v.label}</td>
          {ys.map((n) => (
            <td key={n} className="n xls-out">
              {money(r.covSolesSin[v.key][n], 0)}
            </td>
          ))}
          {r.H < 12 ? <td colSpan={12 - r.H} /> : null}
        </tr>
      ))}
      <tr className="xls-tot">
        <Rn n={56} />
        <td>TOTAL</td>
        {ys.map((n) => (
          <td key={n} className="n">
            {money(r.covSinTot[n], 0)}
          </td>
        ))}
        {r.H < 12 ? <td colSpan={12 - r.H} /> : null}
      </tr>
      <tr>
        <Rn n={58} />
        <td colSpan={13} className="xls-sec">
          COV con proyecto — tráfico normal + generado
        </td>
      </tr>
      <tr className="xls-h">
        <Rn n={61} />
        <td />
        {ys.map((n) => (
          <td key={n}>Año {n}</td>
        ))}
        {r.H < 12 ? <td colSpan={12 - r.H} /> : null}
      </tr>
      <tr className="xls-tot">
        <Rn n={62} />
        <td>Normal</td>
        {ys.map((n) => (
          <td key={n} className="n">
            {money(r.covConNTot[n], 0)}
          </td>
        ))}
        {r.H < 12 ? <td colSpan={12 - r.H} /> : null}
      </tr>
      <tr className="xls-tot">
        <Rn n={70} />
        <td>Generado</td>
        {ys.map((n) => (
          <td key={n} className="n">
            {money(r.covConGTot[n], 0)}
          </td>
        ))}
        {r.H < 12 ? <td colSpan={12 - r.H} /> : null}
      </tr>
      <tr>
        <Rn n={119} />
        <td colSpan={13} className="xls-sec">
          Beneficios incrementales (S/ sociales)
        </td>
      </tr>
      <tr className="xls-h">
        <Rn n={122} />
        <td>Año</td>
        <td>Alternativa 1 y 2</td>
        <td colSpan={11} className="xls-muted">
          Ambas alternativas comparten superficie/estado COV en el ejemplo de la guía
        </td>
      </tr>
      {yAll.map((n) => (
        <tr key={n} onClick={() => show("B = COVsin − COVcon_normal + 0.5 × COVcon_generado")}>
          <Rn n={123 + n} />
          <td className="n">{n}</td>
          <td className="n xls-out">{n === 0 ? "" : money(r.benInc[n], 0)}</td>
          <td colSpan={11} />
        </tr>
      ))}
      <tr>
        <Rn n={136} />
        <td colSpan={13} className="xls-sec">
          Evaluación económica — Alternativa 1 · {inp.alt1.nombre}
        </td>
      </tr>
      <EvalTable start={143} ev={r.eval1} tasa={inp.tasa} H={r.H} show={show} />
      <tr>
        <Rn n={160} />
        <td colSpan={13} className="xls-sec">
          Evaluación económica — Alternativa 2 · {inp.alt2.nombre}
        </td>
      </tr>
      <EvalTable start={163} ev={r.eval2} tasa={inp.tasa} H={r.H} show={show} />
      <tr className={r.mejor === 1 ? "xls-ok" : "xls-warn"}>
        <Rn n={180} />
        <td colSpan={13}>
          Adopción: se elige la alternativa de mayor VAN. Resultado: Alternativa {r.mejor} ({r.mejor === 1 ? inp.alt1.nombre : inp.alt2.nombre})
          {r.eval1.van >= 0 && r.eval2.van >= 0
            ? " — ambas con VAN ≥ 0 y TIR por encima de la tasa social si TIR > i."
            : r.eval1.van < 0 && r.eval2.van < 0
              ? " — VAN negativo: el PIP no se justifica por costo-beneficio con estos parámetros."
              : ""}
        </td>
      </tr>
    </tbody>
  );
}

function EvalTable({
  start,
  ev,
  tasa,
  H,
  show,
}: {
  start: number;
  ev: ReturnType<typeof calcAcb>["eval1"];
  tasa: number;
  H: number;
  show: (f: string) => void;
}) {
  const ys = years(H);
  return (
    <>
      <tr className="xls-h">
        <Rn n={start} />
        <td>Año</td>
        <td>Inversión</td>
        <td>O&M incremental</td>
        <td>Beneficios</td>
        <td>Flujo neto</td>
        <td colSpan={8} />
      </tr>
      {ys.map((n) => (
        <tr key={n} onClick={() => show("FN = −I − O&Minc + B    (año 10: −I incluye −residual)")}>
          <Rn n={start + 1 + n} />
          <td className="n">{n}</td>
          <td className="n xls-out">{n === 0 ? money(ev.inversion, 0) : n === H ? money(-ev.residual, 0) : ""}</td>
          <td className="n xls-out">{n === 0 ? "" : money(ev.omInc[n], 0)}</td>
          <td className="n xls-out">{n === 0 ? "" : money(ev.ben[n], 0)}</td>
          <td className="n xls-out">{money(ev.flujo[n], 0)}</td>
          <td colSpan={8} />
        </tr>
      ))}
      <tr className="xls-kpi-row">
        <Rn n={start + H + 3} />
        <td>Tasa de descuento</td>
        <td className="n">{pct(tasa, 1)}</td>
        <td>VAN</td>
        <td className={`n ${ev.van >= 0 ? "xls-ok" : "xls-bad"}`} onClick={() => show("VAN = Σ FN_t / (1+i)^t")}>
          {money(ev.van, 2)}
        </td>
        <td />
        <td>TIR</td>
        <td className={`n ${ev.tir >= tasa ? "xls-ok" : "xls-bad"}`} onClick={() => show("TIR tal que VAN(TIR) = 0")}>
          {pct(ev.tir, 2)}
        </td>
        <td>B/C</td>
        <td className={`n ${ev.bc >= 1 ? "xls-ok" : "xls-bad"}`} onClick={() => show("B/C = VPN(beneficios) / VPN(inversión + O&M − residual)")}>
          {n1(ev.bc, 4)}
        </td>
        <td colSpan={4} />
      </tr>
    </>
  );
}

function FcTable({ kind, mes, code, onPick }: { kind: "lig" | "pes"; mes: number; code: string; onPick: (c: string) => void }) {
  const rows = kind === "lig" ? FC_LIG : FC_PES;
  return (
    <tbody>
      <tr className="xls-title">
        <Rn n={1} />
        <td colSpan={13}>Factores de corrección promedio {kind === "lig" ? "vehículos ligeros" : "vehículos pesados"} (2000-2010)</td>
      </tr>
      <tr className="xls-h">
        <Rn n={2} />
        <td>Código</td>
        <td>Peaje</td>
        {MESES.map((m) => (
          <td key={m} className={MESES[mes] === m ? "xls-hi" : ""}>
            {m.slice(0, 3)}
          </td>
        ))}
      </tr>
      {rows.map((p, i) => (
        <tr key={p.code} className={p.code === code ? "xls-selrow" : ""} onClick={() => onPick(p.code)}>
          <Rn n={4 + i} />
          <td>{p.code}</td>
          <td>{p.nombre}</td>
          {p.m.map((v, j) => (
            <td key={j} className={`n ${j === mes ? "xls-hi" : ""}`}>
              {n1(v, 4)}
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  );
}

function TcpSheet({ depto, onPick }: { depto: string; onPick: (d: string) => void }) {
  return (
    <tbody>
      <tr className="xls-title">
        <Rn n={1} />
        <td colSpan={13}>Tasa de crecimiento de la población por departamento (INEI)</td>
      </tr>
      <tr className="xls-h">
        <Rn n={4} />
        <td>Departamento</td>
        <td>Zona</td>
        <td>1995-2000</td>
        <td>2000-2005</td>
        <td>2005-2010</td>
        <td>2010-2015</td>
        <td colSpan={7} />
      </tr>
      {TCP.map((t, i) => (
        <tr key={t.depto} className={t.depto === depto ? "xls-selrow" : ""} onClick={() => t.depto !== "PERÚ" && onPick(t.depto)}>
          <Rn n={5 + i} />
          <td>{t.depto}</td>
          <td>{t.zona}</td>
          {t.r.map((x, j) => (
            <td key={j} className="n">
              {n1(x, 1)}
            </td>
          ))}
          <td colSpan={7} />
        </tr>
      ))}
      <tr>
        <Rn n={36} />
        <td colSpan={13} className="xls-muted">
          Fuente: INEI. El aplicativo usa la columna 2010-2015 como rvp al elegir departamento.
        </td>
      </tr>
    </tbody>
  );
}

function PbiSheet({ depto, onPick }: { depto: string; onPick: (d: string) => void }) {
  return (
    <tbody>
      <tr className="xls-title">
        <Rn n={2} />
        <td colSpan={13}>PBI: tasa anual departamental 2009/2008 (INEI)</td>
      </tr>
      <tr className="xls-h">
        <Rn n={3} />
        <td>Departamento</td>
        <td>2009/2008 %</td>
        <td colSpan={11} />
      </tr>
      {PBI.map((t, i) => (
        <tr key={t.depto} className={t.depto === depto ? "xls-selrow" : ""} onClick={() => t.depto !== "PERÚ" && onPick(t.depto)}>
          <Rn n={4 + i} />
          <td>{t.depto}</td>
          <td className="n">{n1(t.r, 1)}</td>
          <td colSpan={11} />
        </tr>
      ))}
      <tr>
        <Rn n={30} />
        <td colSpan={13} className="xls-muted">
          Fuente: INEI Informe Técnico N° 01 — agosto 2010. Se usa como rvc (vehículos de carga). Si el PBI es negativo, el ejemplo de la guía igual tomó 0.6 % para Huánuco; edite rvc en DEMANDA.
        </td>
      </tr>
    </tbody>
  );
}

function CovSheet({ inp }: { inp: AcbInput }) {
  return (
    <tbody>
      <tr className="xls-title">
        <Rn n={2} />
        <td colSpan={13}>Costo modular de operación vehicular a precios sociales · US$-vehículo-km · HDM-III / MTC nov. 2010</td>
      </tr>
      <tr className="xls-h">
        <Rn n={5} />
        <td>Región</td>
        <td>Topografía</td>
        <td>Superficie</td>
        <td>Estado</td>
        <td>Auto</td>
        <td>Camioneta</td>
        <td>Bus med.</td>
        <td>Bus gran.</td>
        <td>Cam 2E</td>
        <td>Cam 3E</td>
        <td>Articulado</td>
        <td colSpan={2} />
      </tr>
      {COV.map((c, i) => {
        const on =
          c.region === inp.zona && c.topo === inp.tipologia && c.sup === inp.superficie && (c.est === inp.estadoSin || c.est === inp.estadoCon);
        return (
          <tr key={`${c.region}${c.topo}${c.sup}${c.est}${i}`} className={on ? "xls-selrow" : ""}>
            <Rn n={7 + i} />
            <td>{c.region}</td>
            <td>{c.topo}</td>
            <td>{c.sup}</td>
            <td>{c.est}</td>
            {c.vals.map((v, j) => (
              <td key={j} className="n">
                {n1(v, 4)}
              </td>
            ))}
            <td colSpan={2} />
          </tr>
        );
      })}
    </tbody>
  );
}

function AnchoSheet() {
  return (
    <tbody>
      <tr className="xls-title">
        <Rn n={1} />
        <td colSpan={13}>Ancho de la calzada según el tráfico vehicular por día (IMD) · PROVIAS / caminos vecinales 2010</td>
      </tr>
      <tr>
        <Rn n={3} />
        <td colSpan={13} className="xls-sec">
          Superficie sin afirmar (SAF) — lastrado con material de corte
        </td>
      </tr>
      <tr className="xls-h">
        <Rn n={6} />
        <td>IMD</td>
        <td>Ancho (m)</td>
        <td>US$/km Costa-Sierra</td>
        <td>US$/km Selva</td>
        <td colSpan={9}>Descripción</td>
      </tr>
      {ANCHO_SAF.map((a, i) => (
        <tr key={a.imd}>
          <Rn n={8 + i} />
          <td>{a.imd}</td>
          <td>{a.ancho}</td>
          <td className="n">{money(a.costa, 0)}</td>
          <td className="n">{money(a.selva, 0)}</td>
          <td colSpan={9}>{a.desc}</td>
        </tr>
      ))}
      <tr>
        <Rn n={14} />
        <td colSpan={13} className="xls-sec">
          Superficie afirmada (AF) — rehabilitación
        </td>
      </tr>
      {ANCHO_AF_REHAB.map((a, i) => (
        <tr key={a.imd}>
          <Rn n={19 + i} />
          <td>{a.imd}</td>
          <td>{a.ancho}</td>
          <td className="n">{money(a.costa, 0)}</td>
          <td className="n">{money(a.selva, 0)}</td>
          <td colSpan={9} />
        </tr>
      ))}
      <tr>
        <Rn n={29} />
        <td colSpan={13} className="xls-sec">
          Superficie afirmada (AF) — mejoramiento de estándar
        </td>
      </tr>
      {ANCHO_AF_MEJORA.map((a, i) => (
        <tr key={a.imd}>
          <Rn n={34 + i} />
          <td>{a.imd}</td>
          <td>{a.ancho}</td>
          <td className="n">{money(a.costa, 0)}</td>
          <td className="n">{money(a.selva, 0)}</td>
          <td colSpan={9} />
        </tr>
      ))}
    </tbody>
  );
}

function EstructSheet() {
  return (
    <tbody>
      <tr className="xls-title">
        <Rn n={1} />
        <td colSpan={13}>Estructura funcional programática de un camino vecinal</td>
      </tr>
      <tr>
        <Rn n={3} />
        <td colSpan={13} className="xls-note">
          Para ubicar el proyecto en el sistema de presupuesto público nacional.
        </td>
      </tr>
      <tr className="xls-h">
        <Rn n={7} />
        <td>Nivel</td>
        <td>Código</td>
        <td>Denominación</td>
        <td colSpan={10} />
      </tr>
      <tr>
        <Rn n={7} />
        <td>Función</td>
        <td className="n">15</td>
        <td>Transporte</td>
        <td colSpan={10} />
      </tr>
      <tr>
        <Rn n={8} />
        <td>Programa</td>
        <td className="n">33</td>
        <td>Transporte terrestre</td>
        <td colSpan={10} />
      </tr>
      <tr>
        <Rn n={9} />
        <td>Subprograma</td>
        <td className="n">66</td>
        <td>Vías vecinales</td>
        <td colSpan={10} />
      </tr>
      <tr>
        <Rn n={10} />
        <td>Responsable funcional</td>
        <td />
        <td>Transporte y Comunicaciones</td>
        <td colSpan={10} />
      </tr>
    </tbody>
  );
}

function GlosarioSheet() {
  return (
    <tbody>
      <tr className="xls-title">
        <Rn n={1} />
        <td colSpan={13}>Glosario de términos</td>
      </tr>
      {GLOSARIO.map((g, i) => (
        <tr key={g.t}>
          <Rn n={3 + i * 2} />
          <td className="xls-term">{g.t}</td>
          <td colSpan={12}>{g.d}</td>
        </tr>
      ))}
    </tbody>
  );
}

import { Formula, MathLine } from "../Formula";
import { parsePunch, type PunchSpec } from "../../lib/engines/maestria/drawCommon";
import { SteelSectionFig } from "../SteelSectionFig";
import { buildLosaDraftSpec, losaCaption, losaSteelPlan, parseLosaSteelPack } from "../../lib/engines/maestria/losa2dDraw";
import { punchToView } from "../../lib/engines/maestria/plateaDraw";
import { viewBoxOf } from "../../lib/engines/maestria/drawCommon";
import type { MaeModel } from "../../lib/engines/maestria/types";

function unpack(raw: string) {
  if (!raw?.trim()) return [] as { x: number; M: number }[];
  return raw.split(";").map((p) => {
    const [x, M] = p.split(",").map(Number);
    return { x, M };
  }).filter((p) => Number.isFinite(p.x) && Number.isFinite(p.M));
}

export function MaeMomentStrip({
  title,
  formula,
  ptsRaw,
  L,
  MuPos,
  MuNeg,
  unidad = "t·m",
}: {
  title: string;
  formula: string;
  ptsRaw?: string;
  L: number;
  MuPos?: number;
  MuNeg?: number;
  unidad?: string;
}) {
  const pts = unpack(ptsRaw ?? "");
  const W = 520;
  const H = 200;
  const pad = { l: 48, r: 24, t: 28, b: 36 };
  const xs = pts.length >= 2 ? pts : [{ x: 0, M: 0 }, { x: Math.max(L, 1), M: 0 }];
  const Mmax = Math.max(...xs.map((p) => Math.abs(p.M)), MuPos ?? 0, MuNeg ?? 0, 0.05);
  const xMax = Math.max(...xs.map((p) => p.x), L, 0.5);
  const x = (v: number) => pad.l + (v / xMax) * (W - pad.l - pad.r);
  const y = (M: number) => pad.t + (H - pad.t - pad.b) / 2 - (M / Mmax) * ((H - pad.t - pad.b) / 2 - 8);
  const d = xs.map((p, i) => `${i ? "L" : "M"} ${x(p.x).toFixed(1)} ${y(p.M).toFixed(1)}`).join(" ");
  return (
    <figure className="mae-fig">
      <figcaption>{title}</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="mae-fig-svg">
        <line x1={pad.l} y1={y(0)} x2={W - pad.r} y2={y(0)} stroke="#1a4473" />
        <path d={d} fill="none" stroke="#8b1e1e" strokeWidth="2.2" />
        <text x={pad.l} y={16} fontSize="11" fill="#5a4a28">
          {formula} · M+={ (MuPos ?? 0).toFixed(2)} {unidad} · |M−|={(MuNeg ?? 0).toFixed(2)}
        </text>
      </svg>
    </figure>
  );
}

export function MaePunchFig({ spec }: { spec: PunchSpec }) {
  const v = punchToView(spec);
  const poly = v.peri.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const out = v.outline.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const ratio = spec.Vu / Math.max(spec.phiVn, 0.01);
  const stamp = spec.ok ? "#2e7846" : "#8b1e1e";
  const d2 = (spec.d || 0) / 2;
  return (
    <figure className="mae-fig">
      <figcaption>Punzonamiento — perímetro crítico a d/2 · {spec.col.id} ({spec.kind})</figcaption>
      <svg viewBox={`0 0 ${v.W} ${v.H}`} className="mae-fig-svg">
        <defs>
          <pattern id="mae-soil" width="8" height="8" patternUnits="userSpaceOnUse">
            <path d="M0 8 L8 0" stroke="#c9b896" strokeWidth="0.7" />
          </pattern>
        </defs>
        <rect x="0" y="0" width={v.W} height={v.H} fill="#efe8dc" />
        <rect x="0" y="0" width={v.W} height={v.H} fill="url(#mae-soil)" />
        <polygon points={out} fill="#d5c9a8" stroke="#1a4473" strokeWidth="1.8" />
        {v.edges.left ? <line x1={v.outline[0].x} y1={v.outline[0].y} x2={v.outline[3].x} y2={v.outline[3].y} stroke="#8b1e1e" strokeWidth="3" /> : null}
        {v.edges.bot ? <line x1={v.outline[0].x} y1={v.outline[0].y} x2={v.outline[1].x} y2={v.outline[1].y} stroke="#8b1e1e" strokeWidth="3" /> : null}
        {v.edges.right ? <line x1={v.outline[1].x} y1={v.outline[1].y} x2={v.outline[2].x} y2={v.outline[2].y} stroke="#8b1e1e" strokeWidth="3" /> : null}
        {v.edges.top ? <line x1={v.outline[2].x} y1={v.outline[2].y} x2={v.outline[3].x} y2={v.outline[3].y} stroke="#8b1e1e" strokeWidth="3" /> : null}
        <polygon points={poly} fill={spec.ok ? "rgba(46,120,70,0.18)" : "rgba(139,30,30,0.18)"} stroke="none" />
        {(v.segs?.length
          ? v.segs.map((s, i) => (
              <line key={`b0-${i}`} x1={s.a.x} y1={s.a.y} x2={s.b.x} y2={s.b.y} stroke={stamp} strokeWidth="2.8" strokeDasharray="7 4" />
            ))
          : [<polygon key="b0" points={poly} fill="none" stroke={stamp} strokeWidth="2.6" strokeDasharray="7 4" />])}
        <polygon points={v.colOn.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")} fill="#1a4473" stroke="#0d2a4a" strokeWidth="1.2" />
        <text x={v.colOn[2]?.x ?? v.col.x} y={(v.colOn[2]?.y ?? v.col.y) - 8} textAnchor="end" fontSize="11" fill="#1a4473" fontWeight="700">
          {spec.col.id}  {spec.col.t2.toFixed(2)}×{spec.col.t1.toFixed(2)} m
        </text>
        <text x={v.peri[0]?.x ?? 70} y={(v.peri[0]?.y ?? 40) + 16} fontSize="11" fill={stamp}>
          b0 a d/2 = {spec.b0.toFixed(0)} cm · d/2 = {(d2 * 100).toFixed(1)} cm
        </text>
        <rect x={v.W / 2 - 168} y={v.H - 38} width="336" height="26" rx="3" fill={spec.ok ? "#e7f2ea" : "#f6e4e4"} stroke={stamp} />
        <text x={v.W / 2} y={v.H - 20} textAnchor="middle" fontSize="13" fontWeight="700" fill={stamp}>
          Vu={spec.Vu.toFixed(1)} t   φVn={spec.phiVn.toFixed(1)} t   Vu/φVn={ratio.toFixed(2)}   {spec.ok ? "OK" : "NO"}
        </text>
      </svg>
      <p className="mae-fig-note">
        Recorte de planta ({v.x0.toFixed(2)}–{v.x1.toFixed(2)} m × {v.y0.toFixed(2)}–{v.y1.toFixed(2)} m). La columna queda entera sobre la zapata. Trazos discontinuos: perímetro crítico b0 a d/2 (L en esquina, U en borde). Trazo rojo = borde libre. Vu = Pu − qu Acrit frente a φVn (E.060 11.12).
      </p>
    </figure>
  );
}

export function MaePunchFromDims({ values }: { values: Record<string, string> }) {
  const spec = parsePunch(values.punchJson);
  if (!spec) return null;
  return <MaePunchFig spec={spec} />;
}

export function MaeSteelPlan({
  model,
  bars,
  packRaw,
}: {
  model: MaeModel;
  bars: { infX: string; infY: string; supX: string; supY: string };
  packRaw?: string;
}) {
  const pack = parseLosaSteelPack(packRaw ?? "");
  if (pack) {
    return <SteelSectionFig spec={buildLosaDraftSpec(model, pack)} />;
  }
  const { pad, sc, W, H } = viewBoxOf(model);
  const layers = losaSteelPlan(model, bars);
  return (
    <figure className="mae-fig">
      <figcaption>Despiece — barras con grosor proporcional al Ø</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="mae-fig-svg">
        <rect x="0" y="0" width={W} height={H} fill="#f7f3ea" />
        {model.cells.map((row, iy) =>
          row.map((on, ix) => {
            if (!on) return null;
            const a = { x: pad + (model.axesX[ix] - model.axesX[0]) * sc, y: pad + (model.axesY[model.axesY.length - 1] - model.axesY[iy + 1]) * sc };
            const w = (model.axesX[ix + 1] - model.axesX[ix]) * sc;
            const h = (model.axesY[iy + 1] - model.axesY[iy]) * sc;
            return <rect key={`${ix}-${iy}`} x={a.x} y={a.y} width={w} height={h} fill="#efe8dc" stroke="#1a4473" />;
          }),
        )}
        {layers.map((b, i) => (
          <path key={i} d={b.d} fill="none" stroke={b.color} strokeWidth={b.sw} strokeLinecap="round" />
        ))}
      </svg>
      <p className="mae-fig-note">{losaCaption(bars)}</p>
    </figure>
  );
}

export function MaeReport({
  steps,
  checks,
  headline,
  adoption,
}: {
  steps: { n: string; title: string; formula?: string; formulaTex?: string; substitution?: string; result: string; note?: string; desarrollo?: string[]; ok?: boolean; table?: { caption?: string; headers: string[]; rows: string[][] } }[];
  checks: { label: string; value: string; limit: string; ok: boolean }[];
  headline: string;
  adoption: string;
}) {
  return (
    <div className="mae-report">
      <h3>{headline}</h3>
      <p className="mae-adopt">{adoption}</p>
      {steps.map((s) => (
        <section key={s.n} className="paso">
          <div className="paso-kicker">Paso {s.n}</div>
          <h4>{s.title}</h4>
          {s.formula ? (
            <div className="paso-row">
              <span className="paso-lab">Fórmula</span>
              <Formula tex={s.formulaTex} fallback={s.formula} />
            </div>
          ) : null}
          {s.desarrollo?.length ? (
            <div className="paso-row">
              <span className="paso-lab">Cálculo</span>
              <ol className="paso-des">
                {s.desarrollo.map((ln) => (
                  <li key={ln}>{ln}</li>
                ))}
              </ol>
            </div>
          ) : null}
          {s.substitution ? (
            <div className="paso-row">
              <span className="paso-lab">Sustitución</span>
              <p>{s.substitution}</p>
            </div>
          ) : null}
          <div className="paso-row paso-res">
            <span className="paso-lab">Resultado</span>
            <MathLine text={s.result} />
          </div>
          {s.note ? (
            <div className="paso-row">
              <span className="paso-lab">Criterio</span>
              <p className="paso-nota">{s.note}</p>
            </div>
          ) : null}
          {s.table?.headers.length ? (
            <div className="table-scroll">
              <table>
                <caption>{s.table.caption}</caption>
                <thead>
                  <tr>
                    {s.table.headers.map((h) => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {s.table.rows.map((r, i) => (
                    <tr key={i}>
                      {r.map((c, j) => (
                        <td key={j}>{c}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      ))}
      <h3>Verificaciones</h3>
      {checks.map((c) => (
        <div key={c.label} className={`check ${c.ok ? "ok" : "bad"}`}>
          <span className="stamp">{c.ok ? "CUMPLE" : "NO CUMPLE"}</span>
          <span>
            {c.label}: {c.value} · límite {c.limit}
          </span>
        </div>
      ))}
    </div>
  );
}

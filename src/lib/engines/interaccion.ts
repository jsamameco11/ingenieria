import { type CalcCheck, type CalcOutput, type Engine, barByName, fmt, num, str } from "../types";
import { encodeDemands, encodePts } from "../colpro";
import { fmtPMTable, parseEtabsPaste } from "../pmMotor";
import { buildPmSheets } from "../pmExport";
import { checkPoint, generateFiberPM, symmetryReport } from "../pmFiber";
import { buildSection, describeForma, resolvePmForma } from "../pmSections";

function out(
  headline: string,
  adoption: string,
  steps: CalcOutput["steps"],
  checks: CalcCheck[],
  extras?: CalcOutput["extras"],
  dims?: Record<string, string>,
): CalcOutput {
  return { headline, adoption, steps, checks, extras, dims };
}
function ok(label: string, value: string, limit: string, pass: boolean): CalcCheck {
  return { label, value, limit, ok: pass };
}

export const diagramaInteraccion: Engine = (raw) => {
  const tipo = str(raw, "tipoElem", "columna");
  const forma = resolvePmForma(tipo, str(raw, "formaPM", "rect"), str(raw, "conBE", "si"));
  const code = str(raw, "codePM", "E060") === "ACI" ? "ACI" : "E060";
  const spiral = str(raw, "spiral", "no") === "si" || (forma === "circ" && str(raw, "spiral", "no") !== "no");
  const b = num(raw, "b", 40);
  const h = num(raw, "h", forma === "circ" ? b : 40);
  const rec = num(raw, "rec", 4);
  const destName = str(raw, "dest", '3/8"');
  const dest = barByName(destName).db;
  const bar = str(raw, "bar", '3/4"');
  const nBar = num(raw, "nBar", forma === "circ" ? 8 : 8);
  const sec = buildSection({
    forma,
    b,
    h: forma === "circ" ? b : h,
    tw: num(raw, "tw", 20),
    tf: num(raw, "tf", 20),
    tWall: num(raw, "tWall", 20),
    rec,
    dest,
    bar,
    nBar,
    barBE: str(raw, "barBE", bar),
    nBarBE: num(raw, "nBarBE", 4),
    nBarAlma: num(raw, "nBarAlma", 2),
    nBarAla: num(raw, "nBarAla", num(raw, "nBarAlma", 2)),
    bBE: num(raw, "bBE", 14),
    hBE: num(raw, "hBE", h),
    barMalla: str(raw, "barMalla", '3/8"'),
    sMalla: num(raw, "sMalla", 20),
    nInner: num(raw, "nInner", 0),
    polyUser: str(raw, "polyUser", ""),
    holesUser: str(raw, "holesUser", ""),
    barsUser: str(raw, "barsUser", ""),
  });
  const fc = num(raw, "fc", 210);
  const fy = num(raw, "fy", 4200);
  const fib = generateFiberPM(sec, { fc, fy, code, spiral });
  const paste = parseEtabsPaste(str(raw, "etabsPaste", ""), str(raw, "etabsSign", "etabs") === "memoria" ? "memoria" : "etabs");
  const PuMan = num(raw, "Pu", 0);
  const M2Man = num(raw, "M2u", 0);
  const M3Man = num(raw, "M3u", 0);
  const extra =
    Math.abs(PuMan) + Math.abs(M2Man) + Math.abs(M3Man) > 1e-6
      ? [{ name: str(raw, "comboNom", "Punto manual"), p: PuMan, m2: M2Man, m3: M3Man }]
      : [];
  const demands = [...extra, ...paste];
  const checksPts = demands.map((d) => {
    const r = checkPoint(fib, d.p, d.m2, d.m3);
    return { ...d, ...r };
  });
  const worst = checksPts.length ? checksPts.reduce((a, b) => (b.dc > a.dc ? b : a)) : null;
  const wallLike = tipo === "muro" || tipo === "caja" || tipo === "nucleo" || forma === "muro" || forma === "muro-be" || forma === "caja";
  const rhoMin = wallLike ? 0.0025 : 0.01;
  const rhoMax = wallLike ? 0.06 : 0.04;
  const okRho = fib.rho + 1e-9 >= rhoMin && fib.rho <= rhoMax + 1e-9;
  const okPo = fib.Pnmax > 0.5;
  const okCurve = fib.m3.pts.length >= 8 && fib.m2.pts.length >= 8;
  const geom = describeForma(forma);
  const steelTxt = `${sec.bars.length} barras · As = ${fmt(sec.As, 2)} cm²`;
  const norma = code === "ACI" ? "ACI 318" : "RNE E.060";
  const phiTxt = spiral ? `espiral φc=${fmt(fib.phiC, 2)} α=${fmt(fib.alfa, 2)}` : `estribada φc=${fmt(fib.phiC, 2)} α=${fmt(fib.alfa, 2)}`;
  const sym = symmetryReport(sec, fib);
  const simM3 = sym.m3eq
    ? `iguales (${fmt(sym.m3p, 2)} t·m)`
    : `distintas: + ${fmt(sym.m3p, 2)} / − ${fmt(sym.m3n, 2)} t·m`;
  const simM2 = sym.m2eq
    ? `iguales (${fmt(sym.m2p, 2)} t·m)`
    : `distintas: + ${fmt(sym.m2p, 2)} / − ${fmt(sym.m2n, 2)} t·m`;
  const symNote =
    forma === "C"
      ? `La C (canal) es simétrica respecto del eje 3 (horizontal por G): M3+ = M3−. No lo es respecto del eje 2: G queda ${fmt(Math.abs(sym.ex), 2)} cm hacia el alma (cx = ${fmt(sym.cx, 2)} cm, el recuadro centra en ${fmt(sym.midX, 2)} cm). Comprimir el alma no es lo mismo que comprimir las puntas de las alas; por eso M2+ ≠ M2−. Es el comportamiento correcto de un canal, igual que en Section Designer.`
      : forma === "L"
        ? `La L no tiene eje de simetría. G se desplaza hacia el rincón (ex = ${fmt(sym.ex, 2)} cm, ey = ${fmt(sym.ey, 2)} cm). Las cuatro ramas ±M2 y ±M3 son distintas.`
        : forma === "T"
          ? `La T es simétrica respecto del alma (eje 2): M2+ = M2−. No lo es en el eje 3 (ala vs extremo del alma): M3+ ≠ M3−. G sube hacia el ala (ey = ${fmt(sym.ey, 2)} cm).`
          : forma === "I" || forma === "rect" || forma === "circ"
            ? `Sección simétrica respecto de G. Las ramas + y − coinciden en M2 y en M3.`
            : `G = (${fmt(sym.cx, 2)}; ${fmt(sym.cy, 2)}) cm respecto del origen del polígono. Las ramas ± solo coinciden si la sección (y el acero) son simétricas respecto de ese eje.`;

  const tableCombos: string[][] = [["Combinación", "Pu (t)", "M2 (t·m)", "M3 (t·m)", "D/C M2", "D/C M3", "D/C PMM", "¿Cumple?"]];
  for (const d of checksPts) {
    tableCombos.push([
      d.name,
      fmt(d.p, 2),
      fmt(d.m2, 2),
      fmt(d.m3, 2),
      fmt(d.dc2, 3),
      fmt(d.dc3, 3),
      fmt(d.dc, 3),
      d.ok ? "Sí" : "No",
    ]);
  }

  return out(
    `${geom}  ·  ${steelTxt}  ·  ρg = ${fmt(fib.rho * 100, 2)} %  ·  φPn,máx = ${fmt(fib.Pnmax, 1)} t`,
    `${norma}  ·  ${phiTxt}  ·  Po = ${fmt(fib.Po, 1)} t  ·  ${sec.name}`,
    [
      {
        n: "01",
        title: "Sección y acero — modelo tipo Section Designer",
        formula: "Ag, Ix, Iy por polígonos (con huecos)    As = Σ As,i",
        substitution: `${sec.name}  ·  ${sec.bars.length} barras  ·  rec = ${fmt(rec, 1)} cm  ·  Ø long ${bar}  ·  estribo ${destName}`,
        result: `Ag = ${fmt(fib.Ag, 0)} cm²    As = ${fmt(fib.As, 2)} cm²    ρg = ${fmt(fib.rho * 100, 2)} %    G = (${fmt(sym.cx, 2)}; ${fmt(sym.cy, 2)}) cm`,
        note:
          (forma === "caja"
            ? "Caja de ascensor: polígono exterior menos el hueco. Las barras de perímetro y, si se piden, las de cara interior y los núcleos de confinamiento en las cuatro esquinas entran al diagrama."
            : forma === "muro-be"
              ? "Muro con elementos de borde: cuantía de alma (malla) + columnas de confinamiento en ambos extremos, E.060 21.9."
              : forma === "libre"
                ? "Section Designer: el polígono, los huecos y las barras son los que usted trazó (clic en el croquis o coordenadas). El recubrimiento se respeta al generar barras automáticas de perímetro."
                : "La sección se discretiza como anillo(s) de concreto y barras puntuales. El motor es el mismo para columna, muro, L, T, C, I o núcleo.") +
          "  " +
          symNote,
      },
      {
        n: "02",
        title: "Resistencia axial nominal (Po)",
        formula: "Po = 0.85 f'c (Ag − As) + fy As",
        substitution: `0.85 × ${fmt(fc, 0)} × (${fmt(fib.Ag, 0)} − ${fmt(fib.As, 2)}) + ${fmt(fy, 0)} × ${fmt(fib.As, 2)}`,
        result: `Po = ${fmt(fib.Po, 1)} t`,
        note: `${norma}: φPn,máx = α φc Po con α = ${fmt(fib.alfa, 2)} (${spiral ? "espiral / circular" : "estribos"}) y φc = ${fmt(fib.phiC, 2)}.`,
      },
      {
        n: "03",
        title: "Diagrama φPn–φMn — compatibilidad de deformaciones",
        formula: "εcu = 0.003    a = β1 c    Cc = 0.85 f'c Acomp    fs = Es εs ≤ fy",
        substitution: `β1 = ${fmt(fc <= 280 ? 0.85 : Math.max(0.65, 0.85 - 0.05 * ((fc - 280) / 70)), 2)}  ·  Es = 2 000 000 kg/cm²  ·  barrido de c y de los cuatro sentidos (±2, ±3)`,
        result: `φPn,máx = ${fmt(fib.Pnmax, 1)} t    φMn,máx M3 = ${fmt(Math.max(...fib.m3.pts.map((p) => p[1]), 0), 2)} t·m    φMn,máx M2 = ${fmt(Math.max(...fib.m2.pts.map((p) => p[1]), 0), 2)} t·m`,
        note: "El bloque de Whitney recorta el polígono (y resta huecos). En cada barra se descuenta 0.85 f'c si cae dentro del bloque. φ transita de φc a 0.90 entre εt = 0.002 y 0.005, igual que ETABS Concrete Frame Design.",
        table: { caption: "Puntos del diagrama M3 (sentido +)", headers: fmtPMTable(fib.m3.rows)[0], rows: fmtPMTable(fib.m3.rows).slice(1) },
      },
      {
        n: "04",
        title: "Verificación P–M–M estilo ETABS (Bresler)",
        formula: "1/Pn = 1/Pnx + 1/Pny − 1/Po    D/C = |Pu| / Pn",
        substitution: worst
          ? `${worst.name}: Pu=${fmt(worst.p, 2)} t  M2=${fmt(worst.m2, 2)}  M3=${fmt(worst.m3, 2)}  ·  ${worst.method}`
          : "Pegue la tabla ETABS de Column o Pier Forces (CM, CV, CSX, CSY · P, V2, V3, T, M2, M3) o un punto manual. Compresión positiva en la memoria; en ETABS el axial a compresión suele ir negativo — elija el convenio.",
        result: worst ? `D/C máx = ${fmt(worst.dc, 3)}  ·  ${worst.ok ? "CUMPLE" : "NO CUMPLE"}` : "Sin demandas — solo se genera la envolvente.",
        note: "Si Pu ≈ 0 se usa elipse de momentos. Uniaxial si un momento es nulo. El D/C ≤ 1.00 es el mismo criterio de ratio de ETABS.",
        table: checksPts.length ? { caption: "Demandas vs capacidad PMM", headers: tableCombos[0], rows: tableCombos.slice(1) } : undefined,
      },
    ],
    [
      ok(`${norma}: φPn,máx = α φc Po`, `${fmt(fib.Pnmax, 1)} t`, `α=${fmt(fib.alfa, 2)} φc=${fmt(fib.phiC, 2)}`, okPo),
      ok(
        tipo === "muro" || forma.startsWith("muro") || forma === "caja" ? "ρ de muro/núcleo 0.25 %–6 %" : "ρg columna 1 %–4 % (E.060 10.9)",
        `${fmt(fib.rho * 100, 2)} %`,
        `${fmt(rhoMin * 100, 2)}–${fmt(rhoMax * 100, 0)} %`,
        okRho,
      ),
      ok("Diagrama M3 generado", `${fib.m3.pts.length} puntos`, "≥ 8", okCurve),
      ok("Diagrama M2 generado", `${fib.m2.pts.length} puntos`, "≥ 8", fib.m2.pts.length >= 8),
      ...(forma === "C"
        ? [
            ok("C: M3+ = M3− (simetría horizontal por G)", simM3, "iguales", sym.m3eq),
            ok("C: M2+ ≠ M2− (G hacia el alma)", simM2, "distintas", !sym.m2eq),
          ]
        : forma === "T"
          ? [
              ok("T: M2+ = M2− (simetría del alma)", simM2, "iguales", sym.m2eq),
              ok("T: M3+ ≠ M3− (ala vs alma)", simM3, "distintas", !sym.m3eq),
            ]
          : forma === "I" || forma === "rect" || forma === "circ"
            ? [
                ok("M3+ = M3− (simetría por G)", simM3, "iguales", sym.m3eq),
                ok("M2+ = M2− (simetría por G)", simM2, "iguales", sym.m2eq),
              ]
            : []),
      ...(worst
        ? [ok(`D/C PMM ≤ 1.00 (${worst.name})`, fmt(worst.dc, 3), "≤ 1.00", worst.ok)]
        : [ok("Demandas ETABS o punto Pu–M2–M3", "sin datos", "pegar o llenar", true)]),
    ],
    buildPmSheets({
      comma: true,
      meta: {
        titulo: `${geom} · ${steelTxt}`,
        norma,
        seccion: sec.name,
        barras: steelTxt,
        Ag: fib.Ag,
        As: fib.As,
        rho: fib.rho,
        Po: fib.Po,
        Pnmax: fib.Pnmax,
        phiC: fib.phiC,
        alfa: fib.alfa,
        fc,
        fy,
        cx: sym.cx,
        cy: sym.cy,
        ex: sym.ex,
        ey: sym.ey,
        simM3,
        simM2,
      },
      fib,
      bars: sec.bars,
      demands: checksPts,
    }),
    {
      forma,
      tipoElem: tipo,
      b: String(b),
      h: String(forma === "circ" ? b : h),
      rec: String(rec),
      tw: String(num(raw, "tw", 20)),
      tf: String(num(raw, "tf", 20)),
      tWall: String(num(raw, "tWall", 20)),
      bBE: String(num(raw, "bBE", 25)),
      nBar: String(nBar),
      nBarsDraw: String(sec.bars.length),
      As: String(sec.As),
      poly: sec.outer.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(";"),
      holes: sec.holes.map((h) => h.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(";")).join("|"),
      bars: sec.bars.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)},${p.As.toFixed(3)}`).join(";"),
      sdLive: "1",
      cx: String(sec.cx),
      cy: String(sec.cy),
      pmKind: forma.startsWith("muro") || forma === "caja" ? "placa" : "col",
      pm3: encodePts(fib.m3.pts),
      pm2: encodePts(fib.m2.pts),
      pm3neg: encodePts(fib.m3n.pts),
      pm2neg: encodePts(fib.m2n.pts),
      dem3: encodeDemands(demands.map((d) => ({ p: d.p, m: d.m3, name: d.name }))),
      dem2: encodeDemands(demands.map((d) => ({ p: d.p, m: d.m2, name: d.name }))),
      dem3p: encodeDemands(demands.filter((d) => d.m3 >= -1e-9).map((d) => ({ p: d.p, m: Math.abs(d.m3), name: d.name }))),
      dem3n: encodeDemands(demands.filter((d) => d.m3 <= 1e-9).map((d) => ({ p: d.p, m: Math.abs(d.m3), name: d.name }))),
      dem2p: encodeDemands(demands.filter((d) => d.m2 >= -1e-9).map((d) => ({ p: d.p, m: Math.abs(d.m2), name: d.name }))),
      dem2n: encodeDemands(demands.filter((d) => d.m2 <= 1e-9).map((d) => ({ p: d.p, m: Math.abs(d.m2), name: d.name }))),
    },
  );
};

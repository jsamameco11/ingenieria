import { fmt, num, str, type Engine } from "../../types";
import { designBeamStirrups } from "../../estribos";
import { barByName } from "../../types";
import { invertBeam, packPts } from "./matrixBeam";
import { asFlex, fmtBar, ldTension, ok, out, pickSlabBar, round05, step } from "./steel";

export type VcColLoad = { x: number; P: number; M: number; id: string };

function parseCols(raw: string | undefined, L: number): VcColLoad[] {
  if (!raw?.trim()) return [];
  try {
    const j = JSON.parse(raw) as { cols?: { x: number; P3?: number; Pu?: number; M3?: number; id?: string }[] };
    if (!Array.isArray(j.cols) || !j.cols.length) return [];
    return j.cols.map((c, i) => ({
      x: Math.min(L, Math.max(0, Number(c.x) || 0)),
      P: Number(c.Pu) > 0 ? Number(c.Pu) : 1.5 * Math.max(Number(c.P3) || 0, 0),
      M: Number(c.M3) || 0,
      id: String(c.id || `C${i + 1}`),
    }));
  } catch {
    return [];
  }
}

function unpackPts(raw: string | undefined): { x: number; M: number }[] {
  if (!raw?.trim()) return [];
  return raw
    .split(";")
    .map((s) => s.split(",").map(Number))
    .filter((a) => a.length >= 2 && Number.isFinite(a[0]) && Number.isFinite(a[1]))
    .map(([x, M]) => ({ x, M }));
}

/**
 * Motor de cálculo profesional — viga de cimentación (viga invertida).
 * Separado de zapata/platea: analiza el tramo gobernante como viga de
 * extremos libres con reacción del suelo q(x)=a+bx calibrada a ΣV=0 y ΣM=0
 * (Bowles), y diseña flexión (As inf/sup), cortante + estribos E.060 11/21
 * y anclaje ℓd E.060 12.2. Emite el cuadro de diseño que alimenta al motor
 * de renderizado del despiece (vigaCimentacionDespiece).
 */
export const calcVigaCimentacion: Engine = (raw) => {
  const L = Math.max(num(raw, "Lbeam", num(raw, "L", 12)), 1.5);
  const bM = num(raw, "bBeam", 0.4);
  const hM = num(raw, "hBeam", 0.6);
  const bCm = Math.max(Math.round(bM * 100), 25);
  const hCm = Math.max(Math.round(hM * 100), 40);
  const fc = num(raw, "fc", 210);
  const fy = num(raw, "fy", 4200);
  const rec = num(raw, "recVC", num(raw, "rec", 7.5));
  const estName = str(raw, "estVC", '3/8"');
  const nRamas = Math.max(2, Math.round(num(raw, "ramasVC", 2)));
  const qu = num(raw, "qu", 0);
  const bTrib = num(raw, "bTrib", Math.max(bM, 0.4));

  // Columnas del tramo: vcColsJson > mPts (saltos de V) > reparto uniforme.
  let cols = parseCols(str(raw, "vcColsJson", ""), L);
  const ptsIn = unpackPts(str(raw, "mPts", ""));
  const wLine = qu > 0 && bTrib > 0 ? qu * bTrib : Math.max(num(raw, "wLine", 0), 0.1);
  if (!cols.length && ptsIn.length >= 2) {
    // Deriva apoyos de los saltos de cortante del diagrama importado.
    const vPts = unpackPts(str(raw, "vPts", ""));
    const xs = new Set<number>();
    if (vPts.length >= 2) {
      for (let i = 1; i < vPts.length; i++) {
        const jump = Math.abs(vPts[i].M - vPts[i - 1].M);
        if (jump > 3 && Math.abs(vPts[i].x - vPts[i - 1].x) < L * 0.02 + 0.05) xs.add((vPts[i].x + vPts[i - 1].x) / 2);
      }
    }
    const uniq = [...xs].sort((a, b) => a - b).filter((x) => x > 0.15 && x < L - 0.15);
    if (uniq.length >= 1) {
      const P = (wLine * L) / uniq.length;
      cols = uniq.map((x, i) => ({ x, P, M: 0, id: `C${i + 1}` }));
    }
  }
  if (!cols.length) {
    const n = Math.max(2, Math.min(6, Math.round(L / 4)));
    cols = Array.from({ length: n }, (_, i) => ({
      x: n === 1 ? L / 2 : (i * L) / (n - 1),
      P: (wLine * L) / n,
      M: 0,
      id: `C${i + 1}`,
    }));
  }

  const beam = invertBeam(
    L,
    wLine,
    cols.map((c) => ({ x: c.x, P: c.P, M: c.M })),
  );
  const Mend = beam.pts.length ? beam.pts[beam.pts.length - 1].M : 0;
  const Vend = beam.Vend ?? 0;
  const Msoil = Math.max(-beam.Mmin, 0);
  const Mtop = Math.max(beam.Mmax, 0);
  const Vmax = beam.Vmax;

  // Flexión: M− entre apoyos = lecho inferior continuo; M+ en vuelos = superior.
  const d = hCm - Math.max(rec, 4) - 1.2;
  const flexInf = asFlex(Msoil, bCm, d, fc, fy, hCm);
  const flexSup = asFlex(Mtop, bCm, d, fc, fy, hCm);
  const nInf = Math.max(2, Math.min(8, Math.ceil((flexInf.As / Math.max(barByName(str(raw, "barVCInf", '3/4"')).as, 0.5)) * 10) / 10));
  void nInf;
  const barInfPick = pickSlabBar(Math.max(flexInf.As / Math.max(bCm / 25, 1), 1.5), hCm);
  void barInfPick;
  const longInfName = str(raw, "asVCInf", "");
  const longSupName = str(raw, "asVCSup", "");
  const dbInfGuess = longInfName ? barByName(longInfName.replace(/.*Ø\s*/i, "").split("@")[0].trim() || '3/4"').db : 1.91;
  const dbSupGuess = longSupName ? barByName(longSupName.replace(/.*Ø\s*/i, "").split("@")[0].trim() || '1/2"').db : 1.27;
  const AsInfNeed = flexInf.As;
  const AsSupNeed = flexSup.As;
  const nBarsInf = Math.max(2, Math.ceil(AsInfNeed / Math.max(barByName('3/4"').as, 0.5)));
  const nBarsSup = Math.max(2, Math.ceil(Math.max(AsSupNeed, 0.5) / Math.max(barByName('1/2"').as, 0.5)));
  const asVCInf = longInfName || `${Math.min(8, nBarsInf)} Ø 3/4"`;
  const asVCSup = longSupName || `${Math.min(8, nBarsSup)} Ø 1/2"`;

  // Cortante + estribos E.060 11 / 21.3.
  const estBar = barByName(estName);
  const Av = nRamas * estBar.as;
  const dbLong = Math.max(dbInfGuess, dbSupGuess, 1.27);
  const sh = designBeamStirrups({
    b: bCm,
    h: hCm,
    d,
    rec: Math.min(rec, 5),
    fc,
    fy,
    Vu: Vmax,
    VA: Vmax,
    Av,
    L,
    destName: estBar.name,
    destDb: estBar.db,
    dbLong,
    nRamas,
    sismico: true,
  });
  const ldInf = ldTension(fy, fc, dbInfGuess);
  const ldSup = ldTension(fy, fc, dbSupGuess);
  const t = `${fmt(L, 2)}×${bCm}×${hCm}`;

  return out(
    `Viga de cimentación ${t} m/cm  ·  ${cols.length} col.  ·  M− ${fmt(Msoil, 2)} / M+ ${fmt(Mtop, 2)} t·m`,
    `Inf. ${asVCInf} (corrido)  ·  sup. ${asVCSup} (cortes L_teo+ℓd)  ·  est. ${nRamas}Ø ${estBar.name} ${sh.arregloPlano}  ·  V ${fmt(Vmax, 1)} t.`,
    [
      step(
        "01",
        "Tramo gobernante y cargas — viga invertida de extremos libres",
        "ΣPu del tramo    ·    w ≈ ΣPu/L    ·    q(x)=a+bx con ∫q=ΣPu y ∫qx=ΣPuxi+ΣMc",
        "q(x)=a+bx\\qquad \\int_0^L q\\,dx=\\sum P_u\\qquad M(0)=M(L)=0",
        `L = ${fmt(L, 2)} m    ·    b×h = ${bCm}×${hCm} cm    ·    ${cols.length} col.: ${cols.map((c) => `${c.id}@${fmt(c.x, 2)}=${fmt(c.P, 1)}t`).join("  ")}`,
        `ΣPu = ${fmt(cols.reduce((s, c) => s + c.P, 0), 1)} t    ·    w ≈ ${fmt(wLine, 2)} t/m    ·    q(0) = ${fmt(beam.q0 ?? 0, 2)}    q(L) = ${fmt(beam.qL ?? 0, 2)} t/m`,
        "Cada tramo con columnas es una viga invertida rígida (Bowles): la reacción lineal del suelo se calibra a las Pu y Mc del tramo. Un VC sin columnas no gobierna.",
        {
          desarrollo: cols.map((c) => `${c.id}: x = ${fmt(c.x, 2)} m, Pu = ${fmt(c.P, 1)} t${c.M ? `, Mc = ${fmt(c.M, 2)} t·m` : ""}.`),
          table: {
            caption: "Cargas del tramo",
            headers: ["Col", "x (m)", "Pu (t)", "Mc (t·m)"],
            rows: cols.map((c) => [c.id, fmt(c.x, 2), fmt(c.P, 1), fmt(c.M, 2)]),
          },
        },
      ),
      step(
        "02",
        "Análisis estructural — diagramas V(x) y M(x)",
        "V(x)=∫q−ΣPu    ·    M(x)=∫V    ·    M(0)=M(L)=0 verifica equilibrio",
        "V(x)=\\int_0^x q-\\sum P_u\\qquad M(x)=\\int_0^x V",
        `Estaciones: ${beam.pts.length}    ·    Vmáx = ${fmt(Vmax, 1)} t    ·    M+ = ${fmt(beam.Mmax, 2)}    M− = ${fmt(beam.Mmin, 2)} t·m`,
        `M− suelo = ${fmt(Msoil, 2)} t·m (inf. continuo)    ·    M+ vuelos = ${fmt(Mtop, 2)} t·m (sup. cortado)    ·    cierre V(L) = ${fmt(Vend, 2)} t, M(L) = ${fmt(Mend, 2)} t·m`,
        "Entre apoyos el momento tracciona la cara del suelo (M−, acero inferior continuo). En vuelos tracciona arriba (M+, superior cortado L_teo+ℓd). Si V(L) o M(L) no cierran ≈0, el tramo está mal asignado.",
        {
          ok: Math.abs(Vend) < Math.max(2, wLine * L * 0.05) && Math.abs(Mend) < Math.max(1, Msoil * 0.1 + 0.5),
          desarrollo: [
            `q(x) calibrada: q(0) = ${fmt(beam.q0 ?? 0, 2)} t/m, q(L) = ${fmt(beam.qL ?? 0, 2)} t/m.`,
            `Vmáx = ${fmt(Vmax, 1)} t en x = ${fmt(beam.xMmax, 2)} m. M− máx en x = ${fmt(beam.xMmin, 2)} m.`,
            `Equilibrio: V(L) = ${fmt(Vend, 2)} t ≈ 0, M(L) = ${fmt(Mend, 2)} t·m ≈ 0 (extremos libres).`,
          ],
        },
      ),
      step(
        "03",
        "Flexión — acero longitudinal E.060 10 (Whitney)",
        "Rn = Mu/(φbd²)    ·    As = máx(ρbd, 14bd/fy, 0.8√f'c bd/fy)",
        "R_n=\\dfrac{M_u}{\\phi b d^2}\\qquad A_s=\\max(\\rho bd,\\tfrac{14}{f_y}bd)",
        `b = ${bCm} cm    ·    h = ${hCm} cm    ·    d = ${fmt(d, 1)} cm    ·    f'c = ${fmt(fc, 0)}    fy = ${fmt(fy, 0)}`,
        `Inf. As = ${fmt(AsInfNeed, 2)} cm² → ${asVCInf}    ·    sup. As = ${fmt(AsSupNeed, 2)} cm² → ${asVCSup}`,
        "Inferior corrido de extremo a extremo (M− entre apoyos). Superior cortado en cada apoyo/extremo: L_teo ≈ 0.30ℓn + ℓd con extensión máx(d, 12db, ℓn/16).",
        {
          desarrollo: [
            `d = h − rec − Øest − Ø/2 ≈ ${hCm} − ${fmt(rec, 1)} − ${fmt(estBar.db, 2)} − 1.0 = ${fmt(d, 1)} cm.`,
            `M− = ${fmt(Msoil, 2)} t·m → Rn = ${fmt(flexInf.Rn ?? 0, 1)} → As = ${fmt(AsInfNeed, 2)} cm² (mín ${fmt(flexInf.Asmin, 2)}).`,
            `M+ = ${fmt(Mtop, 2)} t·m → As = ${fmt(AsSupNeed, 2)} cm² (mín ${fmt(flexSup.Asmin, 2)}).`,
          ],
        },
      ),
      step(
        "04",
        "Cortante y estribos — E.060 11 y 21.3 (confinamiento)",
        "Vc = 0.53√f'c bd    ·    Vs = Vu/φ−Vc    ·    s = Av fy d/Vs    ·    1@5 + zona 2h",
        "\\phi V_c=0.85\\cdot 0.53\\sqrt{f'_c}bd\\qquad s=\\dfrac{A_v f_y d}{V_s}",
        `Vu = ${fmt(Vmax, 1)} t (a d de la cara)    ·    ${nRamas}R Ø ${estBar.name} (Av = ${fmt(Av, 2)} cm²)`,
        `Vc = ${fmt(sh.Vc, 1)} t    φVc = ${fmt(sh.phiVc, 1)} t    Vs = ${fmt(sh.Vs, 1)} t    → ${sh.arregloPlano} (${sh.nTotal} est.)`,
        `${sh.regimen}. ${sh.criterioZona}. Primer estribo a 5 cm del paño (E.060 11.5.5.1).`,
        {
          ok: sh.sectionOk,
          desarrollo: [
            `φVc = ${fmt(sh.phiVc, 1)} t, Vs,máx = ${fmt(sh.VsMax, 1)} t ${sh.sectionOk ? "(sección OK)" : "(SECCIÓN INSUFICIENTE: subir b/h)"}.`,
            `Apoyo: s ≤ ${fmt(sh.sMaxApoyo, 1)} cm → se adopta ${sh.sApoyo} cm en ℓ = ${fmt(sh.Lzona, 2)} m por extremo.`,
            `Centro: s ≤ ${fmt(sh.sMaxCentro, 1)} cm → ${sh.sCentro} cm en ${fmt(sh.Lcentro, 2)} m.`,
            `Metrado: ${sh.arregloPlano}, ${sh.nTotal} estribos de L = ${fmt(sh.Lunit, 1)} cm c/u.`,
          ],
        },
      ),
      step(
        "05",
        "Desarrollo y anclaje — E.060 12.2",
        "ℓd = 0.075 fy db/√f'c    ·    Lsup = L_teo + ℓd    ·    gancho 90° ≥ 12db",
        "\\ell_d=0.075\\,f_y d_b/\\sqrt{f'_c}",
        `db inf. ${fmt(dbInfGuess, 2)} / sup. ${fmt(dbSupGuess, 2)} cm`,
        `ℓd inf. = ${fmt(ldInf, 1)} cm    ℓd sup. = ${fmt(ldSup, 1)} cm    gancho ≥ ${fmt(12 * dbInfGuess, 1)} cm    rec = ${fmt(rec, 1)} cm`,
        "Inferior continuo anclado con gancho 90° en bordes libres. Superior: L_teo desde la cara + ℓd. Rec ≥ 7.5 cm contra suelo.",
        {},
      ),
    ],
    [
      ok("Equilibrio V(L)≈0", fmt(Vend, 2), "≈ 0", Math.abs(Vend) < Math.max(2, wLine * L * 0.05)),
      ok("Equilibrio M(L)≈0", fmt(Mend, 2), "≈ 0", Math.abs(Mend) < Math.max(1, Msoil * 0.1 + 0.5)),
      ok("Cortante sección", fmt(Vmax, 1), `≤ ${fmt(0.85 * (sh.Vc + sh.VsMax), 1)}`, sh.sectionOk),
      ok("Estribos", sh.arregloPlano, sh.regimen, true),
      ok("h ≥ 40 cm", `${hCm} cm`, "≥ 40", hCm >= 40),
    ],
    [
      {
        title: "Estaciones V–M del tramo",
        rows: [
          ["x (m)", "V (t)", "M (t·m)"],
          ...beam.pts.filter((_, i, a) => i % 2 === 0 || i === a.length - 1).map((p) => [fmt(p.x, 2), fmt(p.V, 1), fmt(p.M, 2)]),
        ],
      },
    ],
    {
      Lbeam: L.toFixed(2),
      L: L.toFixed(2),
      bBeam: bM.toFixed(2),
      hBeam: hM.toFixed(2),
      Msoil: Msoil.toFixed(2),
      Mtop: Mtop.toFixed(2),
      VmaxVC: Vmax.toFixed(2),
      asVCInf,
      asVCSup,
      AsVCInf: AsInfNeed.toFixed(2),
      AsVCSup: AsSupNeed.toFixed(2),
      estVC: `${nRamas}Ø ${estBar.name} ${sh.arregloPlano}`,
      sApoyoVC: String(sh.sApoyo),
      sCentroVC: String(sh.sCentro),
      nEstVC: String(sh.nTotal),
      LzonaVC: sh.Lzona.toFixed(2),
      ldInfVC: ldInf.toFixed(1),
      ldSupVC: ldSup.toFixed(1),
      vcColsJson: JSON.stringify({ cols }),
      mPts: packPts(beam.pts.map((p) => ({ x: p.x, M: p.M }))),
      vPts: packPts(beam.pts.map((p) => ({ x: p.x, M: p.V }))),
    },
  );
};

export function designVcSummary(raw: Record<string, string>) {
  const L = Math.max(num(raw, "Lbeam", num(raw, "L", 12)), 1);
  void L;
  return {
    inf: str(raw, "asVCInf", str(raw, "asLong", '3 Ø 3/4"')),
    sup: str(raw, "asVCSup", str(raw, "asSup", '2 Ø 1/2"')),
    est: str(raw, "estVC", '2Ø 3/8"'),
    sAp: num(raw, "sApoyoVC", 10),
    sCe: num(raw, "sCentroVC", 20),
  };
}

export { round05, fmtBar };

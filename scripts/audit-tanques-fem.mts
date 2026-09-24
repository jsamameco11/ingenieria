/**
 * Auditoría estructural de los 4 motores FEM de reservorios/tanques.
 * Compara FEM vs teoría/RK4/equilibrio y revisa el empaquetado de diagramas.
 */
import {
  laminaCilindrica,
  reservorioApoyado,
  reservorioCuadrado,
  tanqueElevadoColumnas,
  tanqueElevadoFuste,
} from "../src/lib/engines/tanques.ts";
import { femCilindro, femFusteCantilever, femMuroRect } from "../src/lib/engines/tanquesFem.ts";
import { solveFrame3D } from "../src/lib/engines/frame3d.ts";
function unpackMomentos(s: string) {
  if (!s) return [] as { x: number; M: number }[];
  return s.split(";").filter(Boolean).map((p) => {
    const [x, M] = p.split(",").map(Number);
    return { x, M };
  });
}

type Sev = "ok" | "info" | "warn" | "fail";
type Finding = {
  motor: string;
  sev: Sev;
  id: string;
  title: string;
  detail: string;
  numbers?: Record<string, number | string>;
};

const findings: Finding[] = [];
function add(f: Finding) {
  findings.push(f);
}
function rel(a: number, b: number) {
  return Math.abs(a - b) / Math.max(Math.abs(b), 1e-9);
}
function maxAbs(pts: { M?: number; N?: number; V?: number }[], key: "M" | "N" | "V") {
  return Math.max(0, ...pts.map((p) => Math.abs((p as Record<string, number>)[key] ?? 0)));
}
function packOk(s: string | undefined, minPts: number) {
  const pts = unpackMomentos(s ?? "");
  const finite = pts.every((p) => Number.isFinite(p.x) && Number.isFinite(p.M));
  const mono = pts.every((p, i) => i === 0 || p.x >= pts[i - 1].x - 1e-9);
  return { n: pts.length, finite, mono, peak: maxAbs(pts as { M: number }[], "M"), pts };
}

/* ------------------------------------------------------------------ */
/* 0. Verificación del pórtico 3D (voladizo exacto)                    */
/* ------------------------------------------------------------------ */
{
  const H = 10, E = 2e6, I = 0.05, A = 0.2, F = 10;
  const nodes = [
    { id: 1, x: 0, y: 0, z: 0, fixed: true },
    { id: 2, x: 0, y: 0, z: H, fixed: false },
  ];
  const elems = [{ n1: 1, n2: 2, E, G: E / 2.4, A, Iy: I, Iz: I, J: 2 * I }];
  const r = solveFrame3D(nodes, elems, [{ node: 2, fx: F }]);
  const dFem = Math.abs(r.disp.get(2)?.[0] ?? 0);
  const dTeo = (F * H ** 3) / (3 * E * I);
  const Mteo = F * H;
  const Mfem = Math.hypot(r.forces[0].My1, r.forces[0].Mz1);
  add({
    motor: "frame3d",
    sev: rel(dFem, dTeo) < 0.02 && rel(Mfem, Mteo) < 0.02 ? "ok" : "fail",
    id: "f3d-cantilever",
    title: "Pórtico 12 GDL vs voladizo exacto",
    detail: "δ=FH³/3EI y M=F·H. Es el motor de la torre de columnas y del fuste.",
    numbers: { dFem, dTeo, errD_pct: rel(dFem, dTeo) * 100, Mfem, Mteo, errM_pct: rel(Mfem, Mteo) * 100 },
  });
}

/* ------------------------------------------------------------------ */
/* 1. Lámina cilíndrica: FEM Hermite vs RK4 (PCA)                      */
/* ------------------------------------------------------------------ */
{
  const H = 4, R = 4, t = 0.25, fc = 210;
  const p = (y: number) => Math.max(0, 1 * (H - y));
  const fem = femCilindro({ H, R, t, fc, presion: p, nElem: 40 });
  const rk = laminaCilindrica(H, R, t, fc, p);
  const Nfem = maxAbs(fem.pts, "N");
  const Nrk = maxAbs(rk, "N");
  const Mfem = maxAbs(fem.pts, "M");
  const Mrk = maxAbs(rk, "M");
  const Vfem = maxAbs(fem.pts, "V");
  const Vrk = maxAbs(rk, "V");
  const w0 = fem.pts[0]?.w ?? 99;
  const NmemBase = p(0) * R;
  const yM = fem.pts.reduce((b, q) => (Math.abs(q.M) > Math.abs(b.M) ? q : b), fem.pts[0]);
  const yN = fem.pts.reduce((b, q) => (Math.abs(q.N) > Math.abs(b.N) ? q : b), fem.pts[0]);
  add({
    motor: "femCilindro",
    sev: Math.abs(w0) < 1e-8 ? "ok" : "fail",
    id: "cil-bc",
    title: "Condición de borde: base empotrada w=0",
    detail: "El primer nudo debe tener deflexión radial nula.",
    numbers: { w_base: w0 },
  });
  add({
    motor: "femCilindro",
    sev: rel(Nfem, Nrk) < 0.08 && rel(Mfem, Mrk) < 0.12 ? "ok" : rel(Nfem, Nrk) < 0.2 ? "warn" : "fail",
    id: "cil-vs-rk4",
    title: "FEM Hermite vs lámina RK4 (tablas PCA)",
    detail: "Misma EDO D w''''+k w=p. N y M máximos deben coincidir dentro de ~8–12 % con 40 elementos.",
    numbers: {
      Nfem, Nrk, errN_pct: rel(Nfem, Nrk) * 100,
      Mfem, Mrk, errM_pct: rel(Mfem, Mrk) * 100,
      Vfem, Vrk, errV_pct: rel(Vfem, Vrk) * 100,
      nElem: fem.nElem, nNodos: fem.nNodos,
    },
  });
  add({
    motor: "femCilindro",
    sev: Nfem < NmemBase && (yM.y / H) < 0.35 && (yN.y / H) > 0.15 ? "ok" : "warn",
    id: "cil-pca-shape",
    title: "Forma PCA: M cerca de la base, N < pR, N no en y=0",
    detail: "En lámina empotrada el anillo se anula en la base (w=0) y el momento vive junto al empotramiento.",
    numbers: {
      Nfem, Nmembrana_pR: NmemBase, yM_sobre_H: yM.y / H, yN_sobre_H: yN.y / H, M_base: fem.pts[0].M,
    },
  });
  add({
    motor: "femCilindro",
    sev: rel(Vfem, Vrk) < 0.12 ? "ok" : "warn",
    id: "cil-V-curvatura",
    title: "Cortante V = dM/dy de la curvatura de Hermite vs RK4",
    detail: "El cortante sale de la derivada del momento de curvatura, no de kb·u. Debe quedar dentro del 12 % del RK4.",
    numbers: { Vfem, Vrk, errV_pct: rel(Vfem, Vrk) * 100 },
  });
}

/* ------------------------------------------------------------------ */
/* 2. Muro rectangular MITC4 vs viga empotrada-empotrada               */
/* ------------------------------------------------------------------ */
{
  const L = 5, H = 3.5, t = 0.25, fc = 210, HL = 3.2;
  const pres = (z: number) => Math.max(0, HL - z);
  const fem = femMuroRect({ L, H, t, fc, presion: pres, techo: true, nx: 6, nz: 8 });
  const w0 = HL, dw = -HL;
  const MA = (w0 * H * H) / 12 + (dw * H * H) / 30;
  const pBase = HL;
  const MhorFix = (pBase * L * L) / 12;
  const MhorSpan = (pBase * L * L) / 24;
  add({
    motor: "femMuroRect",
    sev: fem.ok && fem.nElem === 48 && fem.MvertMax > 0.05 ? "ok" : "fail",
    id: "rect-runs",
    title: "MITC4 converge y entrega momentos",
    detail: "Malla 6×8 = 48 elementos. Si ok=false el motor cae a viga analítica.",
    numbers: { ok: fem.ok ? 1 : 0, nElem: fem.nElem, nNodos: fem.nNodos, MvertMax: fem.MvertMax, MhorEsq: fem.MhorEsq, MhorVano: fem.MhorVano, Vmax: fem.Vmax },
  });
  add({
    motor: "femMuroRect",
    sev: Math.abs(fem.mHor[0]?.M ?? 0) > 0.02 && Math.abs(fem.mVert[0]?.M ?? 0) > 0.02 ? "ok" : "fail",
    id: "rect-dummy-zero",
    title: "Diagramas arrancan en el empotramiento real (M≠0)",
    detail: "mVert[0] es myy en z=0 y mHor[0] es mxx en la esquina. Un dummy {x:0,M:0} fallaría este chequeo.",
    numbers: { mHor0: fem.mHor[0]?.M ?? -1, mVert0: fem.mVert[0]?.M ?? -1 },
  });
  add({
    motor: "femMuroRect",
    sev: fem.MhorEsq > fem.MhorVano ? "ok" : "fail",
    id: "rect-bc-sides",
    title: "Esquinas monolíticas: M de esquina > M de vano",
    detail: "ux=uy=θz=0 en bordes verticales. Patrón de placa empotrada (wL²/12 vs wL²/24), no de apoyo simple.",
    numbers: {
      MhorEsq_FEM: fem.MhorEsq, MhorVano_FEM: fem.MhorVano,
      MhorEsq_viga_L2_12: MhorFix, MhorVano_viga_L2_24: MhorSpan,
      MvertFEM: fem.MvertMax, Mvert_viga_aprox: MA,
    },
  });
  add({
    motor: "femMuroRect",
    sev: fem.MvertMax > 0.3 * MA && fem.MvertMax < 3 * MA ? "ok" : "warn",
    id: "rect-Mvert-order",
    title: "Orden de magnitud de My (franja vertical) vs viga triangular empotrada",
    detail: "La placa 2D reparte carga a las esquinas, así que My suele ser menor que la viga de franja unitaria. Debe quedar en el mismo orden.",
    numbers: { MvertFEM: fem.MvertMax, Mviga: MA, ratio: fem.MvertMax / Math.max(MA, 1e-9) },
  });
}

/* ------------------------------------------------------------------ */
/* 3. Fuste anular                                                      */
/* ------------------------------------------------------------------ */
{
  const H = 16, Dext = 4, Dint = 3.5, fc = 210;
  const Pi = 80, Pc = 20, hI = 18, hC = 19.5;
  const fem = femFusteCantilever({
    H, Dext, Dint, fc, Pi, Pc, hI, hC,
    Wshaft: 200, Wtop: 600, WiTotal: 800, nElem: 16,
  });
  const I = (Math.PI / 64) * (Dext ** 4 - Dint ** 4);
  const E = 15000 * Math.sqrt(210) * 10;
  const kCrown = (3 * E * I) / (H ** 3);
  const dOffset = 1 / kCrown + (H * H / (2 * E * I)) * (hI - H);
  const kTeo = 1 / dOffset;
  const Tteo = 2 * Math.PI * Math.sqrt(800 / 9.81 / fem.kEff);
  const Vteo = Math.hypot(Pi, Pc);
  const MteoBrazo = Math.hypot(Pi * hI, Pc * hC);
  add({
    motor: "femFuste",
    sev: rel(fem.T, Tteo) < 0.02 ? "ok" : "fail",
    id: "fus-T-internal",
    title: "Periodo FEM internamente consistente T=2π√(W/gk)",
    detail: "k sale del caso unitario en hi; T debe reconstruirse con esa k.",
    numbers: { T: fem.T, Trecon: Tteo, kEff: fem.kEff, kOffset_teo: kTeo, ratio_k: fem.kEff / kTeo },
  });
  add({
    motor: "femFuste",
    sev: rel(fem.Vbase, Vteo) < 0.08 ? "ok" : "warn",
    id: "fus-eq-V",
    title: "Equilibrio: V_base ≈ √(Pi²+Pc²)",
    detail: "Cortante en el empotramiento del tubo.",
    numbers: { Vbase: fem.Vbase, Vsrss: Vteo, err_pct: rel(fem.Vbase, Vteo) * 100 },
  });
  add({
    motor: "femFuste",
    sev: rel(fem.Mbase, MteoBrazo) < 0.03 ? "ok" : "fail",
    id: "fus-clamp-hI",
    title: "Pi y Pc en el CG de la cuba: M_base ≈ √[(Pi·hi)²+(Pc·hc)²]",
    detail: "Nudos maestros sobre la corona con enlace rígido ×300. El brazo no se recorta a H.",
    numbers: { hI, hC, H, Mbase_FEM: fem.Mbase, M_brazo_real: MteoBrazo, err_pct: rel(fem.Mbase, MteoBrazo) * 100 },
  });
  add({
    motor: "femFuste",
    sev: fem.mPts.length >= 8 && fem.deltaTop > 0 ? "ok" : "fail",
    id: "fus-profiles",
    title: "Perfiles M(z), V(z), N(z) y δ de corona",
    detail: "16 elementos → 17 muestras. δ_top alimenta la deriva E.030.",
    numbers: { nM: fem.mPts.length, nV: fem.vPts.length, nN: fem.nPts.length, deltaTop: fem.deltaTop, Mbase: fem.Mbase },
  });
}

/* ------------------------------------------------------------------ */
/* 4. Motores de memoria (4 pestañas) + paquetes de figura              */
/* ------------------------------------------------------------------ */
function auditEngine(name: string, run: () => ReturnType<typeof reservorioApoyado>, keys: string[], femTitle: RegExp) {
  const r = run();
  const packed = /Pts|nodes3D|elems3D|as[A-Z]|bar|est/;
  const nan = Object.entries(r.dims ?? {}).filter(([k, v]) => {
    if (packed.test(k) || v === undefined || String(v).includes(";") || String(v).includes("Ø") || String(v).includes('"')) return false;
    const n = Number(v);
    return v !== "" && !Number.isNaN(n) && !Number.isFinite(n);
  });
  add({
    motor: name,
    sev: r.steps.some((s) => femTitle.test(s.title)) ? "ok" : "fail",
    id: `${name}-fem-step`,
    title: "Paso de motor FEM presente en la memoria",
    detail: r.steps.filter((s) => /FEM|MITC4|12 GDL|Hermite/.test(s.title)).map((s) => `${s.n} ${s.title}`).join(" · ") || "ninguno",
  });
  for (const k of keys) {
    const p = packOk(r.dims?.[k], 4);
    add({
      motor: name,
      sev: p.n >= 4 && p.finite && p.mono && p.peak > 0 ? "ok" : p.n >= 2 && p.peak === 0 ? "warn" : "fail",
      id: `${name}-pack-${k}`,
      title: `Diagrama empaquetado ${k}`,
      detail: p.finite && p.mono ? `${p.n} puntos, pico ${p.peak.toFixed(3)}` : `puntos=${p.n} finite=${p.finite} mono=${p.mono}`,
      numbers: { n: p.n, peak: p.peak },
    });
  }
  add({
    motor: name,
    sev: nan.length ? "fail" : "ok",
    id: `${name}-dims-finite`,
    title: "dims numéricos finitos",
    detail: nan.length ? nan.map(([k, v]) => `${k}=${v}`).join(", ") : "sin NaN/Inf en dims parseables",
    numbers: { femNodos: Number(r.dims?.femNodos ?? 0), femElem: Number(r.dims?.femElem ?? 0) },
  });
  return r;
}

const ap = auditEngine(
  "circular",
  () => reservorioApoyado({ V: "80", rHD: "0.85", fc: "210", fy: "4200", zona: "3", uso: "A", suelo: "S2" }),
  ["mPtsEnv", "nPtsEnv", "vPtsEnv", "mPtsHs", "nPtsHs"],
  /Motor FEM de la pared/,
);
const rec = auditEngine(
  "rectangular",
  () => reservorioCuadrado({ V: "80", rHB: "0.85", rLB: "1.2", fc: "210", fy: "4200", zona: "3", uso: "A", suelo: "S2" }),
  ["mPtsVert", "vPtsVert", "mPtsHorLy", "vPtsHorLy", "mPtsHorLx", "mPtsTecho"],
  /MITC4/,
);
{
  const mesh = String(rec.dims?.femMesh ?? "");
  const head = mesh.split("|")[0] ?? "";
  const [nx, nz] = head.split("x").map(Number);
  const nCells = Number.isFinite(nx) && Number.isFinite(nz) ? nx * nz : 0;
  const myy = (mesh.split("|")[2] ?? "").split(",").filter(Boolean);
  add({
    motor: "rectangular",
    sev: nCells >= 40 && myy.length === nCells ? "ok" : "fail",
    id: "rect-pack-mesh",
    title: "Malla MITC4 empaquetada para el mapa de esfuerzos",
    detail: mesh ? `${head} · ${myy.length} celdas myy` : "femMesh vacío",
    numbers: { nx: nx || 0, nz: nz || 0, celdas: myy.length },
  });
}
const col = auditEngine(
  "columnas",
  () => tanqueElevadoColumnas({ V: "150", Htorre: "14", fc: "210", fy: "4200", zona: "3", uso: "A", suelo: "S2" }),
  ["mPtsEnv", "nPtsEnv", "vPtsEnv", "mPtsColumna", "vPtsColumna", "mPtsViga"],
  /Motor FEM de la torre/,
);
const fus = auditEngine(
  "fuste",
  () => tanqueElevadoFuste({ V: "600", Htorre: "16", fc: "210", fy: "4200", zona: "3", uso: "A", suelo: "S2" }),
  ["mPtsEnv", "nPtsEnv", "mPtsFuste", "vPtsFuste", "nPtsFuste"],
  /Motor FEM del fuste/,
);

{
  const nodes = (col.dims?.nodes3D ?? "").split(";").filter(Boolean);
  const elems = (col.dims?.elems3D ?? "").split(";").filter(Boolean);
  add({
    motor: "columnas",
    sev: nodes.length >= 10 && elems.length >= 20 ? "ok" : "fail",
    id: "col-pack-3d",
    title: "Isométrica 3D: nudos y elementos empaquetados",
    detail: "TorreMatricial3D parsea nodes3D y elems3D. Sin ellos el croquis 3D queda vacío.",
    numbers: { nudos: nodes.length, elementos: elems.length, femNodos: Number(col.dims?.femNodos ?? 0), femElem: Number(col.dims?.femElem ?? 0) },
  });
}

{
  const Mfem = Number(fus.dims?.Mvolteo ?? 0);
  const Vfem = Number(fus.dims?.Vbasal ?? 0);
  const Pi = Number(fus.dims?.Pi ?? 0);
  const Pc = Number(fus.dims?.Pc ?? 0);
  const hi = Number(fus.dims?.hiIBP ?? 0);
  const hc = Number(fus.dims?.hcIBP ?? 0);
  const Mclosed = Math.hypot(Pi * hi, Pc * hc);
  add({
    motor: "fuste",
    sev: Mfem > 10 && Vfem > 1 && rel(Mfem, Mclosed) < 0.03 ? "ok" : "fail",
    id: "fus-engine-MV",
    title: "Memoria de fuste: M_FEM coincide con el brazo real hi/hc",
    detail: "Pi en el nudo maestro a hi, Pc a hc. Mvolteo alimenta σ=P/A±Mc/I.",
    numbers: { Mvolteo: Mfem, Mclosed, errM_pct: rel(Mfem, Mclosed) * 100, Vbasal: Vfem, kEff: Number(fus.dims?.kEff ?? 0), femNodos: Number(fus.dims?.femNodos ?? 0) },
  });
}

{
  const femOk = rec.dims?.femOk === "1";
  const Mesq = Number(rec.dims?.MhorEsq ?? 0);
  const Mvano = Number(rec.dims?.MhorVano ?? 0);
  add({
    motor: "rectangular",
    sev: femOk ? "ok" : "warn",
    id: "rect-engine-ok",
    title: "Memoria rectangular usó MITC4 (no el fallback de viga)",
    detail: `femOk=${rec.dims?.femOk} · ${rec.dims?.femElem} elem.`,
    numbers: { femOk: femOk ? 1 : 0, MvertMax: Number(rec.dims?.MvertMax ?? 0), MhorEsq: Mesq, MhorVano: Mvano },
  });
  add({
    motor: "rectangular",
    sev: Mesq > Mvano ? "ok" : "fail",
    id: "rect-engine-corner",
    title: "Memoria: M_esquina > M_vano (nudo monolítico)",
    detail: "El acero de esquina debe gobernar sobre el de vano cuando el FEM empotra θz.",
    numbers: { MhorEsq: Mesq, MhorVano: Mvano, ratio: Mesq / Math.max(Mvano, 1e-9) },
  });
}

const counts = { ok: 0, info: 0, warn: 0, fail: 0 };
for (const f of findings) counts[f.sev]++;
console.log(JSON.stringify({ counts, findings, headlines: {
  circular: ap.headline, rectangular: rec.headline, columnas: col.headline, fuste: fus.headline,
} }, null, 2));

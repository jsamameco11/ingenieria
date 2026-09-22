/**
 * Verificación del núcleo FEM de láminas (MITC4 + membrana) contra soluciones
 * teóricas conocidas. Ejecutar con:  npx tsx scripts/check-fem.mts
 */
import {
  prepareModel,
  solve,
  elementDisp,
  NDOF,
  type FemModel,
  type FemShell,
  type FemNode,
} from "../src/lib/fem/solve";
import { shellStressAt } from "../src/lib/fem/shell";
import { woodArmer } from "../src/lib/fem/woodArmer";

let fails = 0;
function assert(cond: boolean, msg: string, extra = "") {
  if (cond) {
    console.log(`  ok   ${msg}${extra ? "  " + extra : ""}`);
  } else {
    fails++;
    console.log(`  FAIL ${msg}${extra ? "  " + extra : ""}`);
  }
}
function near(a: number, b: number, tolRel: number) {
  return Math.abs(a - b) <= tolRel * Math.max(1e-12, Math.abs(b));
}

/** Malla rectangular plana en el plano XY, a nivel z = 0. */
function gridXY(Lx: number, Ly: number, nx: number, ny: number, t: number, E: number, nu: number) {
  const nodes: FemNode[] = [];
  const id = (i: number, j: number) => j * (nx + 1) + i;
  for (let j = 0; j <= ny; j++) {
    for (let i = 0; i <= nx; i++) {
      nodes.push({ x: (Lx * i) / nx, y: (Ly * j) / ny, z: 0 });
    }
  }
  const shells: FemShell[] = [];
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      shells.push({
        nodes: [id(i, j), id(i + 1, j), id(i + 1, j + 1), id(i, j + 1)],
        t,
        E,
        nu,
        zona: "p",
      });
    }
  }
  return { nodes, shells, id };
}

console.log("\n── 1. Voladizo de placa (franja) bajo carga uniforme ──");
{
  // Placa larga en Y, empotrada en x=0, libre en x=L, bordes y con simetría:
  // se comporta como una viga en voladizo de rigidez EI/(1−ν²).
  const L = 4;
  const B = 1;
  const t = 0.3;
  const E = 25e6; // kPa
  const nu = 0.2;
  const q = 20; // kN/m²
  const nx = 16;
  const ny = 2;
  const g = gridXY(L, B, nx, ny, t, E, nu);
  const model: FemModel = { nodes: g.nodes, shells: g.shells, springs: [], supports: [] };

  for (let j = 0; j <= ny; j++) {
    const n = g.id(0, j);
    for (const d of [0, 1, 2, 3, 4, 5]) model.supports.push({ node: n, dof: d });
  }
  // Simetría en los bordes y = 0 y y = B  →  flexión cilíndrica.
  for (let i = 0; i <= nx; i++) {
    for (const j of [0, ny]) {
      const n = g.id(i, j);
      model.supports.push({ node: n, dof: 1 }); // v = 0
      model.supports.push({ node: n, dof: 3 }); // θx = 0
      model.supports.push({ node: n, dof: 5 });
    }
  }

  const loads = new Float64Array(g.nodes.length * NDOF);
  for (const e of g.shells) {
    const p = e.nodes.map((i) => g.nodes[i]);
    const dx = Math.abs(p[1].x - p[0].x);
    const dy = Math.abs(p[3].y - p[0].y);
    const f = (-q * dx * dy) / 4; // hacia −z
    for (const n of e.nodes) loads[n * NDOF + 2] += f;
  }

  const prep = prepareModel(model);
  const r = solve(prep, loads);
  assert(r.ok, "factorización LDL^T correcta");

  const D = (E * t ** 3) / (12 * (1 - nu * nu));
  const wTeor = (q * L ** 4) / (8 * D); // flexión cilíndrica
  const wFem = Math.abs(r.u[g.id(nx, 0) * NDOF + 2]);
  assert(near(wFem, wTeor, 0.03), "flecha en punta", `FEM ${wFem.toExponential(4)} vs teórica ${wTeor.toExponential(4)} m`);

  // MITC4 da curvatura constante en la dirección del tramo: el momento del
  // elemento corresponde a su centro de gravedad.
  const mAt = (ie: number) => {
    const e = g.shells[ie];
    return shellStressAt(
      e.nodes.map((i) => g.nodes[i]),
      { E, nu, t },
      elementDisp(r.u, e.nodes),
      0,
      0,
    );
  };
  const dxe = L / nx;
  const st = mAt(0);
  const mCg = (q * (L - dxe / 2) ** 2) / 2;
  assert(near(Math.abs(st.mxx), mCg, 0.01), "momento en el primer elemento (su cdg)", `FEM ${Math.abs(st.mxx).toFixed(2)} vs ${mCg.toFixed(2)} kN·m/m`);

  // Extrapolación lineal de los dos primeros elementos a la cara del apoyo.
  const m0 = Math.abs(mAt(0).mxx);
  const m1 = Math.abs(mAt(1).mxx);
  const mExtrap = m0 + (m0 - m1) * 0.5;
  const mTeor = (q * L * L) / 2;
  assert(near(mExtrap, mTeor, 0.02), "momento extrapolado al empotramiento", `FEM ${mExtrap.toFixed(2)} vs ${mTeor.toFixed(2)} kN·m/m`);
  assert(near(Math.abs(st.qx), q * (L - dxe / 2), 0.03), "cortante en el primer elemento", `FEM ${Math.abs(st.qx).toFixed(2)} vs ${(q * (L - dxe / 2)).toFixed(2)} kN/m`);
  assert(near(st.myy, nu * st.mxx, 0.02), "momento transversal = ν·Mxx (deformación plana)", `${st.myy.toFixed(2)} vs ${(nu * st.mxx).toFixed(2)}`);
}

console.log("\n── 2. Placa cuadrada simplemente apoyada, carga uniforme ──");
{
  // Timoshenko: w_c = 0.00406 q a⁴ / D ; M_max = 0.0479 q a²  (ν = 0.3)
  const a = 5;
  const t = 0.2;
  const E = 25e6;
  const nu = 0.3;
  const q = 10;
  const n = 12;
  const g = gridXY(a, a, n, n, t, E, nu);
  const model: FemModel = { nodes: g.nodes, shells: g.shells, springs: [], supports: [] };
  for (let i = 0; i <= n; i++) {
    for (let j = 0; j <= n; j++) {
      const borde = i === 0 || j === 0 || i === n || j === n;
      const nd = g.id(i, j);
      if (borde) model.supports.push({ node: nd, dof: 2 });
      // La membrana no interviene: se restringen u, v y θz.
      model.supports.push({ node: nd, dof: 0 });
      model.supports.push({ node: nd, dof: 1 });
      model.supports.push({ node: nd, dof: 5 });
    }
  }
  const loads = new Float64Array(g.nodes.length * NDOF);
  for (const e of g.shells) {
    const p = e.nodes.map((i) => g.nodes[i]);
    const dx = Math.abs(p[1].x - p[0].x);
    const dy = Math.abs(p[3].y - p[0].y);
    const f = (-q * dx * dy) / 4;
    for (const nd of e.nodes) loads[nd * NDOF + 2] += f;
  }
  const r = solve(prepareModel(model), loads);
  const D = (E * t ** 3) / (12 * (1 - nu * nu));
  const wTeor = (0.00406 * q * a ** 4) / D;
  const wFem = Math.abs(r.u[g.id(n / 2, n / 2) * NDOF + 2]);
  assert(near(wFem, wTeor, 0.03), "flecha central", `FEM ${wFem.toExponential(4)} vs Timoshenko ${wTeor.toExponential(4)} m`);

  const ec = g.shells[(n / 2) * n + n / 2];
  const st = shellStressAt(
    ec.nodes.map((i) => g.nodes[i]),
    { E, nu, t },
    elementDisp(r.u, ec.nodes),
    -1,
    -1,
  );
  const mTeor = 0.0479 * q * a * a;
  assert(near(Math.abs(st.mxx), mTeor, 0.05), "momento central Mxx", `FEM ${Math.abs(st.mxx).toFixed(2)} vs ${mTeor.toFixed(2)} kN·m/m`);
}

console.log("\n── 3. Acción de membrana: tracción pura en el plano ──");
{
  const L = 4;
  const B = 2;
  const t = 0.25;
  const E = 25e6;
  const nu = 0.2;
  const n = 4;
  const g = gridXY(L, B, n, n, t, E, nu);
  const model: FemModel = { nodes: g.nodes, shells: g.shells, springs: [], supports: [] };
  const N = 500; // kN total
  for (let j = 0; j <= n; j++) {
    const nd = g.id(0, j);
    model.supports.push({ node: nd, dof: 0 });
  }
  for (let i = 0; i <= n; i++) for (let j = 0; j <= n; j++) {
    const nd = g.id(i, j);
    model.supports.push({ node: nd, dof: 2 });
    model.supports.push({ node: nd, dof: 3 });
    model.supports.push({ node: nd, dof: 4 });
    model.supports.push({ node: nd, dof: 5 });
  }
  model.supports.push({ node: g.id(0, 0), dof: 1 });
  const loads = new Float64Array(g.nodes.length * NDOF);
  for (let j = 0; j <= n; j++) {
    const w = j === 0 || j === n ? 0.5 : 1;
    loads[g.id(n, j) * NDOF + 0] = (N / n) * w;
  }
  const r = solve(prepareModel(model), loads);
  const dTeor = (N * L) / (E * t * B);
  const dFem = r.u[g.id(n, Math.floor(n / 2)) * NDOF + 0];
  assert(near(dFem, dTeor, 0.01), "alargamiento axial", `FEM ${dFem.toExponential(4)} vs ${dTeor.toExponential(4)} m`);
}

console.log("\n── 4. Viga sobre fundación elástica (resortes Winkler) ──");
{
  // Franja de 1 m sobre lecho ks con carga puntual central: solución de Hetényi
  // w(0) = P·λ / (2·k)  con λ = (k/(4EI))^{1/4}
  const L = 24; // λ·L ≈ 10 → cada mitad supera π y la solución infinita aplica
  const B = 1;
  const t = 0.4;
  const E = 25e6;
  const nu = 0;
  const ks = 30000; // kN/m³
  const nx = 120;
  const ny = 1;
  const g = gridXY(L, B, nx, ny, t, E, nu);
  const model: FemModel = { nodes: g.nodes, shells: g.shells, springs: [], supports: [] };
  const areaTrib = new Float64Array(g.nodes.length);
  for (const e of g.shells) {
    const p = e.nodes.map((i) => g.nodes[i]);
    const A = Math.abs(p[1].x - p[0].x) * Math.abs(p[3].y - p[0].y);
    for (const nd of e.nodes) areaTrib[nd] += A / 4;
  }
  for (let i = 0; i < g.nodes.length; i++) {
    model.springs.push({ node: i, dof: 2, k: ks * areaTrib[i] });
    model.supports.push({ node: i, dof: 0 });
    model.supports.push({ node: i, dof: 1 });
    model.supports.push({ node: i, dof: 5 });
  }
  for (let i = 0; i <= nx; i++) for (const j of [0, ny]) model.supports.push({ node: g.id(i, j), dof: 3 });

  const P = 100;
  const loads = new Float64Array(g.nodes.length * NDOF);
  for (let j = 0; j <= ny; j++) loads[g.id(nx / 2, j) * NDOF + 2] = -P / (ny + 1);

  const r = solve(prepareModel(model), loads);
  const I = (B * t ** 3) / 12;
  const k = ks * B;
  const lam = Math.pow(k / (4 * E * I), 0.25);
  const wTeor = (P * lam) / (2 * k);
  const wFem = Math.abs(r.u[g.id(nx / 2, 0) * NDOF + 2]);
  assert(near(wFem, wTeor, 0.05), "asentamiento bajo la carga (Hetényi)", `FEM ${wFem.toExponential(4)} vs ${wTeor.toExponential(4)} m`);

  const sumK = r.springForce.reduce((a, b) => a + b, 0);
  assert(near(sumK, P, 0.01), "equilibrio vertical de los resortes", `Σ ${sumK.toFixed(2)} vs P ${P.toFixed(2)} kN`);
}

console.log("\n── 5. Resortes sin tracción (despegue) ──");
{
  const L = 6;
  const t = 0.4;
  const E = 25e6;
  const nu = 0;
  const ks = 20000;
  const nx = 30;
  const g = gridXY(L, 1, nx, 1, t, E, nu);
  const model: FemModel = { nodes: g.nodes, shells: g.shells, springs: [], supports: [] };
  const areaTrib = new Float64Array(g.nodes.length);
  for (const e of g.shells) {
    const p = e.nodes.map((i) => g.nodes[i]);
    const A = Math.abs(p[1].x - p[0].x) * Math.abs(p[3].y - p[0].y);
    for (const nd of e.nodes) areaTrib[nd] += A / 4;
  }
  for (let i = 0; i < g.nodes.length; i++) {
    model.springs.push({ node: i, dof: 2, k: ks * areaTrib[i], noTension: true });
    model.supports.push({ node: i, dof: 0 });
    model.supports.push({ node: i, dof: 1 });
    model.supports.push({ node: i, dof: 5 });
  }
  for (let i = 0; i <= nx; i++) for (const j of [0, 1]) model.supports.push({ node: g.id(i, j), dof: 3 });

  // Carga vertical muy excéntrica: el extremo opuesto debe despegar.
  const loads = new Float64Array(g.nodes.length * NDOF);
  const P = 400;
  for (const j of [0, 1]) loads[g.id(2, j) * NDOF + 2] = -P / 2;
  const r = solve(prepareModel(model), loads);
  const inactivos = r.springActive.filter((a) => !a).length;
  assert(r.ok, "convergencia del lazo de contacto", `${r.iteraciones} iteraciones`);
  assert(inactivos > 0, "hay resortes desactivados por tracción", `${inactivos} de ${r.springActive.length}`);
  const traccion = r.springForce.some((f) => f < -1e-6);
  assert(!traccion, "ningún resorte queda traccionado");
  const sumK = r.springForce.reduce((a, b) => a + b, 0);
  assert(near(sumK, P, 0.01), "equilibrio vertical con despegue", `Σ ${sumK.toFixed(2)} vs ${P.toFixed(2)} kN`);
}

console.log("\n── 6. Wood & Armer ──");
{
  const a = woodArmer({ mxx: 100, myy: 40, mxy: 30 });
  assert(near(a.supX, 130, 1e-9) && near(a.supY, 70, 1e-9), "caso general cara +z", `${a.supX} / ${a.supY}`);
  assert(a.infX === 0 && a.infY === 0, "sin armadura opuesta cuando ambos son positivos");

  const b = woodArmer({ mxx: -60, myy: 60, mxy: 40 });
  assert(b.supX === 0, "corrección cuando Mx+|Mxy| < 0");
  assert(near(b.supY, 60 + 1600 / 60, 1e-9), "reparto del torsor a la otra dirección", `${b.supY}`);

  const c = woodArmer({ mxx: -80, myy: -50, mxy: 20 });
  assert(near(c.infX, 100, 1e-9) && near(c.infY, 70, 1e-9), "caso general cara −z", `${c.infX} / ${c.infY}`);

  const d = woodArmer({ mxx: 0, myy: 0, mxy: 50 });
  assert(near(d.supX, 50, 1e-9) && near(d.infX, 50, 1e-9), "torsión pura arma ambas caras");
}

console.log(fails === 0 ? "\n✔ FEM: todas las verificaciones pasan\n" : `\n✖ ${fails} verificaciones fallidas\n`);
process.exit(fails === 0 ? 0 : 1);

/**
 * Verificación del modelo FEM del muro de sostenimiento:
 * equilibrio global de cada combinación y contraste con el voladizo analítico.
 * Ejecutar con:  npx tsx scripts/check-muro-fem.mts
 */
import { NDOF } from "../src/lib/fem/solve";
import {
  COMBINACIONES,
  construirCargas,
  construirMalla,
  resolverMuroFem,
  serieFuste,
  serieZapata,
  valorEn,
  type FemOpciones,
  type MuroGeom,
} from "../src/lib/engines/muro/fem";
import {
  calcularSismo,
  construirPerfil,
  kaRankine,
  presionEstatica,
  type PerfilInput,
} from "../src/lib/engines/muro/perfil";

let fails = 0;
function assert(cond: boolean, msg: string, extra = "") {
  if (cond) console.log(`  ok   ${msg}${extra ? "  " + extra : ""}`);
  else {
    fails++;
    console.log(`  FAIL ${msg}${extra ? "  " + extra : ""}`);
  }
}
const near = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol * Math.max(1e-9, Math.abs(b));

const geom: MuroGeom = { hp: 5, hf: 0.5, ttop: 0.3, tbase: 0.45, Ltoe: 1.0, Lheel: 3.5, Df: 1.0 };
const H = geom.hp + geom.hf;
const gammaC = 23.5;

const perfilInput: PerfilInput = {
  estratos: [{ nombre: "Relleno granular", espesor: 6, gamma: 18.6, gammaSat: 20, phi: 32, c: 0 }],
  H,
  nf: 99,
  gammaW: 9.81,
  q: 10,
  condicion: "activo",
  i: 0,
  delta: 0,
  metodoK: "rankine",
};
const perfil = construirPerfil(perfilInput);
const Ka = kaRankine(32, 0);
const sismo = calcularSismo({
  metodo: "simplificado",
  kh: 0.18,
  kv: 0,
  gammaEq: 18.6,
  H,
  phiEq: 32,
  delta: 0,
  i: 0,
  Ea: perfil.E,
  Ka,
});

console.log("\n── Perfil y empujes ──");
{
  // Empuje de Rankine con sobrecarga: Ka·q·H + ½·Ka·γ·H²
  const teor = Ka * perfilInput.q * H + 0.5 * Ka * 18.6 * H * H;
  assert(near(perfil.E, teor, 0.005), "empuje estático total", `${perfil.E.toFixed(2)} vs ${teor.toFixed(2)} kN/m`);
  const pBase = Ka * (perfilInput.q + 18.6 * H);
  assert(near(perfil.pMax, pBase, 0.005), "presión en el fondo", `${perfil.pMax.toFixed(2)} vs ${pBase.toFixed(2)} kPa`);
  const dTeor = 0.375 * 0.18 * 18.6 * H * H;
  assert(near(sismo.dPae, dTeor, 1e-9), "ΔPae simplificado E.050", `${sismo.dPae.toFixed(2)} kN/m`);
  assert(near(sismo.y, 0.6 * H, 1e-9), "punto de aplicación a 0.6H", `${sismo.y.toFixed(2)} m`);
  const resTrap = ((sismo.pTop + sismo.pBot) / 2) * H;
  assert(near(resTrap, sismo.dPae, 1e-6), "el trapecio equivalente integra ΔPae", `${resTrap.toFixed(2)}`);
  const yTrap = (H * (2 * sismo.pTop + sismo.pBot)) / (3 * (sismo.pTop + sismo.pBot));
  assert(near(yTrap, 0.6 * H, 1e-6), "y el trapecio tiene su resultante en 0.6H", `${yTrap.toFixed(3)} m`);
}

const opciones: FemOpciones = {
  Lpanel: 2,
  nz: 20,
  nToe: 6,
  nHeel: 16,
  nx: 4,
  bordeX: "simetria",
  ks: 30000,
  ksh: 15000,
  Ec: 21538000, // kPa, f'c = 21 MPa
  nu: 0.2,
  sinTraccion: true,
};

console.log("\n── Malla ──");
const mesh = construirMalla(geom, opciones);
{
  assert(mesh.yGrid.some((y) => Math.abs(y - geom.Ltoe) < 1e-9), "la cara de la puntera es línea de nodos");
  assert(mesh.yGrid.some((y) => Math.abs(y - (geom.Ltoe + geom.tbase)) < 1e-9), "la cara del talón es línea de nodos");
  assert(mesh.yGrid.some((y) => Math.abs(y - mesh.yStemBase) < 1e-9), "el eje del fuste es línea de nodos");
  const compartidos = mesh.fusteId.every((col, ix) => col[0] === mesh.zapId[ix][mesh.yGrid.indexOf(mesh.yStemBase)]);
  assert(compartidos, "el arranque del fuste comparte nodos con la zapata");
  console.log(`       ${mesh.model.nodes.length} nodos · ${mesh.model.shells.length} elementos`);
}

const entradaCargas = {
  geom,
  perfilInput,
  perfil,
  sismo,
  gammaC,
  gammaFront: 18,
  kh: 0.18,
  kv: 0,
  inerciaRelleno: false,
  inerciaSobrecarga: true,
};
const cargas = construirCargas(mesh, entradaCargas);

console.log("\n── Cargas por caso (por metro de muro) ──");
{
  const Lp = opciones.Lpanel;
  const sumar = (v: Float64Array, d: number) => {
    let s = 0;
    for (let i = 0; i < mesh.model.nodes.length; i++) s += v[i * NDOF + d];
    return s / Lp;
  };
  const volConcreto =
    geom.hf * (geom.Ltoe + geom.tbase + geom.Lheel) + ((geom.ttop + geom.tbase) / 2) * geom.hp;
  const Wc = volConcreto * gammaC;
  const Wrelleno = 18.6 * geom.hp * geom.Lheel;
  const Wfrontal = 18 * (geom.Df - geom.hf) * geom.Ltoe;
  const cmZ = -sumar(cargas.CM, 2);
  assert(near(cmZ, Wc + Wrelleno + Wfrontal, 0.005), "CM vertical = concreto + relleno + suelo frontal", `${cmZ.toFixed(2)} vs ${(Wc + Wrelleno + Wfrontal).toFixed(2)} kN/m`);

  const cvZ = -sumar(cargas.CV, 2);
  assert(near(cvZ, perfilInput.q * geom.Lheel, 0.005), "CV vertical = q·L_talón", `${cvZ.toFixed(2)} vs ${(perfilInput.q * geom.Lheel).toFixed(2)} kN/m`);

  const ceY = -sumar(cargas.CE, 1);
  assert(near(ceY, perfil.Eh, 0.01), "CE horizontal = empuje total del perfil", `${ceY.toFixed(2)} vs ${perfil.Eh.toFixed(2)} kN/m`);

  // Por defecto la inercia kh·W solo moviliza el concreto: la de la cuña de
  // relleno ya viene dentro de ΔPae y sumarla otra vez la contaría dos veces.
  const csY = -sumar(cargas.CS, 1);
  const inerciaC = 0.18 * Wc;
  assert(near(csY, sismo.dPae + inerciaC, 0.02), "CS horizontal = ΔPae + inercia del concreto", `${csY.toFixed(2)} vs ${(sismo.dPae + inerciaC).toFixed(2)} kN/m`);

  const conRelleno = construirCargas(mesh, { ...entradaCargas, inerciaRelleno: true });
  const csY2 = -sumar(conRelleno.CS, 1);
  const inerciaR = 0.18 * (Wc + Wrelleno + 0.25 * perfilInput.q * geom.Lheel);
  assert(near(csY2, sismo.dPae + inerciaR, 0.02), "con inerciaRelleno se suma la masa del relleno", `${csY2.toFixed(2)} vs ${(sismo.dPae + inerciaR).toFixed(2)} kN/m`);
}

console.log("\n── Resolución y equilibrio ──");
const res = resolverMuroFem(mesh, cargas, opciones);
assert(res.ok, "todas las combinaciones resueltas", `${res.nEcuaciones} ecuaciones`);
{
  for (const c of res.combos) {
    const f = new Float64Array(mesh.model.nodes.length * NDOF);
    for (const [caso, k] of Object.entries(c.combo.factores)) {
      const src = cargas[caso as keyof typeof cargas];
      for (let i = 0; i < f.length; i++) f[i] += (k as number) * src[i];
    }
    let fz = 0;
    for (let i = 0; i < mesh.model.nodes.length; i++) fz += f[i * NDOF + 2];
    let rz = 0;
    for (const n of mesh.nodosBase) {
      const idx = mesh.resorteVert.get(n)!;
      const area = mesh.model.springs[idx].k / opciones.ks;
      rz += (c.presion.get(n) ?? 0) * area;
    }
    assert(near(rz, -fz, 0.01), `equilibrio vertical · ${c.combo.nombre}`, `R ${rz.toFixed(1)} vs P ${(-fz).toFixed(1)} kN`);
  }
}

console.log("\n── Contraste con el voladizo analítico ──");
{
  const cULS = res.combos.find((c) => c.combo.nombre === "0.9CM + 1.7CE")!;
  const serie = serieFuste(mesh, cULS.esfuerzos);

  // Momento analítico en el arranque del fuste (cara superior de la zapata),
  // integrando la presión sobre la altura libre.
  let M = 0;
  let V = 0;
  const n = 400;
  for (let i = 0; i < n; i++) {
    const y0 = (geom.hp * i) / n;
    const y1 = (geom.hp * (i + 1)) / n;
    const ym = (y0 + y1) / 2; // altura sobre el arranque
    const p = presionEstatica(perfil, geom.hp - ym);
    const dF = p * (y1 - y0);
    V += dF;
    M += dF * ym;
  }
  const Mu = 1.7 * M;
  const Vu = 1.7 * V;
  const mFem = Math.abs(valorEn(serie, mesh.caraFuste, "myy"));
  const vFem = Math.abs(valorEn(serie, mesh.caraFuste, "qy"));
  console.log(`       analítico Mu = ${Mu.toFixed(1)} kN·m/m · Vu = ${Vu.toFixed(1)} kN/m`);
  console.log(`       FEM       Mu = ${mFem.toFixed(1)} kN·m/m · Vu = ${vFem.toFixed(1)} kN/m`);
  assert(near(mFem, Mu, 0.02), "momento en el arranque del fuste dentro del 2 %");
  assert(near(vFem, Vu, 0.02), "cortante en el arranque del fuste dentro del 2 %");

  const sz = serieZapata(mesh, cULS.esfuerzos);
  const mTalon = valorEn(sz, mesh.caraTalon, "myy");
  const mPuntera = valorEn(sz, mesh.caraPuntera, "myy");
  console.log(`       FEM talón   Myy = ${mTalon.toFixed(1)} kN·m/m (+ = tracción arriba)`);
  console.log(`       FEM puntera Myy = ${mPuntera.toFixed(1)} kN·m/m`);
  assert(mTalon > 0, "el talón tracciona la cara superior");
  assert(mPuntera < 0, "la puntera tracciona la cara inferior");
}

console.log("\n── Presiones de contacto y despegue ──");
{
  const serv = res.combos.find((c) => c.combo.tipo === "SLS")!;
  console.log(`       servicio: q_max = ${serv.presionMax.toFixed(1)} kPa · ${serv.despegue} nodos despegados · ${serv.iteraciones} iteraciones`);
  assert(serv.presionMax > 0, "hay presión de contacto en servicio");
  const sismico = res.combos.find((c) => c.combo.nombre.includes("CS"))!;
  assert(sismico.presionMax >= serv.presionMax, "el sismo aumenta la presión de punta", `${sismico.presionMax.toFixed(1)} vs ${serv.presionMax.toFixed(1)} kPa`);
}

console.log("\n── Envolvente ──");
{
  const env = res.envolvente;
  const maxSup = Math.max(...env.supY);
  const maxInf = Math.max(...env.infY);
  assert(maxSup > 0 && maxInf > 0, "la envolvente arma ambas caras", `sup ${maxSup.toFixed(1)} · inf ${maxInf.toFixed(1)} kN·m/m`);
  assert(env.q.every((v) => v >= 0), "cortantes de envolvente no negativos");
  assert(COMBINACIONES.filter((c) => c.tipo === "ULS").length === 5, "5 combinaciones de rotura");
}

console.log(fails === 0 ? "\n✔ Muro FEM: todas las verificaciones pasan\n" : `\n✖ ${fails} verificaciones fallidas\n`);
process.exit(fails === 0 ? 0 : 1);

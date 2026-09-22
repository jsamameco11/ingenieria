/**
 * Verificación del sistema de unidades del muro.
 *
 * Comprueba los factores contra equivalencias exactas y, sobre todo, que el
 * expediente completo dé el mismo muro en los tres sistemas: si cambiar de
 * unidades cambiara un acero o un factor de seguridad, sería un error de
 * conversión disfrazado de resultado.
 */

import { MODULES } from "../src/lib/catalog";
import { ENGINES } from "../src/lib/engines/index";
import { convertirCampo, crearUnidades, MAGNITUD_CAMPO, SISTEMAS, type Sistema } from "../src/lib/engines/muro/unidades";

let fallos = 0;
function assert(cond: boolean, msg: string, extra = "") {
  if (cond) console.log(`  ok   ${msg}${extra ? `  ${extra}` : ""}`);
  else {
    fallos++;
    console.log(`  FALLA ${msg}${extra ? `  ${extra}` : ""}`);
  }
}
const cerca = (a: number, b: number, tol = 1e-4) => Math.abs(a - b) <= Math.abs(b) * tol + 1e-12;

console.log("── Factores de conversión ──");
{
  const t = crearUnidades("tnf");
  const k = crearUnidades("kn");
  const i = crearUnidades("imperial");

  // Equivalencias exactas de referencia (NIST SP 811).
  assert(cerca(t.F(9.80665), 1), "1 Tnf/m = 9.80665 kN/m", t.F(9.80665).toFixed(6));
  assert(cerca(t.P(9.80665), 1), "1 Tnf/m² = 9.80665 kPa");
  assert(cerca(t.M(9.80665), 1), "1 Tnf·m/m = 9.80665 kN·m/m");
  assert(cerca(t.Fc(20.594), 210, 1e-3), "210 kg/cm² = 20.594 MPa", t.Fc(20.594).toFixed(1));
  assert(cerca(t.iFc(210), 20.594, 1e-3), "entrada 210 kg/cm² → MPa");

  assert(cerca(k.F(103.3), 103.3), "kN es la identidad");
  assert(cerca(k.Fc(21), 21), "MPa es la identidad");

  assert(cerca(i.L(1), 3.2808399), "1 m = 3.2808399 pie", i.L(1).toFixed(6));
  assert(cerca(i.Lc(0.05), 1.9685), "0.05 m = 1.9685 pulg", i.Lc(0.05).toFixed(4));
  assert(cerca(i.F(14.5939), 1, 1e-3), "1 kip/pie = 14.5939 kN/m", i.F(14.5939).toFixed(6));
  assert(cerca(i.P(47.880259), 1), "1 ksf = 47.880259 kPa");
  assert(cerca(i.M(4.4482216), 1), "1 kip·pie/pie = 4.4482216 kN·m/m");
  assert(cerca(i.W(0.15708746), 1), "1 pcf = 0.15708746 kN/m³");
  assert(cerca(i.Fc(6.89475729), 1000), "1000 psi = 6.89475729 MPa");
  assert(cerca(i.As(1), 0.04724409), "1 cm²/m = 0.04724409 pulg²/pie", i.As(1).toFixed(8));
  assert(cerca(i.iL(3.2808399), 1), "entrada en pie → m");
}

console.log("\n── Conversión de los datos al cambiar de sistema ──");
{
  assert(cerca(convertirCampo("gam1", 1.9, "tnf", "kn"), 18.6, 3e-3), "γ 1.90 Tnf/m³ → 18.6 kN/m³", String(convertirCampo("gam1", 1.9, "tnf", "kn")));
  assert(cerca(convertirCampo("hp", 5, "tnf", "imperial"), 16.4, 2e-3), "h_p 5.00 m → 16.4 pie", String(convertirCampo("hp", 5, "tnf", "imperial")));
  assert(cerca(convertirCampo("fc", 210, "tnf", "imperial"), 2990, 5e-3), "f'c 210 kg/cm² → 2990 psi", String(convertirCampo("fc", 210, "tnf", "imperial")));
  assert(convertirCampo("talud", 12, "tnf", "imperial") === 12, "un ángulo no se convierte");
  assert(convertirCampo("nz", 20, "tnf", "imperial") === 20, "un número de divisiones no se convierte");
  // Ida y vuelta: con tres cifras significativas el dato tiene que volver a su sitio.
  for (const key of ["hp", "tbase", "gam1", "q", "qadm", "ks", "fc", "recFuste"]) {
    const v0 = Number({ hp: 5, tbase: 0.45, gam1: 1.9, q: 1, qadm: 25, ks: 3000, fc: 210, recFuste: 0.05 }[key]);
    const ida = convertirCampo(key, v0, "tnf", "imperial");
    const vuelta = convertirCampo(key, ida, "imperial", "tnf");
    assert(cerca(vuelta, v0, 5e-3), `ida y vuelta de ${key}`, `${v0} → ${ida} → ${vuelta}`);
  }
}

console.log("\n── El muro es el mismo en los tres sistemas ──");
{
  const mod = MODULES.find((m) => m.slug === "muro-sostenimiento");
  if (!mod) throw new Error("falta el módulo en el catálogo");
  const engine = ENGINES[mod.engine];

  const base: Record<string, string> = {};
  for (const f of mod.fields) base[f.key] = String(mod.defaults[f.key] ?? "");

  const corridas = SISTEMAS.map(({ value }) => {
    const v: Record<string, string> = { ...base, unidades: value };
    if (value !== "tnf") {
      for (const key of Object.keys(MAGNITUD_CAMPO)) {
        if (base[key] === undefined || base[key] === "") continue;
        const n = Number(base[key]);
        if (!Number.isFinite(n)) continue;
        v[key] = String(convertirCampo(key, n, "tnf", value as Sistema));
      }
    }
    return { sis: value, r: engine(v) };
  });

  const ref = corridas[0];
  for (const { sis, r } of corridas.slice(1)) {
    assert(r.checks.length === ref.r.checks.length, `${sis}: mismo número de verificaciones`);
    const distintas = r.checks.filter((c, i) => c.ok !== ref.r.checks[i].ok).map((c) => c.label);
    assert(distintas.length === 0, `${sis}: mismas verificaciones cumplen`, distintas.join(", "));
    assert(r.steps.length === ref.r.steps.length, `${sis}: mismo número de pasos`);

    /*
     * El acero es el resultado que le importa al usuario. Los diámetros tienen
     * que ser los mismos; la separación puede diferir en unidades inglesas
     * porque allí la lista constructiva está en pulgadas (4" = 10.16 cm), pero
     * el área provista no puede alejarse.
     */
    const acero = (o: typeof r) => JSON.parse(o.dims?.muroAcero ?? "{}");
    const a1 = acero(r);
    const a0 = acero(ref.r);
    const diam = (a: Record<string, { bar?: string }>) => [a.fuste?.bar, a.puntera?.bar, a.talon?.bar].join(" · ");
    assert(diam(a1) === diam(a0), `${sis}: mismos diámetros que en Tnf`, diam(a1));
    // El salto entre dos separaciones consecutivas de la lista constructiva es
    // del orden del 10 %, y siempre hacia el lado seguro (más acero).
    for (const z of ["fuste", "puntera", "talon"] as const) {
      assert(a1[z].As >= a0[z].As * 0.97, `${sis}: el ${z} no queda con menos acero`, `${a1[z].As.toFixed(2)} vs ${a0[z].As.toFixed(2)}`);
      assert(cerca(a1[z].As, a0[z].As, 0.12), `${sis}: As provisto del ${z} a menos del 12 %`, `${a1[z].As.toFixed(2)} vs ${a0[z].As.toFixed(2)}`);
    }

    // Y el modelo FEM, que se arma siempre en SI: la malla tiene que ser idéntica
    // y las presiones coincidir salvo el redondeo de los datos convertidos.
    const fem = (o: typeof r) => JSON.parse(o.dims?.muroFem ?? "{}");
    const f1 = fem(r);
    const f0 = fem(ref.r);
    assert(f1.nNodos === f0.nNodos && f1.nElem === f0.nElem, `${sis}: misma malla`, `${f1.nNodos}/${f1.nElem}`);
    assert(cerca(f1.B, f0.B, 2e-3), `${sis}: mismo ancho de zapata`, `${f1.B} vs ${f0.B}`);
    assert(cerca(f1.servicio.qMax, f0.servicio.qMax, 0.01), `${sis}: misma presión de servicio`, `${f1.servicio.qMax} vs ${f0.servicio.qMax}`);
  }

  // Y los rótulos tienen que cambiar, si no el selector no serviría de nada.
  const enc = corridas.map((c) => c.r.headline);
  assert(enc[0].includes("Tnf"), "en Tnf el encabezado habla en Tnf", enc[0].slice(0, 70));
  assert(enc[1].includes("kN"), "en SI el encabezado habla en kN", enc[1].slice(0, 70));
  assert(enc[2].includes("kip"), "en imperial el encabezado habla en kip", enc[2].slice(0, 70));
}

console.log(fallos === 0 ? "\n✔ Unidades: todas las verificaciones pasan\n" : `\n✘ ${fallos} fallo(s)\n`);
process.exit(fallos === 0 ? 0 : 1);

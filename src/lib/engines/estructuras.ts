import {
  type CalcCheck,
  type CalcOutput,
  type Engine,
  barByName,
  beta1,
  fmt,
  num,
  pickBars,
  proponerAceroColumna,
  round5,
  roundUp,
  spacingFor,
  str,
  BARS,
} from "../types";
import { ACABADOS, USO_VIVIENDA, USOS_E020, pesoLosa, usoE020 } from "../e020";
import {
  analyzeContinuous,
  encodeBeam,
  parseLuces,
  planDespiece,
} from "../beam2d";
import {
  asFromSteel,
  barDb,
  colproById,
  encodeDemands,
  encodePts,
  fmtPtsTable,
  insidePM,
  nBarsSteel,
  sectionAs,
  steelParts,
  whitneyFromBars,
  whitneyPM,
} from "../colpro";
import { resolveSection, tipoById } from "../columnaTipos";
import { generateColumnPM } from "../pmMotor";
import { platea, zapataCombinada, zapataCorrida } from "./cimentaciones";
import { e030C as e030CTabla } from "../e030/tablas";
import { resolveE030 } from "../e030/resolve";
import { calcularEscalera, type EscaleraTramo } from "../escaleraCalc";
import { designBeamStirrups, designColumnStirrups } from "../estribos";
import { diagramaInteraccion } from "./interaccion";

function out(
  headline: string,
  adoption: string,
  steps: CalcOutput["steps"],
  checks: CalcCheck[],
  extras?: CalcOutput["extras"],
  dims?: Record<string, string>
): CalcOutput {
  return { headline, adoption, steps, checks, extras, dims };
}

function ok(label: string, value: string, limit: string, pass: boolean): CalcCheck {
  return { label, value, limit, ok: pass };
}

function nearestBar(db: number) {
  return BARS.reduce((best, bar) => (Math.abs(bar.db - db) < Math.abs(best.db - db) ? bar : best), BARS[0]);
}

function pesoParte(peso: number, n: number, nTot: number) {
  return nTot > 0 ? (peso * n) / nTot : 0;
}


/* ───────── Predimensionamiento de columnas (Morales / PRED COL VIG) ───────── */
export const predColumnas: Engine = (raw) => {
  const nPisos = num(raw, "nPisos", 5);
  const area = num(raw, "area", 20);
  const wdPiso = num(raw, "wd", 1000);
  const fc = num(raw, "fc", 210);
  const bMin = num(raw, "bMin", 25);
  const tipo = str(raw, "tipo", "interior");
  const zona = str(raw, "zona", "primeros");
  const azotea = str(raw, "azotea", "si") === "si";
  const wAz = num(raw, "wAz", 800);
  const k = tipo === "esquina" ? 1.5 : tipo === "extrema" ? 1.25 : 1.1;
  const n = zona === "ultimos" ? (tipo === "interior" ? 0.25 : 0.2) : tipo === "esquina" ? 0.2 : 0.3;
  const Ppisos = area * wdPiso * nPisos;
  const Paz = azotea ? area * wAz : 0;
  const P = Ppisos + Paz;
  const Ag = (k * P) / (n * fc);
  const ladoSq = Math.sqrt(Ag);
  const b = Math.max(bMin, round5(bMin));
  const Dcalc = Ag / b;
  const D = round5(Math.max(bMin, Dcalc));
  const AgAdopt = b * D;
  const cumple = AgAdopt >= Ag - 1;
  const acero = proponerAceroColumna(AgAdopt, D / b);
  const okRho = acero.rho + 1e-9 >= 0.01 && acero.rho <= 0.04 + 1e-9;
  const destName = str(raw, "dest", '3/8"');
  const destBar = barByName(destName);
  const Lu = num(raw, "Lu", 300);
  const sismico = str(raw, "sismico", "si") !== "no";
  const rec = num(raw, "rec", 4);
  const longBar = barByName(acero.name);
  const st = designColumnStirrups({
    b,
    h: D,
    rec,
    Lu,
    fc,
    fy: 4200,
    destName,
    destDb: destBar.db,
    destAs: destBar.as,
    dbLong: longBar.db,
    nBar: acero.n,
    nRamas: 0,
    sismico,
  });
  return out(
    `Columna ${tipo}: ${b.toFixed(0)} × ${D.toFixed(0)} cm · ${acero.text} · ${st.destLabel} @ ${st.sConf}/${st.sRest} cm`,
    `${b.toFixed(0)}×${D.toFixed(0)} cm  ·  ${acero.text}  ·  estribos ${st.arregloPlano}  ·  ρg = ${fmt(acero.rho * 100, 2)} % ≥ 1 %`,
    [
      {
        n: "01",
        title: "Peso axial de gravedad sobre la columna",
        formula: azotea
          ? "P = A_trib × (w_piso × N_pisos + w_azotea)"
          : "P = A_trib × w_piso × N_pisos",
        substitution: azotea
          ? `P = ${fmt(area, 2)} × (${fmt(wdPiso, 0)}×${nPisos} + ${fmt(wAz, 0)}) = ${fmt(P, 0)} kg`
          : `P = ${fmt(area, 2)} m² × ${fmt(wdPiso, 0)} kg/m² × ${nPisos} = ${fmt(P, 0)} kg`,
        result: `${fmt(P / 1000, 2)} t`,
        note: azotea
          ? "Morales: se acumulan los pisos tributarios y la azotea (carga de techo)."
          : "Según Morales: carga acumulada de todos los pisos tributarios. Sin azotea.",
      },
      {
        n: "02",
        title: "Factores de ubicación (k) y de cuantía (n)",
        formula: "Interior k=1.10 n=0.30 · Extrema k=1.25 n=0.25 · Esquina k=1.50 n=0.20",
        substitution: `Tipo «${tipo}», zona «${zona}» → k = ${fmt(k, 2)}  ·  n = ${fmt(n, 2)}`,
        result: `k = ${fmt(k, 2)}   n = ${fmt(n, 2)}`,
      },
      {
        n: "03",
        title: "Área de concreto requerida",
        formula: "A_g = k·P / (n·f'c)",
        substitution: `A_g = ${fmt(k, 2)}×${fmt(P, 0)} / (${fmt(n, 2)}×${fmt(fc, 0)}) = ${fmt(Ag, 1)} cm²`,
        result: `${fmt(Ag, 1)} cm²  (cuadrada ≈ ${fmt(ladoSq, 1)} cm)`,
      },
      {
        n: "04",
        title: "Sección adoptada (múltiplos de 5 cm)",
        formula: "D = A_g / b   →  redondear a 5 cm",
        substitution: `b mín = ${bMin} cm → b = ${b} cm  ·  D calc = ${fmt(Dcalc, 1)} cm → D = ${D} cm`,
        result: `${b} × ${D} cm`,
        ok: cumple,
      },
      {
        n: "05",
        title: "Cuantía geométrica mínima — E.060 10.9.1",
        formula: "ρg,mín = 0.01    ·    As,mín = 0.01 Ag    ·    ρg,máx = 0.04 (0.06 en empalme)",
        substitution: `Ag = ${fmt(AgAdopt, 0)} cm²  →  As,mín = 0.01 × ${fmt(AgAdopt, 0)} = ${fmt(acero.Asmin, 2)} cm²`,
        result: `As,mín = ${fmt(acero.Asmin, 2)} cm²`,
        note: "En columna no se adopta menos del 1 % de Ag. El 4 % es el tope de sección; 6 % solo en el tramo de empalme.",
      },
      {
        n: "06",
        title: "Acero longitudinal adoptado",
        formula: "As ≥ As,mín    ·    n par    ·    Ø comercial",
        substitution: `${acero.text}  →  As = ${fmt(acero.As, 2)} cm²  ·  ρg = ${fmt(acero.rho * 100, 2)} %`,
        result: `${acero.text}   ρg = ${fmt(acero.rho * 100, 2)} %`,
        ok: okRho,
        note: "Se elige la combinación de n y Ø más cercana al 1.2 %, sin bajar del 1 % ni pasar del 4 %.",
      },
      {
        n: "07",
        title: "Diámetro del estribo — E.060 7.10.5 / 21.4.4",
        formula: "Øest ≥ máx(db long / 4,  3/8\")",
        substitution: `db long = ${fmt(longBar.db, 2)} cm  →  Øest mín = máx(${fmt(longBar.db / 4, 2)}, 0.95) = ${fmt(st.destMin, 2)} cm`,
        result: `Ø ${destName} (db = ${fmt(destBar.db, 2)} cm)${st.destOk ? "  ·  cumple" : "  ·  aumentar Ø"}`,
        ok: st.destOk,
        desarrollo: [
          `El estribo debe ser al menos ¼ del Ø longitudinal y no menor que 3/8\".`,
          `Con ${acero.text}, db/4 = ${fmt(longBar.db, 2)}/4 = ${fmt(longBar.db / 4, 2)} cm. Gobierna ${fmt(st.destMin, 2)} cm.`,
          `Se adopta Ø ${destName}. ${st.needCrosstie ? `hx > 35 cm o n ≥ 8 → se cierran ${st.nRamas} ramas (estribo + ganchos suplementarios).` : "Basta estribo cerrado de 2 ramas."}`,
        ],
        note: "En pórtico especial el gancho es de 135° con extensión ≥ 6 db y ≥ 7.5 cm.",
      },
      {
        n: "08",
        title: "Longitud de zona confinada ℓo — E.060 21.4.4.4",
        formula: "ℓo ≥ máx(h, b, Lu/6, 45 cm)",
        substitution: `máx(${fmt(D, 0)}, ${fmt(b, 0)}, ${fmt(Lu, 0)}/6 = ${fmt(Lu / 6, 1)}, 45) = ${fmt(st.lo, 1)} cm`,
        result: `ℓo = ${fmt(st.lo, 1)} cm en cada extremo  ·  tramo central = ${fmt(st.Lrest, 1)} cm`,
        desarrollo: [
          `Lu = ${fmt(Lu, 0)} cm (luz libre de piso).`,
          `ℓo = máx(peralte, lado menor, Lu/6, 45 cm) = ${fmt(st.lo, 1)} cm.`,
          `El primer estribo se coloca a 5 cm de la cara del nudo. El resto de la altura lleva s = ${st.sRest} cm.`,
        ],
        note: sismico
          ? "En zona sísmica peruana el pórtico especial exige núcleo confinado en ambos extremos de cada piso."
          : "Sin sismo se detalla s ≤ mín(16 db, 48 Øest, menor lado) en toda la altura.",
      },
      {
        n: "09",
        title: "Ash y espaciamiento de confinamiento — E.060 21.4.4.1",
        formula: "Ash ≥ 0.09 s hc f'c/fy    y    Ash ≥ 0.3 s hc (Ag/Ach − 1) f'c/fy",
        substitution: `hc = ${fmt(st.hc, 1)} cm  ·  Ach = ${fmt(st.Ach, 0)} cm²  ·  Ash = ${st.nRamas}×${fmt(destBar.as, 2)} = ${fmt(st.Ash, 2)} cm²`,
        result: `${st.destLabel} @ ${st.sConf} cm (extremos)  /  @ ${st.sRest} cm (resto)`,
        desarrollo: [
          `Núcleo: hc = b − 2 rec − Øest = ${fmt(b, 0)} − 2×${fmt(rec, 1)} − ${fmt(destBar.db, 2)} = ${fmt(st.hc, 1)} cm.`,
          `Ash/s (0.09) = 0.09×${fmt(st.hc, 1)}×${fmt(fc, 0)}/4200 = ${fmt(st.avs1, 4)} cm²/cm.`,
          `Ash/s (0.30) = 0.30×${fmt(st.hc, 1)}×(${fmt(st.Ag, 0)}/${fmt(st.Ach, 0)} − 1)×${fmt(fc, 0)}/4200 = ${fmt(st.avs2, 4)} cm²/cm.`,
          `s de Ash = ${fmt(st.Ash, 2)} / ${fmt(st.avsReq, 4)} = ${fmt(st.sFromAsh, 1)} cm.`,
          `s máx extremo = mín(lado/4, 6 db, so) = ${fmt(st.sMaxConf, 1)} cm  ·  so = 10+(35−hx)/3 = ${fmt(st.so, 1)} cm (hx = ${fmt(st.hx, 1)} cm).`,
          `Se adopta s = ${st.sConf} cm en ℓo y s = ${st.sRest} cm fuera (≤ 6 db y ≤ 15 cm).`,
        ],
        ok: st.ashOk && st.destOk,
      },
      {
        n: "10",
        title: "Despiece y metrado de estribos",
        formula: "n = 1 + ⌈(ℓo − 5)/s⌉    ·    primer estribo a 5 cm del paño",
        substitution: `n extremo = 1 + ⌈(${fmt(st.lo, 1)} − 5)/${st.sConf}⌉ = ${st.nConf}    ·    n resto = ${st.nRest}`,
        result: `${st.arregloPlano}   ·   ${st.nTotal} estribos   ·   ${fmt(st.peso, 2)} kg`,
        desarrollo: [
          `Arreglo en cada extremo: ${st.arregloConf}.`,
          `Tramo central (Lu − 2ℓo = ${fmt(st.Lrest, 1)} cm): ${st.arregloRest}.`,
          `Longitud de un estribo cerrado: 2(b′+h′) + 2 ganchos 135° = ${fmt(st.Lunit, 1)} cm.`,
          `Peso = n × L × 0.785 As = ${st.nTotal} × ${fmt(st.Lunit / 100, 3)} m × ${fmt(destBar.as * 0.785, 3)} kg/m = ${fmt(st.peso, 2)} kg.`,
        ],
        note: "Notación de plano: 1 @ 0.05, n @ s_conf, resto @ s_resto. Ganchos 135° en zona confinada.",
      },
    ],
    [
      ok("Ag adoptada ≥ Ag req.", `${fmt(AgAdopt, 0)} cm²`, `≥ ${fmt(Ag, 0)} cm²`, cumple),
      ok("Cuantía ρg ≥ 1 %", `${fmt(acero.rho * 100, 2)} %`, "≥ 1.00 %", okRho && acero.rho + 1e-9 >= 0.01),
      ok("Cuantía ρg ≤ 4 %", `${fmt(acero.rho * 100, 2)} %`, "≤ 4.00 %", acero.rho <= 0.04 + 1e-9),
      ok("Øest ≥ máx(db/4, 3/8\")", destName, `≥ ${fmt(st.destMin, 2)} cm`, st.destOk),
      ok("Ash/s ≥ Ash/s req", fmt(st.Ash / st.sConf, 3), `≥ ${fmt(st.avsReq, 3)}`, st.ashOk),
      ok("s extremo ≤ s máx", `${st.sConf} cm`, `≤ ${fmt(st.sMaxConf, 1)} cm`, st.sConf <= st.sMaxConf + 0.1),
    ],
    [
      {
        title: "Cuadro de estribos de columna",
        rows: [
          ["Zona", "Longitud", "Estribo", "Arreglo", "s", "Cantidad", "L unit.", "Peso"],
          ["Extremo inferior", `${fmt(st.lo / 100, 2)} m`, st.destLabel, st.arregloConf, `${st.sConf} cm`, String(st.nConf), `${fmt(st.Lunit, 1)} cm`, `${fmt(pesoParte(st.peso, st.nConf, st.nTotal), 2)} kg`],
          ["Tramo central", `${fmt(st.Lrest / 100, 2)} m`, st.destLabel, st.arregloRest, `${st.sRest} cm`, String(st.nRest), `${fmt(st.Lunit, 1)} cm`, `${fmt(pesoParte(st.peso, st.nRest, st.nTotal), 2)} kg`],
          ["Extremo superior", `${fmt(st.lo / 100, 2)} m`, st.destLabel, st.arregloConf, `${st.sConf} cm`, String(st.nConf), `${fmt(st.Lunit, 1)} cm`, `${fmt(pesoParte(st.peso, st.nConf, st.nTotal), 2)} kg`],
          ["Total", `${fmt(Lu / 100, 2)} m`, st.destLabel, st.arregloPlano, "—", String(st.nTotal), "—", `${fmt(st.peso, 2)} kg`],
        ],
      },
    ],
    {
      bAdopt: String(b),
      hAdopt: String(D),
      nBar: String(acero.n),
      barLong: acero.name,
      barEst: destName,
      dest: String(destBar.db),
      steel: acero.text,
      sConf: String(st.sConf),
      sRest: String(st.sRest),
      lo: String(st.lo),
      Lu: String(Lu),
      nRamas: String(st.nRamas),
      arreglo: st.arregloPlano,
    }
  );
};

/* ───────── Predimensionamiento vigas y losa (E.060 + E.020) ───────── */
export const predVigasLosas: Engine = (raw) => {
  const Ln = num(raw, "Ln", 5.6);
  const bCol = num(raw, "bCol", 0.3);
  const Lajes = Ln + bCol;
  const s = num(raw, "s", 4.0);
  const Lvol = num(raw, "Lvol", 1.8);
  const tipoLosa = str(raw, "tipoLosa", "aligerada");
  const uso = usoE020(str(raw, "uso", "vivienda"));

  const hLosaTab: Record<string, number> = { aligerada: Ln / 25, maciza: Ln / 30, nervada: Ln / 20 };
  const hLosaCalc = hLosaTab[tipoLosa] ?? Ln / 25;
  const hLosaMin = tipoLosa === "aligerada" ? 0.17 : 0.12;
  const hLosa = Math.max(hLosaMin, roundUp(hLosaCalc * 100, 5) / 100);

  const pp = pesoLosa(tipoLosa, hLosa);
  const cm = pp + ACABADOS + uso.tabique;
  const cv = uso.sc;
  const w = cm + cv;
  const q = (w * s) / 1000;

  const cmViv = pp + ACABADOS + USO_VIVIENDA.tabique;
  const wViv = cmViv + USO_VIVIENDA.sc;
  const qViv = (wViv * s) / 1000;
  const nViv = 12;
  const nCalc = uso.id === "vivienda" ? nViv : nViv * Math.pow(qViv / Math.max(q, 0.01), 0.45);
  const n = Math.max(8, Math.min(14, nCalc));
  const hCarga = Ln / n;

  const hE060 = Ln / 16;
  const hViga = Math.max(0.25, hE060, hCarga);
  const hVigaAd = roundUp(hViga * 100, 5) / 100;
  const bViga = Math.max(0.25, hVigaAd / 2);
  const bVigaAd = roundUp(bViga * 100, 5) / 100;
  const hVol = Math.max(0.25, Lvol / 8);
  const hVolAd = roundUp(hVol * 100, 5) / 100;
  const gobiernaCarga = hCarga >= hE060 - 1e-9;

  const desglose = USOS_E020.map((u) => {
    const wU = pp + ACABADOS + u.tabique + u.sc;
    const qU = (wU * s) / 1000;
    const nU = u.id === "vivienda" ? nViv : Math.max(8, Math.min(14, nViv * Math.pow(qViv / Math.max(qU, 0.01), 0.45)));
    const hU = roundUp(Math.max(0.25, Ln / 16, Ln / nU) * 100, 5) / 100;
    const marca = u.id === uso.id ? "◀" : "";
    return [
      marca,
      u.grupo,
      u.label.replace(/ —.*$/, ""),
      fmt(u.sc, 0),
      fmt(wU, 0),
      fmt(qU, 2),
      `L/${fmt(nU, 1)}`,
      fmt(hU * 100, 0),
    ];
  });

  return out(
    `Losa ${fmt(hLosa * 100, 0)} cm · Viga ${fmt(bVigaAd * 100, 0)}×${fmt(hVigaAd * 100, 0)} cm  (L/${fmt(n, 1)})`,
    `Losa ${tipoLosa} h = ${fmt(hLosa, 2)} m   ·   viga ${fmt(bVigaAd, 2)} × ${fmt(hVigaAd, 2)} m   ·   ${uso.grupo.toLowerCase()} L/${fmt(n, 1)}`,
    [
      {
        n: "01",
        title: "Luz libre Ln — caras internas de columna",
        formula: "Ln = cara interna − cara interna    ·    L_ejes = Ln + b_col",
        substitution: `Ln = ${fmt(Ln, 2)} m  ·  b_col = ${fmt(bCol, 2)} m  →  L_ejes = ${fmt(Lajes, 2)} m`,
        result: `Ln = ${fmt(Ln, 2)} m (no usar ${fmt(Lajes, 2)} m ni ${fmt(Ln + 2 * bCol, 2)} m)`,
        note: "E.060 Art. 10.4: Ln es la luz libre entre caras de los apoyos. El peralte (Ln/16, Ln/25) no se calcula con la luz entre ejes ni con el largo total de la viga (que incluye las columnas).",
        desarrollo: [
          `Cara interna izq. → cara interna der. = Ln = ${fmt(Ln, 2)} m`,
          `Eje a eje (columnas iguales) = Ln + b_col = ${fmt(Ln, 2)} + ${fmt(bCol, 2)} = ${fmt(Lajes, 2)} m`,
          `Largo total de viga (cara externa a cara externa) = Ln + 2 b_col = ${fmt(Ln + 2 * bCol, 2)} m — no es Ln`,
        ],
      },
      {
        n: "02",
        title: "Losa — E.060 Art. 10.4.1.1",
        formula: "h ≥ Ln/25 aligerada · Ln/30 maciza · Ln/20 nervada",
        substitution: `h = ${fmt(Ln, 2)} / ${tipoLosa === "maciza" ? 30 : tipoLosa === "nervada" ? 20 : 25} = ${fmt(hLosaCalc, 3)} m → adoptar ${fmt(hLosa, 2)} m`,
        result: `h losa = ${fmt(hLosa * 100, 0)} cm`,
        note: tipoLosa === "aligerada" ? "Mínimo 17 cm en aligerados habituales. Ln es cara a cara, no entre ejes." : "Espesor geométrico mínimo de norma, salvo cálculo de deflexiones. Ln es cara a cara.",
      },
      {
        n: "03",
        title: "Metrado de la losa — E.020",
        formula: "w = peso propio + acabados + tabiquería + CV",
        substitution: `pp = ${fmt(pp, 0)}  ·  acabados = ${ACABADOS}  ·  tabique = ${fmt(uso.tabique, 0)}  ·  CV ${uso.label} = ${fmt(cv, 0)} kg/m²`,
        result: `w = ${fmt(w, 0)} kg/m²`,
        note: "Pesos propios con γc = 2400 kg/m³ (E.020). La sobrecarga es la mínima de Tabla 1; el Art. 6.4 exige calcular el almacenaje real si el apilado supera ese valor.",
      },
      {
        n: "04",
        title: "Carga lineal sobre la viga",
        formula: "q = w · s",
        substitution: `q = ${fmt(w, 0)} kg/m² × ${fmt(s, 2)} m = ${fmt(w * s, 0)} kg/m`,
        result: `${fmt(q, 2)} t/m`,
        note: "s es el ancho tributario de losa (luz entre ejes que descarga en esta viga). No interviene una viga secundaria.",
      },
      {
        n: "05",
        title: "Calibración L/12 en vivienda",
        formula: "n_viv = 12    cuando    q = q_vivienda",
        substitution: `Vivienda E.020: CV = 200 kg/m², tabique = 150 kg/m² → w_viv = ${fmt(wViv, 0)} kg/m² → q_viv = ${fmt(qViv, 2)} t/m`,
        result: `h_viv = Ln/12 = ${fmt(Ln / 12, 3)} m`,
        note: "La regla L/12 no es un artículo de la E.060: es el peralte de servicio que usa la práctica peruana cuando la losa es de vivienda. Aquí se demuestra con el metrado, no se postula.",
      },
      {
        n: "06",
        title: "Peralte por carga — otras ocupaciones",
        formula: "n = 12 · (q_viv / q)^0.45     h = Ln / n",
        substitution:
          uso.id === "vivienda"
            ? `Este caso es vivienda: n = 12. q = q_viv = ${fmt(q, 2)} t/m`
            : `q = ${fmt(q, 2)} t/m  vs  q_viv = ${fmt(qViv, 2)} t/m  →  n = 12×(${fmt(qViv, 2)}/${fmt(q, 2)})^0.45 = ${fmt(nCalc, 2)}`,
        result: `L/${fmt(n, 1)}  →  h = ${fmt(hCarga * 100, 1)} cm`,
        note: "El exponente 0.45 interpola flexión (h ∝ q^{1/3} si b∝h) y el canto extra que pide la práctica en almacenes. Con CV = 750 kg/m² el divisor cae a L/9–L/10.",
      },
      {
        n: "07",
        title: "Mínimo E.060 si no se calculan deflexiones",
        formula: "h ≥ Ln/16  (viga, un tramo, Tabla 10.4.1.1)",
        substitution: `Ln/16 = ${fmt(Ln, 2)}/16 = ${fmt(hE060, 3)} m. Por carga se pide ${fmt(hCarga, 3)} m.`,
        result: gobiernaCarga ? `Gobierna la carga: ${fmt(hVigaAd * 100, 0)} cm` : `Gobierna E.060: ${fmt(hVigaAd * 100, 0)} cm`,
        note: "Ln/16 es el piso de norma (apoyada). Pórtico continuo permite Ln/21, pero no se usa aquí como relajación: la carga lineal manda.",
      },
      {
        n: "08",
        title: "Sección adoptada",
        formula: "b ≈ h/2   ·   múltiplos de 5 cm   ·   b ≥ 25 cm",
        substitution: `h = ${fmt(hVigaAd, 2)} m → b = ${fmt(bViga, 2)} m`,
        result: `${fmt(bVigaAd * 100, 0)} × ${fmt(hVigaAd * 100, 0)} cm`,
      },
      {
        n: "09",
        title: "Voladizo — E.060",
        formula: "h ≥ L_vol / 8",
        substitution: `h = ${fmt(Lvol, 2)} / 8 = ${fmt(hVol, 3)} m`,
        result: `h vol = ${fmt(hVolAd * 100, 0)} cm`,
      },
    ],
    [
      ok("h losa ≥ mínimo", `${fmt(hLosa * 100, 0)} cm`, `≥ ${fmt(hLosaMin * 100, 0)} cm`, hLosa >= hLosaMin),
      ok("b viga ≥ 25 cm", `${fmt(bVigaAd * 100, 0)} cm`, "≥ 25 cm", bVigaAd >= 0.25),
      ok("h viga ≥ Ln/16", `${fmt(hVigaAd * 100, 0)} cm`, `≥ ${fmt(hE060 * 100, 0)} cm`, hVigaAd + 1e-9 >= hE060),
    ],
    [
      {
        title: "Desglose E.020 — divisor L/h según sobrecarga (misma Ln y s)",
        rows: [
          ["", "Grupo", "Uso", "CV kg/m²", "w kg/m²", "q t/m", "L/h", "h cm"],
          ...desglose,
        ],
      },
    ]
  );
};

/* ───────── Espectro E.030 ───────── */
export type EspectroPoint = { t: number; c: number; sa: number };

export function e030C(t: number, Tp: number, Tl: number): number {
  return e030CTabla(t, Tp, Tl);
}

export function e030Curve(raw: Record<string, string>) {
  const p = resolveE030(raw);
  const Z = p.Z;
  const U = p.U;
  const S = p.S;
  const Tp = p.Tp;
  const Tl = p.Tl;
  const R0 = p.R0;
  const Ia = p.Ia;
  const Ip = p.Ip;
  const H = p.H;
  const Ct = p.Ct;
  const R = p.R;
  const T = H / Math.max(Ct, 1e-6);
  const C = p.suelo === "S5" ? 0 : e030C(T, Tp, Tl);
  const Sa = p.suelo === "S5" ? 0 : (Z * U * C * S) / R;
  const points: EspectroPoint[] = [];
  for (let i = 0; i <= 30; i++) {
    const t = i / 10;
    const c = p.suelo === "S5" ? 0 : e030C(t, Tp, Tl);
    points.push({ t, c, sa: p.suelo === "S5" ? 0 : (Z * U * c * S) / R });
  }
  return { Z, U, S, Tp, Tl, R0, Ia, Ip, H, Ct, R, T, C, Sa, points, meta: p };
}

export const espectroE030: Engine = (raw) => {
  const { T, C, Sa, R, H, Ct, R0, Ia, Ip, Z, U, S, Tp, Tl, points, meta } = e030Curve(raw);
  const rows: string[][] = [["T (s)", "C", "Sa = ZUCS/R"]];
  for (const p of points) {
    rows.push([fmt(p.t, 2), fmt(p.c, 3), fmt(p.sa, 4)]);
  }
  const Cest = T <= Tp ? 2.5 : C;
  return out(
    `Sa(T=${fmt(T, 2)} s) = ${fmt(Sa, 3)}  ·  R = ${fmt(R, 2)}`,
    `Espectro E.030 2026 listo para ETABS/SAP. ${meta.ubicacion} · zona ${meta.zona}.`,
    [
      {
        n: "01",
        title: "Zonificación (Anexo II / Tabla N° 1)",
        formula: "Z según distrito",
        substitution: `${meta.ubicacion} → zona ${meta.zona} → Z = ${fmt(Z, 2)}`,
        result: `Z = ${fmt(Z, 2)}`,
        note: meta.zonaDesc,
      },
      {
        n: "02",
        title: "Parámetros de sitio (Tablas N° 4 y 5)",
        formula: "S, Tp, TL según perfil y zona",
        substitution: `${meta.sueloLabel} en zona ${meta.zona} → S = ${fmt(S, 2)} · Tp = ${fmt(Tp, 2)} s · TL = ${fmt(Tl, 2)} s`,
        result: `S = ${fmt(S, 2)}`,
        note: meta.sitioNote,
      },
      {
        n: "03",
        title: "Categoría y factor de uso U (Tabla N° 7)",
        formula: "U según categoría",
        substitution: `${meta.catLabel} → U = ${fmt(U, 2)}`,
        result: `U = ${fmt(U, 2)}`,
        note: meta.catDesc,
      },
      {
        n: "04",
        title: "Periodo estimado (art. 36)",
        formula: "T = H / Ct",
        substitution: `T = ${fmt(H, 2)} / ${fmt(Ct, 0)} = ${fmt(T, 3)} s`,
        result: `${fmt(T, 3)} s`,
        note: `Ct = 35 pórticos CA o acero a momento; 45 acero arriostrado; 60 dual, muros, EMDL y albañilería. Sistema: ${meta.sisLabel}.`,
      },
      {
        n: "05",
        title: "Factor de reducción",
        formula: "R = R0 · Ia · Ip",
        substitution: `R = ${fmt(R0, 1)} × ${fmt(Ia, 2)} × ${fmt(Ip, 2)} = ${fmt(R, 2)}`,
        result: `R = ${fmt(R, 2)}`,
        note: `${meta.sisLabel}. ${meta.iaLabel}. ${meta.ipLabel}.`,
      },
      {
        n: "06",
        title: "Factor C de amplificación (Tabla N° 6)",
        formula: "T < 0,2 Tp → 1+7,5(T/Tp) · 0,2 Tp–Tp → 2,5 · Tp–TL → 2,5 Tp/T · T>TL → 2,5 Tp TL/T²",
        substitution: `Tp=${fmt(Tp, 2)} s  TL=${fmt(Tl, 2)} s  T=${fmt(T, 3)} s  →  C = ${fmt(C, 3)}`,
        result: `C = ${fmt(C, 3)}`,
        note: `Para cortante basal estático se usa C = 2,5 si 0 ≤ T ≤ Tp (art. 18.3 / 34): Cest = ${fmt(Cest, 2)}.`,
      },
      {
        n: "07",
        title: "Ordenada espectral",
        formula: "Sa = Z · U · C · S / R",
        substitution: `Sa = ${fmt(Z, 2)}×${fmt(U, 2)}×${fmt(C, 3)}×${fmt(S, 2)} / ${fmt(R, 2)}`,
        result: `Sa = ${fmt(Sa, 4)}`,
      },
    ],
    [
      ok("R > 0", fmt(R, 2), "R > 0", R > 0),
      ok("Perfil S5 no admite espectro normativo", meta.suelo, "S0–S4", meta.suelo !== "S5"),
      ok(
        "S4 en zona 4 exige análisis de respuesta de sitio",
        meta.suelo === "S4" && meta.zona === 4 ? "Requerido" : "No aplica",
        "Tabla N° 4",
        !(meta.suelo === "S4" && meta.zona === 4)
      ),
    ],
    [
      {
        title: "Parámetros adoptados",
        rows: [
          ["Parámetro", "Valor", "Origen"],
          ["Ubicación", meta.ubicacion, "Anexo II E.030"],
          ["Zona sísmica", `Zona ${meta.zona}`, "4 zonas vigentes (no 5)"],
          ["Z", fmt(Z, 2), "Tabla N° 1"],
          ["Perfil", meta.sueloLabel, "Tabla N° 2 y 3"],
          ["S", fmt(S, 2), "Tabla N° 4"],
          ["Tp (s)", fmt(Tp, 2), "Tabla N° 5"],
          ["TL (s)", fmt(Tl, 2), "Tabla N° 5"],
          ["Categoría", meta.catLabel, "Tabla N° 7"],
          ["U", fmt(U, 2), "Tabla N° 7"],
          ["Sistema", meta.sisLabel, "Tabla N° 10"],
          ["R0", fmt(R0, 1), "Tabla N° 10"],
          ["Ia", fmt(Ia, 2), "Tabla N° 11"],
          ["Ip", fmt(Ip, 2), "Tabla N° 12"],
          ["R", fmt(R, 2), "R = R0·Ia·Ip"],
        ],
      },
      { title: "Espectro Sa(T) — copiar a ETABS", rows },
    ]
  );
};

/* ───────── Viga a flexión + cortante + estribos (ACI / E.060) ───────── */
export const vigaFlexion: Engine = (raw) => {
  const b = num(raw, "b", 25);
  const h = num(raw, "h", 50);
  const rec = num(raw, "rec", 5);
  const fc = num(raw, "fc", 210);
  const fy = num(raw, "fy", 4200);
  const L = num(raw, "L", 6);
  const wu = num(raw, "wu", 2.5);
  const MuIn = num(raw, "Mu", 0);
  const dest = num(raw, "dest", 0.95);
  const db = num(raw, "db", 1.59);
  const nRamas = Math.max(2, Math.round(num(raw, "nRamas", 2)));
  const VuIn = num(raw, "Vu", 0);
  const d = h - rec - dest - db / 2;
  const Mu = MuIn > 0 ? MuIn : (wu * L * L) / 8;
  const Mu_kgcm = Mu * 100000;
  const phiF = 0.9;
  const b1 = beta1(fc);
  const Rn = Mu_kgcm / (phiF * b * d * d);
  const rho = (0.85 * fc / fy) * (1 - Math.sqrt(Math.max(0, 1 - (2 * Rn) / (0.85 * fc))));
  const rhoMin = Math.max(0.8 * Math.sqrt(fc) / fy, 14 / fy);
  const rhoB = (0.85 * b1 * fc / fy) * (6300 / (6300 + fy));
  const rhoMax = 0.75 * rhoB;
  const rhoUse = Math.max(rho, rhoMin);
  const As = rhoUse * b * d;
  const a = (As * fy) / (0.85 * fc * b);
  const phiMn = (phiF * As * fy * (d - a / 2)) / 100000;
  const bars = pickBars(As, ['1/2"', '5/8"', '3/4"', '1"']);
  const tension = rhoUse <= rhoMax;
  const capacity = phiMn + 0.01 >= Mu;

  const stirrup = nearestBar(dest);
  const Av = nRamas * stirrup.as;
  const VA = (wu * L) / 2;
  const VuAuto = L > 0.2 ? VA * Math.max(0, L / 2 - d / 100) / (L / 2) : VA;
  const Vu = VuIn > 0 ? VuIn : VuAuto;
  const sismico = str(raw, "sismico", "si") !== "no";
  const sh = designBeamStirrups({
    b,
    h,
    d,
    rec,
    fc,
    fy,
    Vu,
    Av,
    L,
    VA,
    destName: stirrup.name,
    destDb: stirrup.db,
    dbLong: db,
    nRamas,
    sismico,
  });
  const estLabel = sh.estLabel;

  return out(
    `As = ${fmt(As, 2)} cm² → ${bars.text}  ·  ${estLabel}  ${sh.arregloPlano}`,
    `Flexión: ${bars.text}  ·  d = ${fmt(d, 1)} cm  ·  φMn = ${fmt(phiMn, 2)} t·m.  Cortante: ${estLabel} — ${sh.arregloPlano}  (${sh.nTotal} estribos).`,
    [
      {
        n: "01",
        title: "Peralte efectivo",
        formula: "d = h − rec − Øest − db/2",
        substitution: `d = ${h} − ${rec} − ${fmt(dest, 2)} − ${fmt(db, 2)}/2 = ${fmt(d, 2)} cm`,
        result: `d = ${fmt(d, 2)} cm`,
      },
      {
        n: "02",
        title: "Momento último",
        formula: MuIn > 0 ? "Mu ingresado" : "Mu = wu L² / 8  (viga simplemente apoyada)",
        substitution: MuIn > 0 ? `Mu = ${fmt(Mu, 2)} t·m` : `Mu = ${fmt(wu, 2)}×${fmt(L, 2)}² / 8 = ${fmt(Mu, 2)} t·m`,
        result: `${fmt(Mu, 2)} t·m = ${fmt(Mu_kgcm, 0)} kg·cm`,
      },
      {
        n: "03",
        title: "Cuantía requerida",
        formula: "ρ = (0.85 f'c / fy) [ 1 − √(1 − 2 Rn / (0.85 f'c)) ]",
        substitution: `Rn = ${fmt(Rn, 2)} kg/cm²  →  ρ = ${fmt(rho, 5)}  ·  ρmín = ${fmt(rhoMin, 5)}  ·  ρmáx = ${fmt(rhoMax, 5)}`,
        result: `ρ usar = ${fmt(rhoUse, 5)}`,
        ok: tension,
      },
      {
        n: "04",
        title: "Área de acero a flexión",
        formula: "As = ρ b d    ·    a = As fy / (0.85 f'c b)",
        substitution: `As = ${fmt(rhoUse, 5)}×${b}×${fmt(d, 1)} = ${fmt(As, 2)} cm²   a = ${fmt(a, 2)} cm`,
        result: `${fmt(As, 2)} cm²  →  ${bars.text}`,
      },
      {
        n: "05",
        title: "Resistencia a flexión",
        formula: "φMn = φ As fy (d − a/2)   ·   φ = 0.90",
        substitution: `φMn = 0.9×${fmt(As, 2)}×${fy}×(${fmt(d, 1)}−${fmt(a, 2)}/2) / 1e5`,
        result: `φMn = ${fmt(phiMn, 2)} t·m  ${capacity ? "≥ Mu  OK" : "< Mu  NO CUMPLE"}`,
        ok: capacity,
      },
      {
        n: "06",
        title: "Cortante en el paño del apoyo",
        formula: "VA = wu L / 2",
        substitution: `VA = ${fmt(wu, 2)} × ${fmt(L, 2)} / 2 = ${fmt(VA, 2)} t`,
        result: `VA = ${fmt(VA, 2)} t`,
        desarrollo: [
          "En viga simplemente apoyada con wu uniforme la reacción de cada apoyo es wu L / 2.",
          `VA = ${fmt(wu, 2)} t/m × ${fmt(L, 2)} m / 2 = ${fmt(VA, 2)} t. Este valor rige el diagrama V(x) en el paño.`,
        ],
        note: "Si la viga es continua, reemplace wu L/2 por la reacción de análisis (o ingrese Vu).",
      },
      {
        n: "07",
        title: "Cortante de diseño a distancia d — E.060 11.1.3",
        formula: VuIn > 0 ? "Vu ingresado" : "Vu = VA (L/2 − d) / (L/2)",
        substitution:
          VuIn > 0
            ? `Vu = ${fmt(Vu, 2)} t`
            : `Vu = ${fmt(VA, 2)} × (${fmt(L / 2, 2)} − ${fmt(d / 100, 3)}) / ${fmt(L / 2, 2)} = ${fmt(Vu, 2)} t`,
        result: `Vu = ${fmt(Vu, 2)} t`,
        desarrollo: [
          "La sección crítica a cortante está a una distancia d de la cara del apoyo, no en el paño.",
          `d = ${fmt(d, 2)} cm = ${fmt(d / 100, 3)} m. Desde el apoyo el cortante baja linealmente.`,
          VuIn > 0
            ? "Se usa el Vu ingresado (análisis)."
            : `Vu = VA × (L/2 − d) / (L/2) = ${fmt(VA, 2)} × ${fmt(L / 2 - d / 100, 3)} / ${fmt(L / 2, 2)} = ${fmt(Vu, 2)} t.`,
        ],
      },
      {
        n: "08",
        title: "Resistencia del concreto — E.060 11.3",
        formula: "Vc = 0.53 √f'c b d    ·    φv = 0.85",
        substitution: `Vc = 0.53√${fc} × ${b} × ${fmt(d, 1)} / 1000 = ${fmt(sh.Vc, 2)} t`,
        result: `φVc = ${fmt(sh.phiVc, 2)} t    ·    φVc/2 = ${fmt(sh.phiVc / 2, 2)} t`,
        desarrollo: [
          `√f'c = √${fmt(fc, 0)} = ${fmt(Math.sqrt(fc), 2)} kg/cm².`,
          `Vc = 0.53 × ${fmt(Math.sqrt(fc), 2)} × ${b} × ${fmt(d, 1)} / 1000 = ${fmt(sh.Vc, 2)} t.`,
          `φVc = 0.85 × ${fmt(sh.Vc, 2)} = ${fmt(sh.phiVc, 2)} t.`,
          `Tres regímenes: Vu ≤ φVc/2 (constructivos) · φVc/2 < Vu ≤ φVc (mínimos) · Vu > φVc (diseño).`,
          `Aquí Vu = ${fmt(Vu, 2)} t  →  ${sh.regimen}.`,
        ],
        note: sh.regimen,
      },
      {
        n: "09",
        title: "Acero de corte Vs y límite de sección",
        formula: "Vs = Vu/φ − Vc    ·    Vs ≤ 2.1 √f'c b d    ·    umbral s=d/4: 1.1 √f'c b d",
        substitution: sh.needDesign
          ? `Vs = ${fmt(Vu, 2)}/0.85 − ${fmt(sh.Vc, 2)} = ${fmt(sh.Vs, 2)} t   ·   Vs,máx = ${fmt(sh.VsMax, 2)} t`
          : `Vs de diseño = 0  ·  Vs,máx = ${fmt(sh.VsMax, 2)} t`,
        result: sh.needDesign ? `Vs = ${fmt(sh.Vs, 2)} t` : "Estribos mínimos / constructivos",
        ok: sh.sectionOk,
        desarrollo: [
          sh.needDesign
            ? `Vs = Vu/φ − Vc = ${fmt(Vu, 2)}/0.85 − ${fmt(sh.Vc, 2)} = ${fmt(sh.Vs, 2)} t.`
            : "Vu no supera φVc: el concreto cubre el corte. Vs de diseño = 0.",
          `Vs,máx = 2.1 √f'c b d = ${fmt(sh.VsMax, 2)} t. Si Vs lo supera hay que agrandar la sección (no basta más estribos).`,
          `Si Vs > 1.1 √f'c b d = ${fmt(sh.vsLim, 2)} t, el s máx baja de d/2 a d/4 (y de 60 a 30 cm).`,
        ],
      },
      {
        n: "10",
        title: "Av, s de cálculo y Av/s mínimo — E.060 11.5",
        formula: "Av = n × As(Ø)    ·    s = Av fy d / Vs    ·    Av/s ≥ máx(3.5, 0.75√f'c) b / fy",
        substitution: `Av = ${nRamas}×${fmt(stirrup.as, 2)} = ${fmt(Av, 2)} cm²  ·  s calc = ${fmt(Math.min(sh.sFromVs, 999), 1)} cm`,
        result: `s apoyo = ${sh.sApoyo} cm    ·    s centro = ${sh.sCentro} cm`,
        desarrollo: [
          `Estribo cerrado Ø ${stirrup.name}, ${nRamas} ramas: Av = ${nRamas} × ${fmt(stirrup.as, 2)} = ${fmt(Av, 2)} cm².`,
          sh.needDesign
            ? `s de Vs = Av fy d / Vs = ${fmt(Av, 2)}×${fmt(fy, 0)}×${fmt(d, 1)} / (${fmt(sh.Vs, 2)}×1000) = ${fmt(Math.min(sh.sFromVs, 999), 1)} cm.`
            : "No hay Vs de diseño: gobierna el s máximo de norma y el Av/s mínimo.",
          `Av/s mín = máx(3.5, 0.75√f'c) b / fy = ${fmt(sh.avsMin, 4)} cm²/cm  →  s de mínimo = ${fmt(sh.sFromMin, 1)} cm.`,
          `s máx apoyo = ${fmt(sh.sMaxApoyo, 1)} cm${sismico ? ` (incluye s sísmico = mín(d/4, 8 db, 24 Øest, 30) = ${fmt(sh.sMaxSis, 1)} cm)` : ""}.`,
          `s máx centro = mín(d/2, 60) = ${fmt(sh.sMaxCentro, 1)} cm. Se trunca al comercial 5-6-8-10-12-15-20-25-30 cm.`,
        ],
        note: `Av/s adoptado = ${fmt(sh.avs, 3)} cm²/cm  ≥  ${fmt(sh.avsMin, 3)} cm²/cm.`,
      },
      {
        n: "11",
        title: "Zona densa y primer estribo",
        formula: sismico ? "ℓo = 2h    ·    primer estribo a 5 cm del paño" : "ℓ hasta Vu ≈ φVc (≤ L/4)    ·    primer estribo a 5 cm",
        substitution: `ℓo = ${fmt(sh.lo, 2)} m  ·  ℓ corte = ${fmt(sh.Lshear, 2)} m  ·  ℓ zona = ${fmt(sh.Lzona, 2)} m  ·  ℓ centro = ${fmt(sh.Lcentro, 2)} m`,
        result: sh.criterioZona,
        desarrollo: [
          sismico
            ? `Pórtico especial (E.060 21.3.3): la zona plástica se confina en 2h = 2×${fmt(h, 0)} = ${fmt(2 * h, 0)} cm = ${fmt(sh.lo, 2)} m a cada lado del nudo.`
            : "Sin sismo, la zona densa llega hasta donde Vu cae a φVc, sin pasar de L/4.",
          `El tramo hasta Vu = φVc midiendo desde el paño es ${fmt(sh.Lshear, 2)} m. Se toma el mayor con 2h cuando hay sismo.`,
          "El primer estribo se coloca a 5 cm de la cara de la columna (E.060 11.5.5.1 / práctica de despiece).",
        ],
      },
      {
        n: "12",
        title: "Cantidad — n = 1 + ⌈(ℓ − 5)/s⌉",
        formula: "n_apoyo = 1 + ⌈(ℓzona − 5)/s⌉    ·    n_centro = ⌈ℓc/s⌉ − 1",
        substitution: `n apoyo = 1 + ⌈(${fmt(sh.Lzona * 100, 1)} − 5)/${sh.sApoyo}⌉ = ${sh.nEnd}    ·    n centro = ${sh.nCentro}`,
        result: `${sh.arregloPlano}    ·    ${sh.nTotal} estribos`,
        desarrollo: [
          `Cada apoyo: primer estribo a 5 cm y el resto a ${sh.sApoyo} cm hasta cubrir ${fmt(sh.Lzona * 100, 1)} cm → ${sh.arregloApoyo}  (${sh.nEnd} und).`,
          `Centro: se descuenta 1 para no repetir el estribo de borde de zona → ${sh.nCentro} @ ${sh.sCentro} cm.`,
          `Total = 2×${sh.nEnd} + ${sh.nCentro} = ${sh.nTotal}.`,
          `Notación de plano (metros): ${sh.arregloPlano}.`,
        ],
        note: "Así se evita el error de n = L/s redondeado, que no cuenta el primer estribo a 5 cm.",
      },
      {
        n: "13",
        title: "Longitud unitaria y peso",
        formula: "L = 2(b′ + h′) + 2 ganchos 135°    ·    gancho = máx(6 db, 7.5 cm)",
        substitution: `b′ = ${fmt(b - 2 * rec, 1)}  ·  h′ = ${fmt(h - 2 * rec, 1)}  ·  gancho = ${fmt(Math.max(6 * stirrup.db, 7.5), 1)} cm`,
        result: `L unit. = ${fmt(sh.Lunit, 1)} cm    ·    ${fmt(sh.peso, 2)} kg (${sh.nTotal} und)`,
        desarrollo: [
          `b′ = b − 2 rec = ${fmt(b, 0)} − 2×${fmt(rec, 1)} = ${fmt(b - 2 * rec, 1)} cm.`,
          `h′ = h − 2 rec = ${fmt(h, 0)} − 2×${fmt(rec, 1)} = ${fmt(h - 2 * rec, 1)} cm.`,
          `Gancho sísmico 135°: máx(6×${fmt(stirrup.db, 2)}, 7.5) = ${fmt(Math.max(6 * stirrup.db, 7.5), 1)} cm.`,
          `L = 2(${fmt(b - 2 * rec, 1)}+${fmt(h - 2 * rec, 1)}) + 2×${fmt(Math.max(6 * stirrup.db, 7.5), 1)} = ${fmt(sh.Lunit, 1)} cm.`,
          `Peso = ${sh.nTotal} × ${fmt(sh.Lunit / 100, 3)} m × ${fmt(stirrup.as * 0.785, 3)} kg/m = ${fmt(sh.peso, 2)} kg.`,
        ],
      },
    ],
    [
      ok("φMn ≥ Mu", `${fmt(phiMn, 2)} t·m`, `≥ ${fmt(Mu, 2)} t·m`, capacity),
      ok("ρ ≤ ρmáx (falla dúctil)", fmt(rhoUse, 5), `≤ ${fmt(rhoMax, 5)}`, tension),
      ok("ρ ≥ ρmín", fmt(rhoUse, 5), `≥ ${fmt(rhoMin, 5)}`, rhoUse + 1e-9 >= rhoMin),
      ok("Vu ≤ φ(Vc + Vs,máx)", `${fmt(Vu, 2)} t`, `≤ ${fmt(sh.phi * (sh.Vc + sh.VsMax), 2)} t`, sh.sectionOk),
      ok("Vs ≤ 2.1 √f'c b d", `${fmt(sh.Vs, 2)} t`, `≤ ${fmt(sh.VsMax, 2)} t`, sh.Vs <= sh.VsMax + 1e-9),
      ok("s apoyo ≤ s máx", `${sh.sApoyo} cm`, `≤ ${fmt(sh.sMaxApoyo, 0)} cm`, sh.sApoyo <= sh.sMaxApoyo + 0.1),
      ok("Av/s ≥ Av/s mín", fmt(sh.avs, 3), `≥ ${fmt(sh.avsMin, 3)}`, sh.avs + 1e-9 >= sh.avsMin),
    ],
    [
      {
        title: "Cuadro de estribos",
        rows: [
          ["Zona", "Criterio", "Longitud", "Estribo", "Arreglo", "s", "Cant.", "L unit.", "Peso"],
          ["Apoyo izquierdo", sismico ? "ℓo = 2h" : "hasta Vu≈φVc", `${fmt(sh.Lzona, 2)} m`, estLabel, sh.arregloApoyo, `${sh.sApoyo} cm`, String(sh.nEnd), `${fmt(sh.Lunit, 1)} cm`, `${fmt(pesoParte(sh.peso, sh.nEnd, sh.nTotal), 2)} kg`],
          ["Centro", "s ≤ d/2", `${fmt(sh.Lcentro, 2)} m`, estLabel, sh.arregloCentro, `${sh.sCentro} cm`, String(sh.nCentro), `${fmt(sh.Lunit, 1)} cm`, `${fmt(pesoParte(sh.peso, sh.nCentro, sh.nTotal), 2)} kg`],
          ["Apoyo derecho", sismico ? "ℓo = 2h" : "hasta Vu≈φVc", `${fmt(sh.Lzona, 2)} m`, estLabel, sh.arregloApoyo, `${sh.sApoyo} cm`, String(sh.nEnd), `${fmt(sh.Lunit, 1)} cm`, `${fmt(pesoParte(sh.peso, sh.nEnd, sh.nTotal), 2)} kg`],
          ["Total", "—", `${fmt(L, 2)} m`, estLabel, sh.arregloPlano, "—", String(sh.nTotal), "—", `${fmt(sh.peso, 2)} kg`],
        ],
      },
    ],
    {
      sApoyo: String(sh.sApoyo),
      sCentro: String(sh.sCentro),
      sAd: String(sh.sApoyo),
      sMid: String(sh.sCentro),
      nRamas: String(nRamas),
      barEst: stirrup.name,
      Lzona: String(sh.Lzona),
      arreglo: sh.arregloPlano,
      sismico: sismico ? "si" : "no",
    }
  );
};

/* ───────── Viga a cortante ───────── */
export const vigaCortante: Engine = (raw) => {
  const b = num(raw, "b", 25);
  const h = num(raw, "h", 50);
  const rec = num(raw, "rec", 5);
  const fc = num(raw, "fc", 210);
  const fy = num(raw, "fy", 4200);
  const dest = num(raw, "dest", 0.95);
  const nRamas = Math.max(2, Math.round(num(raw, "nRamas", 2)));
  const L = num(raw, "L", 6);
  const wu = num(raw, "wu", 2.5);
  const AvIn = num(raw, "Av", 0);
  const stirrup = nearestBar(dest);
  const Av = AvIn > 0 ? AvIn : nRamas * stirrup.as;
  const d = h - rec - dest - 0.8;
  const VA = num(raw, "Vu", 0) > 0 && num(raw, "L", 0) === 0 ? num(raw, "Vu", 8) : (wu * L) / 2;
  const VuIn = num(raw, "Vu", 0);
  const VuAuto = L > 0.2 ? VA * Math.max(0, L / 2 - d / 100) / (L / 2) : VA;
  const Vu = VuIn > 0 ? VuIn : VuAuto;
  const sismico = str(raw, "sismico", "si") !== "no";
  const sh = designBeamStirrups({
    b,
    h,
    d,
    rec,
    fc,
    fy,
    Vu,
    Av,
    L: L || 1,
    VA: VA || Vu,
    destName: stirrup.name,
    destDb: stirrup.db,
    dbLong: 1.27,
    nRamas,
    sismico,
  });
  const estLabel = sh.estLabel;
  return out(
    `${estLabel}  ${sh.arregloPlano}`,
    `Vc = ${fmt(sh.Vc, 2)} t  ·  Vs = ${fmt(sh.Vs, 2)} t  ·  ${estLabel} — ${sh.arregloPlano}  (${sh.nTotal} und)`,
    [
      {
        n: "01",
        title: "Contribución del concreto — E.060 11.3",
        formula: "Vc = 0.53 √f'c  b d    ·    φ = 0.85",
        substitution: `Vc = 0.53√${fc} × ${b} × ${fmt(d, 1)} / 1000 = ${fmt(sh.Vc, 2)} t`,
        result: `φVc = ${fmt(sh.phiVc, 2)} t`,
        desarrollo: [
          `Vc = 0.53 × ${fmt(Math.sqrt(fc), 2)} × ${b} × ${fmt(d, 1)} / 1000 = ${fmt(sh.Vc, 2)} t.`,
          `φVc = 0.85 × ${fmt(sh.Vc, 2)} = ${fmt(sh.phiVc, 2)} t.  φVc/2 = ${fmt(sh.phiVc / 2, 2)} t.`,
        ],
      },
      {
        n: "02",
        title: "Régimen de estribos",
        formula: "Vu ≷ φVc/2  y  φVc    →    constructivos / mínimos / diseño",
        substitution: `Vu = ${fmt(Vu, 2)} t  ${sh.needDesign ? ">" : "≤"}  φVc = ${fmt(sh.phiVc, 2)} t`,
        result: sh.regimen,
        ok: sh.sectionOk,
        desarrollo: [
          sh.needDesign
            ? `Vs = Vu/φ − Vc = ${fmt(Vu, 2)}/0.85 − ${fmt(sh.Vc, 2)} = ${fmt(sh.Vs, 2)} t.`
            : sh.needMin
              ? "φVc/2 < Vu ≤ φVc: se colocan estribos con Av/s mínimo, no Vs de diseño."
              : "Vu ≤ φVc/2: el concreto basta; se detalla s ≤ d/2 por constructividad.",
        ],
      },
      {
        n: "03",
        title: "Espaciamiento adoptado",
        formula: "s = Av fy d / Vs    ·    s ≤ s máx    ·    Av/s ≥ Av/s mín",
        substitution: `Av = ${fmt(Av, 2)} cm²  ·  s calc = ${fmt(Math.min(sh.sFromVs, 999), 1)} cm  ·  s máx = ${fmt(sh.sMaxApoyo, 1)} cm`,
        result: `${estLabel}  ${sh.arregloPlano}`,
        desarrollo: [
          `Av/s mín = ${fmt(sh.avsMin, 4)} cm²/cm.  s máx apoyo = ${fmt(sh.sMaxApoyo, 1)} cm.  s máx centro = ${fmt(sh.sMaxCentro, 1)} cm.`,
          `Se adopta s = ${sh.sApoyo} cm en apoyos y s = ${sh.sCentro} cm en el centro (comercial).`,
        ],
      },
      {
        n: "04",
        title: "Límite de sección Vs ≤ 2.1 √f'c b d",
        formula: "Vs ≤ Vs,máx",
        substitution: `${fmt(sh.Vs, 2)} t  ≤  ${fmt(sh.VsMax, 2)} t`,
        result: sh.Vs <= sh.VsMax ? "OK — la sección alcanza" : "Aumentar b o h",
        ok: sh.Vs <= sh.VsMax,
      },
      {
        n: "05",
        title: "Despiece y metrado",
        formula: "n = 1 + ⌈(ℓ − 5)/s⌉    ·    primer estribo a 5 cm",
        substitution: `ℓ zona = ${fmt(sh.Lzona, 2)} m  ·  n apoyo = ${sh.nEnd}  ·  n centro = ${sh.nCentro}`,
        result: `${sh.nTotal} estribos  ·  L unit. ${fmt(sh.Lunit, 1)} cm  ·  ${fmt(sh.peso, 2)} kg`,
        desarrollo: [
          sh.criterioZona,
          `Apoyos: ${sh.arregloApoyo}.  Centro: ${sh.arregloCentro}.`,
          `Total = 2×${sh.nEnd} + ${sh.nCentro} = ${sh.nTotal}.`,
        ],
      },
    ],
    [
      ok("Vu ≤ φ(Vc+Vs máx)", `${fmt(Vu, 2)} t`, `≤ ${fmt(sh.phi * (sh.Vc + sh.VsMax), 2)} t`, sh.sectionOk),
      ok("s ≤ s máx", `${sh.sApoyo} cm`, `≤ ${fmt(sh.sMaxApoyo, 0)} cm`, sh.sApoyo <= sh.sMaxApoyo + 0.1),
      ok("Av/s ≥ Av/s mín", fmt(sh.avs, 3), `≥ ${fmt(sh.avsMin, 3)}`, sh.avs + 1e-9 >= sh.avsMin),
    ],
    [
      {
        title: "Cuadro de estribos",
        rows: [
          ["Zona", "Longitud", "Estribo", "Arreglo", "s", "Cant.", "Peso"],
          ["Apoyo izquierdo", `${fmt(sh.Lzona, 2)} m`, estLabel, sh.arregloApoyo, `${sh.sApoyo} cm`, String(sh.nEnd), `${fmt(pesoParte(sh.peso, sh.nEnd, sh.nTotal), 2)} kg`],
          ["Centro", `${fmt(sh.Lcentro, 2)} m`, estLabel, sh.arregloCentro, `${sh.sCentro} cm`, String(sh.nCentro), `${fmt(pesoParte(sh.peso, sh.nCentro, sh.nTotal), 2)} kg`],
          ["Apoyo derecho", `${fmt(sh.Lzona, 2)} m`, estLabel, sh.arregloApoyo, `${sh.sApoyo} cm`, String(sh.nEnd), `${fmt(pesoParte(sh.peso, sh.nEnd, sh.nTotal), 2)} kg`],
          ["Total", `${fmt(L || 1, 2)} m`, estLabel, sh.arregloPlano, "—", String(sh.nTotal), `${fmt(sh.peso, 2)} kg`],
        ],
      },
    ],
    { sApoyo: String(sh.sApoyo), sCentro: String(sh.sCentro), sAd: String(sh.sApoyo), sMid: String(sh.sCentro), nRamas: String(nRamas), barEst: stirrup.name, arreglo: sh.arregloPlano }
  );
};

/* ───────── Viga doblemente armada ───────── */
export const vigaDoble: Engine = (raw) => {
  const b = num(raw, "b", 35);
  const h = num(raw, "h", 60);
  const rec = num(raw, "rec", 5);
  const fc = num(raw, "fc", 210);
  const fy = num(raw, "fy", 4200);
  const Mu = num(raw, "Mu", 36.54);
  const d = h - rec - 1;
  const dp = rec + 1;
  const b1 = beta1(fc);
  const rhoB = (0.85 * b1 * fc / fy) * (6300 / (6300 + fy));
  const rhoMax = 0.75 * rhoB;
  const As1 = rhoMax * b * d;
  const a1 = (As1 * fy) / (0.85 * fc * b);
  const Mu1 = (0.9 * As1 * fy * (d - a1 / 2)) / 100000;
  const Mr = Math.max(0, Mu - Mu1);
  const As2 = Mr > 0 ? (Mr * 100000) / (0.9 * fy * (d - dp)) : 0;
  const As = As1 + As2;
  const Asp = As2;
  const inf = pickBars(As, ['3/4"', '1"', '5/8"']);
  const sup = Asp > 0.1 ? pickBars(Asp, ['5/8"', '1/2"', '3/4"']) : { text: "No requiere (sección simple)" };
  return out(
    Mr > 0 ? `Doble armadura  As = ${fmt(As, 2)}  A's = ${fmt(Asp, 2)} cm²` : "Basta armadura simple",
    `Inferior: ${inf.text}   ·   Superior: ${sup.text}`,
    [
      {
        n: "01",
        title: "Momento máximo de sección simplemente armada",
        formula: "ρmáx = 0.75 ρb   ·   Mu1 = φ As1 fy (d − a/2)",
        substitution: `ρmáx = ${fmt(rhoMax, 5)}  ·  As1 = ${fmt(As1, 2)} cm²  ·  Mu1 = ${fmt(Mu1, 2)} t·m`,
        result: `Mu1 = ${fmt(Mu1, 2)} t·m`,
      },
      {
        n: "02",
        title: "Momento residual",
        formula: "Mr = Mu − Mu1",
        substitution: `Mr = ${fmt(Mu, 2)} − ${fmt(Mu1, 2)} = ${fmt(Mr, 2)} t·m`,
        result: Mr > 0 ? "Requiere acero de compresión" : "No requiere doble armadura",
        ok: true,
      },
      {
        n: "03",
        title: "Acero de compresión y tracción adicional",
        formula: "A's = Mr / [φ fy (d − d')]",
        substitution: `A's = ${fmt(Mr, 2)}×1e5 / (0.9×${fy}×(${fmt(d, 1)}−${fmt(dp, 1)})) = ${fmt(Asp, 2)} cm²`,
        result: `As = As1+A's = ${fmt(As, 2)} cm²`,
      },
    ],
    [ok("Mu cubierto", `${fmt(Mu, 2)} t·m`, Mr > 0 ? "con doble armadura" : "con As simple", true)]
  );
};

/* ───────── Diseño de columna COL PRO (esbeltez + diagrama P–M) ───────── */
export const columnaEsbeltez: Engine = (raw) => {
  const seccion = str(raw, "seccion", "018");
  const tipo = seccion !== "custom" ? tipoById(seccion) : undefined;
  const cat = seccion !== "custom" ? resolveSection(seccion) ?? colproById(seccion) : undefined;
  const b = cat ? cat.b : num(raw, "b", 30);
  const h = cat ? cat.h : num(raw, "h", 30);
  const steel = cat ? cat.steel : str(raw, "steel", '4 Ø 3/4"');
  const As = cat ? sectionAs(cat) : num(raw, "As", asFromSteel(steel) || 9.68);
  const rec = num(raw, "rec", 4);
  const nBar = tipo ? tipo.nBar : cat ? Math.max(4, nBarsSteel(cat.steel)) : num(raw, "nBar", 4);
  const barName = tipo?.bar ?? str(raw, "bar", steelParts(steel)[0]?.bar ?? '3/4"');
  const Lu = num(raw, "Lu", 345);
  const kfac = num(raw, "k", 1.2);
  const portico = str(raw, "portico", "no");
  const fc = num(raw, "fc", 210);
  const fy = num(raw, "fy", 4200);
  const PCM = num(raw, "PCM", 47.49);
  const PCV = num(raw, "PCV", 9.45);
  const PSDX = num(raw, "PSDX", 0.12);
  const PSDY = num(raw, "PSDY", 0.29);
  const M2CM = num(raw, "M2CM", 0.379);
  const M3CM = num(raw, "M3CM", -0.259);
  const M2CV = num(raw, "M2CV", -0.17);
  const M3CV = num(raw, "M3CV", 0.148);
  const M2SDX = num(raw, "M2SDX", 0.064);
  const M3SDX = num(raw, "M3SDX", 1.132);
  const M2SDY = num(raw, "M2SDY", 0.148);
  const M3SDY = num(raw, "M3SDY", 2.641);

  const destName = str(raw, "dest", '3/8"');
  const destBar = barByName(destName);
  const shape = (tipo?.shape ?? cat?.shape ?? str(raw, "shape", str(raw, "forma", "rect"))) as string;
  const Ag = shape === "circ" ? Math.PI * (b / 2) ** 2 : b * h;
  const Asmin = 0.01 * Ag;
  const prop = proponerAceroColumna(Ag, h / Math.max(b, 1));
  const bajoMin = As + 1e-9 < Asmin;
  const AsUse = bajoMin ? prop.As : As;
  const nBarUse = bajoMin ? prop.n : nBar;
  const steelUse = bajoMin ? prop.text : steel;
  const barNameUse = bajoMin ? prop.name : barName;
  const Ix = shape === "circ" ? (Math.PI * b ** 4) / 64 : (b * h ** 3) / 12;
  const Iy = shape === "circ" ? Ix : (h * b ** 3) / 12;
  const rx = Math.sqrt(Ix / Ag);
  const ry = Math.sqrt(Iy / Ag);
  const Ec = 15000 * Math.sqrt(fc);
  const betaD = PCM / Math.max(PCM + PCV, 1e-6);
  const limK = portico === "arriostrado" ? 34 : 22;
  const luUse = portico === "muro" ? Lu / 2 : Lu;
  const kLurX = (kfac * luUse) / rx;
  const kLurY = (kfac * luUse) / ry;
  const esbX = kLurX > limK;
  const esbY = kLurY > limK;
  const EIx = (0.4 * Ec * Ix) / (1 + betaD);
  const EIy = (0.4 * Ec * Iy) / (1 + betaD);
  const kLu = kfac * luUse;
  const PcX = (Math.PI ** 2 * EIx) / (kLu * kLu) / 1000;
  const PcY = (Math.PI ** 2 * EIy) / (kLu * kLu) / 1000;
  const Po80 = (0.8 * (0.85 * fc * (Ag - AsUse) + fy * AsUse)) / 1000;
  const phi = 0.7;
  const Pnmax = (phi * Po80);
  const rho = AsUse / Ag;
  const okRhoMin = rho + 1e-9 >= 0.01;
  const okRhoMax = rho <= 0.04 + 1e-9;

  type Combo = { name: string; p: number; m2: number; m3: number };
  const grav: Combo = { name: "1.4 CM + 1.7 CV", p: 1.4 * PCM + 1.7 * PCV, m2: 1.4 * M2CM + 1.7 * M2CV, m3: 1.4 * M3CM + 1.7 * M3CV };
  const sisX: Combo[] = [
    { name: "1.25(CM+CV)+SDX", p: 1.25 * (PCM + PCV) + PSDX, m2: 1.25 * (M2CM + M2CV) + M2SDX, m3: 1.25 * (M3CM + M3CV) + M3SDX },
    { name: "1.25(CM+CV)−SDX", p: 1.25 * (PCM + PCV) - PSDX, m2: 1.25 * (M2CM + M2CV) - M2SDX, m3: 1.25 * (M3CM + M3CV) - M3SDX },
    { name: "0.9 CM + SDX", p: 0.9 * PCM + PSDX, m2: 0.9 * M2CM + M2SDX, m3: 0.9 * M3CM + M3SDX },
    { name: "0.9 CM − SDX", p: 0.9 * PCM - PSDX, m2: 0.9 * M2CM - M2SDX, m3: 0.9 * M3CM - M3SDX },
  ];
  const sisY: Combo[] = [
    { name: "1.25(CM+CV)+SDY", p: 1.25 * (PCM + PCV) + PSDY, m2: 1.25 * (M2CM + M2CV) + M2SDY, m3: 1.25 * (M3CM + M3CV) + M3SDY },
    { name: "1.25(CM+CV)−SDY", p: 1.25 * (PCM + PCV) - PSDY, m2: 1.25 * (M2CM + M2CV) - M2SDY, m3: 1.25 * (M3CM + M3CV) - M3SDY },
    { name: "0.9 CM + SDY", p: 0.9 * PCM + PSDY, m2: 0.9 * M2CM + M2SDY, m3: 0.9 * M3CM + M3SDY },
    { name: "0.9 CM − SDY", p: 0.9 * PCM - PSDY, m2: 0.9 * M2CM - M2SDY, m3: 0.9 * M3CM - M3SDY },
  ];
  const all = [grav, ...sisX, ...sisY];
  const PuEnv = Math.max(...all.map((c) => Math.abs(c.p)));
  const delta = (P: number, Pc: number, esb: boolean) => {
    if (!esb) return 1;
    const den = 1 - Math.abs(P) / Math.max(0.75 * Pc, 1e-6);
    if (den <= 0.05) return 2.5;
    return Math.min(2.5, Math.max(1, 1 / den));
  };
  const mag = all.map((c) => {
    const d2 = delta(c.p, PcX, esbX);
    const d3 = delta(c.p, PcY, esbY);
    return { ...c, d2, d3, m2u: c.m2 * d2, m3u: c.m3 * d3 };
  });
  const signed = (
    moment: (c: (typeof mag)[number]) => number,
    sign: 1 | -1,
  ) =>
    mag
      .filter((c) => (sign > 0 ? moment(c) >= -1e-9 : moment(c) <= 1e-9))
      .map((c) => ({ p: c.p, m: Math.abs(moment(c)), name: c.name }));
  const xxPos = signed((c) => c.m3u, 1);
  const xxNeg = signed((c) => c.m3u, -1);
  const yyPos = signed((c) => c.m2u, 1);
  const yyNeg = signed((c) => c.m2u, -1);

  const genPM = generateColumnPM({
    shape,
    b,
    h,
    As: AsUse,
    nBar: nBarUse,
    rec,
    fc,
    fy,
    db: barDb(barNameUse),
    destDb: destBar.db,
  });
  const m3curve = cat && cat.m3.length && !bajoMin ? cat.m3 : genPM.m3.pts;
  const m2curve = cat && cat.m2.length && !bajoMin ? cat.m2 : genPM.m2.pts;
  const chk3 = mag.map((c) => ({ ...c, ...insidePM(m3curve, c.p, c.m3u) }));
  const chk2 = mag.map((c) => ({ ...c, ...insidePM(m2curve, c.p, c.m2u) }));
  const okM3 = chk3.every((c) => c.ok);
  const okM2 = chk2.every((c) => c.ok);
  const okP = PuEnv <= Po80;
  const okPphi = PuEnv <= Pnmax + 0.2;
  const sismicoCol = str(raw, "sismico", "si") !== "no";
  const nRamasIn = num(raw, "nRamas", 0);
  const st = designColumnStirrups({
    b,
    h,
    rec,
    Lu,
    fc,
    fy,
    destName,
    destDb: destBar.db,
    destAs: destBar.as,
    dbLong: barDb(barNameUse),
    nBar: nBarUse,
    nRamas: nRamasIn,
    sismico: sismicoCol,
  });
  return out(
    `${esbX || esbY ? "Esbelta" : "Corta"}  ·  ${b}×${h} cm · ${steelUse}  ·  ${st.destLabel} @ ${st.sConf}/${st.sRest} cm  ·  ρg = ${fmt(rho * 100, 2)} %`,
    `${b}×${h} cm  ·  ${steelUse}  ·  estribos ${st.arregloPlano}  ·  ρg = ${fmt(rho * 100, 2)} % ≥ 1 %`,
    [
      {
        n: "01",
        title: "Geometría de la sección",
        formula: shape === "circ" ? "Ag = π D²/4    I = π D⁴/64" : "Ag = b h    Ix = b h³/12    Iy = h b³/12",
        substitution: shape === "circ" ? `D=${fmt(b, 0)} cm  ·  As=${fmt(AsUse, 2)} cm² (${steelUse})` : `b=${fmt(b, 0)} cm  h=${fmt(h, 0)} cm  ·  As=${fmt(AsUse, 2)} cm² (${steelUse})`,
        result: `Ag = ${fmt(Ag, 0)} cm²`,
        note: `Sección ${b}×${h} cm, ${steelUse}. f'c=${fmt(fc, 0)} kg/cm², fy=${fmt(fy, 0)} kg/cm².`,
      },
      {
        n: "01a",
        title: "Cuantía geométrica mínima — E.060 10.9.1",
        formula: "0.01 ≤ ρg = As/Ag ≤ 0.04    (0.06 solo en el tramo de empalme)",
        substitution: `As,mín = 0.01 × ${fmt(Ag, 0)} = ${fmt(Asmin, 2)} cm²    ·    As ${bajoMin ? "propuesto" : "dado"} = ${fmt(As, 2)} cm² (${steel})`,
        result: bajoMin
          ? `As < 1 % → se adopta ${steelUse} (As = ${fmt(AsUse, 2)} cm², ρg = ${fmt(rho * 100, 2)} %)`
          : `ρg = ${fmt(rho * 100, 2)} %  ·  ${steelUse}`,
        ok: okRhoMin && okRhoMax,
        note: bajoMin
          ? "E.060 no permite menos del 1 % en columna. El diagrama P–M y φPn se recalculan con el acero adoptado."
          : "La cuantía queda en el rango de sección (1 %–4 %). El 6 % solo aplica en el empalme.",
      },
      {
        n: "02",
        title: "Radios de giro y módulo de elasticidad",
        formula: "rx = √(Ix/Ag)    ry = √(Iy/Ag)    Ec = 15 000 √f'c",
        substitution: `Ix=${fmt(Ix, 0)} cm⁴  Iy=${fmt(Iy, 0)} cm⁴`,
        result: `rx=${fmt(rx, 2)} cm  ·  ry=${fmt(ry, 2)} cm  ·  Ec=${fmt(Ec, 0)} kg/cm²`,
      },
      {
        n: "03",
        title: "Relación de carga sostenida βd",
        formula: "βd = PCM / (PCM + PCV)",
        substitution: `βd = ${fmt(PCM, 2)} / (${fmt(PCM, 2)}+${fmt(PCV, 2)})`,
        result: fmt(betaD, 3),
        note: "PCM y PCV se toman en valor absoluto de gravedad (compresión positiva).",
      },
      {
        n: "04",
        title: "Esbeltez E.060",
        formula: `k Lu / r  ≷  ${limK}   (${portico === "arriostrado" ? "pórtico arriostrado" : portico === "muro" ? "muro, Lu/2" : "pórtico no arriostrado"})`,
        substitution: `(kLu/r)x=${fmt(kLurX, 1)}  ·  (kLu/r)y=${fmt(kLurY, 1)}  ·  Lu=${fmt(luUse, 0)} cm  k=${fmt(kfac, 2)}`,
        result: `${esbX ? "Esbelta" : "No esbelta"} en x  ·  ${esbY ? "Esbelta" : "No esbelta"} en y`,
        note: "Si esbelta se magnifica el momento con δns = 1 / [1 − Pu/(0.75 Pc)].",
      },
      {
        n: "05",
        title: "Rigidez efectiva EI",
        formula: "EI = 0.4 Ec Ig / (1+βd)",
        substitution: `1+βd = ${fmt(1 + betaD, 3)}`,
        result: `EIx=${fmt(EIx, 0)} kg·cm²  ·  EIy=${fmt(EIy, 0)} kg·cm²`,
      },
      {
        n: "06",
        title: "Carga crítica de pandeo Pc",
        formula: "Pc = π² EI / (k Lu)²",
        substitution: `(k Lu) = ${fmt(kLu, 0)} cm`,
        result: `Pcx=${fmt(PcX, 1)} t  ·  Pcy=${fmt(PcY, 1)} t`,
      },
      {
        n: "07",
        title: "Compresión pura — E.060",
        formula: "Pu / {0.80 [0.85 f'c (Ag−As) + fy As]}  <  1",
        substitution: `Pu,env=${fmt(PuEnv, 2)} t  ·  0.80 Po=${fmt(Po80, 2)} t  ·  φPn,máx=0.80φ Po=${fmt(Pnmax, 2)} t (φ=0.70)`,
        result: `${fmt(PuEnv / Po80, 3)} < 1`,
        ok: okP,
        note: "El tope del diagrama de interacción incluye φ = 0.70 (compresión).",
      },
      {
        n: "08",
        title: "Combinaciones de carga E.060",
        formula: "1.4CM+1.7CV  ·  1.25(CM+CV)±S  ·  0.9CM±S",
        substitution: `CM: P=${fmt(PCM, 2)} t  CV: P=${fmt(PCV, 2)} t  SDX: P=${fmt(PSDX, 2)} t  SDY: P=${fmt(PSDY, 2)} t`,
        result: `${all.length} combinaciones  ·  Pu,máx=${fmt(PuEnv, 2)} t`,
        note: "Los momentos se amplifican con δ si la columna es esbelta en ese sentido (E.060).",
      },
      {
        n: "09",
        title: "Diagrama de interacción φPn–φMn",
        formula: "El par (Pu, Mu,δ) debe quedar dentro de la envolvente 0° (M3) y 90° (M2)",
        substitution: cat && !bajoMin
          ? `Envolvente φPn–φMn para ${b}×${h} cm con ${steelUse} (f'c = ${fmt(fc, 0)} kg/cm²).`
          : "Curva generada con bloque rectangular de Whitney, φ=0.70 a 0.90.",
        result: okM3 && okM2 ? "Todos los puntos dentro" : "Hay puntos fuera — revisar sección o acero",
        ok: okM3 && okM2,
        note: "La curva de interacción corresponde a la sección y al acero adoptados, con φ variable según el tipo de falla.",
      },
      {
        n: "10",
        title: "Diámetro y ramas del estribo — E.060 7.10.5 / 21.4.4",
        formula: "Øest ≥ máx(db long / 4, 3/8\")    ·    hx ≤ 35 cm o se añaden ganchos",
        substitution: `db long = ${fmt(barDb(barNameUse), 2)} cm  →  Øest mín = ${fmt(st.destMin, 2)} cm  ·  hx = ${fmt(st.hx, 1)} cm`,
        result: `${st.destLabel}${st.destOk ? "  ·  cumple" : "  ·  aumentar Ø"}${st.needCrosstie ? "  ·  con ganchos suplementarios" : ""}`,
        ok: st.destOk,
        desarrollo: [
          `Øest mín = máx(${fmt(barDb(barNameUse), 2)}/4, 0.95) = ${fmt(st.destMin, 2)} cm. Se usa Ø ${destName}.`,
          `hx = núcleo / (n ramas/2) = ${fmt(st.hx, 1)} cm. ${st.needCrosstie ? "hx > 35 cm o n ≥ 8: se cierran 4 ramas (estribo + crosstie)." : "hx ≤ 35 cm: basta estribo cerrado de 2 ramas."}`,
          "Ganchos de 135° con extensión ≥ 6 db y ≥ 7.5 cm (E.060 21.1).",
        ],
      },
      {
        n: "11",
        title: "Longitud de zona confinada ℓo — E.060 21.4.4.4",
        formula: "ℓo ≥ máx(h, b, Lu/6, 45 cm)",
        substitution: `máx(${fmt(h, 0)}, ${fmt(b, 0)}, ${fmt(Lu, 0)}/6 = ${fmt(Lu / 6, 1)}, 45) = ${fmt(st.lo, 1)} cm`,
        result: `ℓo = ${fmt(st.lo, 1)} cm c/extremo    ·    tramo central = ${fmt(st.Lrest, 1)} cm`,
        desarrollo: [
          `Lu = ${fmt(Lu, 0)} cm (luz libre). ℓo gobierna el mayor de: peralte, lado, Lu/6 y 45 cm.`,
          "El primer estribo va a 5 cm de la cara del nudo (viga o losa).",
          st.Lrest > 0
            ? `Fuera de ℓo el s máx sísmico es mín(6 db, 15 cm) = ${fmt(st.sMaxRest, 1)} cm.`
            : "2ℓo cubre toda la altura: la columna se confina de nudo a nudo.",
        ],
        note: sismicoCol
          ? "Pórtico especial: el núcleo se cierra en ambos extremos de cada piso."
          : "Sin sismo: s ≤ mín(16 db, 48 Øest, menor lado) en toda la altura.",
      },
      {
        n: "12",
        title: "Ash de confinamiento — E.060 21.4.4.1",
        formula: "Ash ≥ 0.09 s hc f'c/fy    y    Ash ≥ 0.3 s hc (Ag/Ach − 1) f'c/fy",
        substitution: `hc = ${fmt(st.hc, 1)} cm  ·  Ash = ${st.nRamas}×${fmt(destBar.as, 2)} = ${fmt(st.Ash, 2)} cm²  ·  so = ${fmt(st.so, 1)} cm`,
        result: `${st.destLabel} @ ${st.sConf} cm (ℓo)  /  @ ${st.sRest} cm (resto)`,
        ok: st.ashOk,
        desarrollo: [
          `hc = b − 2 rec − Øest = ${fmt(b, 0)} − 2×${fmt(rec, 1)} − ${fmt(destBar.db, 2)} = ${fmt(st.hc, 1)} cm.  Ach = ${fmt(st.Ach, 0)} cm².`,
          `Ash/s (0.09) = 0.09×${fmt(st.hc, 1)}×${fmt(fc, 0)}/${fmt(fy, 0)} = ${fmt(st.avs1, 4)} cm²/cm.`,
          `Ash/s (0.30) = 0.30×${fmt(st.hc, 1)}×(${fmt(st.Ag, 0)}/${fmt(st.Ach, 0)} − 1)×${fmt(fc, 0)}/${fmt(fy, 0)} = ${fmt(st.avs2, 4)} cm²/cm.`,
          `s de Ash = ${fmt(st.Ash, 2)} / ${fmt(st.avsReq, 4)} = ${fmt(st.sFromAsh, 1)} cm.`,
          `s máx ℓo = mín(lado/4, 6 db, so) = ${fmt(st.sMaxConf, 1)} cm, con so = 10+(35−hx)/3 = ${fmt(st.so, 1)} cm (7.5 ≤ so ≤ 10).`,
          `Se adopta s = ${st.sConf} cm en extremos y s = ${st.sRest} cm en el resto.`,
        ],
      },
      {
        n: "13",
        title: "Despiece y metrado de estribos",
        formula: "n = 1 + ⌈(ℓo − 5)/s⌉    ·    primer estribo a 5 cm del nudo",
        substitution: `n extremo = ${st.nConf}    ·    n resto = ${st.nRest}    ·    L unit. = ${fmt(st.Lunit, 1)} cm`,
        result: `${st.arregloPlano}    ·    ${st.nTotal} estribos    ·    ${fmt(st.peso, 2)} kg`,
        desarrollo: [
          `Cada extremo: ${st.arregloConf}.  Centro: ${st.arregloRest}.`,
          `Total = 2×${st.nConf} + ${st.nRest} = ${st.nTotal}.`,
          `L unitaria = 2(b′+h′) + 2 ganchos 135° = ${fmt(st.Lunit, 1)} cm.`,
          `Peso = ${st.nTotal} × ${fmt(st.Lunit / 100, 3)} × ${fmt(destBar.as * 0.785, 3)} = ${fmt(st.peso, 2)} kg.`,
        ],
        note: "Notación de plano: 1 @ 0.05, n @ s_conf, resto @ s_resto.",
      },
    ],
    [
      ok("Cuantía ρg ≥ 1 %", `${fmt(rho * 100, 2)} %`, "≥ 1.00 %", okRhoMin),
      ok("Cuantía ρg ≤ 4 %", `${fmt(rho * 100, 2)} %`, "≤ 4.00 %", okRhoMax),
      ok("Pu ≤ 0.80 Po", `${fmt(PuEnv, 1)} t`, `≤ ${fmt(Po80, 1)} t`, okP),
      ok("Pu ≤ φPn,máx", `${fmt(PuEnv, 1)} t`, `≤ ${fmt(Pnmax, 1)} t`, okPphi),
      ok("Puntos M3 (0°) dentro", okM3 ? "OK" : "fuera", "diagrama φP–φM", okM3),
      ok("Puntos M2 (90°) dentro", okM2 ? "OK" : "fuera", "diagrama φP–φM", okM2),
      ok("Esbeltez x", fmt(kLurX, 1), esbX ? `> ${limK} → amplificar δ` : `≤ ${limK}`, true),
      ok("Esbeltez y", fmt(kLurY, 1), esbY ? `> ${limK} → amplificar δ` : `≤ ${limK}`, true),
      ok("Øest ≥ máx(db/4, 3/8\")", destName, `≥ ${fmt(st.destMin, 2)} cm`, st.destOk),
      ok("Ash/s ≥ Ash/s req", fmt(st.Ash / Math.max(st.sConf, 1), 3), `≥ ${fmt(st.avsReq, 3)}`, st.ashOk),
      ok("s extremo ≤ s máx", `${st.sConf} cm`, `≤ ${fmt(st.sMaxConf, 1)} cm`, st.sConf <= st.sMaxConf + 0.1),
    ],
    [
      {
        title: "6. Combinaciones y momentos magnificados",
        rows: [
          ["Combo", "P (t)", "M2", "M3", "δ2", "δ3", "M2,u", "M3,u"],
          ...mag.map((c) => [
            c.name,
            fmt(c.p, 2),
            fmt(c.m2, 2),
            fmt(c.m3, 2),
            fmt(c.d2, 3),
            fmt(c.d3, 3),
            fmt(c.m2u, 2),
            fmt(c.m3u, 2),
          ]),
        ],
      },
      {
        title: "7. Diagrama de interacción — M3 (0° y 180°)",
        rows: fmtPtsTable(m3curve),
      },
      {
        title: "8. Diagrama de interacción — M2 (90° y 270°)",
        rows: fmtPtsTable(m2curve),
      },
      {
        title: "Cuadro de estribos de columna",
        rows: [
          ["Zona", "Longitud", "Estribo", "Arreglo", "s", "Cant.", "L unit.", "Peso"],
          ["Extremo inferior", `${fmt(st.lo / 100, 2)} m`, st.destLabel, st.arregloConf, `${st.sConf} cm`, String(st.nConf), `${fmt(st.Lunit, 1)} cm`, `${fmt(pesoParte(st.peso, st.nConf, st.nTotal), 2)} kg`],
          ["Tramo central", `${fmt(st.Lrest / 100, 2)} m`, st.destLabel, st.arregloRest, `${st.sRest} cm`, String(st.nRest), `${fmt(st.Lunit, 1)} cm`, `${fmt(pesoParte(st.peso, st.nRest, st.nTotal), 2)} kg`],
          ["Extremo superior", `${fmt(st.lo / 100, 2)} m`, st.destLabel, st.arregloConf, `${st.sConf} cm`, String(st.nConf), `${fmt(st.Lunit, 1)} cm`, `${fmt(pesoParte(st.peso, st.nConf, st.nTotal), 2)} kg`],
          ["Total", `${fmt(Lu / 100, 2)} m`, st.destLabel, st.arregloPlano, "—", String(st.nTotal), "—", `${fmt(st.peso, 2)} kg`],
        ],
      },
    ],
    {
      b: String(b),
      h: String(h),
      As: String(AsUse),
      nBar: String(nBarUse),
      bar: barNameUse,
      shape: cat?.shape ?? str(raw, "forma", "rect"),
      steel: steelUse,
      barEst: destName,
      dest: String(destBar.db),
      sConf: String(st.sConf),
      sRest: String(st.sRest),
      lo: String(st.lo),
      Lu: String(Lu),
      nRamas: String(st.nRamas),
      arreglo: st.arregloPlano,
      pm3: encodePts(m3curve),
      pm2: encodePts(m2curve),
      dem3p: encodeDemands(xxPos),
      dem3n: encodeDemands(xxNeg),
      dem2p: encodeDemands(yyPos),
      dem2n: encodeDemands(yyNeg),
    }
  );
};

/* ───────── Zapata aislada ───────── */
function round05(x: number) {
  return Math.ceil(x * 20 - 1e-9) / 20;
}

export const zapataAislada: Engine = (raw) => {
  const t1 = num(raw, "t1", 0.4);
  const t2 = num(raw, "t2", 0.4);
  const PD = num(raw, "PD", 80);
  const PL = num(raw, "PL", 30);
  const FX = num(raw, "FX", 0);
  const FY = num(raw, "FY", 0);
  const FZin = num(raw, "FZ", 0);
  const M1 = num(raw, "M1", 0);
  const M2 = num(raw, "M2", 0);
  const M3 = num(raw, "M3", 0);
  const qadm = num(raw, "qadm", 2.0);
  const Df = num(raw, "Df", 1.5);
  const gt = num(raw, "gt", 1.8);
  const hf = num(raw, "hf", 0.5);
  const sc = num(raw, "sc", 0.3);
  const fc = num(raw, "fc", 210);
  const fy = num(raw, "fy", 4200);
  const rec = num(raw, "rec", 7.5);
  const gravZ = PD + PL;
  const FZ = FZin > 0 ? FZin : gravZ;
  const Pserv = Math.max(FZ, 0.1);
  const qn = qadm * 10 - gt * Df - 2.4 * hf - sc;
  const M2c = M2 + FY * hf;
  const M3c = M3 + FX * hf;
  const Hxy = Math.hypot(FX, FY);

  let B = round05(Math.max(t1 + 0.8, Math.sqrt(Pserv / Math.max(qn, 0.4))));
  let L = round05(Math.max(t2 + 0.8, B + (t2 - t1)));
  let ex = 0;
  let ey = 0;
  let qmax = 0;
  let qmin = 0;
  for (let i = 0; i < 80; i++) {
    ex = M3c / Pserv;
    ey = M2c / Pserv;
    if (Math.abs(ex) > L / 6 - 0.005) L = round05(Math.abs(ex) * 6.2 + 0.2);
    if (Math.abs(ey) > B / 6 - 0.005) B = round05(Math.abs(ey) * 6.2 + 0.2);
    B = Math.max(B, round05(t1 + 0.8));
    L = Math.max(L, round05(t2 + 0.8));
    const lvB = (B - t1) / 2;
    const lvL = (L - t2) / 2;
    if (lvL + 0.02 < lvB) L = round05(t2 + 2 * lvB);
    if (lvB + 0.02 < lvL) B = round05(t1 + 2 * lvL);
    const k = 1 + (6 * Math.abs(ex)) / L + (6 * Math.abs(ey)) / B;
    const kn = 1 - (6 * Math.abs(ex)) / L - (6 * Math.abs(ey)) / B;
    qmax = (Pserv / (B * L)) * k;
    qmin = (Pserv / (B * L)) * kn;
    if (qmax <= qn + 1e-6 && qmin >= -0.01) break;
    B = round05(B + 0.05);
    L = round05(L + 0.05);
  }

  const lvX = (L - t2) / 2;
  const lvY = (B - t1) / 2;
  const inKern = Math.abs(ex) <= L / 6 + 1e-6 && Math.abs(ey) <= B / 6 + 1e-6;
  const q11 = (Pserv / (B * L)) * (1 + (6 * ex) / L + (6 * ey) / B);
  const q12 = (Pserv / (B * L)) * (1 + (6 * ex) / L - (6 * ey) / B);
  const q21 = (Pserv / (B * L)) * (1 - (6 * ex) / L + (6 * ey) / B);
  const q22 = (Pserv / (B * L)) * (1 - (6 * ex) / L - (6 * ey) / B);
  const mu = 0.45;
  const Rdesl = mu * Pserv;
  const FSdesl = Hxy < 0.01 ? 99 : Rdesl / Hxy;
  const MrX = Pserv * (L / 2);
  const MrY = Pserv * (B / 2);
  const FSotX = Math.abs(M3c) < 0.01 ? 99 : MrX / Math.abs(M3c);
  const FSotY = Math.abs(M2c) < 0.01 ? 99 : MrY / Math.abs(M2c);

  const Pu = 1.4 * PD + 1.7 * PL;
  const lam = Pu / Pserv;
  const Vux = lam * FX;
  const Vuy = lam * FY;
  const Mux = lam * M2c;
  const Muy = lam * M3c;
  const Tu = lam * M1;
  const qu = Pu / (B * L);
  const quMax = qu * (qmax / (Pserv / (B * L)));
  const hNeed = Math.max(0.4, Math.max(lvX, lvY) / 2);
  const hAd = Math.max(hf, round05(hNeed));
  const d = hAd * 100 - rec;
  const MuL = (quMax * B * lvX * lvX) / 2;
  const MuB = (quMax * L * lvY * lvY) / 2;
  const AsL = (MuL * 100000) / (0.9 * fy * 0.9 * d);
  const AsB = (MuB * 100000) / (0.9 * fy * 0.9 * d);
  const Asmin = 0.0018 * 100 * hAd * 100;
  const AsUse = Math.max(AsL, AsB, Asmin);
  const sBar = spacingFor(AsUse, 1.29, 100);
  const b0 = 2 * ((t1 * 100 + d) + (t2 * 100 + d));
  const VuPunz = Pu * (1 - ((t1 * 100 + d) * (t2 * 100 + d)) / (B * 100 * L * 100));
  const phiVc = (0.85 * 1.06 * Math.sqrt(Math.max(fc, 1)) * b0 * d) / 1000;
  const bShear = B * 100;
  const Vu1 = qu * B * Math.max(0, lvX * 100 - d) / 100;
  const phiVc1 = (0.85 * 0.53 * Math.sqrt(Math.max(fc, 1)) * bShear * d) / 1000;

  const fzNota = FZin > 0 ? "FZ de análisis (envelope)." : "FZ = PD + PL (no se ingresó axial de análisis).";

  return out(
    `Zapata ${fmt(B, 2)} × ${fmt(L, 2)} × ${fmt(hAd, 2)} m`,
    `Ø 1/2" @ ${sBar} cm ambas direcciones  ·  As = ${fmt(AsUse, 2)} cm²/m`,
    [
      {
        n: "01",
        title: "Solicitación en la base — 6 GDL",
        formula: "FX, FY, FZ, M1, M2, M3   (servicio, copiados del análisis)",
        substitution: `FX=${fmt(FX, 2)} t   FY=${fmt(FY, 2)} t   FZ=${fmt(FZ, 2)} t   ·   M1=${fmt(M1, 2)}   M2=${fmt(M2, 2)}   M3=${fmt(M3, 2)} t·m`,
        result: `P = FZ = ${fmt(Pserv, 2)} t`,
        note: `Convenio: X,Y horizontales; Z axial (compresión +). M1 = torsión (eje Z). M2 flexiona alrededor de X (ey = M2/P). M3 flexiona alrededor de Y (ex = M3/P). Gravedad: PD=${fmt(PD, 1)} t, PL=${fmt(PL, 1)} t. ${fzNota}`,
      },
      {
        n: "02",
        title: "Traslado al plano de contacto zapata–suelo",
        formula: "M2c = M2 + FY·h    ·    M3c = M3 + FX·h",
        substitution: `h = ${fmt(hf, 2)} m  →  M2c = ${fmt(M2, 2)} + ${fmt(FY, 2)}×${fmt(hf, 2)} = ${fmt(M2c, 2)}   ·   M3c = ${fmt(M3, 2)} + ${fmt(FX, 2)}×${fmt(hf, 2)} = ${fmt(M3c, 2)} t·m`,
        result: `M2c = ${fmt(M2c, 2)} t·m    M3c = ${fmt(M3c, 2)} t·m`,
        note: "El corte horizontal, aplicado en la cara superior, genera un par adicional hf·V en el contacto. M1 no altera las presiones verticales.",
      },
      {
        n: "03",
        title: "Esfuerzo neto del terreno",
        formula: "σn = σadm − γt Df − γc h − s/c",
        substitution: `σn = ${fmt(qadm * 10, 2)} − ${fmt(gt, 2)}×${fmt(Df, 2)} − 2.4×${fmt(hf, 2)} − ${fmt(sc, 2)}`,
        result: `${fmt(qn, 2)} t/m²`,
        note: "σadm se ingresa en kg/cm² (×10 = t/m²). Se descuenta el peso del relleno, de la zapata (γc = 2.4 t/m³) y la sobrecarga de piso.",
      },
      {
        n: "04",
        title: "Excentricidades y núcleo central",
        formula: "ex = M3c / P    ·    ey = M2c / P    ·    núcleo: |e| ≤ lado/6",
        substitution: `ex = ${fmt(M3c, 2)}/${fmt(Pserv, 2)} = ${fmt(ex, 3)} m    ·    ey = ${fmt(M2c, 2)}/${fmt(Pserv, 2)} = ${fmt(ey, 3)} m`,
        result: `|ex| ${inKern ? "≤" : ">"} L/6 = ${fmt(L / 6, 3)} m    ·    |ey| ${inKern ? "≤" : ">"} B/6 = ${fmt(B / 6, 3)} m`,
        note: inKern
          ? "La resultante cae dentro del núcleo: el diagrama de presiones cubre toda el área (qmín ≥ 0)."
          : "Fuera del núcleo habría tracción en el suelo. Se agrandó B y L hasta reingresar al tercio medio.",
        ok: inKern,
      },
      {
        n: "05",
        title: "Dimensionamiento en planta",
        formula: "B×L de vuelos iguales, creciendo hasta qmáx ≤ σn y e en el núcleo",
        substitution: `P/σn = ${fmt(Pserv / Math.max(qn, 0.3), 2)} m²  →  se itera con 6e/lado`,
        result: `B = ${fmt(B, 2)} m (eje Y)    L = ${fmt(L, 2)} m (eje X)`,
        note: `Vuelos: ℓv,X = (L−t2)/2 = ${fmt(lvX, 2)} m    ℓv,Y = (B−t1)/2 = ${fmt(lvY, 2)} m. Columna ${fmt(t1, 2)}×${fmt(t2, 2)} m centrada.`,
      },
      {
        n: "06",
        title: "Presiones en las cuatro esquinas",
        formula: "q = P/(B L) · [1 ± 6ex/L ± 6ey/B]",
        substitution: `P/(BL) = ${fmt(Pserv / (B * L), 3)} t/m²    6ex/L = ${fmt((6 * ex) / L, 3)}    6ey/B = ${fmt((6 * ey) / B, 3)}`,
        result: `qmáx = ${fmt(qmax, 2)} t/m²    qmín = ${fmt(qmin, 2)} t/m²`,
        note: `Esquinas (X,Y): q(++)${fmt(q11, 2)}  q(+−)${fmt(q12, 2)}  q(−+)${fmt(q21, 2)}  q(−−)${fmt(q22, 2)} t/m². Límite de suelo: σn = ${fmt(qn, 2)} t/m².`,
      },
      {
        n: "07",
        title: "Deslizamiento en el plano XY",
        formula: "H = √(FX²+FY²)    ·    R = μ P    ·    FS = R/H ≥ 1.5",
        substitution: `H = √(${fmt(FX, 2)}²+${fmt(FY, 2)}²) = ${fmt(Hxy, 2)} t    ·    μ = 0.45    R = ${fmt(Rdesl, 2)} t`,
        result: Hxy < 0.01 ? "Sin corte horizontal — no gobierna" : `FS deslizamiento = ${fmt(FSdesl, 2)}`,
        note: "μ = 0.45 es fricción concreto–suelo de gravas/arenas densas, sin empuje pasivo. Si H = 0 el chequeo queda documentado y no gobierna.",
        ok: Hxy < 0.01 || FSdesl >= 1.5,
      },
      {
        n: "08",
        title: "Volcamiento",
        formula: "FS = (P · lado/2) / |Mc|  ≥  1.5",
        substitution: `FSx = ${fmt(Pserv, 2)}×${fmt(L / 2, 2)} / ${fmt(Math.abs(M3c), 2)}    ·    FSy = ${fmt(Pserv, 2)}×${fmt(B / 2, 2)} / ${fmt(Math.abs(M2c), 2)}`,
        result: `FS,X = ${FSotX > 20 ? ">20" : fmt(FSotX, 2)}    ·    FS,Y = ${FSotY > 20 ? ">20" : fmt(FSotY, 2)}`,
        note: "Estabilizante: peso vertical por el brazo al borde de vuelco. Volcante: momento ya trasladado al contacto (M2c, M3c).",
        ok: FSotX >= 1.5 && FSotY >= 1.5,
      },
      {
        n: "09",
        title: "Torsión M1",
        formula: "T = M1    (eje Z; no produce σ vertical)",
        substitution: `M1 = ${fmt(M1, 2)} t·m    ·    Tu = λ M1 = ${fmt(Tu, 2)} t·m`,
        result: Math.abs(M1) < 0.05 ? "M1 nulo — no interviene" : `Tu = ${fmt(Tu, 2)} t·m (se informa; no dimensiona B×L)`,
        note: "La torsión no entra al diagrama q(x,y). En zapata aislada compacta suele ser residual. Si |M1| es alto, conviene zapata con viga de atado o muro de corte.",
      },
      {
        n: "10",
        title: "Combinación última E.060 / ACI (gravedad)",
        formula: "Pu = 1.4 PD + 1.7 PL    ·    λ = Pu/P    ·    Vu = λ V    Mu = λ Mc",
        substitution: `Pu = 1.4×${fmt(PD, 1)} + 1.7×${fmt(PL, 1)} = ${fmt(Pu, 2)} t    ·    λ = ${fmt(lam, 3)}`,
        result: `Vux=${fmt(Vux, 2)} t  Vuy=${fmt(Vuy, 2)} t  ·  Mux=${fmt(Mux, 2)}  Muy=${fmt(Muy, 2)} t·m`,
        note: "PD y PL son la gravedad en Z. λ majora proporcionalmente cortes y momentos de servicio para el diseño de concreto, coherente con un envelope de análisis.",
      },
      {
        n: "11",
        title: "Peralte por vuelo y d efectivo",
        formula: "h ≥ ℓv / 2    y    h ≥ 40 cm    ·    d = h − r",
        substitution: `ℓv,máx = ${fmt(Math.max(lvX, lvY), 2)} m  →  h ≥ ${fmt(hNeed, 2)} m    ·    r = ${fmt(rec, 1)} cm`,
        result: `h = ${fmt(hAd, 2)} m    ·    d = ${fmt(d, 1)} cm`,
      },
      {
        n: "12",
        title: "Punzonamiento (ACI 15.5 / E.060)",
        formula: "b0 = 2[(t1+d)+(t2+d)]    ·    φVc = 0.85·1.06√f'c b0 d",
        substitution: `b0 = ${fmt(b0, 0)} cm    ·    Vu = Pu[1−(c1+d)(c2+d)/(B L)] = ${fmt(VuPunz, 2)} t`,
        result: `Vu = ${fmt(VuPunz, 2)} t    ≤    φVc = ${fmt(phiVc, 2)} t`,
        ok: VuPunz <= phiVc,
      },
      {
        n: "13",
        title: "Corte en una dirección (sección a d de la cara)",
        formula: "Vu,1 = qu B (ℓv − d)    ·    φVc = 0.85·0.53√f'c b d",
        substitution: `ℓv,X − d = ${fmt(Math.max(0, lvX - d / 100), 2)} m    ·    b = ${fmt(B, 2)} m`,
        result: `Vu,1 = ${fmt(Vu1, 2)} t    ≤    φVc = ${fmt(phiVc1, 2)} t`,
        ok: Vu1 <= phiVc1,
      },
      {
        n: "14",
        title: "Momento en la cara de columna (ACI 15.4)",
        formula: "Mu = qmáx,u · lado · ℓv² / 2",
        substitution: `qu,máx = ${fmt(quMax, 2)} t/m²    ·    Mu,L = ${fmt(MuL, 2)}    Mu,B = ${fmt(MuB, 2)} t·m/m`,
        result: `Mu,gob = ${fmt(Math.max(MuL, MuB), 2)} t·m/m`,
        desarrollo: [
          `qu,máx = qu · (qmáx/qmedio) = ${fmt(qu, 2)} · ${fmt(qmax / Math.max(Pserv / (B * L), 0.01), 3)} = ${fmt(quMax, 2)} t/m².`,
          `Vuelo X: ℓv,X = (L−t2)/2 = ${fmt(lvX, 2)} m.  Mu,L = ${fmt(quMax, 2)} · ${fmt(B, 2)} · ${fmt(lvX, 2)}² / 2 = ${fmt(MuL, 2)} t·m.`,
          `Vuelo Y: ℓv,Y = (B−t1)/2 = ${fmt(lvY, 2)} m.  Mu,B = ${fmt(quMax, 2)} · ${fmt(L, 2)} · ${fmt(lvY, 2)}² / 2 = ${fmt(MuB, 2)} t·m.`,
          `El diagrama de cada voladizo es parabólico: M(x) = qu,máx · lado · x² / 2, con M = 0 en el borde libre y Mu en la cara de columna.`,
        ],
        note: "Se usa la presión última amplificada por la misma forma del diagrama de servicio (qmáx/qmedio), del lado seguro.",
      },
      {
        n: "15",
        title: "Acero por flexión y temperatura",
        formula: "As = Mu/(φ fy jd)    ·    Asmín = 0.0018 b h",
        substitution: `As,L = ${fmt(AsL, 2)}    As,B = ${fmt(AsB, 2)}    Asmín = ${fmt(Asmin, 2)} cm²/m`,
        result: `Usar Ø 1/2" @ ${sBar} cm ambas direcciones    ·    As = ${fmt(AsUse, 2)} cm²/m`,
        desarrollo: [
          `φ = 0,90  ·  j ≈ 0,90  ·  d = ${fmt(d, 1)} cm  ·  fy = ${fmt(fy, 0)} kg/cm².`,
          `As,L = ${fmt(MuL, 2)} × 100 000 / (0,90 × ${fmt(fy, 0)} × 0,90 × ${fmt(d, 1)}) = ${fmt(AsL, 2)} cm²/m.`,
          `As,B = ${fmt(MuB, 2)} × 100 000 / (0,90 × ${fmt(fy, 0)} × 0,90 × ${fmt(d, 1)}) = ${fmt(AsB, 2)} cm²/m.`,
          `Asmín = 0,0018 × 100 × ${fmt(hAd * 100, 0)} = ${fmt(Asmin, 2)} cm²/m (temperatura / retracción de zapata).`,
          `Se adopta As = máx(As,L, As,B, Asmín) = ${fmt(AsUse, 2)} cm²/m → Ø 1/2" (1,29 cm²) @ ${sBar} cm en ambas direcciones, cara del suelo.`,
        ],
        note: "Malla inferior en las dos direcciones. El recubrimiento de 7.5 cm es el de zapatas contra terreno (E.060).",
      },
    ],
    [
      ok("qmáx ≤ σn", `${fmt(qmax, 2)} t/m²`, `≤ ${fmt(qn, 2)} t/m²`, qmax <= qn + 0.02 && qn > 0),
      ok("qmín ≥ 0 (núcleo)", `${fmt(qmin, 2)} t/m²`, "≥ 0", qmin >= -0.02 && inKern),
      ok("Deslizamiento FS ≥ 1.5", Hxy < 0.01 ? "N/A" : fmt(FSdesl, 2), "≥ 1.5", Hxy < 0.01 || FSdesl >= 1.5),
      ok("Volcamiento FS ≥ 1.5", `${FSotX > 20 ? ">20" : fmt(FSotX, 2)} / ${FSotY > 20 ? ">20" : fmt(FSotY, 2)}`, "≥ 1.5", FSotX >= 1.5 && FSotY >= 1.5),
      ok("Punzonamiento Vu ≤ φVc", `${fmt(VuPunz, 2)} t`, `${fmt(phiVc, 2)} t`, VuPunz <= phiVc),
      ok("Corte 1 dir. Vu ≤ φVc", `${fmt(Vu1, 2)} t`, `${fmt(phiVc1, 2)} t`, Vu1 <= phiVc1),
      ok("h ≥ 40 cm", `${fmt(hAd * 100, 0)} cm`, "≥ 40 cm", hAd >= 0.4),
      ok("σn > 0", `${fmt(qn, 2)} t/m²`, "> 0", qn > 0),
    ],
    [
      {
        title: "Solicitación en la base (6 GDL)",
        rows: [
          ["Componente", "Símbolo", "Servicio", "Último (λ)", "Unidad", "Efecto en la zapata"],
          ["Fuerza X", "FX", fmt(FX, 2), fmt(Vux, 2), "t", "Corte + par hf·FX en M3c"],
          ["Fuerza Y", "FY", fmt(FY, 2), fmt(Vuy, 2), "t", "Corte + par hf·FY en M2c"],
          ["Fuerza Z (axial)", "FZ", fmt(FZ, 2), fmt(Pu, 2), "t", "Presión media P/(B L)"],
          ["Momento 1 (torsión)", "M1", fmt(M1, 2), fmt(Tu, 2), "t·m", "No entra a q(x,y)"],
          ["Momento 2 (eje X)", "M2", fmt(M2, 2), fmt(Mux, 2), "t·m", "ey = M2c/P"],
          ["Momento 3 (eje Y)", "M3", fmt(M3, 2), fmt(Muy, 2), "t·m", "ex = M3c/P"],
        ],
      },
      {
        title: "Presiones de servicio en esquinas",
        rows: [
          ["Esquina", "X", "Y", "q (t/m²)"],
          ["(+,+)", "+L/2", "+B/2", fmt(q11, 3)],
          ["(+,-)", "+L/2", "−B/2", fmt(q12, 3)],
          ["(-,+)", "−L/2", "+B/2", fmt(q21, 3)],
          ["(-,-)", "−L/2", "−B/2", fmt(q22, 3)],
          ["Máxima", "—", "—", fmt(qmax, 3)],
          ["Mínima", "—", "—", fmt(qmin, 3)],
          ["σn admisible", "—", "—", fmt(qn, 3)],
        ],
      },
    ],
    {
      B: B.toFixed(2),
      L: L.toFixed(2),
      hAd: hAd.toFixed(2),
      ex: ex.toFixed(3),
      ey: ey.toFixed(3),
      FZ: Pserv.toFixed(2),
      FX: FX.toFixed(2),
      FY: FY.toFixed(2),
      lvX: lvX.toFixed(3),
      lvY: lvY.toFixed(3),
      MuL: MuL.toFixed(3),
      MuB: MuB.toFixed(3),
      AsL: AsL.toFixed(2),
      AsB: AsB.toFixed(2),
      asL: `Ø 1/2" @ ${sBar} cm`,
      asB: `Ø 1/2" @ ${sBar} cm`,
    }
  );
};

/* ───────── Escalera 2 tramos ───────── */
function pasosTramo(m: ReturnType<typeof calcularEscalera>, t: EscaleraTramo, nCarga: string, nAcero: string) {
  const inclinado = t.id !== "D";
  return [
    {
      n: nCarga,
      title: `${t.label} — luces, cargas y momentos`,
      formula: inclinado
        ? "α = atan(H/L)   ·   Li = √(Lh²+H²)   ·   g_losa = γ e / cosα   ·   g_grada = γ c/2   ·   wu = 1.4 CM + 1.7 CV   ·   Mu⁺ = wu Lh²/8   ·   Mu⁻ = wu Lh²/10"
        : "Losa horizontal   ·   g = γ e   ·   wu = 1.4(γe+acab)+1.7 CV   ·   Mu⁺ = wu a²/8   ·   Mu⁻ = wu a²/12",
      substitution: inclinado
        ? `n = ${t.nC} contrapasos  ·  H = ${fmt(t.H, 3)} m  ·  Lh = ${fmt(t.Lh, 2)} m`
        : `Luz corta del descanso a = ${fmt(t.Lh, 2)} m  ·  cota ${fmt(t.H, 2)} m`,
      result: `Mu⁺ = ${fmt(t.MuPos, 3)} t·m/m   ·   Mu⁻ = ${fmt(t.MuNeg, 3)} t·m/m   ·   Vu = ${fmt(t.Vu, 3)} t/m`,
      desarrollo: inclinado
        ? [
            `α = atan(${fmt(t.H, 3)} / ${fmt(t.Lh, 2)}) = ${fmt(t.alphaDeg, 1)}°`,
            `Li = √(${fmt(t.Lh, 2)}² + ${fmt(t.H, 3)}²) = ${fmt(t.Li, 2)} m`,
            `g_losa = 2 400 × ${fmt(m.e / 100, 2)} / cos ${fmt(t.alphaDeg, 1)}° = ${fmt(t.gLosa, 0)} kg/m² (sobre planta)`,
            `g_grada = 2 400 × (${fmt(m.cCm, 1)}/2) / 100 = ${fmt(t.gGrada, 0)} kg/m²`,
            `CM = ${fmt(t.gLosa, 0)} + ${fmt(t.gGrada, 0)} + ${fmt(m.acab, 0)} = ${fmt(t.CM, 0)} kg/m²`,
            `wu = 1,4 × ${fmt(t.CM, 0)} + 1,7 × ${fmt(m.cv, 0)} = ${fmt(t.wu, 0)} kg/m²`,
            `Mu⁺ = (${fmt(t.wu, 0)}/1000) × ${fmt(t.Lh, 2)}² / 8 = ${fmt(t.MuPos, 3)} t·m/m`,
            `Mu⁻ (arranque en descanso) = (${fmt(t.wu, 0)}/1000) × ${fmt(t.Lh, 2)}² / 10 = ${fmt(t.MuNeg, 3)} t·m/m`,
            `Vu = (${fmt(t.wu, 0)}/1000) × ${fmt(t.Lh, 2)} / 2 = ${fmt(t.Vu, 3)} t/m`,
          ]
        : [
            `g = 2 400 × ${fmt(m.e / 100, 2)} = ${fmt(t.gLosa, 0)} kg/m²`,
            `CM = ${fmt(t.gLosa, 0)} + ${fmt(m.acab, 0)} = ${fmt(t.CM, 0)} kg/m²`,
            `wu = 1,4 × ${fmt(t.CM, 0)} + 1,7 × ${fmt(m.cv, 0)} = ${fmt(t.wu, 0)} kg/m²`,
            `Mu⁺ = (${fmt(t.wu, 0)}/1000) × ${fmt(t.Lh, 2)}² / 8 = ${fmt(t.MuPos, 3)} t·m/m`,
            `Mu⁻ = (${fmt(t.wu, 0)}/1000) × ${fmt(t.Lh, 2)}² / 12 = ${fmt(t.MuNeg, 3)} t·m/m`,
            `Vu = (${fmt(t.wu, 0)}/1000) × ${fmt(t.Lh, 2)} / 2 = ${fmt(t.Vu, 3)} t/m`,
          ],
      table: {
        caption: `Metrado de ${t.label} (franja de 1,00 m)`,
        headers: ["Ítem", "Fórmula", "Valor", "Und"],
        rows: [
          ["Peso losa", inclinado ? "γ e / cos α" : "γ e", fmt(t.gLosa, 0), "kg/m²"],
          ["Peso gradas", inclinado ? "γ c / 2" : "—", fmt(t.gGrada, 0), "kg/m²"],
          ["Acabados", "dato", fmt(m.acab, 0), "kg/m²"],
          ["CM", "losa+grada+acab", fmt(t.CM, 0), "kg/m²"],
          ["CV E.020", "dato", fmt(m.cv, 0), "kg/m²"],
          ["wu", "1,4 CM + 1,7 CV", fmt(t.wu, 0), "kg/m²"],
          ["Lh", inclinado ? "proyección del tramo" : "lado corto a", fmt(t.Lh, 2), "m"],
          ["Mu⁺", inclinado ? "wu Lh²/8" : "wu a²/8", fmt(t.MuPos, 3), "t·m/m"],
          ["Mu⁻", inclinado ? "wu Lh²/10" : "wu a²/12", fmt(t.MuNeg, 3), "t·m/m"],
        ],
      },
    },
    {
      n: nAcero,
      title: `${t.label} — acero longitudinal (flexión)`,
      formula: "As = Mu·10⁵ / (φ fy j d)   ·   Asmín flexión = máx(0,7√f'c/fy ; 14/fy)·b d   ·   s = Ab / As × 100",
      substitution: `d = ${fmt(m.d, 1)} cm  ·  φ = 0,90  ·  j = 0,90  ·  fy = ${fmt(m.fy, 0)} kg/cm²   ·   dirección: ${m.dirLong}`,
      result: `Long. inf. ${t.pos.text}   ·   Long. sup. ${t.neg.text}`,
      desarrollo: [
        `El acero longitudinal corre en el ${m.dirLong}. No se confunde con el transversal (paso 11).`,
        `As⁺ (cara inferior, vano) = ${fmt(t.MuPos, 3)} × 100 000 / (0,90 × ${fmt(m.fy, 0)} × 0,90 × ${fmt(m.d, 1)}) = ${fmt(t.pos.AsFlex, 2)} cm²/m`,
        `As⁻ (cara superior, arranque) = ${fmt(t.MuNeg, 3)} × 100 000 / (0,90 × ${fmt(m.fy, 0)} × 0,90 × ${fmt(m.d, 1)}) = ${fmt(t.neg.AsFlex, 2)} cm²/m`,
        `Asmín flexión = máx(0,7√${fmt(m.fc, 0)} ; 14) / ${fmt(m.fy, 0)} × 100 × ${fmt(m.d, 1)} = ${fmt(t.pos.AsMin, 2)} cm²/m`,
        `Se adopta máx(Ascalc, Asmín flexión): inf. ${fmt(t.pos.AsUse, 2)} → ${t.pos.text} (${fmt(t.pos.AsProv, 2)} cm²/m)`,
        `Negativo longitudinal (cara superior): ${fmt(t.neg.AsUse, 2)} → ${t.neg.text} (${fmt(t.neg.AsProv, 2)} cm²/m)`,
      ],
      note: inclinado
        ? "Longitudinal inferior: sigue la pendiente, al fondo de la losa. Longitudinal superior: negativo de arranque. El transversal (paso 11) no es estribo de corte."
        : "En el descanso el longitudinal va en la luz corta (lado a). El transversal cubre la luz larga (2a): distribución y temperatura, no cortante.",
    },
  ];
}

export const escalera: Engine = (raw) => {
  const m = calcularEscalera({
    H: num(raw, "H", 3),
    L: num(raw, "L", 3.2),
    nC: num(raw, "nC", 16),
    bHuella: num(raw, "bHuella", 25),
    a: num(raw, "a", 1.2),
    e: num(raw, "e", 15),
    fc: num(raw, "fc", 210),
    fy: num(raw, "fy", 4200),
    cv: num(raw, "cv", 400),
    acab: num(raw, "acab", 100),
    rec: num(raw, "rec", 2.5),
  });
  const okB = m.blanco >= 61 && m.blanco <= 70;
  const okC = m.cCm >= 16 && m.cCm <= 19;
  const okE1 = m.e / 100 >= m.t1.Lh / 25;
  const okE2 = m.e / 100 >= m.t2.Lh / 25;
  const okV = m.VuMax <= m.phiVc + 1e-6;
  const gov = m.t1.pos.AsUse >= m.t2.pos.AsUse ? m.t1 : m.t2;

  return out(
    `T1 ${m.n1} c.p. · T2 ${m.n2} c.p. · long. inf. ${gov.pos.text}`,
    `c = ${fmt(m.cCm, 1)} cm  ·  e = ${fmt(m.e, 0)} cm  ·  d = ${fmt(m.d, 1)} cm  ·  transv. ${m.dist.text}`,
    [
      {
        n: "01",
        title: "Geometría de los dos tramos y fórmula de Blanco",
        formula: "c = H / n   ·   n1 = ⌈n/2⌉   ·   n2 = n−n1   ·   c + 2b = 61 a 70 cm",
        substitution: `H = ${fmt(m.H, 2)} m  ·  n = ${m.nC}  ·  b = ${fmt(m.bCm, 0)} cm`,
        result: `c = ${fmt(m.cCm, 1)} cm  ·  T1 ${m.n1} contrapasos (H1 = ${fmt(m.t1.H, 2)} m)  ·  T2 ${m.n2} contrapasos (H2 = ${fmt(m.t2.H, 2)} m)`,
        ok: okB,
        desarrollo: [
          `c = ${fmt(m.H * 100, 1)} / ${m.nC} = ${fmt(m.cCm, 1)} cm`,
          `Blanco: ${fmt(m.cCm, 1)} + 2 × ${fmt(m.bCm, 0)} = ${fmt(m.blanco, 1)} cm`,
          `Tramo 1: ${m.n1} contrapasos, desnivel ${fmt(m.t1.H, 2)} m, proyección L = ${fmt(m.L, 2)} m, α = ${fmt(m.t1.alphaDeg, 1)}°`,
          `Descanso: losa horizontal ${fmt(m.a, 2)} × ${fmt(2 * m.a, 2)} m a la cota ${fmt(m.t1.H, 2)} m`,
          `Tramo 2: ${m.n2} contrapasos, desnivel ${fmt(m.t2.H, 2)} m, misma proyección L, α = ${fmt(m.t2.alphaDeg, 1)}°`,
          `Si n es impar los tramos no son iguales: cada uno se calcula con su H y su α. No se usa H/2 genérico.`,
        ],
      },
      {
        n: "02",
        title: "Peralte útil y predimensionado de la losa",
        formula: "e ≥ Lh/20 a Lh/25   ·   d = e − rec − Ø/2",
        substitution: `e = ${fmt(m.e, 0)} cm  ·  rec = ${fmt(m.rec, 1)} cm  ·  Ø 3/8" (0,95 cm)`,
        result: `d = ${fmt(m.d, 1)} cm  ·  Lh/20 = ${fmt(m.t1.Lh / 20, 2)} m  ·  Lh/25 = ${fmt(m.t1.Lh / 25, 2)} m`,
        ok: okE1 && okE2,
        desarrollo: [
          `d = ${fmt(m.e, 0)} − ${fmt(m.rec, 1)} − 0,95/2 = ${fmt(m.d, 1)} cm`,
          `Tramo 1: Lh/25 = ${fmt(m.t1.Lh / 25, 2)} m → e mín. ${fmt((m.t1.Lh / 25) * 100, 0)} cm`,
          `Tramo 2: Lh/25 = ${fmt(m.t2.Lh / 25, 2)} m → e mín. ${fmt((m.t2.Lh / 25) * 100, 0)} cm`,
        ],
      },
      ...pasosTramo(m, m.t1, "03", "04"),
      ...pasosTramo(m, m.desc, "05", "06"),
      ...pasosTramo(m, m.t2, "07", "08"),
      {
        n: "09",
        title: "Cortante de la losa — no se confunde con el acero transversal",
        formula: "φVc = 0,85 × 0,53 √f'c b d    ·    Vu = wu Lh / 2    ·    E.060 11.5.5.1: losas sin Av mín.",
        substitution: `f'c = ${fmt(m.fc, 0)} kg/cm²  ·  b = 100 cm  ·  d = ${fmt(m.d, 1)} cm`,
        result: `Vu máx. = ${fmt(m.VuMax, 3)} t/m   ${okV ? "≤" : ">"}   φVc = ${fmt(m.phiVc, 3)} t/m   ·   ${okV ? "sin estribos" : "requiere estribos Av"}`,
        ok: okV,
        desarrollo: [
          `En vigas el acero transversal son estribos (Av) a cortante. En losa de escalera no: el corte se verifica con el concreto.`,
          `Vc = 0,53 √${fmt(m.fc, 0)} × 100 × ${fmt(m.d, 1)} / 1000 = ${fmt(m.phiVc / 0.85, 3)} t/m`,
          `φVc = 0,85 × Vc = ${fmt(m.phiVc, 3)} t/m`,
          `Vu T1 = ${fmt(m.t1.Vu, 3)}   ·   Vu descanso = ${fmt(m.desc.Vu, 3)}   ·   Vu T2 = ${fmt(m.t2.Vu, 3)} t/m`,
          okV
            ? "Vu ≤ φVc. El concreto absorbe el corte. E.060 11.5.5.1 exime a las losas del Av mínimo. No se colocan estribos. La malla del paso 11 no es Av."
            : "Vu > φVc: hay que aumentar e o f'c, o colocar estribos Av = (Vu/φ − Vc) s / (fy d) que abracen el longitudinal. Eso no es la malla de distribución.",
        ],
        note: "Estribo de cortante ≠ barra transversal de losa. El primero cierra el alma; la segunda va suelta, a 90° del principal, en una sola capa.",
      },
      {
        n: "10",
        title: "Acero longitudinal — los tres paños",
        formula: "Long. inf. = positivo de vano (pendiente)   ·   Long. sup. = negativo de arranque",
        substitution: `Franja de 1,00 m. Dirección: ${m.dirLong}.`,
        result: `Gobierna ${gov.label}: ${gov.pos.text}`,
        table: {
          caption: "Acero longitudinal (flexión · E.060 10.5)",
          headers: ["Paño", "n / luz", "Mu⁺ (t·m/m)", "Mu⁻ (t·m/m)", "As⁺ (cm²/m)", "Long. inf.", "Long. sup."],
          rows: [
            [m.t1.label, `${m.n1} c.p. · ${fmt(m.t1.Lh, 2)} m`, fmt(m.t1.MuPos, 3), fmt(m.t1.MuNeg, 3), fmt(m.t1.pos.AsUse, 2), m.t1.pos.text, m.t1.neg.text],
            [m.desc.label, `${fmt(m.a, 2)} m`, fmt(m.desc.MuPos, 3), fmt(m.desc.MuNeg, 3), fmt(m.desc.pos.AsUse, 2), m.desc.pos.text, m.desc.neg.text],
            [m.t2.label, `${m.n2} c.p. · ${fmt(m.t2.Lh, 2)} m`, fmt(m.t2.MuPos, 3), fmt(m.t2.MuNeg, 3), fmt(m.t2.pos.AsUse, 2), m.t2.pos.text, m.t2.neg.text],
          ],
        },
        note: "El longitudinal es de flexión. El transversal del paso 11 es distribución + temperatura. El cortante se resolvió en el paso 09.",
      },
      {
        n: "11",
        title: "Acero transversal de losa — distribución y temperatura (no es cortante)",
        formula: "As,st = ρst · b · e     ·     ρst = 0,0018 (fy ≥ 4 200) ó 0,0020     ·     s ≤ mín(5e ; 45 cm)",
        substitution: `b = 100 cm  ·  e = ${fmt(m.e, 0)} cm  ·  fy = ${fmt(m.fy, 0)} kg/cm²  ·  ${m.dirTransv}`,
        result: `${m.dist.text}   ·   As,st = ${fmt(m.AsMinTemp, 2)} cm²/m   ·   s máx. = ${fmt(m.sMaxTransv, 0)} cm`,
        ok: m.dist.s <= m.sMaxTransv + 1e-6 && m.dist.AsProv + 1e-6 >= m.AsMinTemp,
        desarrollo: [
          `Tres aceros distintos: (1) longitudinal de flexión, (2) transversal de losa, (3) estribos Av si Vu > φVc. Esta malla es el (2), no el (3).`,
          `En losa de un sentido (la escalera lo es) el acero ⊥ al principal reparte cargas puntuales y cubre retracción y temperatura. E.060 7.13 fija As,st y s máx. En obra se llama «distribución».`,
          `As,st = ${m.fy >= 4200 ? "0,0018" : "0,0020"} × 100 × ${fmt(m.e, 0)} = ${fmt(m.AsMinTemp, 2)} cm²/m`,
          `s ≤ mín(5×${fmt(m.e, 0)} ; 45) = ${fmt(m.sMaxTransv, 0)} cm. Se adopta ${m.dist.text} → ${fmt(m.dist.AsProv, 2)} cm²/m ≥ ${fmt(m.AsMinTemp, 2)} cm²/m.`,
          `Va suelta, encima del longitudinal, según el ancho a = ${fmt(m.a, 2)} m (en el descanso, luz larga 2a = ${fmt(2 * m.a, 2)} m). No abraza el alma: no es estribo.`,
        ],
        table: {
          caption: "Qué es y qué no es cada acero",
          headers: ["Acero", "Dirección", "Función", "Norma", "Este ejemplo"],
          rows: [
            ["Longitudinal", "Pendiente / luz", "Flexión Mu⁺ / Mu⁻", "E.060 10.5", gov.pos.text],
            ["Transversal de losa", "⊥ al longitudinal", "Distribución + retracción/temperatura", "E.060 7.13", m.dist.text],
            ["Estribos Av", "Cierran el alma", "Cortante Vu > φVc", "E.060 11.5", okV ? "No se requieren" : "Sí: Vu > φVc"],
          ],
        },
        note: "La columna que antes decía «Distribución» es este acero transversal de losa. No dimensiona cortante.",
      },
    ],
    [
      ok("Fórmula de Blanco", `${fmt(m.blanco, 1)} cm`, "61–70 cm", okB),
      ok("Contrapaso", `${fmt(m.cCm, 1)} cm`, "16–18 cm (A.010 / práctica)", okC),
      ok("e ≥ Lh/25 tramo 1", `${fmt(m.e, 0)} cm`, `≥ ${fmt((m.t1.Lh / 25) * 100, 0)} cm`, okE1),
      ok("e ≥ Lh/25 tramo 2", `${fmt(m.e, 0)} cm`, `≥ ${fmt((m.t2.Lh / 25) * 100, 0)} cm`, okE2),
      ok("Cortante φVc ≥ Vu (sin estribos)", `${fmt(m.VuMax, 3)} t/m`, `≤ ${fmt(m.phiVc, 3)} t/m · E.060 11.5.5.1`, okV),
      ok("Transversal dist. + temp. 7.13", m.dist.text, `As,st ≥ ${fmt(m.AsMinTemp, 2)} cm²/m · no es Av`, m.dist.s <= m.sMaxTransv + 1e-6 && m.dist.AsProv + 1e-6 >= m.AsMinTemp),
    ],
    [
      {
        title: "Acero longitudinal (flexión)",
        rows: [
          ["Paño", "Long. inferior (vano)", "Long. superior (negativo)"],
          [m.t1.label, m.t1.pos.text, m.t1.neg.text],
          [m.desc.label, m.desc.pos.text, m.desc.neg.text],
          [m.t2.label, m.t2.pos.text, m.t2.neg.text],
        ],
      },
      {
        title: "Acero transversal de losa (distribución + temperatura · no es cortante)",
        rows: [
          ["Paño", "Dirección", "As,st (cm²/m)", "Barra y separación"],
          [m.t1.label, "⊥ a la pendiente", fmt(m.AsMinTemp, 2), m.dist.text],
          [m.desc.label, "⊥ a la luz corta", fmt(m.AsMinTemp, 2), m.dist.text],
          [m.t2.label, "⊥ a la pendiente", fmt(m.AsMinTemp, 2), m.dist.text],
        ],
      },
    ],
    {
      asT1: m.t1.pos.text,
      asT2: m.t2.pos.text,
      asD: m.desc.pos.text,
      asNeg: m.t1.neg.text,
      asNegD: m.desc.neg.text,
      asNeg2: m.t2.neg.text,
      asDist: m.dist.text,
      asTransv: m.dist.text,
      asT1As: fmt(m.t1.pos.AsUse, 2),
      asT2As: fmt(m.t2.pos.AsUse, 2),
      asDAs: fmt(m.desc.pos.AsUse, 2),
      n1: String(m.n1),
      n2: String(m.n2),
      dUtil: fmt(m.d, 1),
      rec: fmt(m.rec, 1),
      Lh1: m.t1.Lh.toFixed(3),
      Lh2: m.t2.Lh.toFixed(3),
      LhD: m.desc.Lh.toFixed(3),
      muT1: m.t1.MuPos.toFixed(3),
      muN1: m.t1.MuNeg.toFixed(3),
      muT2: m.t2.MuPos.toFixed(3),
      muN2: m.t2.MuNeg.toFixed(3),
      muD: m.desc.MuPos.toFixed(3),
      muND: m.desc.MuNeg.toFixed(3),
    }
  );
};

/* ───────── Losa aligerada / viguetas ───────── */
/* ───────── Losa continua 2D (aligerada o maciza) ───────── */
function losaContinua(kind: "aligerada" | "maciza"): Engine {
  return (raw) => {
    const isJoist = kind === "aligerada";
    const L = num(raw, "L", isJoist ? 5 : 3.5);
    const nPanos = Math.max(1, Math.min(8, Math.round(num(raw, "nPanos", 3))));
    const medida = str(raw, "medidaLuz", "libre");
    const bApoyo = num(raw, "bApoyo", 0.3);
    const lucesEje = parseLuces(str(raw, "luces", ""), nPanos, L);
    const luces = medida === "ejes" ? lucesEje.map((Li) => Math.max(0.5, Li - bApoyo)) : lucesEje;
    const volI = str(raw, "voladoI", "no") === "si" ? num(raw, "LvolI", 1.2) : 0;
    const volD = str(raw, "voladoD", "no") === "si" ? num(raw, "LvolD", 1.2) : 0;
    const endFix = str(raw, "apoyoExt", "simple") === "empotrado";
    const h = isJoist ? num(raw, "e", 20) : num(raw, "h", 12);
    const s = isJoist ? num(raw, "s", 40) : 100;
    const bw = isJoist ? num(raw, "bw", 10) : 100;
    const rec = num(raw, "rec", 3);
    const bar = barByName(str(raw, "bar", '3/8"'));
    const destName = str(raw, "dest", isJoist ? '3/8"' : "ninguno");
    const dest = destName === "ninguno" ? 0 : barByName(destName).db;
    const fc = num(raw, "fc", 210);
    const fy = num(raw, "fy", 4200);
    const cv = num(raw, "cv", 200);
    const acab = num(raw, "acab", 100);
    const tab = num(raw, "tab", isJoist ? 150 : 0);
    const pesoLosa = isJoist
      ? h <= 17 ? 280 : h <= 20 ? 300 : h <= 25 ? 350 : 420
      : 2400 * (h / 100);
    const CM = pesoLosa + acab + tab;
    const tribut = isJoist ? s / 100 : 1;
    const WD = CM * tribut;
    const WL = cv * tribut;
    const d = Math.max(4, h - rec - dest - bar.db / 2);
    const hf = 5;
    const LnMax = Math.max(...luces);
    const bFlange = isJoist ? Math.min(s, (LnMax / 4) * 100, 16 * hf + bw) : 100;
    const AsMinFlex = Math.max((0.7 * Math.sqrt(fc)) / fy, 14 / fy) * (isJoist ? bw : 100) * d;
    const AsMinTemp = (fy >= 4200 ? 0.0018 : 0.002) * 100 * h;
    const asMin = isJoist ? AsMinFlex : AsMinTemp;
    const beam = analyzeContinuous({
      luces,
      volI,
      volD,
      endFix,
      WD,
      WL,
      bw: isJoist ? bw : 100,
      bFlange,
      d,
      h,
      fc,
      fy,
      bar,
      kind: isJoist ? "joist" : "slab",
      asMin,
      hf: isJoist ? 5 : h,
    });
    const parseLay = (t: string) => {
      const m = /(\d+)\s*Ø\s*([^(\s]+)/.exec(t);
      const n = m ? Number(m[1]) : 1;
      const nm = (m?.[2] ?? bar.name).replace(/["”]/g, "").trim();
      const db = barByName(nm.includes("/") || nm === "1" ? `${nm}"` : bar.name).db;
      return { n, db };
    };
    const posLays = beam.steel.map((st) => parseLay(st.barsPos));
    const posWorst = posLays.reduce((a, x) => (x.n * x.db > a.n * a.db ? x : a), posLays[0] ?? { n: 1, db: bar.db });
    const sClear = Math.max(2.5, posWorst.db);
    const anchoNeed = isJoist
      ? 2 * rec + 2 * dest + posWorst.n * posWorst.db + Math.max(0, posWorst.n - 1) * sClear
      : 0;
    const hRatio = isJoist ? 25 : nPanos === 1 && !endFix ? 20 : 24;
    const hmin = LnMax / hRatio;
    const VuMax = Math.max(...beam.steel.map((st) => Math.max(st.VuL, st.VuR)), 0);
    const bV = isJoist ? bw : 100;
    const Vc = (0.53 * Math.sqrt(fc) * bV * d) / 1000;
    const phiVc = 0.85 * Vc;
    const okV = VuMax <= phiVc + 1e-6;
    const okM = beam.steel.every((st) => st.okPos && st.okNegL && st.okNegR);
    const gov = beam.steel.reduce((a, st) => (st.MuPos > a.MuPos ? st : a), beam.steel[0]);
    const unit = isJoist ? "cm²" : "cm²/m";
    const apoyos = beam.support.filter(Boolean).length;
    const modelo = [
      volI > 0 ? `volado I ${fmt(volI, 2)} m` : null,
      `${nPanos} paño${nPanos > 1 ? "s" : ""} Ln = ${luces.map((x) => fmt(x, 2)).join(" + ")} m`,
      volD > 0 ? `volado D ${fmt(volD, 2)} m` : null,
      medida === "ejes" ? `de ejes, b apoyo = ${fmt(bApoyo, 2)} m` : "luz libre",
    ]
      .filter(Boolean)
      .join(" · ");

    const zonaRows = beam.steel.flatMap((st) => {
      if (st.kind === "cantilever") {
        const atR = st.MuNegR >= st.MuNegL;
        return [
          [
            st.label,
            "Arranque (−)",
            fmt(Math.max(st.MuNegL, st.MuNegR), 3),
            fmt(atR ? st.AsFlexNegR : st.AsFlexNegL, 2),
            fmt(st.AsMin, 2),
            fmt(atR ? st.AsNegR : st.AsNegL, 2),
            atR ? st.barsNegR : st.barsNegL,
          ],
          [st.label, "Vano (+)", fmt(st.MuPos, 3), fmt(st.AsFlexPos, 2), fmt(st.AsMin, 2), fmt(st.AsPos, 2), st.barsPos],
        ];
      }
      return [
        [st.label, "Vano (+)", fmt(st.MuPos, 3), fmt(st.AsFlexPos, 2), fmt(st.AsMin, 2), fmt(st.AsPos, 2), st.barsPos],
        [st.label, "Apoyo izq (−)", fmt(st.MuNegL, 3), fmt(st.AsFlexNegL, 2), fmt(st.AsMin, 2), fmt(st.AsNegL, 2), st.barsNegL],
        [st.label, "Apoyo der (−)", fmt(st.MuNegR, 3), fmt(st.AsFlexNegR, 2), fmt(st.AsMin, 2), fmt(st.AsNegR, 2), st.barsNegR],
      ];
    });
    const envRows = beam.steel.map((st) => [
      st.label,
      fmt(st.Ln, 2),
      fmt(st.MuPos, 3),
      fmt(st.MuNegL, 3),
      fmt(st.MuNegR, 3),
      fmt(st.VuL, 3),
      fmt(st.VuR, 3),
    ]);
    const lenRows = beam.steel.map((st) => [
      st.label,
      fmt(st.LteoNegL, 2),
      fmt(st.LteoNegR, 2),
      fmt(st.Lext, 2),
      fmt(st.ld, 2),
      fmt(st.LcorteNegL, 2),
      fmt(st.LcorteNegR, 2),
    ]);
    const plan = planDespiece(beam.nodes, beam.members, beam.steel, bar, isJoist ? "joist" : "slab", bApoyo);
    const AsDist = isJoist ? 0 : asMin;
    const distText = isJoist
      ? `Loseta: malla o Ø 1/4" @ 25 cm en la capa de 5 cm`
      : `Ø ${bar.name} @ ${Math.max(8, Math.min(5 * h, 45, Math.floor(((bar.as / Math.max(AsDist, 1e-9)) * 100) / 5) * 5))} cm  (${fmt(AsDist, 2)} cm²/m)`;

    const titulo = isJoist
      ? `Vigueta ${bw}×${h} cm c/ ${s} cm  ·  ${nPanos} paños  ·  ${gov.barsPos}`
      : `Losa maciza h = ${h} cm  ·  franja 1.00 m  ·  ${gov.barsPos}`;

    return out(
      titulo,
      `d = ${fmt(d, 1)} cm  ·  As ${unit} por zona  ·  ${beam.combo}  ·  Mu+ = ${fmt(gov.MuPos, 3)} t·m`,
      [
        {
          n: "01",
          title: isJoist ? "Peso propio de losa aligerada" : "Peso propio de losa maciza",
          formula: isJoist
            ? "CM = peso propio de losa + acabados + tabiquería"
            : "CM = γc h + acabados + tabiquería   γc = 2400 kg/m³",
          substitution: isJoist
            ? `e = ${h} cm → ${pesoLosa} kg/m² + acab. ${acab} + tab. ${tab}`
            : `h = ${h} cm → 2400×${fmt(h / 100, 2)} + ${acab} + ${tab}`,
          result: `CM = ${fmt(CM, 0)} kg/m²`,
        },
        {
          n: "02",
          title: isJoist ? "Cargas por metro de vigueta" : "Cargas por franja de 1.00 m",
          formula: isJoist ? "WD = CM · s    WL = CV · s" : "WD = CM · 1.00 m    WL = CV · 1.00 m",
          substitution: `tributario = ${fmt(tribut, 2)} m  →  WD = ${fmt(WD, 1)} kg/m  ·  WL = ${fmt(WL, 1)} kg/m`,
          result: `1.4 WD = ${fmt(beam.wuDL, 1)} kg/m    1.7 WL = ${fmt(beam.wuLL, 1)} kg/m`,
          note: "U = 1.4 CM + 1.7 CV (E.060). El damero se aplica solo a la CV factoreada.",
        },
        {
          n: "03",
          title: "Luz de análisis y peralte efectivo",
          formula: "Ln = luz libre    ·    d = h − rec − Øest − db/2",
          substitution: `${medida === "ejes" ? `L ejes − b apoyo ${fmt(bApoyo, 2)} m` : "L ingresada = luz libre"}  ·  rec = ${fmt(rec, 1)} cm  ·  Ø ${bar.name} (db = ${fmt(bar.db, 2)} cm)${dest ? `  ·  estribo db = ${fmt(dest, 2)} cm` : ""}`,
          result: `Ln,máx = ${fmt(LnMax, 2)} m    d = ${fmt(d, 1)} cm`,
          note: "El recubrimiento libre es a la cara de la barra (E.060). El peralte efectivo llega al centroide del acero.",
        },
        {
          n: "04",
          title: "Modelo estructural 2D (tipo SAP2000)",
          formula: "Viga continua Euler–Bernoulli · rigideces · EI prismático",
          substitution: modelo,
          result: `${beam.members.length} barras  ·  ${apoyos} apoyos ${endFix ? "empotrados en extremos" : "simples"}`,
          note: "Mismo esquema de frame 2D: v = 0 en apoyos, θ libre si el extremo es simple. Volado = extremo libre.",
        },
        {
          n: "05",
          title: "Dameros de carga viva (Mu+ y Mu−)",
          formula: "1.4 CM en todos + 1.7 CV en el patrón",
          substitution: `${beam.patterns.filter((p) => p.id === "odd" || p.id === "even").length} dameros de vano (acero inferior / Mu+) y ${beam.patterns.filter((p) => (p.id ?? "").startsWith("adj-") || p.id === "volI" || p.id === "volD").length} dameros de apoyo (acero superior / Mu−)${volI || volD ? ", más volados" : ""} · un patrón de CV llena de referencia`,
          result: `Mu+ máx = ${fmt(Math.max(...beam.steel.map((st) => st.MuPos)), 3)} t·m    Mu− máx = ${fmt(Math.max(...beam.steel.map((st) => Math.max(st.MuNegL, st.MuNegR))), 3)} t·m`,
          note: "El CM factoreado actúa siempre. Impares/pares maximizan Mu+ (As+ cara inferior). Paños contiguos al nudo maximizan Mu− (As− cara superior, ACI 6.4.3 / E.060). La envolvente toma el máximo y el mínimo de todos los patrones.",
        },
        {
          n: "06",
          title: `Acero requerido por zona (${unit})`,
          formula: "As = Mu / (φ fy jd)  ≥ Asmín    φ = 0.90",
          substitution: isJoist
            ? `Mu+ = ${fmt(gov.MuPos, 3)} t·m (vano, b = beff = ${fmt(bFlange, 1)} cm). Mu− = ${fmt(Math.max(gov.MuNegL, gov.MuNegR), 3)} t·m (apoyo, b = bw = ${bw} cm). Asmín = ${fmt(asMin, 2)} cm²`
            : `Mu+ = ${fmt(gov.MuPos, 3)} t·m  ·  Mu− = ${fmt(Math.max(gov.MuNegL, gov.MuNegR), 3)} t·m  ·  franja b = 100 cm. Asmín = ${fmt(asMin, 2)} cm²/m`,
          result: `Vano As+ = ${fmt(gov.AsPos, 2)} ${unit}  ·  Apoyo As− = ${fmt(Math.max(gov.AsNegL, gov.AsNegR), 2)} ${unit}`,
          note: "En cada paño hay tres zonas de diseño: vano (+) y los dos apoyos (−). La tabla lista As de flexión, As mín y As a colocar.",
        },
        {
          n: "07",
          title: isJoist ? "Colocación — Ø según As de cada zona" : `Colocación con Ø ${bar.name}`,
          formula: isJoist
            ? "Se adopta el menor Ø comercial (3/8″, 1/2″, 5/8″, 3/4″) con 1 a 4 barras que cubra As. El vano va en el nervio; el negativo, en la loseta."
            : "s = Ab / As × 100 cm   8 ≤ s ≤ min(3h, 45)",
          substitution: isJoist
            ? `Ø mínimo de partida ${bar.name}. Si As no cabe en 1–2 barras de ese Ø, se sube de diámetro.`
            : `Ab = ${fmt(bar.as, 2)} cm²    db = ${fmt(bar.db, 2)} cm`,
          result: `Vano ${gov.barsPos}    ·    Apoyo ${gov.MuNegL >= gov.MuNegR ? gov.barsNegL : gov.barsNegR}`,
        },
        {
          n: "08",
          title: "Cortante máximo Vu (a d de la cara del apoyo)",
          formula: "Vu = máx |V_env| en x = cara ± d     φVc = 0.85 × 0.53 √f'c b d / 1000",
          substitution: `1.4 WD = ${fmt(beam.wuDL, 1)} kg/m  ·  1.7 WL = ${fmt(beam.wuLL, 1)} kg/m  ·  d = ${fmt(d, 1)} cm (${fmt(d / 100, 3)} m).  Vu por paño: ${beam.steel.map((st) => `${st.label.replace("Paño ", "P")} izq ${fmt(st.VuL, 3)} t / der ${fmt(st.VuR, 3)} t`).join(" · ")}`,
          result: `Vu,máx = ${fmt(VuMax, 3)} t    φVc = 0.85×0.53×√${fc}×${fmt(bV, 0)}×${fmt(d, 1)} / 1000 = ${fmt(phiVc, 3)} t    ${okV ? "CUMPLE" : "NO CUMPLE"}`,
          note: okV
            ? "Vu se lee en la envolvente de dameros, no en la cara del apoyo. Vu ≤ φVc: no se requiere acero de corte de diseño."
            : isJoist
              ? "Vu > φVc: el nervio necesita estribos Av fy d / Vs."
              : "Vu > φVc: aumentar h o revisar luces. Las losas macizas de 1 dir. rara vez necesitan estribos.",
        },
        {
          n: "09",
          title: "Longitudes de acero negativo",
          formula: "L_ext = máx(Ln/16, d, 12 db)     L_corte = máx(L_teór. + L_ext, ld)     Si Mu−≈0 → L_corte = ld",
          substitution: `12 db = ${fmt(12 * bar.db, 1)} cm  ·  Ln/16 = ${fmt((gov.Ln / 16) * 100, 1)} cm  ·  d = ${fmt(d, 1)} cm`,
          result: `L_ext = ${fmt(gov.Lext, 2)} m    ld = ${fmt(gov.ld, 2)} m`,
          note: "L teórica = inflexión de la envolvente (sin desarrollo). En extremo simple con Mu− ≈ 0 no hay zona negativa: no se usa Ln/4 ni Lext; L_corte = ld.",
        },
        {
          n: "10",
          title: isJoist ? "Acero de loseta (reparto)" : "Acero de temperatura / distribución",
          formula: isJoist ? "Malla en la loseta de ~5 cm" : `As,temp = ${fy >= 4200 ? "0.0018" : "0.002"} b h`,
          substitution: isJoist ? "Perpendicular a las viguetas, en la capa superior de la loseta." : `${fy >= 4200 ? "0.0018" : "0.002"}×100×${h} = ${fmt(AsDist, 2)} cm²/m`,
          result: distText,
        },
        {
          n: "11",
          title: "Despiece de aceros — adopción en planta",
          formula: plan.unifyPos
            ? "Si ≥ 2 paños tienen As+ mayor que el resto → un solo acero continuo en toda la vigueta"
            : plan.extras.length
              ? "As+ de la mayoría, continuo · adicional solo en el paño que gobierna · L = Lteo + 2 ld"
              : "As+ igual en todos los paños → continuo de extremo a extremo",
          substitution: plan.extras.length
            ? `${plan.labelBase}  ·  ${plan.extras.map((e) => `${e.text} en ${e.label}: Lteo=${fmt(e.Lteo, 2)} m  ld=${fmt(e.ld, 2)} m  L=${fmt(e.Lbar, 2)} m`).join("  ·  ")}`
            : plan.labelBase,
          result: plan.note,
          note: plan.negs.length
            ? `As− en cada apoyo. En interiores L = Lizq + Lder. En extremo simple (Mu− ≈ 0) L = ld, con gancho 90° (un doblez). ${plan.negs.map((g) => `${g.text} en x=${fmt(g.x, 2)} m → L=${fmt(g.Lbar, 2)} m`).join("  ·  ")}`
            : "Sin acero negativo de corte: extremos simples de un solo paño o momentos de apoyo nulos.",
        },
      ],
      [
        ok(
          isJoist ? "h ≥ Ln/25 (aligerada)" : `h ≥ Ln/${hRatio} (maciza, E.060 Tabla 9.5(a))`,
          `${h} cm`,
          `≥ ${fmt(hmin * 100, 1)} cm`,
          h / 100 + 0.001 >= hmin
        ),
        ok("d > 4 cm", `${fmt(d, 1)} cm`, "> 4 cm", d > 4),
        ...(isJoist
          ? [
              ok("bw ≥ 8 cm", `${bw} cm`, "≥ 8 cm", bw >= 8),
              ok(
                "Las barras caben en el nervio",
                `${fmt(anchoNeed, 1)} cm`,
                `≤ bw = ${bw} cm`,
                anchoNeed <= bw + 0.3
              ),
            ]
          : []),
        ok(`φMn+ ≥ Mu+`, okM ? "sí" : "no", "todas las zonas", beam.steel.every((st) => st.okPos)),
        ok(`φMn− ≥ Mu−`, okM ? "sí" : "no", "apoyos", beam.steel.every((st) => st.okNegL && st.okNegR)),
        ok("Vu ≤ φVc (a d del apoyo)", `${fmt(VuMax, 3)} t`, `≤ ${fmt(phiVc, 3)} t`, okV),
      ],
      [
        {
          title: `Acero por zona de diseño (${unit})`,
          rows: [
            ["Paño", "Zona", "Mu (t·m)", "As flexión", "As mín", "As requerido", "Colocación"],
            ...zonaRows,
          ],
        },
        {
          title: "Envolvente M y V",
          rows: [["Paño", "Ln (m)", "Mu+", "Mu− izq", "Mu− der", "Vu izq", "Vu der"], ...envRows],
        },
        {
          title: "Longitudes de acero negativo (m)",
          rows: [["Paño", "L teór. izq", "L teór. der", "L ext", "ld", "L corte izq", "L corte der"], ...lenRows],
        },
        {
          title: "Despiece adoptado",
          rows: [
            ["Elemento", "Acero", "Ubicación", "L teórica (m)", "ld (m)", "L total (m)"],
            ["As+ de fondo", plan.labelBase, "Toda la longitud", "—", "—", "continuo"],
            ...plan.extras.map((e) => [
              "As+ adicional",
              e.text,
              e.label,
              fmt(e.Lteo, 2),
              fmt(e.ld, 2),
              fmt(e.Lbar, 2),
            ]),
            ...plan.negs.map((g) => [
              "As− superior",
              g.text,
              `Apoyo x = ${fmt(g.x, 2)} m`,
              `${fmt(g.LteoL, 2)} / ${fmt(g.LteoR, 2)}`,
              fmt(g.ld, 2),
              fmt(g.Lbar, 2),
            ]),
          ],
        },
      ],
      {
        modelJson: encodeBeam(beam),
        nPanos: String(nPanos),
        slabKind: kind,
        dCm: String(d),
      }
    );
  };
}

export const viguetas: Engine = losaContinua("aligerada");
export const losa1d: Engine = losaContinua("maciza");

/* ───────── Losa 2 direcciones (coeficientes ACI) ───────── */
export const losa2d: Engine = (raw) => {
  const A = num(raw, "A", 4.0);
  const B = num(raw, "B", 5.0);
  const h = num(raw, "h", 15);
  const cm = num(raw, "cm", 500);
  const cv = num(raw, "cv", 250);
  const fy = num(raw, "fy", 4200);
  const caso = str(raw, "caso", "cccc");
  const ratio = Math.min(A, B) / Math.max(A, B);
  const ca: Record<string, number> = { cccc: 0.033, cccd: 0.04, ccdd: 0.05, cddd: 0.06, dddd: 0.083 };
  const coef = ca[caso] ?? 0.05;
  const wu = 1.4 * cm + 1.7 * cv;
  const Mu = coef * (wu / 1000) * Math.min(A, B) ** 2;
  const d = h - 2.5;
  const As = (Mu * 100000) / (0.9 * fy * 0.9 * d);
  const Asmin = 0.0018 * 100 * h;
  const AsUse = Math.max(As, Asmin);
  const s = spacingFor(AsUse, 0.71, 100);
  return out(
    `Mu = ${fmt(Mu, 3)} t·m/m  ·  Ø3/8" @ ${s} cm`,
    `Método 3 ACI  ·  A/B = ${fmt(ratio, 2)}  ·  caso ${caso.toUpperCase()}  ·  α = ${coef}`,
    [
      {
        n: "01",
        title: "Relación de lados y caso de continuidad",
        formula: "m = A/B   (A lado corto)   ·   c = continuo, d = discontinuo",
        substitution: `A = ${fmt(A, 2)}  B = ${fmt(B, 2)}  →  m = ${fmt(ratio, 2)}  ·  caso ${caso}`,
        result: `α = ${coef}`,
        note: "Coeficientes del método 3 ACI (losas dos direcciones).",
      },
      {
        n: "02",
        title: "Momento de diseño",
        formula: "Mu = α wu ln²",
        substitution: `wu = ${fmt(wu, 0)} kg/m²  ·  Mu = ${coef}×${fmt(wu / 1000, 3)}×${fmt(Math.min(A, B), 2)}²`,
        result: `${fmt(Mu, 3)} t·m/m`,
      },
      {
        n: "03",
        title: "Acero en franja de 1.00 m",
        substitution: `As = ${fmt(AsUse, 2)} cm²/m`,
        result: `Ø 3/8" @ ${s} cm`,
      },
    ],
    [ok("A/B ≥ 0.5 (válido método)", fmt(ratio, 2), "≥ 0.50", ratio >= 0.5)]
  );
};

/* ───────── Placa / muro de corte (DISEÑO DE PLACAS.xlsx) ───────── */
const PLACA_AB: Record<string, { as: number; db: number }> = {
  '3/8"': { as: 0.71, db: 0.95 },
  '1/2"': { as: 1.27, db: 1.27 },
  '5/8"': { as: 1.99, db: 1.59 },
  '3/4"': { as: 2.85, db: 1.91 },
  '1"': { as: 5.07, db: 2.54 },
};

function evenCeil(x: number, minN = 4) {
  let n = Math.max(minN, Math.ceil(x - 1e-12));
  if (n % 2) n += 1;
  return n;
}

function placeLayer(y0: number, y1: number, n: number, asEach: number) {
  if (n <= 0 || asEach <= 0) return [] as { y: number; As: number }[];
  if (n === 1) return [{ y: (y0 + y1) / 2, As: asEach }];
  const out: { y: number; As: number }[] = [];
  for (let i = 0; i < n; i++) {
    const k = i / (n - 1);
    out.push({ y: y0 + k * (y1 - y0), As: asEach });
  }
  return out;
}

export const placa: Engine = (raw) => {
  const lw = num(raw, "lw", 1.45);
  const t = num(raw, "t", 0.3);
  const hw = num(raw, "hw", 12.55);
  const hm = num(raw, "hm", 3.55);
  const fc = num(raw, "fc", 210);
  const fy = num(raw, "fy", 4200);
  const rec = num(raw, "rec", 4);
  const rhoBorde = num(raw, "rhoBorde", 0.01);
  const barBorde = str(raw, "barBorde", '3/4"');
  const barMalla = str(raw, "barMalla", '3/8"');
  const AbB = PLACA_AB[barBorde] ?? PLACA_AB['3/4"'];
  const AbM = PLACA_AB[barMalla] ?? PLACA_AB['3/8"'];

  type F = { name: string; p: number; v2: number; v3: number; tt: number; m2: number; m3: number };
  const cm: F = {
    name: "CM",
    p: num(raw, "Pcm", -39.513),
    v2: num(raw, "V2cm", 0.2618),
    v3: num(raw, "V3cm", -0.0042),
    tt: num(raw, "Tcm", -0.024),
    m2: num(raw, "M2cm", 0.0202),
    m3: num(raw, "M3cm", 0.9238),
  };
  const cv: F = {
    name: "CV",
    p: num(raw, "Pcv", -3.9263),
    v2: num(raw, "V2cv", 0.1096),
    v3: num(raw, "V3cv", 0.0024),
    tt: num(raw, "Tcv", -0.0034),
    m2: num(raw, "M2cv", 0.0077),
    m3: num(raw, "M3cv", 0.2379),
  };
  const dx: F = {
    name: "SDX",
    p: num(raw, "Pdx", 29.2855),
    v2: num(raw, "V2dx", 28.375),
    v3: num(raw, "V3dx", 0.1867),
    tt: num(raw, "Tdx", 0.2399),
    m2: num(raw, "M2dx", 0.4659),
    m3: num(raw, "M3dx", 98.0965),
  };
  const dy: F = {
    name: "SDY",
    p: num(raw, "Pdy", 19.6219),
    v2: num(raw, "V2dy", 19.5453),
    v3: num(raw, "V3dy", 0.5888),
    tt: num(raw, "Tdy", 0.2341),
    m2: num(raw, "M2dy", 1.5647),
    m3: num(raw, "M3dy", 66.6154),
  };

  const gP = 1.4 * cm.p + 1.7 * cv.p;
  const gV2 = 1.4 * cm.v2 + 1.7 * cv.v2;
  const gV3 = 1.4 * cm.v3 + 1.7 * cv.v3;
  const gT = 1.4 * cm.tt + 1.7 * cv.tt;
  const gM2 = 1.4 * cm.m2 + 1.7 * cv.m2;
  const gM3 = 1.4 * cm.m3 + 1.7 * cv.m3;
  const sP = 1.25 * (cm.p + cv.p);
  const sV2 = 1.25 * (cm.v2 + cv.v2);
  const sV3 = 1.25 * (cm.v3 + cv.v3);
  const sT = 1.25 * (cm.tt + cv.tt);
  const sM2 = 1.25 * (cm.m2 + cv.m2);
  const sM3 = 1.25 * (cm.m3 + cv.m3);
  const nP = 0.9 * cm.p;
  const nV2 = 0.9 * cm.v2;
  const nV3 = 0.9 * cm.v3;
  const nT = 0.9 * cm.tt;
  const nM2 = 0.9 * cm.m2;
  const nM3 = 0.9 * cm.m3;

  const row = (name: string, p: number, v2: number, v3: number, tt: number, m2: number, m3: number): F => ({
    name, p, v2, v3, tt, m2, m3,
  });

  const base: F[] = [
    row("1.4 CM + 1.7 CV", gP, gV2, gV3, gT, gM2, gM3),
    row("1.25(CM+CV)+SDX", sP + dx.p, sV2 + dx.v2, sV3 + dx.v3, sT + dx.tt, sM2 + dx.m2, sM3 + dx.m3),
    row("1.25(CM+CV)−SDX", sP - dx.p, sV2 - dx.v2, sV3 - dx.v3, sT - dx.tt, sM2 - dx.m2, sM3 - dx.m3),
    row("0.9 CM + SDX", nP + dx.p, nV2 + dx.v2, nV3 + dx.v3, nT + dx.tt, nM2 + dx.m2, nM3 + dx.m3),
    row("0.9 CM − SDX", nP - dx.p, nV2 - dx.v2, nV3 - dx.v3, nT - dx.tt, nM2 - dx.m2, nM3 - dx.m3),
    row("1.25(CM+CV)+SDY", sP + dy.p, sV2 + dy.v2, sV3 + dy.v3, sT + dy.tt, sM2 + dy.m2, sM3 + dy.m3),
    row("1.25(CM+CV)−SDY", sP - dy.p, sV2 - dy.v2, sV3 - dy.v3, sT - dy.tt, sM2 - dy.m2, sM3 - dy.m3),
    row("0.9 CM + SDY", nP + dy.p, nV2 + dy.v2, nV3 + dy.v3, nT + dy.tt, nM2 + dy.m2, nM3 + dy.m3),
    row("0.9 CM − SDY", nP - dy.p, nV2 - dy.v2, nV3 - dy.v3, nT - dy.tt, nM2 - dy.m2, nM3 - dy.m3),
  ];
  const combos: F[] = [
    ...base,
    ...base.slice(1).map((c) => row(`${c.name} (M−)`, c.p, c.v2, c.v3, c.tt, -c.m2, -c.m3)),
  ];

  const Pabs = Math.max(...combos.map((c) => Math.abs(c.p)));
  const Vu = Math.max(...combos.map((c) => Math.abs(c.v2)));
  const Mu = Math.max(...combos.map((c) => Math.abs(c.m3)));
  const Mu2 = Math.max(...combos.map((c) => Math.abs(c.m2)));
  const Tu = Math.max(...combos.map((c) => Math.abs(c.tt)));
  const govP = combos.reduce((a, c) => (Math.abs(c.p) > Math.abs(a.p) ? c : a), combos[0]);
  const govV = combos.reduce((a, c) => (Math.abs(c.v2) > Math.abs(a.v2) ? c : a), combos[0]);
  const govM = combos.reduce((a, c) => (Math.abs(c.m3) > Math.abs(a.m3) ? c : a), combos[0]);

  const Ag = lw * t;
  const cG = lw / 2;
  const Ig = (t * lw ** 3) / 12;
  const Pkg = Pabs * 1000;
  const Mkgcm = Mu * 100000;
  const sigPlus = Pkg / (Ag * 10000) + (Mkgcm * (cG * 100)) / (Ig * 1e8);
  const sigMinus = Pkg / (Ag * 10000) - (Mkgcm * (cG * 100)) / (Ig * 1e8);
  const sigMax = Math.max(Math.abs(sigPlus), Math.abs(sigMinus));
  const sigLim = 0.2 * fc;
  const needBE = sigMax > sigLim + 1e-9;

  const Le2t = 2 * t;
  const Le01 = 0.1 * lw;
  const Le = Math.max(Le2t, Le01);
  const Ac = Le * t * 10000;
  const AsBreq = rhoBorde * Le * t * 10000;
  const nBorde = evenCeil(AsBreq / AbB.as);
  const AsBprov = nBorde * AbB.as;
  const Pconf = Pabs / 2 + Mu / Math.max(lw, 1e-6);
  const phiCol = 0.7;
  const phiE = 0.8;
  const phiPn = (phiE * phiCol * (0.85 * fc * (Ac - AsBprov) + fy * AsBprov)) / 1000;
  const okPn = Pconf <= phiPn + 1e-6;

  const hwLw = hw / Math.max(lw, 1e-6);
  const tMinPiso = hm / 25;
  const ac = hwLw < 1.5 ? 0.8 : hwLw >= 2 ? 0.53 : 0.8 - (0.27 * (hwLw - 1.5)) / 0.5;
  const VnMax = 2.6 * Math.sqrt(fc) * Ag * 10;
  const Vc = ac * Math.sqrt(fc) * Ag * 10;
  const phiV = 0.85;
  const Vs = Math.max(0, Vu / phiV - Vc);
  const Aew = lw * 100 * t * 100;
  const rhohCalc = Vs / Math.max((fy / 1000) * Aew, 1e-9);
  const rhohmin = 0.0025;
  const rhoh = Math.max(rhohCalc, rhohmin);
  const Ash = rhoh * t * 100 * 100;
  const nFaces = 2;
  const sHraw = (nFaces * AbM.as) / Math.max(Ash, 1e-9);
  const sHcalc = Math.floor(sHraw * 100) / 100;
  const sHmax = Math.min(3 * t, 0.4);
  const sH = Math.min(sHcalc, sHmax);
  const sHcm = Math.max(5, Math.floor(sH * 100));

  const rhoVcalc = 0.0025 + 0.5 * (2.5 - hwLw) * (rhoh - 0.0025);
  const rhoVmin = 0.0025;
  const rhoV = Math.max(rhoVcalc, rhoVmin);
  const Asv = rhoV * t * 100 * 100;
  const sVraw = (nFaces * AbM.as) / Math.max(Asv, 1e-9);
  const sVcalc = Math.floor(sVraw * 100) / 100;
  const sV = Math.min(sVcalc, sHmax);
  const sVcm = Math.max(5, Math.floor(sV * 100));

  const hc = Math.max(t * 100 - 2 * rec, 8);
  const avsConf = (0.09 * hc * fc) / fy;
  const AvEst = 2 * PLACA_AB['3/8"'].as;
  const sConfCalc = AvEst / Math.max(avsConf, 1e-9);
  const sConfMax = Math.min(6 * AbB.db, 15);
  const sConf = Math.max(5, Math.floor(Math.min(sConfCalc, sConfMax)));

  const hcm = lw * 100;
  const bcm = t * 100;
  const Lecm = Le * 100;
  const ccB = rec + 0.95 + AbB.db / 2;
  const yL0 = -hcm / 2 + ccB;
  const yL1 = -hcm / 2 + Lecm - ccB;
  const yR1 = hcm / 2 - ccB;
  const yR0 = hcm / 2 - Lecm + ccB;
  const webLen = Math.max(lw - 2 * Le, 0.15);
  const AsWeb = rhoV * t * webLen * 10000;
  const nWeb = evenCeil(AsWeb / AbM.as, 2);
  const yW0 = -hcm / 2 + Lecm + AbM.db;
  const yW1 = hcm / 2 - Lecm - AbM.db;
  const layersM3 = [
    ...placeLayer(yL0, yL1, nBorde, AbB.as),
    ...placeLayer(yR0, yR1, nBorde, AbB.as),
    ...placeLayer(yW0, yW1, nWeb, AbM.as),
  ];
  const curveM3 = whitneyFromBars({ b: bcm, h: hcm, bars: layersM3, fc, fy });
  const AsTot = 2 * AsBprov + nWeb * AbM.as;
  const nBarTot = 2 * nBorde + nWeb;
  const curveM2 = whitneyPM({
    b: hcm,
    h: bcm,
    As: AsTot,
    nBar: Math.max(4, nBarTot),
    rec,
    fc,
    fy,
    db: AbB.db,
  });

  const demands = combos.map((c) => ({
    name: c.name,
    p: -c.p,
    m3: c.m3,
    m2: c.m2,
  }));
  const chk3 = demands.map((d) => ({ ...d, ...insidePM(curveM3, d.p, d.m3) }));
  const chk2 = demands.map((d) => ({ ...d, ...insidePM(curveM2, d.p, d.m2) }));
  const okM3 = chk3.every((c) => c.ok);
  const okM2 = chk2.every((c) => c.ok);
  const VuOk = Vu <= phiV * (Vc + Math.max(Vs, 0)) + 1e-6 && Vu / phiV <= VnMax + 1e-6;
  const tOk = t >= 0.15 && t + 1e-9 >= tMinPiso;

  const fmtC = (c: F) => [c.name, fmt(c.p, 2), fmt(c.v2, 2), fmt(c.v3, 2), fmt(c.tt, 2), fmt(c.m2, 2), fmt(c.m3, 2)];

  return out(
    `${needBE ? `${nBorde} Ø ${barBorde} en cada núcleo` : "Sin núcleo especial"}  ·  ${barMalla} @ ${sHcm} cm (H) y @ ${sVcm} cm (V) c/cara`,
    `lw×t = ${fmt(lw, 2)}×${fmt(t, 2)} m  ·  borde ${fmt(t * 100, 0)}×${fmt(Le * 100, 0)} cm  ·  Vu=${fmt(Vu, 1)} t  Mu=${fmt(Mu, 1)} t·m`,
    [
      {
        n: "01",
        title: "Datos previos y geometría",
        formula: "Ag = lw · t    ·    d ≈ 0.80 lw    ·    t ≥ máx(15 cm, hs/25)",
        substitution: `lw = ${fmt(lw, 2)} m   ·   t = ${fmt(t, 2)} m   ·   hw = ${fmt(hw, 2)} m   ·   hm = ${fmt(hm, 2)} m   ·   f'c = ${fmt(fc, 0)} kg/cm²   ·   fy = ${fmt(fy, 0)} kg/cm²`,
        result: `Ag = ${fmt(Ag, 3)} m² (${fmt(Ag * 10000, 0)} cm²)    ·    d = ${fmt(0.8 * lw, 2)} m    ·    t mín = ${fmt(Math.max(15, tMinPiso * 100), 1)} cm`,
        desarrollo: [
          `Área bruta: Ag = lw × t = ${fmt(lw, 2)} × ${fmt(t, 2)} = ${fmt(Ag, 3)} m² = ${fmt(Ag * 10000, 0)} cm².`,
          `Peralte efectivo en el plano (flexión de lw): d ≈ 0.80 lw = 0.80 × ${fmt(lw, 2)} = ${fmt(0.8 * lw, 2)} m.`,
          `Espesor mínimo por entrepiso E.060: t ≥ hs/25 = ${fmt(hm, 2)} / 25 = ${fmt(tMinPiso * 100, 1)} cm.`,
          `Espesor mínimo absoluto: t ≥ 15 cm. Adoptado t = ${fmt(t * 100, 0)} cm ${t >= 0.15 && t + 1e-9 >= tMinPiso ? "→ cumple ambos límites" : "→ NO cumple; aumentar t"}.`,
          `Esbeltez del muro: hw/lw = ${fmt(hw, 2)} / ${fmt(lw, 2)} = ${fmt(hwLw, 2)} (interviene en αc y en ρv).`,
        ],
        note: "La estación de diseño es Bottom del muro (ETABS Column). En placa sísmica gobiernan ρh mín = ρv mín = 0.0025 (E.060 11.8 y 21.9); las cuantías de muro ordinario 0.002 / 0.0015 no aplican.",
      },
      {
        n: "02",
        title: "Convenio de signos ETABS",
        formula: "P < 0 = compresión    ·    V2 y M3 en el plano de lw    ·    V3 y M2 fuera de plano",
        substitution: `CM: P=${fmt(cm.p, 2)} t  V2=${fmt(cm.v2, 2)}  M3=${fmt(cm.m3, 2)}   ·   CV: P=${fmt(cv.p, 2)}  V2=${fmt(cv.v2, 2)}  M3=${fmt(cv.m3, 2)}`,
        result: `SDX: V2=${fmt(dx.v2, 2)} t  M3=${fmt(dx.m3, 2)} t·m    ·    SDY: V2=${fmt(dy.v2, 2)} t  M3=${fmt(dy.m3, 2)} t·m`,
        desarrollo: [
          `Caso CM (Dead): P=${fmt(cm.p, 3)} t, V2=${fmt(cm.v2, 3)} t, V3=${fmt(cm.v3, 3)} t, T=${fmt(cm.tt, 3)} t·m, M2=${fmt(cm.m2, 3)} t·m, M3=${fmt(cm.m3, 3)} t·m.`,
          `Caso CV (Live): P=${fmt(cv.p, 3)} t, V2=${fmt(cv.v2, 3)} t, V3=${fmt(cv.v3, 3)} t, T=${fmt(cv.tt, 3)} t·m, M2=${fmt(cv.m2, 3)} t·m, M3=${fmt(cv.m3, 3)} t·m.`,
          `Espectro SDX (dirección X): P=${fmt(dx.p, 3)} t, V2=${fmt(dx.v2, 3)} t, M3=${fmt(dx.m3, 3)} t·m. Este es el sismo en el plano del muro.`,
          `Espectro SDY (dirección Y): P=${fmt(dy.p, 3)} t, V2=${fmt(dy.v2, 3)} t, M3=${fmt(dy.m3, 3)} t·m. Este es el sismo fuera de plano (M2 gobierna).`,
          `Los espectros entran en magnitud. El signo ± lo arma la combinación (E.060), no el valor pegado de ETABS.`,
        ],
        note: "Pegue P, V2, V3, T, M2 y M3 de la tabla de análisis (Story, Unique Name, Load Case, station Bottom). El espectro en Y se llama SDY; el ± lo arma la combinación, no el valor pegado de ETABS.",
      },
      {
        n: "03",
        title: "Factores de carga E.060",
        formula: "U = 1.4 CM + 1.7 CV    ·    U = 1.25(CM+CV) ± SD    ·    U = 0.90 CM ± SD",
        substitution: `1.4×(${fmt(cm.p, 2)})+1.7×(${fmt(cv.p, 2)}) = ${fmt(gP, 2)} t    ·    1.25(CM+CV)+SDX: P=${fmt(sP + dx.p, 2)} t  V2=${fmt(sV2 + dx.v2, 2)} t  M3=${fmt(sM3 + dx.m3, 2)} t·m`,
        result: `Envelope: |P|=${fmt(Pabs, 2)} t   |V2|=${fmt(Vu, 2)} t   |M3|=${fmt(Mu, 2)} t·m`,
        desarrollo: [
          `Gravedad: 1.4 CM + 1.7 CV → P = 1.4(${fmt(cm.p, 2)}) + 1.7(${fmt(cv.p, 2)}) = ${fmt(gP, 2)} t; V2 = ${fmt(gV2, 2)} t; M3 = ${fmt(gM3, 2)} t·m.`,
          `Carga sísmica de base: 1.25(CM+CV) → P = 1.25(${fmt(cm.p, 2)}+${fmt(cv.p, 2)}) = ${fmt(sP, 2)} t; V2 = ${fmt(sV2, 2)} t; M3 = ${fmt(sM3, 2)} t·m.`,
          `Más SDX: P = ${fmt(sP, 2)} + (${fmt(dx.p, 2)}) = ${fmt(sP + dx.p, 2)} t; V2 = ${fmt(sV2 + dx.v2, 2)} t; M3 = ${fmt(sM3 + dx.m3, 2)} t·m.`,
          `Menos SDX: P = ${fmt(sP, 2)} − (${fmt(dx.p, 2)}) = ${fmt(sP - dx.p, 2)} t; V2 = ${fmt(sV2 - dx.v2, 2)} t; M3 = ${fmt(sM3 - dx.m3, 2)} t·m.`,
          `Más SDY: P = ${fmt(sP, 2)} + (${fmt(dy.p, 2)}) = ${fmt(sP + dy.p, 2)} t; V2 = ${fmt(sV2 + dy.v2, 2)} t; M3 = ${fmt(sM3 + dy.m3, 2)} t·m.`,
          `0.90 CM ± SD cubre el caso de alivio de carga muerta. La tabla al pie lista las 9 combinaciones y las invertidas de momento.`,
        ],
        note: "Se replican SDX y SDY en ambos sentidos, y además se invierten M2 y M3 (combo «M−») para cubrir el sismo contrario. El envelope toma el máximo absoluto de cada componente.",
      },
      {
        n: "04",
        title: "Solicitaciones gobernantes",
        formula: "Pu = máx|P|    ·    Vu = máx|V2|    ·    Mu = máx|M3|",
        substitution: `|P| en «${govP.name}» = ${fmt(Math.abs(govP.p), 2)} t    ·    |V2| en «${govV.name}» = ${fmt(Math.abs(govV.v2), 2)} t    ·    |M3| en «${govM.name}» = ${fmt(Math.abs(govM.m3), 2)} t·m`,
        result: `Pu = ${fmt(Pabs, 2)} t    Vu = ${fmt(Vu, 2)} t    Mu = ${fmt(Mu, 2)} t·m    ·    |M2|=${fmt(Mu2, 2)}    |T|=${fmt(Tu, 2)} t·m`,
        desarrollo: [
          `El axial de diseño Pu = ${fmt(Pabs, 2)} t proviene de la combinación «${govP.name}» (P = ${fmt(govP.p, 2)} t).`,
          `El corte de alma Vu = ${fmt(Vu, 2)} t proviene de «${govV.name}» (V2 = ${fmt(govV.v2, 2)} t).`,
          `El momento en el plano Mu = ${fmt(Mu, 2)} t·m proviene de «${govM.name}» (M3 = ${fmt(govM.m3, 2)} t·m).`,
          `Fuera de plano se informa |M2| = ${fmt(Mu2, 2)} t·m y |T| = ${fmt(Tu, 2)} t·m (no arman el alma; M2 entra al diagrama P–M2).`,
        ],
        note: "El diseño del alma y de los núcleos usa este envelope (criterio conservador: máximos absolutos, no necesariamente de la misma combinación).",
      },
      {
        n: "05",
        title: "Propiedades de la sección bruta",
        formula: "A = lw t    ·    c = lw/2    ·    I = t lw³ / 12",
        substitution: `A = ${fmt(lw, 2)}×${fmt(t, 2)} = ${fmt(Ag, 3)} m²    ·    c = ${fmt(cG, 3)} m    ·    I = ${fmt(t, 2)}×${fmt(lw, 2)}³/12`,
        result: `A = ${fmt(Ag * 10000, 0)} cm²    ·    I = ${fmt(Ig, 6)} m⁴ = ${fmt(Ig * 1e8, 0)} cm⁴`,
        desarrollo: [
          `A = ${fmt(lw, 2)} × ${fmt(t, 2)} = ${fmt(Ag, 3)} m² = ${fmt(Ag * 10000, 0)} cm².`,
          `Distancia al extremo: c = lw/2 = ${fmt(lw, 2)}/2 = ${fmt(cG, 3)} m = ${fmt(cG * 100, 1)} cm.`,
          `Inercia en el plano: I = t·lw³/12 = ${fmt(t, 2)} × ${fmt(lw, 2)}³ / 12 = ${fmt(Ig, 6)} m⁴ = ${fmt(Ig * 1e8, 0)} cm⁴.`,
        ],
        note: "E.060 21.9.6.2 / ACI 18.10.6.2: el esfuerzo extremo se calcula con modelo elástico lineal y propiedades brutas, bajo fuerzas factoradas.",
      },
      {
        n: "06",
        title: "Esfuerzo extremo de compresión",
        formula: "σ = P/A  ±  M c / I",
        substitution: `P=${fmt(Pkg, 0)} kg    A=${fmt(Ag * 10000, 0)} cm²    M=${fmt(Mkgcm, 0)} kg·cm    c=${fmt(cG * 100, 1)} cm`,
        result: `σ+ = ${fmt(sigPlus, 1)} kg/cm²    σ− = ${fmt(sigMinus, 1)} kg/cm²    ·    σmáx = ${fmt(sigMax, 1)} kg/cm²`,
        desarrollo: [
          `Se trabaja en kg y cm: P = ${fmt(Pabs, 2)} t × 1000 = ${fmt(Pkg, 0)} kg; M = ${fmt(Mu, 2)} t·m × 100 000 = ${fmt(Mkgcm, 0)} kg·cm.`,
          `P/A = ${fmt(Pkg, 0)} / ${fmt(Ag * 10000, 0)} = ${fmt(Pkg / (Ag * 10000), 2)} kg/cm².`,
          `M c / I = ${fmt(Mkgcm, 0)} × ${fmt(cG * 100, 1)} / ${fmt(Ig * 1e8, 0)} = ${fmt((Mkgcm * (cG * 100)) / (Ig * 1e8), 2)} kg/cm².`,
          `σ+ = P/A + Mc/I = ${fmt(sigPlus, 1)} kg/cm² (extremo más comprimido). σ− = P/A − Mc/I = ${fmt(sigMinus, 1)} kg/cm².`,
        ],
        note: "Se toma |P|máx con |M3|máx (envelope). Compresión positiva en esta fórmula.",
      },
      {
        n: "07",
        title: "¿Se requieren elementos de borde?",
        formula: "σmáx  ≷  0.20 f'c",
        substitution: `${fmt(sigMax, 1)}  ${needBE ? ">" : "≤"}  0.20×${fmt(fc, 0)} = ${fmt(sigLim, 1)} kg/cm²`,
        result: needBE ? "Requiere elemento de confinamiento en los extremos" : "OK — no exige núcleo especial por esfuerzo",
        desarrollo: [
          `Límite de norma: 0.20 f'c = 0.20 × ${fmt(fc, 0)} = ${fmt(sigLim, 1)} kg/cm².`,
          `Comparación: σmáx = ${fmt(sigMax, 1)} kg/cm² ${needBE ? ">" : "≤"} ${fmt(sigLim, 1)} kg/cm² → ${needBE ? "hay que confinar los extremos" : "no se exige núcleo especial por esfuerzo"}.`,
        ],
        note: needBE
          ? "Cuando σ > 0.20 f'c el extremo comprimido debe confinarse como columna estribada (E.060 21.9.6). El núcleo se retira cuando σ baja de 0.15 f'c en pisos superiores."
          : "Aun sin núcleo especial se arma el alma a cuantía mínima y se detalla el extremo con estribos de borde.",
        ok: true,
      },
      {
        n: "08",
        title: "Dimensión del elemento de borde",
        formula: "ℓe = máx(2 t ,  0.1 lw)",
        substitution: `2t = ${fmt(Le2t * 100, 1)} cm    ·    0.1 lw = ${fmt(Le01 * 100, 1)} cm`,
        result: `Elemento de borde: ${fmt(t * 100, 0)} cm × ${fmt(Le * 100, 0)} cm    (${fmt(t, 2)} m × ${fmt(Le, 2)} m)`,
        desarrollo: [
          `2 t = 2 × ${fmt(t * 100, 0)} = ${fmt(Le2t * 100, 1)} cm.`,
          `0.10 lw = 0.10 × ${fmt(lw * 100, 1)} = ${fmt(Le01 * 100, 1)} cm.`,
          `ℓe = máx(${fmt(Le2t * 100, 1)}, ${fmt(Le01 * 100, 1)}) = ${fmt(Le * 100, 1)} cm a cada extremo.`,
          `Alma central = lw − 2 ℓe = ${fmt(lw, 2)} − 2×${fmt(Le, 2)} = ${fmt(Math.max(lw - 2 * Le, 0), 2)} m.`,
        ],
        note: "Se adopta el mayor de 2t y 0.1 lw a cada extremo.",
      },
      {
        n: "09",
        title: "Acero longitudinal del núcleo",
        formula: "As = ρ · ℓe · t    ·    n par    ·    Ø a elección",
        substitution: `ρ=${fmt(rhoBorde * 100, 2)} %    ·    As req = ${fmt(rhoBorde, 3)}×${fmt(Le, 2)}×${fmt(t, 2)}×10000 = ${fmt(AsBreq, 2)} cm²    ·    Ø ${barBorde} = ${fmt(AbB.as, 2)} cm²`,
        result: `${nBorde} Ø ${barBorde}  (As = ${fmt(AsBprov, 2)} cm²) en cada extremo`,
        desarrollo: [
          `As requerida = ρ · ℓe · t = ${fmt(rhoBorde, 3)} × ${fmt(Le, 2)} × ${fmt(t, 2)} × 10 000 = ${fmt(AsBreq, 2)} cm².`,
          `Área de una barra Ø ${barBorde}: Ab = ${fmt(AbB.as, 2)} cm².`,
          `n = As/Ab = ${fmt(AsBreq, 2)} / ${fmt(AbB.as, 2)} = ${fmt(AsBreq / AbB.as, 2)} → se redondea al par siguiente, mínimo 4: n = ${nBorde}.`,
          `As colocada = ${nBorde} × ${fmt(AbB.as, 2)} = ${fmt(AsBprov, 2)} cm² en cada núcleo.`,
        ],
        note: "Se redondea al entero par siguiente (mínimo 4) para simetría del núcleo. Cuantía típica 1 %; no bajar de 0.01 en columna estribada.",
      },
      {
        n: "10",
        title: "Carga última en el elemento de borde",
        formula: "Pconf = Pu/2 + Mu/lw    ·    φPn = φe φ [0.85 f'c (Ac−As) + fy As]",
        substitution: `Pconf = ${fmt(Pabs, 2)}/2 + ${fmt(Mu, 2)}/${fmt(lw, 2)} = ${fmt(Pconf, 2)} t    ·    φ=0.70 (estribada)  φe=0.80    Ac=${fmt(Ac, 0)} cm²`,
        result: `Pconf = ${fmt(Pconf, 2)} t    ${okPn ? "≤" : ">"}    φPn = ${fmt(phiPn, 2)} t`,
        desarrollo: [
          `La mitad del axial más el par Mu/lw se asigna al núcleo comprimido: Pconf = ${fmt(Pabs, 2)}/2 + ${fmt(Mu, 2)}/${fmt(lw, 2)} = ${fmt(Pabs / 2, 2)} + ${fmt(Mu / Math.max(lw, 1e-6), 2)} = ${fmt(Pconf, 2)} t.`,
          `Ac = ℓe · t = ${fmt(Le, 2)} × ${fmt(t, 2)} × 10 000 = ${fmt(Ac, 0)} cm².`,
          `Po = 0.85 f'c (Ac−As) + fy As = 0.85×${fmt(fc, 0)}×(${fmt(Ac, 0)}−${fmt(AsBprov, 2)}) + ${fmt(fy, 0)}×${fmt(AsBprov, 2)}.`,
          `φPn = 0.80 × 0.70 × Po / 1000 = ${fmt(phiPn, 2)} t. Verificación: Pconf ${okPn ? "≤" : ">"} φPn.`,
        ],
        note: okPn
          ? "La mitad del axial más el par Mu/lw cabe en el núcleo propuesto."
          : "Aumentar ℓe, t o As del núcleo (más barras o mayor diámetro).",
        ok: okPn,
      },
      {
        n: "11",
        title: "Tope de corte de la sección",
        formula: "Vn ≤ 2.6 √f'c Acw    ·    Vu/φ ≤ Vn",
        substitution: `Acw=${fmt(Ag, 3)} m²    ·    2.6√${fmt(fc, 0)}×${fmt(Ag, 3)}×10 = ${fmt(VnMax, 1)} t    ·    Vu/0.85=${fmt(Vu / phiV, 2)} t`,
        result: `Vu = ${fmt(Vu, 2)} t    ≤    φ·2.6√f'c Acw = ${fmt(phiV * VnMax, 1)} t`,
        desarrollo: [
          `√f'c = √${fmt(fc, 0)} = ${fmt(Math.sqrt(fc), 2)}.`,
          `Vn,máx = 2.6 √f'c Acw = 2.6 × ${fmt(Math.sqrt(fc), 2)} × ${fmt(Ag, 3)} × 10 = ${fmt(VnMax, 1)} t  (el ×10 pasa de kg/cm²·m² a toneladas).`,
          `Vu/φ = ${fmt(Vu, 2)} / 0.85 = ${fmt(Vu / phiV, 2)} t ${Vu / phiV <= VnMax + 1e-6 ? "≤" : ">"} ${fmt(VnMax, 1)} t.`,
        ],
        note: "Si Vu/φ supera 2.6 √f'c Acw hay que engrosar el muro o alargarlo; no se resuelve solo con más estribos (E.060 11.8 / 21.9.4).",
        ok: Vu / phiV <= VnMax + 1e-6,
      },
      {
        n: "12",
        title: "Coeficiente αc y resistencia del concreto",
        formula: "hw/lw ≤ 1.5 → αc=0.80    ·    hw/lw ≥ 2 → αc=0.53    ·    interpolar    ·    Vc = αc √f'c Acw",
        substitution: `hw/lw = ${fmt(hw, 2)}/${fmt(lw, 2)} = ${fmt(hwLw, 2)}    →    αc = ${fmt(ac, 2)}`,
        result: `Vc = ${fmt(Vc, 2)} t    ·    φVc = ${fmt(phiV * Vc, 2)} t`,
        desarrollo: [
          `hw/lw = ${fmt(hwLw, 2)}. ${hwLw < 1.5 ? "≤ 1.5 → αc = 0.80" : hwLw >= 2 ? "≥ 2.0 → αc = 0.53" : `Entre 1.5 y 2.0: αc = 0.80 − 0.27(hw/lw − 1.5)/0.5 = ${fmt(ac, 2)}`}.`,
          `Vc = αc √f'c Acw = ${fmt(ac, 2)} × ${fmt(Math.sqrt(fc), 2)} × ${fmt(Ag, 3)} × 10 = ${fmt(Vc, 2)} t.`,
          `φVc = 0.85 × ${fmt(Vc, 2)} = ${fmt(phiV * Vc, 2)} t.`,
        ],
        note: "E.060 interpola αc entre 1.5 y 2.0 (no se usa el corte binario 0.80 / 0.53). En muros esbeltos (hw/lw≫2) αc queda en 0.53.",
      },
      {
        n: "13",
        title: "Cortante de acero y cuantía horizontal",
        formula: "Vs = Vu/φ − Vc    ·    ρh = Vs /(fy Acw)    ·    ρh ≥ 0.0025",
        substitution: `Vs = ${fmt(Vu, 2)}/0.85 − ${fmt(Vc, 2)} = ${fmt(Vs, 2)} t    ·    ρh calc = ${fmt(rhohCalc, 5)}    ·    ρh mín = 0.0025`,
        result: `Usar ρh = ${fmt(rhoh, 4)}    ·    Ash = ${fmt(Ash, 2)} cm²/m`,
        desarrollo: [
          `Vs = Vu/φ − Vc = ${fmt(Vu, 2)}/0.85 − ${fmt(Vc, 2)} = ${fmt(Vu / phiV, 2)} − ${fmt(Vc, 2)} = ${fmt(Vs, 2)} t (si sale negativo se toma 0).`,
          `ρh calc = Vs / (fy Acw) = ${fmt(Vs, 2)} / [(${fmt(fy, 0)}/1000) × ${fmt(Aew, 0)}] = ${fmt(rhohCalc, 5)}.`,
          `ρh = máx(${fmt(rhohCalc, 5)}, 0.0025) = ${fmt(rhoh, 4)}.`,
          `Ash = ρh · t · 100 = ${fmt(rhoh, 4)} × ${fmt(t * 100, 0)} × 100 / 100… Ash = ${fmt(Ash, 2)} cm² por metro de altura.`,
        ],
        note: rhohCalc + 1e-9 < rhohmin ? "Gobierna la cuantía mínima: el concreto cubre casi todo el Vu." : "La cuantía de diseño supera el mínimo; se arma por Vs.",
      },
      {
        n: "14",
        title: "Malla horizontal (dos caras)",
        formula: "s = 2 Ab / Ash    ·    s ≤ mín(3t, 40 cm)",
        substitution: `2×${fmt(AbM.as, 2)}/${fmt(Ash, 2)} = ${fmt(sHraw, 3)} m    ·    3t=${fmt(3 * t, 2)} m    ·    0.40 m`,
        result: `Usar ${barMalla} @ ${fmt(sH, 2)} m  (${sHcm} cm) en cada cara`,
        desarrollo: [
          `Dos cortinas: s = 2 Ab / Ash = 2 × ${fmt(AbM.as, 2)} / ${fmt(Ash, 2)} = ${fmt(sHraw, 3)} m = ${fmt(sHraw * 100, 1)} cm.`,
          `s máx = mín(3t, 40 cm) = mín(${fmt(3 * t * 100, 0)} cm, 40 cm) = ${fmt(sHmax * 100, 0)} cm.`,
          `s adoptado = mín(s calc truncado al cm, s máx) = ${sHcm} cm c/cara.`,
        ],
        note: "Dos cortinas (ambas caras). s se trunca hacia abajo al cm, luego se corta con s máx.",
      },
      {
        n: "15",
        title: "Cuantía vertical del alma",
        formula: "ρv = 0.0025 + 0.5 (2.5 − hw/lw)(ρh − 0.0025)    ≥    0.0025",
        substitution: `ρv = 0.0025 + 0.5×(${fmt(2.5 - hwLw, 2)})×(${fmt(rhoh - 0.0025, 5)}) = ${fmt(rhoVcalc, 5)}`,
        result: `Usar ρv = ${fmt(rhoV, 4)}    ·    Asv = ${fmt(Asv, 2)} cm²/m`,
        desarrollo: [
          `(2.5 − hw/lw) = 2.5 − ${fmt(hwLw, 2)} = ${fmt(2.5 - hwLw, 2)}.`,
          `(ρh − 0.0025) = ${fmt(rhoh, 4)} − 0.0025 = ${fmt(rhoh - 0.0025, 5)}.`,
          `ρv calc = 0.0025 + 0.5 × ${fmt(2.5 - hwLw, 2)} × ${fmt(rhoh - 0.0025, 5)} = ${fmt(rhoVcalc, 5)}.`,
          `ρv = máx(${fmt(rhoVcalc, 5)}, 0.0025) = ${fmt(rhoV, 4)} → Asv = ${fmt(Asv, 2)} cm²/m.`,
        ],
        note: "Si hw/lw ≥ 2.5 el paréntesis es negativo y gobierna ρv = 0.0025 (muro esbelto).",
      },
      {
        n: "16",
        title: "Malla vertical (dos caras)",
        formula: "s = 2 Ab / Asv    ·    s ≤ mín(3t, 40 cm)",
        substitution: `2×${fmt(AbM.as, 2)}/${fmt(Asv, 2)} = ${fmt(sVraw, 3)} m`,
        result: `Usar ${barMalla} @ ${fmt(sV, 2)} m  (${sVcm} cm) en cada cara`,
        desarrollo: [
          `s = 2 Ab / Asv = 2 × ${fmt(AbM.as, 2)} / ${fmt(Asv, 2)} = ${fmt(sVraw, 3)} m = ${fmt(sVraw * 100, 1)} cm.`,
          `s adoptado = ${sVcm} cm c/cara, con el mismo s máx = ${fmt(sHmax * 100, 0)} cm.`,
        ],
        note: `Despiece de alma: ${barMalla} horizontal @ ${sHcm} cm y vertical @ ${sVcm} cm, ambas caras, fuera de los núcleos.`,
      },
      {
        n: "17",
        title: "Estribos de confinamiento del núcleo",
        formula: "Ash/s ≥ 0.09 hc f'c / fy    ·    s ≤ mín(6 db long, 15 cm)",
        substitution: `hc = t − 2r = ${fmt(hc, 1)} cm    ·    Ash/s = 0.09×${fmt(hc, 1)}×${fmt(fc, 0)}/${fmt(fy, 0)} = ${fmt(avsConf, 3)} cm²/cm    ·    Ø 3/8" 2 ramas = ${fmt(AvEst, 2)} cm²`,
        result: needBE ? `Estribos Ø 3/8" @ ${sConf} cm en el núcleo (s máx = ${fmt(sConfMax, 0)} cm)` : "Sin núcleo especial: estribos de borde @ 10 cm en los 50 cm extremos de cada piso",
        desarrollo: [
          `Núcleo confinado: hc = t − 2 recubrimientos = ${fmt(t * 100, 0)} − 2×${fmt(rec, 1)} = ${fmt(hc, 1)} cm.`,
          `Ash/s req = 0.09 hc f'c / fy = 0.09 × ${fmt(hc, 1)} × ${fmt(fc, 0)} / ${fmt(fy, 0)} = ${fmt(avsConf, 3)} cm²/cm.`,
          `Estribo Ø 3/8" de 2 ramas: Av = ${fmt(AvEst, 2)} cm² → s calc = Av / (Ash/s) = ${fmt(sConfCalc, 1)} cm.`,
          `s máx = mín(6 db, 15 cm) = mín(${fmt(6 * AbB.db, 1)}, 15) = ${fmt(sConfMax, 0)} cm. Se adopta s = ${sConf} cm.`,
        ],
        note: "Además de verificar φPn, el núcleo se cierra como columna estribada (E.060 21.9.6.4). Ganchos a 135° y ramales ≤ 35 cm.",
      },
      {
        n: "18",
        title: "Diagrama de interacción de la placa",
        formula: "Whitney: εcu=0.003    ·    φ=0.70→0.90    ·    φPn,máx = 0.80 φ Po  (estribada)",
        substitution: `Núcleos: 2×(${nBorde} Ø ${barBorde})    ·    alma: ${nWeb} Ø ${barMalla}    ·    sección ${fmt(bcm, 0)}×${fmt(hcm, 0)} cm`,
        result: okM3 ? "Todos los puntos (P, M3) quedan dentro de φPn–φMn" : "Hay combinaciones fuera del diagrama M3 — aumentar núcleos o lw",
        desarrollo: [
          `Sección para M3 (plano del muro): b = t = ${fmt(bcm, 0)} cm, h = lw = ${fmt(hcm, 0)} cm. Barras: 2 núcleos de ${nBorde} Ø ${barBorde} más ${nWeb} Ø ${barMalla} en el alma.`,
          `P de ETABS es negativo a compresión; en el diagrama se grafica −P (compresión hacia arriba).`,
          `Los cuatro gráficos: M3–SDX+ / M3–SDX− (plano) y M2–SDY+ / M2–SDY− (fuera de plano). El punto dorado es la combinación de mayor |M|.`,
          `Verificación M3: ${okM3 ? "todas las combinaciones dentro de la envolvente." : "hay puntos fuera: aumentar As de núcleo, ℓe o lw."} Verificación M2: ${okM2 ? "OK." : "fuera de envolvente fuera de plano."}`,
        ],
        note: "P se pasa a compresión positiva (−P de ETABS). El croquis P–M muestra la envolvente in-plane (M3) y fuera de plano (M2), con los puntos de combinación.",
        ok: okM3,
      },
    ],
    [
      ok("t ≥ 15 cm", `${fmt(t * 100, 0)} cm`, "≥ 15 cm", t >= 0.15),
      ok("t ≥ hs/25", `${fmt(t * 100, 0)} cm`, `≥ ${fmt(tMinPiso * 100, 1)} cm`, tOk),
      ok("σmáx vs 0.20 f'c", `${fmt(sigMax, 1)} kg/cm²`, `${needBE ? ">" : "≤"} ${fmt(sigLim, 1)} → ${needBE ? "núcleo" : "OK"}`, true),
      ok("Pconf ≤ φPn núcleo", `${fmt(Pconf, 1)} t`, `φPn=${fmt(phiPn, 1)} t`, okPn),
      ok("Vu/φ ≤ 2.6 √f'c Acw", `${fmt(Vu / phiV, 1)} t`, `≤ ${fmt(VnMax, 1)} t`, Vu / phiV <= VnMax + 1e-6),
      ok("Vu ≤ φ(Vc+Vs)", `${fmt(Vu, 1)} t`, `${fmt(phiV * (Vc + Vs), 1)} t`, VuOk),
      ok("ρh ≥ 0.0025", fmt(rhoh, 4), "≥ 0.0025", rhoh >= 0.0025 - 1e-9),
      ok("ρv ≥ 0.0025", fmt(rhoV, 4), "≥ 0.0025", rhoV >= 0.0025 - 1e-9),
      ok("s horiz. ≤ mín(3t, 40 cm)", `${sHcm} cm`, `≤ ${fmt(sHmax * 100, 0)} cm`, sH <= sHmax + 1e-9),
      ok("Puntos M3 dentro de φP–φM", okM3 ? "OK" : "fuera", "envolvente in-plane", okM3),
      ok("Puntos M2 dentro de φP–φM", okM2 ? "OK" : "fuera", "envolvente fuera de plano", okM2),
    ],
    [
      {
        title: "Combinaciones E.060 (estación Bottom)",
        rows: [["Combo", "P (t)", "V2 (t)", "V3 (t)", "T (t·m)", "M2 (t·m)", "M3 (t·m)"], ...base.map(fmtC)],
      },
      {
        title: "SDX/SDY con momentos invertidos (sentido contrario)",
        rows: [["Combo", "P (t)", "V2 (t)", "V3 (t)", "T (t·m)", "M2 (t·m)", "M3 (t·m)"], ...combos.filter((c) => c.name.includes("M−")).map(fmtC)],
      },
      {
        title: "Diagrama de interacción — M3 (0° / 180°, plano del muro)",
        rows: fmtPtsTable(curveM3),
      },
      {
        title: "Diagrama de interacción — M2 (90° / 270°, fuera de plano)",
        rows: fmtPtsTable(curveM2),
      },
    ],
    {
      lw: String(lw),
      t: String(t),
      hw: String(hw),
      hm: String(hm),
      Le: String(Le),
      nBorde: String(nBorde),
      barBorde,
      barMalla,
      sHcm: String(sHcm),
      sVcm: String(sVcm),
      needBE: needBE ? "1" : "0",
      pmKind: "placa",
      pm3: encodePts(curveM3),
      pm2: encodePts(curveM2),
      dem3: encodeDemands(demands.map((d) => ({ p: d.p, m: d.m3, name: d.name }))),
      dem2: encodeDemands(demands.map((d) => ({ p: d.p, m: d.m2, name: d.name }))),
      dem3p: encodeDemands(demands.filter((d) => d.m3 >= -1e-9).map((d) => ({ p: d.p, m: Math.abs(d.m3), name: d.name }))),
      dem3n: encodeDemands(demands.filter((d) => d.m3 <= 1e-9).map((d) => ({ p: d.p, m: Math.abs(d.m3), name: d.name }))),
      dem2p: encodeDemands(demands.filter((d) => d.m2 >= -1e-9).map((d) => ({ p: d.p, m: Math.abs(d.m2), name: d.name }))),
      dem2n: encodeDemands(demands.filter((d) => d.m2 <= 1e-9).map((d) => ({ p: d.p, m: Math.abs(d.m2), name: d.name }))),
    }
  );
};

export const pilotes: Engine = (raw) => {
  const PD = num(raw, "PD", 80);
  const PL = num(raw, "PL", 40);
  const Df = num(raw, "Df", 6.5);
  const phi = num(raw, "phi", 24);
  const D = num(raw, "D", 0.4);
  const P = PD + PL;
  const L = Df - 0.5;
  const Qf = 1 * 1.5 * Math.tan((phi * Math.PI) / 180) * 4 * D * D * (15 * L) * 0.1;
  const Qu = Qf + 40 * D * D;
  const Qa = Qu / 2.5;
  const nPil = Math.max(2, Math.ceil(P / Math.max(Qa, 0.1)));
  return out(
    `${nPil} pilotes ${fmt(D * 100, 0)}×${fmt(D * 100, 0)} cm  ·  Qa=${fmt(Qa, 1)} t`,
    `L = ${fmt(L, 2)} m  ·  Qu = ${fmt(Qu, 1)} t`,
    [
      { n: "01", title: "Longitud", formula: "L ≈ Df − empotramiento de cabezal", result: `${fmt(L, 2)} m` },
      { n: "02", title: "Capacidad", formula: "Qu = Qf + Qp    Qa = Qu/2.5", result: `Qa = ${fmt(Qa, 1)} t` },
      { n: "03", title: "Número", formula: "n = P / Qa", substitution: `P=${fmt(P, 1)} t`, result: `${nPil} pilotes` },
    ],
    [ok("n·Qa ≥ P", `${fmt(nPil * Qa, 1)} t`, `≥ ${fmt(P, 1)} t`, nPil * Qa >= P)]
  );
};

export const estructuras: Record<string, Engine> = {
  predColumnas,
  predVigasLosas,
  espectroE030,
  vigaFlexion,
  vigaCortante,
  vigaDoble,
  columnaEsbeltez,
  diagramaInteraccion,
  zapataAislada,
  zapataCombinada,
  zapataCorrida,
  platea,
  pilotes,
  escalera,
  viguetas,
  losa1d,
  losa2d,
  placa,
};

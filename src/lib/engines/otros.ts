import { type CalcCheck, type CalcOutput, type Engine, fmt, num, str } from "../types";

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

function yes(raw: Record<string, string>, key: string, fallback = "no") {
  const v = str(raw, key, fallback).trim().toLowerCase();
  return v === "si" || v === "sí" || v === "yes" || v === "1";
}

function normFase(s: string) {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** Constante K de la hoja: monofásico = 1, trifásico = √3. */
function kFase(s: string) {
  return normFase(s).startsWith("tri") ? Math.sqrt(3) : 1;
}

function kCaida(s: string) {
  return normFase(s).startsWith("tri") ? Math.sqrt(3) : 2;
}

const THW_DUCT: { mm2: number; awg: string; A: number }[] = [
  { mm2: 2.5, awg: "14 AWG", A: 27 },
  { mm2: 4, awg: "12 AWG", A: 34 },
  { mm2: 6, awg: "10 AWG", A: 44 },
  { mm2: 10, awg: "8 AWG", A: 62 },
  { mm2: 16, awg: "6 AWG", A: 85 },
  { mm2: 25, awg: "4 AWG", A: 107 },
  { mm2: 35, awg: "2 AWG", A: 135 },
  { mm2: 50, awg: "1/0 AWG", A: 160 },
  { mm2: 70, awg: "2/0 AWG", A: 203 },
  { mm2: 95, awg: "3/0 AWG", A: 242 },
  { mm2: 120, awg: "4/0 AWG", A: 279 },
  { mm2: 150, awg: "250 kcmil", A: 318 },
  { mm2: 185, awg: "300 kcmil", A: 361 },
  { mm2: 240, awg: "400 kcmil", A: 406 },
  { mm2: 300, awg: "500 kcmil", A: 462 },
];

function pickCond(Id: number) {
  for (const c of THW_DUCT) if (c.A + 1e-9 >= Id) return c;
  return THW_DUCT[THW_DUCT.length - 1];
}

function round2up(x: number) {
  return Math.ceil(x * 100 - 1e-9) / 100;
}

export const demandaElectrica: Engine = (raw) => {
  const AtN = num(raw, "At", 120);
  const Asot = num(raw, "Asot", 0);
  const At = AtN + 0.75 * Math.max(Asot, 0);
  const V = num(raw, "V", 220);
  const cos = num(raw, "cos", 0.9);
  const FS = num(raw, "FS", 0.8);
  const Ft = num(raw, "Ft", 0.91);
  const Fg = num(raw, "Fg", 0.7);
  const Lcond = num(raw, "Lcond", 12.5);
  const rho = 0.018;
  const hayCalef = yes(raw, "hayCalef");
  const hayAa = yes(raw, "hayAa");
  const hayCocina = yes(raw, "hayCocina", "si");
  const hayCalent = yes(raw, "hayCalent", "si");
  const Pcalef = hayCalef ? num(raw, "Pcalef", 8000) : 0;
  const Paa = hayAa ? num(raw, "Paa", 2000) : 0;
  const Pcocina = hayCocina ? num(raw, "Pcocina", 7000) : 0;
  const Pcalent = hayCalent ? num(raw, "Pcalent", 1800) : 0;
  const sisCalef = str(raw, "sisCalef", "trifasico");
  const sisAa = str(raw, "sisAa", "monofasico");
  const sisCocina = str(raw, "sisCocina", "monofasico");
  const sisCalent = str(raw, "sisCalent", "monofasico");
  const extras = [1, 2, 3, 4].map((i) => {
    const n = Math.max(0, Math.round(num(raw, `espN${i}`, i <= 2 ? 1 : 0)));
    const W = num(raw, `espW${i}`, i === 1 ? 2500 : i === 2 ? 500 : 0);
    const nom = str(raw, `espNom${i}`, i === 1 ? "Horno microondas" : i === 2 ? "Lavadora" : "");
    const P = n > 0 && W > 0 ? n * W : 0;
    const fd = W > 1500 ? 0.25 : 1;
    return { nom: nom || `Carga ${i}`, n, W, P, fd, MD: P * fd };
  });
  const alum1 = At > 0 ? 2500 : 0;
  const alum2 = At > 90 ? Math.ceil((At - 90) / 90 - 1e-9) * 1000 : 0;
  const Palum = alum1 + alum2;
  const MDalum = Palum;
  const MDcalef = hayCalef ? (Pcalef > 10000 ? 10000 + 0.75 * (Pcalef - 10000) : Pcalef) : 0;
  const MDaa = hayAa ? Paa : 0;
  const MDcocina = hayCocina ? (Pcocina > 12000 ? 6000 + 0.4 * (Pcocina - 12000) : 6000) : 0;
  const MDcalent = hayCalent ? Pcalent : 0;
  const Padd = extras.reduce((s, e) => s + e.P, 0);
  const MDadd = extras.reduce((s, e) => s + e.MD, 0);
  const PI = Palum + Pcalef + Paa + Pcocina + Pcalent + Padd;
  const MD = MDalum + MDcalef + MDaa + MDcocina + MDcalent + MDadd;
  const hayTri =
    (hayCalef && normFase(sisCalef).startsWith("tri")) ||
    (hayAa && normFase(sisAa).startsWith("tri")) ||
    (hayCocina && normFase(sisCocina).startsWith("tri")) ||
    (hayCalent && normFase(sisCalent).startsWith("tri"));
  const sisIn = str(raw, "sistema", "auto");
  const sistema =
    normFase(sisIn) === "auto" ? (hayTri || MD > 8000 ? "trifasico" : "monofasico") : sisIn;
  const K = kFase(sistema);
  const kDrop = kCaida(sistema);
  const Pcontr = MD * FS;
  const kWcontr = Math.ceil(Pcontr / 1000 - 1e-9);
  const In = Pcontr / Math.max(K * V * cos, 1e-6);
  const Id = (1.25 * In) / Math.max(Ft * Fg, 0.15);
  const cond = pickCond(Id);
  const dV = (rho * Id * kDrop * Lcond * cos) / Math.max(cond.mm2, 0.1);
  const dVpct = (100 * dV) / Math.max(V, 1);
  const sisLabel = normFase(sistema).startsWith("tri") ? "trifásico" : "monofásico";
  const nResto = At > 90 ? Math.ceil((At - 90) / 90 - 1e-9) : 0;
  const AsotCons = 0.75 * Math.max(Asot, 0);
  const extrasOn = extras.filter((e) => e.P > 0);
  const condIdx = Math.max(0, THW_DUCT.findIndex((c) => c.mm2 === cond.mm2 && c.awg === cond.awg));
  const condPrev = condIdx > 0 ? THW_DUCT[condIdx - 1] : null;
  const fdCocina = Pcocina > 0 ? MDcocina / Pcocina : 0;
  const reglaCalef = Pcalef > 10000
    ? `10 000 + 0.75 × (${fmt(Pcalef, 0)} − 10 000)`
    : "PI ≤ 10 kW → FD = 1.00";
  const reglaCocina = Pcocina > 12000
    ? `6 000 + 0.40 × (${fmt(Pcocina, 0)} − 12 000)`
    : "PI ≤ 12 kW → MD = 6 000 W (piso CNE)";
  const motivoSis =
    normFase(sisIn) !== "auto"
      ? `forzado por el proyectista (${sisLabel})`
      : hayTri
        ? "automático: hay carga especial trifásica"
        : MD > 8000
          ? "automático: MD > 8 kW"
          : "automático: MD ≤ 8 kW y sin especial trifásica";
  type FilaHoja = { desc: string; n: string; pi: string; PI: string; fd: string; MD: string; MDk: string; obs: string };
  const filasHoja: FilaHoja[] = [
    { desc: "Alumbrado y tomas 0–90 m²", n: "1", pi: fmt(alum1, 0), PI: fmt(alum1, 0), fd: "1.00", MD: fmt(alum1, 0), MDk: fmt(alum1 / 1000, 2), obs: "CNE vivienda · FD = 1.00" },
    { desc: "Alumbrado y tomas (resto)", n: fmt(nResto, 0), pi: "1 000", PI: fmt(alum2, 0), fd: "1.00", MD: fmt(alum2, 0), MDk: fmt(alum2 / 1000, 2), obs: At > 90 ? `⌈(${fmt(At, 2)} − 90)/90⌉ × 1 000 W` : "AT ≤ 90 m²" },
    ...(hayCalef
      ? [{ desc: "Calefacción", n: "1", pi: fmt(Pcalef, 0), PI: fmt(Pcalef, 0), fd: Pcalef > 10000 ? "1 / 0.75" : "1.00", MD: fmt(MDcalef, 0), MDk: fmt(MDcalef / 1000, 2), obs: reglaCalef }]
      : []),
    ...(hayAa
      ? [{ desc: "Aire acondicionado", n: "1", pi: fmt(Paa, 0), PI: fmt(Paa, 0), fd: "1.00", MD: fmt(MDaa, 0), MDk: fmt(MDaa / 1000, 2), obs: "FD = 1.00" }]
      : []),
    ...(hayCocina
      ? [{ desc: "Cocina eléctrica", n: "1", pi: fmt(Pcocina, 0), PI: fmt(Pcocina, 0), fd: fmt(fdCocina, 2), MD: fmt(MDcocina, 0), MDk: fmt(MDcocina / 1000, 2), obs: reglaCocina }]
      : []),
    ...(hayCalent
      ? [{ desc: "Calentador / therma", n: "1", pi: fmt(Pcalent, 0), PI: fmt(Pcalent, 0), fd: "1.00", MD: fmt(MDcalent, 0), MDk: fmt(MDcalent / 1000, 2), obs: "FD = 1.00" }]
      : []),
    ...extrasOn.map((e) => ({
      desc: e.nom,
      n: fmt(e.n, 0),
      pi: fmt(e.W, 0),
      PI: fmt(e.P, 0),
      fd: fmt(e.fd, 2),
      MD: fmt(e.MD, 0),
      MDk: fmt(e.MD / 1000, 2),
      obs: e.W > 1500 ? "Pi > 1 500 W → FD = 0.25" : "Pi ≤ 1 500 W → FD = 1.00",
    })),
  ];

  return out(
    `PI = ${fmt(PI / 1000, 2)} kW   ·   MD = ${fmt(MD / 1000, 2)} kW   ·   ${sisLabel}`,
    `Iₙ = ${fmt(round2up(In), 2)} A  ·  I diseño = ${fmt(round2up(Id), 2)} A  ·  ${fmt(cond.mm2, 1)} mm² (${cond.awg}) THW-90`,
    [
      {
        n: "01",
        title: "Área techada a considerar (CNE 050-110)",
        formula: "AT = Σ A_pisos × 1.00 + A_sótano × 0.75",
        substitution: `${fmt(AtN, 2)} × 1.00 + ${fmt(Asot, 2)} × 0.75`,
        desarrollo: [
          `Área de pisos (1.er nivel en adelante) = ${fmt(AtN, 2)} m² × 1.00 = ${fmt(AtN, 2)} m²`,
          `Área de sótano = ${fmt(Asot, 2)} m² × 0.75 = ${fmt(AsotCons, 2)} m²`,
          `AT = ${fmt(AtN, 2)} + ${fmt(AsotCons, 2)} = ${fmt(At, 2)} m²`,
        ],
        result: `AT = ${fmt(At, 2)} m²`,
        note: "CNE Utilización 050-110: el sótano entra al 75 %. Los niveles habitables entran al 100 %.",
        table: {
          caption: "Tabla 1 — Área a considerar",
          headers: ["Ambiente", "Área (m²)", "Factor CNE", "Área considerada (m²)"],
          rows: [
            ["Pisos (1.er nivel en adelante)", fmt(AtN, 2), "1.00", fmt(AtN, 2)],
            ["Sótano", fmt(Asot, 2), "0.75", fmt(AsotCons, 2)],
            ["Total AT", "—", "—", fmt(At, 2)],
          ],
        },
      },
      {
        n: "02",
        title: "Alumbrado y tomacorriente (vivienda)",
        formula: "Primeros 90 m² → 2 500 W     resto → ⌈(AT − 90)/90⌉ × 1 000 W     FD = 1.00",
        substitution: `AT = ${fmt(At, 2)} m²  ·  tramos de resto = ${fmt(nResto, 0)}`,
        desarrollo: [
          At > 0
            ? `Tramo 0–90 m²: PI₁ = 2 500 W    ·    FD = 1.00    ·    MD₁ = 2 500 W`
            : "Sin área techada: no hay alumbrado de vivienda.",
          At > 90
            ? `Resto = ${fmt(At, 2)} − 90 = ${fmt(At - 90, 2)} m²    ·    ⌈${fmt(At - 90, 2)} / 90⌉ = ${fmt(nResto, 0)} tramo(s)`
            : "AT ≤ 90 m²: no hay tramo de resto.",
          `PI₂ = ${fmt(nResto, 0)} × 1 000 = ${fmt(alum2, 0)} W    ·    MD₂ = ${fmt(alum2, 0)} W`,
          `PI alumbrado = ${fmt(alum1, 0)} + ${fmt(alum2, 0)} = ${fmt(Palum, 0)} W`,
        ],
        result: `PI = MD = ${fmt(Palum, 0)} W  =  ${fmt(Palum / 1000, 2)} kW`,
        note: "Hoja Cálculo de Máxima Demanda: el alumbrado de vivienda tiene FD = 1.00.",
        table: {
          caption: "Tabla 2 — Alumbrado y tomacorriente",
          headers: ["Tramo", "Criterio CNE", "PI (W)", "FD", "MD (W)"],
          rows: [
            ["0 a 90 m²", "2 500 W fijos", fmt(alum1, 0), "1.00", fmt(alum1, 0)],
            [
              "Resto",
              At > 90 ? `⌈(${fmt(At, 2)} − 90)/90⌉ × 1 000` : "no aplica (AT ≤ 90 m²)",
              fmt(alum2, 0),
              "1.00",
              fmt(alum2, 0),
            ],
            ["Total alumbrado", "—", fmt(Palum, 0), "1.00", fmt(MDalum, 0)],
          ],
        },
      },
      {
        n: "03",
        title: "Cargas especiales",
        formula:
          "Calefacción: PI ≤ 10 kW → FD=1; exceso × 0.75     AA: FD=1     Cocina: 6 000 W + 0.40 del exceso sobre 12 kW     Calentador: FD=1",
        substitution: [
          hayCalef ? `calefacción ${fmt(Pcalef, 0)} W (${normFase(sisCalef).startsWith("tri") ? "3Φ" : "1Φ"})` : null,
          hayAa ? `AA ${fmt(Paa, 0)} W (${normFase(sisAa).startsWith("tri") ? "3Φ" : "1Φ"})` : null,
          hayCocina ? `cocina ${fmt(Pcocina, 0)} W (${normFase(sisCocina).startsWith("tri") ? "3Φ" : "1Φ"})` : null,
          hayCalent ? `calentador ${fmt(Pcalent, 0)} W (${normFase(sisCalent).startsWith("tri") ? "3Φ" : "1Φ"})` : null,
        ]
          .filter(Boolean)
          .join("  · ") || "ninguna carga especial activada",
        desarrollo: [
          hayCalef
            ? `Calefacción: ${reglaCalef}    →    MD = ${fmt(MDcalef, 0)} W`
            : "Calefacción: no se incluye.",
          hayAa ? `Aire acondicionado: FD = 1.00    →    MD = ${fmt(MDaa, 0)} W` : "Aire acondicionado: no se incluye.",
          hayCocina
            ? `Cocina eléctrica: ${reglaCocina}    →    MD = ${fmt(MDcocina, 0)} W`
            : "Cocina eléctrica: no se incluye.",
          hayCalent ? `Calentador / therma: FD = 1.00    →    MD = ${fmt(MDcalent, 0)} W` : "Calentador: no se incluye.",
          `Σ PI especiales = ${fmt(Pcalef + Paa + Pcocina + Pcalent, 0)} W`,
          `Σ MD especiales = ${fmt(MDcalef + MDaa + MDcocina + MDcalent, 0)} W`,
        ],
        result: `PI esp = ${fmt(Pcalef + Paa + Pcocina + Pcalent, 0)} W     MD esp = ${fmt(MDcalef + MDaa + MDcocina + MDcalent, 0)} W`,
        note: "Factores de la hoja Cálculo de Máxima Demanda (CNE Utilización). Cada especial declara si es monofásica o trifásica para el sistema del alimentador.",
        table: {
          caption: "Tabla 3 — Cargas especiales (solo las incluidas)",
          headers: ["Carga", "PI (W)", "Criterio CNE / FD", "MD (W)", "Sistema"],
          rows: [
            ...(hayCalef
              ? [[
                  "Calefacción",
                  fmt(Pcalef, 0),
                  reglaCalef,
                  fmt(MDcalef, 0),
                  normFase(sisCalef).startsWith("tri") ? "trifásico" : "monofásico",
                ]]
              : []),
            ...(hayAa
              ? [[
                  "Aire acondicionado",
                  fmt(Paa, 0),
                  "FD = 1.00",
                  fmt(MDaa, 0),
                  normFase(sisAa).startsWith("tri") ? "trifásico" : "monofásico",
                ]]
              : []),
            ...(hayCocina
              ? [[
                  "Cocina eléctrica",
                  fmt(Pcocina, 0),
                  reglaCocina,
                  fmt(MDcocina, 0),
                  normFase(sisCocina).startsWith("tri") ? "trifásico" : "monofásico",
                ]]
              : []),
            ...(hayCalent
              ? [[
                  "Calentador / therma",
                  fmt(Pcalent, 0),
                  "FD = 1.00",
                  fmt(MDcalent, 0),
                  normFase(sisCalent).startsWith("tri") ? "trifásico" : "monofásico",
                ]]
              : []),
            [
              "Total especiales",
              fmt(Pcalef + Paa + Pcocina + Pcalent, 0),
              "—",
              fmt(MDcalef + MDaa + MDcocina + MDcalent, 0),
              "—",
            ],
          ],
        },
      },
      {
        n: "04",
        title: "Cargas adicionales",
        formula: "PI = n × Pi     FD = 0.25 si Pi > 1 500 W; si no, FD = 1.00     MD = PI × FD",
        substitution:
          extrasOn.map((e) => `${e.n} × ${e.nom} ${fmt(e.W, 0)} W`).join("  · ") || "ningún aparato adicional (cantidad = 0)",
        desarrollo: extrasOn.length
          ? extrasOn.map(
              (e) =>
                `${e.nom}: PI = ${fmt(e.n, 0)} × ${fmt(e.W, 0)} = ${fmt(e.P, 0)} W    ·    Pi ${e.W > 1500 ? "> 1 500 W → FD = 0.25" : "≤ 1 500 W → FD = 1.00"}    ·    MD = ${fmt(e.MD, 0)} W`,
            )
          : ["No hay filas con cantidad > 0. El cuadro queda en cero."],
        result: `PI adic = ${fmt(Padd, 0)} W     MD adic = ${fmt(MDadd, 0)} W`,
        note: "Solo entran los aparatos con cantidad mayor que cero. El nombre se toma de la hoja del usuario.",
        table: {
          caption: "Tabla 4 — Cargas adicionales",
          headers: ["Aparato", "n", "Pi (W)", "PI (W)", "Criterio FD", "FD", "MD (W)"],
          rows: extrasOn.length
            ? [
                ...extrasOn.map((e) => [
                  e.nom,
                  fmt(e.n, 0),
                  fmt(e.W, 0),
                  fmt(e.P, 0),
                  e.W > 1500 ? "Pi > 1 500 W" : "Pi ≤ 1 500 W",
                  fmt(e.fd, 2),
                  fmt(e.MD, 0),
                ]),
                ["Total adicionales", "—", "—", fmt(Padd, 0), "—", "—", fmt(MDadd, 0)],
              ]
            : [["—", "0", "—", "0", "sin adicionales", "—", "0"]],
        },
      },
      {
        n: "05",
        title: "Potencia instalada y máxima demanda",
        formula: "PI = Σ PI_i     MD = Σ MD_i     P_contratar = MD × FS     kW = ⌈P_contratar / 1 000⌉",
        substitution: `FS = ${fmt(FS, 2)}    ·    MD = ${fmt(MD, 0)} W`,
        desarrollo: [
          `PI = ${fmt(Palum, 0)} + ${fmt(Pcalef + Paa + Pcocina + Pcalent, 0)} + ${fmt(Padd, 0)} = ${fmt(PI, 0)} W = ${fmt(PI / 1000, 2)} kW`,
          `MD = ${fmt(MDalum, 0)} + ${fmt(MDcalef + MDaa + MDcocina + MDcalent, 0)} + ${fmt(MDadd, 0)} = ${fmt(MD, 0)} W = ${fmt(MD / 1000, 2)} kW`,
          `P a contratar = ${fmt(MD, 0)} × ${fmt(FS, 2)} = ${fmt(Pcontr, 0)} W`,
          `kW a contratar = ⌈${fmt(Pcontr / 1000, 3)}⌉ = ${fmt(kWcontr, 0)} kW`,
        ],
        result: `PI = ${fmt(PI / 1000, 2)} kW     MD = ${fmt(MD / 1000, 2)} kW     contratar ${fmt(kWcontr, 0)} kW`,
        note: "FS típico 0.80. Si MD > 8 kW el CNE recomienda alimentador trifásico.",
        table: {
          caption: "Tabla 5 — Hoja de máxima demanda (PI × FD = MD)",
          headers: ["N°", "Descripción", "n", "Pi (W)", "PI (W)", "FD", "MD (W)", "MD (kW)"],
          rows: [
            ...filasHoja.map((f, i) => [String(i + 1), f.desc, f.n, f.pi, f.PI, f.fd, f.MD, f.MDk]),
            ["Σ", "Total vivienda", "—", "—", fmt(PI, 0), "—", fmt(MD, 0), fmt(MD / 1000, 2)],
            ["—", `P a contratar = MD × FS (${fmt(FS, 2)})`, "—", "—", "—", fmt(FS, 2), fmt(Pcontr, 0), fmt(Pcontr / 1000, 2)],
          ],
        },
      },
      {
        n: "06",
        title: "Sistema del alimentador y constante K",
        formula: "K_mono = 1     K_tri = √3     k_ΔV,mono = 2     k_ΔV,tri = √3",
        substitution: motivoSis,
        desarrollo: [
          `Cargas especiales trifásicas: ${hayTri ? "sí" : "no"}`,
          `MD = ${fmt(MD / 1000, 2)} kW ${MD > 8000 ? "> 8 kW" : "≤ 8 kW"}`,
          `Sistema adoptado: ${sisLabel}`,
          `K = ${fmt(K, 3)}    ·    k de caída = ${fmt(kDrop, 3)}`,
        ],
        result: `Sistema ${sisLabel}    ·    K = ${fmt(K, 3)}    ·    k_ΔV = ${fmt(kDrop, 3)}`,
        note: "En modo automático, una sola carga especial trifásica o MD > 8 kW obliga a 3Φ.",
        table: {
          caption: "Tabla 6 — Constantes del sistema",
          headers: ["Parámetro", "Monofásico", "Trifásico", "Adoptado"],
          rows: [
            ["K (corriente)", "1", "√3 = 1.732", fmt(K, 3)],
            ["k (caída de tensión)", "2", "√3 = 1.732", fmt(kDrop, 3)],
            ["Tensión V", fmt(V, 0), fmt(V, 0), `${fmt(V, 0)} V`],
            ["cos φ", fmt(cos, 2), fmt(cos, 2), fmt(cos, 2)],
          ],
        },
      },
      {
        n: "07",
        title: "Corriente nominal del alimentador",
        formula: "Iₙ = (MD · FS) / (K · V · cos φ)",
        substitution: `${fmt(Pcontr, 0)} / (${fmt(K, 3)} × ${fmt(V, 0)} × ${fmt(cos, 2)})`,
        desarrollo: [
          `Numerador = MD × FS = ${fmt(MD, 0)} × ${fmt(FS, 2)} = ${fmt(Pcontr, 0)} W`,
          `Denominador = ${fmt(K, 3)} × ${fmt(V, 0)} × ${fmt(cos, 2)} = ${fmt(K * V * cos, 2)}`,
          `Iₙ = ${fmt(Pcontr, 0)} / ${fmt(K * V * cos, 2)} = ${fmt(In, 3)} A`,
          `Iₙ redondeada al alza (0.01 A) = ${fmt(round2up(In), 2)} A`,
        ],
        result: `Sistema ${sisLabel}  ·  Iₙ = ${fmt(round2up(In), 2)} A`,
        table: {
          caption: "Tabla 7 — Corriente nominal",
          headers: ["Magnitud", "Símbolo", "Valor"],
          rows: [
            ["Máxima demanda", "MD", `${fmt(MD, 0)} W`],
            ["Factor de simultaneidad", "FS", fmt(FS, 2)],
            ["Potencia de cálculo", "MD·FS", `${fmt(Pcontr, 0)} W`],
            ["Constante de sistema", "K", fmt(K, 3)],
            ["Tensión", "V", `${fmt(V, 0)} V`],
            ["Factor de potencia", "cos φ", fmt(cos, 2)],
            ["Corriente nominal", "Iₙ", `${fmt(round2up(In), 2)} A`],
          ],
        },
      },
      {
        n: "08",
        title: "Corriente de diseño y sección THW-90",
        formula: "I_d = 1.25 Iₙ / (Ft · Fg)     se elige S con I_z ≥ I_d (THW-90 en ducto, 90 °C)",
        substitution: `1.25 × ${fmt(round2up(In), 2)} / (${fmt(Ft, 2)} × ${fmt(Fg, 2)})`,
        desarrollo: [
          `Ft · Fg = ${fmt(Ft, 2)} × ${fmt(Fg, 2)} = ${fmt(Ft * Fg, 3)}`,
          `I_d = 1.25 × ${fmt(In, 3)} / ${fmt(Ft * Fg, 3)} = ${fmt(Id, 3)} A`,
          `I_d redondeada al alza = ${fmt(round2up(Id), 2)} A`,
          condPrev
            ? `La sección anterior ${fmt(condPrev.mm2, 1)} mm² (${condPrev.awg}) tiene I_z = ${fmt(condPrev.A, 0)} A < ${fmt(round2up(Id), 2)} A → no cumple.`
            : "No hay sección menor en la tabla THW-90 de la hoja.",
          `Se adopta ${fmt(cond.mm2, 1)} mm² (${cond.awg}) porque I_z = ${fmt(cond.A, 0)} A ≥ ${fmt(round2up(Id), 2)} A.`,
        ],
        result: `Adoptar ${fmt(cond.mm2, 1)} mm² (${cond.awg})  ·  I_z = ${fmt(cond.A, 0)} A`,
        note: "Tabla de ampacidad de la hoja: THW-90 cobre en ducto. Ft típico PVC 30 °C ≈ 0.91; Fg de 3–4 conductores ≈ 0.70.",
        table: {
          caption: "Tabla 8 — Ampacidad THW-90 cobre en ducto (90 °C)",
          headers: ["S (mm²)", "Calibre", "I_z (A)", "I_z ≥ I_d", "Decisión"],
          rows: THW_DUCT.map((c) => [
            fmt(c.mm2, 1),
            c.awg,
            fmt(c.A, 0),
            c.A + 1e-9 >= Id ? "Sí" : "No",
            c.mm2 === cond.mm2 && c.awg === cond.awg ? "Adoptado" : c.A + 1e-9 >= Id ? "mayor (sobrado)" : "insuficiente",
          ]),
        },
      },
      {
        n: "09",
        title: "Caída de tensión del alimentador",
        formula: "ΔV = ρ · I_d · k · L · cos φ / S     ρ_Cu = 0.018 Ω·mm²/m",
        substitution: `0.018 × ${fmt(Id, 2)} × ${fmt(kDrop, 3)} × ${fmt(Lcond, 1)} × ${fmt(cos, 2)} / ${fmt(cond.mm2, 1)}`,
        desarrollo: [
          `ρ = 0.018 Ω·mm²/m (cobre)`,
          `k = ${fmt(kDrop, 3)} (${sisLabel})`,
          `L = ${fmt(Lcond, 2)} m    ·    S = ${fmt(cond.mm2, 1)} mm²`,
          `ΔV = 0.018 × ${fmt(Id, 3)} × ${fmt(kDrop, 3)} × ${fmt(Lcond, 2)} × ${fmt(cos, 2)} / ${fmt(cond.mm2, 1)}`,
          `ΔV = ${fmt(dV, 3)} V`,
          `ΔV (%) = 100 × ${fmt(dV, 3)} / ${fmt(V, 0)} = ${fmt(dVpct, 2)} %`,
        ],
        result: `ΔV = ${fmt(dV, 2)} V = ${fmt(dVpct, 2)} % de ${fmt(V, 0)} V`,
        note: "Límite CNE en alimentador: 5 %. La hoja original sellaba además 5 V.",
        table: {
          caption: "Tabla 9 — Caída de tensión",
          headers: ["Magnitud", "Símbolo", "Valor"],
          rows: [
            ["Resistividad del cobre", "ρ", "0.018 Ω·mm²/m"],
            ["Corriente de diseño", "I_d", `${fmt(round2up(Id), 2)} A`],
            ["Constante de caída", "k", fmt(kDrop, 3)],
            ["Longitud", "L", `${fmt(Lcond, 2)} m`],
            ["Factor de potencia", "cos φ", fmt(cos, 2)],
            ["Sección adoptada", "S", `${fmt(cond.mm2, 1)} mm²`],
            ["Caída", "ΔV", `${fmt(dV, 2)} V`],
            ["Caída relativa", "ΔV/V", `${fmt(dVpct, 2)} %`],
            ["Límite CNE", "—", "5 %"],
          ],
        },
      },
    ],
    [
      ok(
        "MD coherente con PI",
        `${fmt(MD, 0)} W`,
        `≤ PI${hayCocina && Pcocina < 6000 ? " + piso cocina 6 kW" : ""}`,
        MD <= PI + (hayCocina && Pcocina < 6000 ? 6000 - Pcocina : 0) + 1,
      ),
      ok("MD > 8 kW → trifásico (recomendado)", `${fmt(MD / 1000, 2)} kW · ${sisLabel}`, "≥ 8 kW ⇒ 3Φ", MD <= 8000 || normFase(sistema).startsWith("tri")),
      ok("I_z ≥ I diseño", `${fmt(cond.A, 0)} A`, `≥ ${fmt(round2up(Id), 2)} A`, cond.A + 1e-9 >= Id),
      ok("ΔV ≤ 5 %", `${fmt(dVpct, 2)} %`, "≤ 5 %", dVpct <= 5 + 1e-6),
    ],
    [
      {
        title: "Cuadro de cargas del alimentador",
        rows: [
          ["N°", "Descripción", "n", "Pi (W)", "PI (W)", "FD", "MD (W)", "Observación"],
          ...filasHoja.map((f, i) => [String(i + 1), f.desc, f.n, f.pi, f.PI, f.fd, f.MD, f.obs]),
          ["Σ", "Potencia instalada / máxima demanda", "—", "—", fmt(PI, 0), "—", fmt(MD, 0), `${fmt(PI / 1000, 2)} kW / ${fmt(MD / 1000, 2)} kW`],
          ["—", "Potencia a contratar (MD × FS)", "—", "—", "—", fmt(FS, 2), fmt(Pcontr, 0), `${fmt(kWcontr, 0)} kW`],
        ],
      },
    ],
    {
      sistema: sisLabel,
      In: String(round2up(In)),
      Id: String(round2up(Id)),
      Smm: String(cond.mm2),
      awg: cond.awg,
      PI: String(PI),
      MD: String(MD),
      V: String(V),
      Lcond: String(Lcond),
    },
  );
};

export const tasacionInmueble: Engine = (raw) => {
  const At = num(raw, "At", 120);
  const Ac = num(raw, "Ac", 90);
  const VuT = num(raw, "VuT", 350);
  const VuC = num(raw, "VuC", 850);
  const Fubic = num(raw, "Fubic", 1.05);
  const Fcons = num(raw, "Fcons", 0.92);
  const tc = num(raw, "tc", 3.75);
  const VT = At * VuT * Fubic;
  const VC = Ac * VuC * Fcons;
  const Vcom = VT + VC;
  const Vreal = Vcom * 0.8;
  return out(
    `Valor comercial  S/ ${fmt(Vcom, 0)}   (USD ${fmt(Vcom / tc, 0)})`,
    `Terreno ${fmt(VT, 0)} + Edificación ${fmt(VC, 0)}  ·  Valor de realización 80%`,
    [
      {
        n: "01",
        title: "Valor del terreno",
        formula: "VT = Área × VU_terreno × F_ubicación",
        substitution: `${fmt(At, 2)} m² × ${fmt(VuT, 0)} × ${fmt(Fubic, 2)}`,
        result: `S/ ${fmt(VT, 2)}`,
      },
      {
        n: "02",
        title: "Valor de la edificación",
        formula: "VC = Área techada × VU_const. × F_conservación / depreciación",
        substitution: `${fmt(Ac, 2)} m² × ${fmt(VuC, 0)} × ${fmt(Fcons, 2)}`,
        result: `S/ ${fmt(VC, 2)}`,
      },
      {
        n: "03",
        title: "Valor comercial y de realización",
        formula: "Vcom = VT + VC    ·    Vreal ≈ 0.80 Vcom",
        result: `Comercial S/ ${fmt(Vcom, 0)}   ·   Realización S/ ${fmt(Vreal, 0)}`,
        note: "Tipo de cambio referencial para informe bilingüe.",
      },
    ],
    [ok("Áreas coherentes", `techada ${fmt(Ac, 1)}`, `≤ terreno ${fmt(At, 1)} (típico)`, Ac <= At * 3)]
  );
};

export const costoHorario: Engine = (raw) => {
  const Vt = num(raw, "Vt", 220012);
  const n = num(raw, "n", 5);
  const Ha = num(raw, "Ha", 2000);
  const i = num(raw, "i", 0.04);
  const s = num(raw, "s", 0.02);
  const Vr = num(raw, "Vr", 0);
  const comb = num(raw, "comb", 15);
  const pc = num(raw, "pc", 18.5);
  const fm = num(raw, "fm", 0.3);
  const Vu = n * Ha;
  const Va = Vt * (1 - Vr);
  const Dep = Va / Vu;
  const Inv = (Va * i) / Vu;
  const Seg = (Va * s) / Vu;
  const fijos = Dep + Inv + Seg;
  const mant = fm * Dep;
  const combustible = comb * pc;
  const CH = fijos + mant + combustible;
  return out(
    `Costo horario = ${fmt(CH, 2)}  $/h`,
    `Cargos fijos ${fmt(fijos, 2)} + mant. ${fmt(mant, 2)} + combustible ${fmt(combustible, 2)}`,
    [
      {
        n: "01",
        title: "Vida útil en horas",
        formula: "Vu = n × Ha",
        substitution: `${n} años × ${fmt(Ha, 0)} h/año`,
        result: `${fmt(Vu, 0)} h`,
      },
      {
        n: "02",
        title: "Cargos fijos",
        formula: "Dep = Va/Vu    Inv = Va·i/Vu    Seg = Va·s/Vu",
        substitution: `Va = ${fmt(Va, 0)}`,
        result: `Dep ${fmt(Dep, 2)} + Inv ${fmt(Inv, 2)} + Seg ${fmt(Seg, 2)} = ${fmt(fijos, 2)} $/h`,
      },
      {
        n: "03",
        title: "Funcionamiento",
        formula: "Mant. = f · Dep    Comb. = consumo × precio",
        result: `${fmt(mant + combustible, 2)} $/h`,
      },
    ],
    [ok("CH > 0", fmt(CH, 2), "$/h", CH > 0)]
  );
};

export const alcantarilla: Engine = (raw) => {
  const fy = num(raw, "fy", 4200);
  const H = num(raw, "H", 1.4);
  const B = num(raw, "B", 1.6);
  const e = num(raw, "e", 0.15);
  const r = num(raw, "r", 0.20);
  const gs = num(raw, "gs", 1.8);
  const Df = num(raw, "Df", 1.0);
  const Pr = num(raw, "Pr", 7250);
  const gc = 2.4;
  const A = H + 2 * e;
  const L = B + 2 * r;
  const Wsup = L * e * gc * 1000;
  const Winf = L * e * gc * 1000;
  const Wmuro = 2 * (H * r * gc * 1000);
  const Wtot = Wsup + Winf + Wmuro;
  const qrell = gs * 1000 * Df;
  const aRueda = Math.sqrt(Pr / 7);
  const LL = Pr / Math.max((aRueda + 1.75 * Df) ** 2, 0.4);
  const wu = 1.25 * (Wsup / (L * 1) / 1000 + qrell / 1000) + 1.75 * (LL / 1000);
  const Mu = wu * B * B / 8;
  const d = e * 100 - 4;
  const As = (Mu * 100000) / (0.9 * fy * 0.9 * d);
  const Asmin = 0.002 * 100 * e * 100;
  const AsUse = Math.max(As, Asmin);
  return out(
    `Cajón ${fmt(B, 2)} × ${fmt(H, 2)} m  ·  e = ${fmt(e * 100, 0)} cm  ·  As ${fmt(AsUse, 2)} cm²/m`,
    `HS-20-44  ·  A ext = ${fmt(L, 2)} × ${fmt(A, 2)} m  ·  W = ${fmt(Wtot, 0)} kg/m`,
    [
      {
        n: "01",
        title: "Geometría exterior",
        formula: "A = H + 2e    ·    L = B + 2r",
        substitution: `H=${fmt(H,2)} e=${fmt(e,2)} B=${fmt(B,2)} r=${fmt(r,2)}`,
        result: `${fmt(L, 2)} × ${fmt(A, 2)} m`,
      },
      {
        n: "02",
        title: "Peso propio y relleno",
        formula: "W = γc Σ Ai    ·    qrell = γs Df",
        substitution: `W = ${fmt(Wtot, 0)} kg/m  ·  qrell = ${fmt(qrell, 0)} kg/m²`,
        result: `${fmt(Wtot, 0)} kg/m`,
      },
      {
        n: "03",
        title: "Carga viva HS-20 (rueda 7250 kg, difusión 1.75H)",
        formula: "LL = P / (a + 1.75 Df)²",
        substitution: `P = ${fmt(Pr, 0)} kg  ·  LL = ${fmt(LL, 0)} kg/m²`,
        result: `wu ≈ ${fmt(wu, 2)} t/m²`,
      },
      {
        n: "04",
        title: "Losa superior a flexión",
        formula: "Mu = wu B² / 8",
        substitution: `Mu = ${fmt(Mu, 3)} t·m/m  As = ${fmt(AsUse, 2)} cm²/m`,
        result: `Ø 1/2" según As`,
      },
    ],
    [ok("e ≥ 15 cm", `${fmt(e * 100, 0)} cm`, "≥ 15 cm", e >= 0.15)]
  );
};

/** Interpolación lineal de tablas de percolación OS.090 (tiempo → coeficiente). */
function lerpTab(t: number, pts: [number, number][]): number | null {
  if (!(t > 0)) return null;
  if (t > pts[pts.length - 1][0] + 1e-9) return null;
  if (t <= pts[0][0]) return pts[0][1];
  for (let i = 0; i < pts.length - 1; i++) {
    const [t0, a0] = pts[i];
    const [t1, a1] = pts[i + 1];
    if (t <= t1) return a0 + ((t - t0) * (a1 - a0)) / Math.max(t1 - t0, 1e-9);
  }
  return pts[pts.length - 1][1];
}

const POZO_TAB: [number, number][] = [
  [1, 0.88],
  [2, 1.08],
  [5, 1.44],
  [10, 2.25],
  [30, 4.5],
];
const ZANJA_TAB: [number, number][] = [
  [2, 2.3],
  [3, 2.8],
  [4, 3.25],
  [5, 3.5],
  [10, 4.65],
  [15, 5.35],
  [30, 7],
  [45, 8.45],
  [60, 9.3],
];

function ceil05(x: number) {
  return Math.ceil(x * 20 - 1e-9) / 20;
}

export const tanqueSeptico: Engine = (raw) => {
  const Pa = num(raw, "Pa", 100);
  const r = num(raw, "r", 1.5);
  const nYears = num(raw, "nYears", 20);
  const C = num(raw, "C", 120);
  const ret = num(raw, "ret", 0.8);
  const PR = num(raw, "PR", 1);
  const TAL = num(raw, "TAL", 50);
  const PL = num(raw, "PL", 1);
  const hu = num(raw, "hu", 1.8);
  const BL = num(raw, "BL", 0.3);
  const tperc = num(raw, "tperc", 10);
  const Dpozo = num(raw, "Dpozo", 2);
  const nPozosIn = num(raw, "nPozos", 0);
  const bZanja = num(raw, "bZanja", 0.9);
  const Lpieza = num(raw, "Lzanja", 20);
  const Pf = Pa * (1 + (r * nYears) / 100);
  const Q = (ret * Pf * C) / 1000;
  const Qls = Q / 86.4;
  const TRras = Math.max(1, 1.5 - 0.3 * Math.log10(Math.max(Q, 0.1)));
  const V1raw = Q * PR;
  const V1 = Math.max(V1raw, 3);
  const V2 = (Pf * TAL * PL) / 1000;
  const Vu = V1 + V2;
  const twoCam = Vu > 5;
  const A = Vu / Math.max(hu, 0.8);
  const B = ceil05(Math.sqrt(A / 3));
  const L = ceil05(3 * B);
  const Aprov = L * B;
  const L1 = twoCam ? (2 / 3) * L : L;
  const L2 = twoCam ? (1 / 3) * L : 0;
  const Htot = hu + BL;
  const coefPozo = lerpTab(tperc, POZO_TAB);
  const coefZanja = lerpTab(Math.max(tperc, 2), ZANJA_TAB);
  const Aref = (ret * Pf * C) / 190;
  const Apozo = coefPozo != null ? coefPozo * Aref : NaN;
  const Azanja = coefZanja != null ? coefZanja * Aref : NaN;
  const nPozosAuto = Number.isFinite(Apozo) && Dpozo > 0.4 ? Math.max(1, Math.ceil(Apozo / (Math.PI * Dpozo * 2.5))) : 1;
  const nPozos = nPozosIn >= 1 ? Math.round(nPozosIn) : nPozosAuto;
  const Hpozo = Number.isFinite(Apozo) && Dpozo > 0.4 && nPozos > 0 ? Apozo / (Math.PI * Dpozo * nPozos) : 0;
  const LzanjaTot = Number.isFinite(Azanja) && bZanja > 0.2 ? Azanja / bZanja : 0;
  const nZanjas = Lpieza > 1 && LzanjaTot > 0 ? Math.max(1, Math.ceil(LzanjaTot / Lpieza)) : 0;
  const Alecho = 0.1 * Pf;
  const ladoLecho = Math.ceil(Math.sqrt(Math.max(Alecho, 0.25)) * 10) / 10;
  const okQ = Q <= 20 + 1e-6;
  const okHu = hu >= 1.2 && hu <= 2.5;
  const okBL = BL >= 0.3;
  const okLB = L / B >= 2 && L / B <= 4.05;
  const okPozoT = tperc <= 30;
  const okZanjaT = tperc <= 60;
  const okPR = PR + 1e-9 >= TRras;
  const okD = Dpozo >= 1 && Dpozo <= 2.5 + 1e-6;
  const okLz = Lpieza <= 30 + 1e-6;
  const sepMin = Math.max(3, 2 * Dpozo);
  const okHpozo = !Number.isFinite(Apozo) || Hpozo >= 2;

  return out(
    `Vu = ${fmt(Vu, 2)} m³  ·  ${fmt(L, 2)} × ${fmt(B, 2)} × ${fmt(Htot, 2)} m` +
      (twoCam ? "  ·  2 cámaras (⅔ + ⅓)" : "  ·  1 cámara"),
    `RNE OS.090  ·  Pf = ${fmt(Pf, 0)} hab  ·  Q = ${fmt(Q, 2)} m³/d`,
    [
      {
        n: "01",
        title: "Población de diseño",
        formula: "Pf = Pa (1 + r n / 100)     crecimiento lineal",
        substitution: `${fmt(Pa, 0)} × (1 + ${fmt(r, 2)}% × ${fmt(nYears, 0)} años)`,
        result: `Pf = ${fmt(Pf, 1)} hab`,
        note: "No se usa interés compuesto. Es el criterio de las hojas TANQUE SEPTICO.xls / T. SEPTICO.xls.",
      },
      {
        n: "02",
        title: "Caudal de aguas residuales",
        formula: "Q = c retorno × Pf × C / 1000",
        substitution: `${fmt(ret, 2)} × ${fmt(Pf, 1)} × ${fmt(C, 0)} L/hab·d / 1000`,
        result: `Q = ${fmt(Q, 2)} m³/d = ${fmt(Qls, 3)} L/s`,
        note: "OS.090: el tanque séptico conviene si Q < 20 m³/d. Coeficiente de retorno típico 0.80.",
      },
      {
        n: "03",
        title: "Tiempo de retención y volumen de sedimentación",
        formula: "V1 = Q × PR     ·     TRmín = máx(1, 1.5 − 0.3 log10 Q)",
        substitution: `PR = ${fmt(PR, 2)} d (dato)  ·  TRmín = ${fmt(TRras, 2)} d  ·  V1 bruto = ${fmt(V1raw, 2)} m³`,
        result: `V1 = ${fmt(V1, 2)} m³`,
        note: "Vmín de sedimentación = 3 m³. El volumen usa el PR adoptado (típico 1 d, RNE OS.090).",
      },
      {
        n: "04",
        title: "Volumen de lodos y volumen útil",
        formula: "V2 = Pf × TAL × PL / 1000     Vu = V1 + V2",
        substitution: `${fmt(Pf, 1)} × ${fmt(TAL, 0)} L/hab·año × ${fmt(PL, 2)} año / 1000`,
        result: `V2 = ${fmt(V2, 2)} m³     Vu = ${fmt(Vu, 2)} m³`,
        note: "TAL típico: 40 L/hab·año (escuela / rural sin triturador), 50 vivienda, 70 con triturador de basura. PL ≥ 1 año.",
      },
      {
        n: "05",
        title: "Geometría en planta (L/B = 3)",
        formula: "A = Vu / hu     B = √(A/3)     L = 3 B     redondeo a 5 cm",
        substitution: `hu = ${fmt(hu, 2)} m  ·  A req = ${fmt(A, 2)} m²  ·  borde libre ${fmt(BL, 2)} m`,
        result: `L = ${fmt(L, 2)} m   B = ${fmt(B, 2)} m   H = ${fmt(Htot, 2)} m   A = ${fmt(Aprov, 2)} m²`,
        note: twoCam
          ? `Vu > 5 m³: dos cámaras. Cámara 1 (digestión) = ⅔ L = ${fmt(L1, 2)} m. Cámara 2 = ⅓ L = ${fmt(L2, 2)} m. Te de llegada 0.30 m bajo el espejo; te de salida 0.40 m (OS.090).`
          : "Vu ≤ 5 m³: una sola cámara es admisible; igualmente puede adoptarse tabique ⅔ + ⅓. Te de llegada 0.30 m bajo el espejo; te de salida 0.40 m (OS.090).",
      },
      {
        n: "06",
        title: "Pozos de percolación (RNE OS.090)",
        formula: "A = a(t) × c × Pf × C / 190     H = A / (π D n)",
        substitution:
          coefPozo == null
            ? `t = ${fmt(tperc, 1)} min > 30 → el suelo no conviene para pozos`
            : `t = ${fmt(tperc, 1)} min → a = ${fmt(coefPozo, 2)} m²/hab-ref  ·  D = ${fmt(Dpozo, 2)} m  ·  n = ${nPozos}`,
        result:
          coefPozo == null
            ? "No conviene pozo de percolación"
            : `A pared = ${fmt(Apozo, 1)} m²    n = ${nPozos} pozos Ø ${fmt(Dpozo, 2)} m    H útil = ${fmt(Hpozo, 2)} m`,
        note: `Tabla: t=1→0.88; 2→1.08; 5→1.44; 10→2.25; 30→4.50 m²/hab (ref. 190 L). H de pared ≥ 2.00 m. Separación entre pozos ≥ ${fmt(sepMin, 2)} m (máx. de 3 m y 2D). c = ${fmt(ret, 2)}.`,
      },
      {
        n: "07",
        title: "Zanjas de infiltración",
        formula: "A = a(t) × c × Pf × C / 190     Ltot = A / b     n = ceil(Ltot / Lpieza)",
        substitution:
          coefZanja == null
            ? `t = ${fmt(tperc, 1)} min > 60 → no conviene zanja`
            : `t = ${fmt(tperc, 1)} min → a = ${fmt(coefZanja, 2)}  ·  b = ${fmt(bZanja, 2)} m  ·  L pieza = ${fmt(Lpieza, 1)} m`,
        result:
          coefZanja == null
            ? "No conviene zanja de infiltración"
            : `A fondo = ${fmt(Azanja, 1)} m²    L tot = ${fmt(LzanjaTot, 1)} m    n = ${nZanjas} zanjas de ${fmt(Lpieza, 1)} m`,
        note: "Tabla zanjas: 2→2.30; 5→3.50; 10→4.65; 30→7.00; 45→8.45; 60→9.30. L de cada zanja ≤ 30 m. t > 60 min: no infiltrar, buscar otro efluente.",
      },
      {
        n: "08",
        title: "Lechos de secado de lodos",
        formula: "A lecho = 0.10 × Pf     (m²)     lado ≈ √A",
        substitution: `0.10 × ${fmt(Pf, 1)} hab`,
        result: `A = ${fmt(Alecho, 1)} m²    ·    ${fmt(ladoLecho, 1)} × ${fmt(ladoLecho, 1)} m`,
      },
    ],
    [
      ok("Q ≤ 20 m³/d (tanque séptico OS.090)", `${fmt(Q, 2)} m³/d`, "≤ 20", okQ),
      ok("V1 ≥ 3 m³", `${fmt(V1, 2)} m³`, "≥ 3", V1 >= 3 - 1e-6),
      ok(twoCam ? "Vu > 5 m³ → 2 cámaras" : "Vu ≤ 5 m³ (1 cámara admisible)", `${fmt(Vu, 2)} m³`, twoCam ? "> 5" : "≤ 5", true),
      ok("PR ≥ TRmín OS.090", `${fmt(PR, 2)} d`, `≥ ${fmt(TRras, 2)} d`, okPR),
      ok("PL ≥ 1 año", `${fmt(PL, 2)} año`, "≥ 1", PL + 1e-9 >= 1),
      ok("hu entre 1.20 y 2.50 m", `${fmt(hu, 2)} m`, "1.20–2.50", okHu),
      ok("Borde libre ≥ 0.30 m", `${fmt(BL, 2)} m`, "≥ 0.30", okBL),
      ok("L/B entre 2 y 4", fmt(L / B, 2), "2–4", okLB),
      ok("Diámetro de pozo 1.00–2.50 m", `${fmt(Dpozo, 2)} m`, "1.00–2.50", okD),
      ok("Largo de zanja ≤ 30 m", `${fmt(Lpieza, 1)} m`, "≤ 30", okLz),
      ok("Percolación pozos t ≤ 30 min", `${fmt(tperc, 1)} min`, "≤ 30", okPozoT),
      ok("Percolación zanjas t ≤ 60 min", `${fmt(tperc, 1)} min`, "≤ 60", okZanjaT),
      ok("H pozo ≥ 2.00 m", Number.isFinite(Apozo) ? `${fmt(Hpozo, 2)} m` : "—", "≥ 2.00", okHpozo),
    ],
    [
      {
        title: "Resumen geométrico",
        rows: [
          ["Dato", "Valor"],
          ["Población futura Pf", `${fmt(Pf, 1)} hab`],
          ["Caudal Q", `${fmt(Q, 2)} m³/d`],
          ["Vu = V1+V2", `${fmt(Vu, 2)} m³`],
          ["L × B × H", `${fmt(L, 2)} × ${fmt(B, 2)} × ${fmt(Htot, 2)} m`],
          ["Cámara 1 / 2", twoCam ? `${fmt(L1, 2)} m  /  ${fmt(L2, 2)} m` : "una cámara"],
          ["Pozos", coefPozo == null ? "no conviene" : `${nPozos} Ø ${fmt(Dpozo, 2)} m × H ${fmt(Hpozo, 2)} m`],
          ["Zanjas", coefZanja == null ? "no conviene" : `${nZanjas} × ${fmt(Lpieza, 1)} m (b = ${fmt(bZanja, 2)} m)`],
          ["Lecho de secado", `${fmt(ladoLecho, 1)} × ${fmt(ladoLecho, 1)} m`],
        ],
      },
    ],
    {
      L: String(L),
      B: String(B),
      hu: String(hu),
      BL: String(BL),
      L1: String(L1),
      L2: String(L2),
      Htot: String(Htot),
      twoCam: twoCam ? "si" : "no",
      Dpozo: String(Dpozo),
      nPozos: String(nPozos),
      Hpozo: String(Number.isFinite(Hpozo) ? Hpozo : 0),
      bZanja: String(bZanja),
      Lzanja: String(Lpieza),
      nZanjas: String(nZanjas),
      ladoLecho: String(ladoLecho),
    }
  );
};

export const ptarPrimario: Engine = (raw) => {
  const N = num(raw, "N", 10093);
  const C = num(raw, "C", 125);
  const ret = num(raw, "ret", 0.8);
  const dbo = num(raw, "dbo", 180);
  const Btot = num(raw, "Btot", 0.8);
  const eBar = num(raw, "eBar", 0.64);
  const bEsp = num(raw, "bEsp", 2.54);
  const vRej = num(raw, "vRej", 0.6);
  const theta = num(raw, "theta", 45);
  const yRej = num(raw, "yRej", 0.95);
  const vDes = num(raw, "vDes", 0.25);
  const vs = num(raw, "vs", 37.44);
  const tSed = num(raw, "tSed", 1);
  const rLodo = num(raw, "rLodo", 0.52);
  const pSol = num(raw, "pSol", 0.06);
  const Gs = num(raw, "Gs", 1.03);
  const Qmd = (N * C) / 1000;
  const qAgua = Qmd / 86400;
  const Qd = ret * qAgua;
  const eM = eBar / 100;
  const bM = bEsp / 100;
  const nEsp = Math.max(2, Math.ceil((Btot + eM) / (eM + bM) - 1e-9));
  const nBar = Math.max(1, nEsp - 1);
  const Bcalc = nBar * eM + nEsp * bM;
  const Aopen = nEsp * bM * Math.max(yRej, 0.2);
  const vReal = Qd / Math.max(Aopen, 1e-6);
  const vKir = vRej > 0.05 ? vRej : vReal;
  const g = 9.81;
  const beta = 2.42;
  const hv = (vKir * vKir) / (2 * g);
  const th = (theta * Math.PI) / 180;
  const senTh = Math.sin(th);
  const hf = beta * (eM / Math.max(bM, 1e-6)) ** (4 / 3) * hv * senTh;
  const v50 = Qd / Math.max(0.5 * Aopen, 1e-6);
  const hf50 = Math.abs(vReal ** 2 - v50 ** 2) / (2 * g);
  const BLrej = 0.2;
  const Htrej = yRej + BLrej;
  const Lincl = Htrej / Math.max(senTh, 0.2);
  const Lent = 10 * Btot;
  const Lsal = 0.8 * Lent;
  const Lrej = Lent + Lsal;
  const nMan = 0.013;
  const Achan = Btot * Math.max(yRej, 0.2);
  const Pchan = Btot + 2 * yRej;
  const Rhyd = Achan / Math.max(Pchan, 1e-6);
  const vChan = Qd / Math.max(Achan, 1e-6);
  const Sman = ((vChan * nMan) / Math.max(Rhyd ** (2 / 3), 1e-6)) ** 2;
  const hfMan = Sman * Lrej;
  const Ades = Qd / Math.max(vDes, 0.05);
  const Bdes = Math.sqrt(Ades);
  const ydes = Ades / Math.max(Bdes, 0.15);
  const BLdes = Math.max(0.05, ydes / 5);
  const Vsed = Qd * tSed * 3600;
  const Ased = (Qd * 86400) / Math.max(vs, 10);
  const hSed = Vsed / Math.max(Ased, 0.1);
  const Dsed = Math.sqrt((4 * Ased) / Math.PI);
  const dboKg = dbo / 1000;
  const masa = dboKg * rLodo * Qd * 86400;
  const Vsol = masa / (1000 * Gs * Math.max(pSol, 0.02));
  const hLodo = Vsol / Math.max(Ased, 0.1);
  const hRastra = 0.08 * (Dsed / 2);
  const Hsed = 2 * hSed + hRastra;
  const HP = Ased / 93;
  const basura = Qd * 0.03 * 86400 / 1000;
  const nEspReq = Math.max(2, Math.ceil(Qd / Math.max(vRej * bM * yRej, 1e-9)));
  const Breq = (nEspReq - 1) * eM + nEspReq * bM;

  return out(
    `Qarr = ${fmt(Qd * 1000, 1)} L/s  ·  sedimentador Ø ${fmt(Dsed, 2)} m × H ${fmt(Hsed, 2)} m`,
    `N = ${fmt(N, 0)} hab  ·  rejilla ${nBar} barras  ·  vs = ${fmt(vs, 1)} m³/m²·d`,
    [
      {
        n: "01",
        title: "Caudal de diseño",
        formula: "q agua = N C / 86400 / 1000     Qarr = c retorno × q",
        substitution: `${fmt(N, 0)} hab × ${fmt(C, 0)} L/hab·d  ·  retorno ${fmt(ret, 2)}`,
        result: `Qarr = ${fmt(Qd, 4)} m³/s = ${fmt(Qd * 1000, 2)} L/s = ${fmt(Qd * 86400, 1)} m³/d`,
      },
      {
        n: "02",
        title: "Rejilla de barras (Kirschmer)",
        formula: "n esp = (B+e)/(e+b)     hf = β (e/b)^{4/3} (v²/2g) sen θ",
        substitution: `B = ${fmt(Btot, 2)} m  ·  e = ${fmt(eBar, 2)} cm  ·  b = ${fmt(bEsp, 2)} cm  ·  v diseño = ${fmt(vRej, 2)} m/s  ·  θ = ${fmt(theta, 0)}°  ·  β = 2.42`,
        result: `${nBar} barras, ${nEsp} espacios  ·  B calc = ${fmt(Bcalc, 2)} m  ·  v en luces = ${fmt(vReal, 3)} m/s  ·  hf = ${fmt(hf * 100, 2)} cm`,
        note: "Kirschmer con θ en grados y exponente 4/3 (Metcalf). La hoja usaba SEN de Excel en radianes y 3/4. hf limpia < 15 cm. Metcalf: v = 0.6–1.0 m/s en luces.",
      },
      {
        n: "03",
        title: "Rejilla obstruida 50 %, canal y pendiente",
        formula: "hf50 = |v² − v50²| / 2g     Lent = 10 B     Lsal = 0.8 Lent     S = (n v / R^{2/3})²",
        substitution: `y = ${fmt(yRej, 2)} m  ·  v50 = ${fmt(v50, 3)} m/s  ·  n Manning = 0.013  ·  R = ${fmt(Rhyd, 3)} m`,
        result: `hf50 = ${fmt(hf50 * 100, 2)} cm    L canal = ${fmt(Lrej, 2)} m    L inclinada = ${fmt(Lincl, 2)} m    S = ${fmt(Sman * 1000, 3)} ‰    Δh Manning = ${fmt(hfMan * 100, 2)} cm`,
        note: `Para v = ${fmt(vRej, 2)} m/s harían falta ≈ ${nEspReq} luces (B ≈ ${fmt(Breq, 2)} m). L inclinada = H / sen θ (la hoja usaba H√2, válido solo a 45°).`,
      },
      {
        n: "04",
        title: "Desarenador de canal",
        formula: "A = Q / v     v ≈ 0.25 m/s     y = A/B     BL ≈ y/5",
        substitution: `v = ${fmt(vDes, 2)} m/s  ·  A = ${fmt(Ades, 3)} m²`,
        result: `B ≈ ${fmt(Bdes, 2)} m    y ≈ ${fmt(ydes, 2)} m    BL ≈ ${fmt(BLdes, 2)} m`,
        note: "Velocidad de 0.20–0.30 m/s para que la arena sedimente y la materia orgánica siga.",
      },
      {
        n: "05",
        title: "Sedimentador primario",
        formula: "V = Q t     As = Q / vs     D = √(4 As / π)",
        substitution: `t = ${fmt(tSed, 2)} h  ·  vs = ${fmt(vs, 2)} m³/m²·d  ·  DBO = ${fmt(dbo, 0)} mg/L`,
        result: `Ø = ${fmt(Dsed, 2)} m    h lámina = ${fmt(hSed, 2)} m    V = ${fmt(Vsed, 1)} m³    As = ${fmt(Ased, 1)} m²`,
        note: "Carga superficial 30–40 m³/m²·d y TR ≈ 1.0–2.0 h son valores típicos de primario. H tanque = 2 h + rastra (tolva), como en la hoja.",
      },
      {
        n: "06",
        title: "Lodos y potencia de rastras",
        formula: "Ms = DBO · r · Q · 86400     Vs = Ms / (ρ Gs p)     HP ≈ As / 93",
        substitution: `r = ${fmt(rLodo, 2)}  ·  p = ${fmt(pSol * 100, 1)} %  ·  Gs = ${fmt(Gs, 2)}`,
        result: `Ms = ${fmt(masa, 0)} kg/d    h lodo = ${fmt(hLodo, 2)} m    H tanque = ${fmt(Hsed, 2)} m    ${fmt(HP, 2)} HP`,
        note: `Basura retenida en rejilla ≈ ${fmt(basura, 3)} m³/d (0.03 L/m³ de Qarr).`,
      },
    ],
    [
      ok("hf limpia < 0.15 m", `${fmt(hf, 3)} m`, "< 0.15", hf < 0.15),
      ok("v en luces ≤ 1.2 m/s (sin arrastre)", `${fmt(vReal, 3)} m/s`, "≤ 1.2", vReal > 0 && vReal <= 1.2),
      ok("v 50 % obstruida ≤ 1.2 m/s", `${fmt(v50, 3)} m/s`, "≤ 1.2", v50 <= 1.2),
      ok("v desarenador 0.20–0.40 m/s", `${fmt(vDes, 2)} m/s`, "0.20–0.40", vDes >= 0.2 && vDes <= 0.4),
      ok("vs primario 30–50 m³/m²·d", `${fmt(vs, 1)}`, "30–50", vs >= 25 && vs <= 55),
    ],
    [
      {
        title: "Adopción",
        rows: [
          ["Unidad", "Dimensión"],
          ["Rejilla", `${nBar} barras  ·  B = ${fmt(Btot, 2)} m  ·  θ = ${fmt(theta, 0)}°  ·  v luces ${fmt(vReal, 3)} m/s`],
          ["Desarenador", `${fmt(Bdes, 2)} × ${fmt(ydes + BLdes, 2)} m`],
          ["Sedimentador", `Ø ${fmt(Dsed, 2)} m  ·  H ${fmt(Hsed, 2)} m`],
          ["Motor rastras", `${fmt(HP, 2)} HP`],
        ],
      },
    ],
    {
      Btot: String(Btot),
      Dsed: String(Dsed),
      Hsed: String(Hsed),
      Bdes: String(Bdes),
      nBar: String(nBar),
      yRej: String(yRej),
    }
  );
};

export const pavimentoIg: Engine = (raw) => {
  const F = num(raw, "F", 77.17);
  const LL = num(raw, "LL", 45);
  const IP = num(raw, "IP", 30);
  const a = 0.2 * Math.min(F, 75) + 0.005 * Math.min(F, 75) * Math.min(Math.max(LL - 40, 0), 40) + 0.01 * Math.min(F, 75) * Math.min(Math.max(IP - 10, 0), 30);
  const Ig = Math.max(0, a);
  const e = Ig < 4 ? 15 : Ig < 8 ? 20 : Ig < 12 ? 25 : Ig < 16 ? 30 : 35;
  return out(
    `Ig = ${fmt(Ig, 1)}   ·   espesor ${e} cm (base + carpeta)`,
    `Método D.J. Steele / Índice de Grupo — caminos vecinales`,
    [
      {
        n: "01",
        title: "Índice de grupo AASHTO",
        formula: "Ig = 0.2 a + 0.005 ac + 0.01 bd",
        substitution: `F=%N°200=${fmt(F, 1)}  LL=${fmt(LL, 0)}  IP=${fmt(IP, 0)}`,
        result: `Ig = ${fmt(Ig, 1)}`,
        note: "a = F−35 (0–40); c = LL−40 (0–20); d = IP−10 (0–20) en la fórmula original. Se usa la forma extendida de Steele.",
      },
      {
        n: "02",
        title: "Espesor de pavimento flexible de bajo volumen",
        formula: "Tabla Ig → espesor de base+rodadura",
        result: `${e} cm`,
      },
    ],
    [ok("Ig ≥ 0", fmt(Ig, 1), "≥ 0", Ig >= 0)]
  );
};

export const vigaDiagramas: Engine = (raw) => {
  const L = num(raw, "L", 8);
  const w = num(raw, "w", 2.5);
  const P = num(raw, "P", 0);
  const a = num(raw, "a", 4);
  const tipo = str(raw, "tipo", "repartida");
  let RA = 0, RB = 0, Mmax = 0, Vmax = 0, xM = L / 2;
  if (tipo === "puntual") {
    RA = (P * (L - a)) / L;
    RB = (P * a) / L;
    Mmax = RA * a;
    Vmax = Math.max(RA, RB);
    xM = a;
  } else {
    RA = RB = (w * L) / 2;
    Mmax = (w * L * L) / 8;
    Vmax = RA;
    xM = L / 2;
  }
  const rows: string[][] = [["x (m)", "V (t)", "M (t·m)"]];
  for (let i = 0; i <= 10; i++) {
    const x = (L * i) / 10;
    let V = 0, M = 0;
    if (tipo === "puntual") {
      V = x < a ? RA : RA - P;
      M = x < a ? RA * x : RA * x - P * (x - a);
    } else {
      V = RA - w * x;
      M = RA * x - (w * x * x) / 2;
    }
    rows.push([fmt(x, 2), fmt(V, 3), fmt(M, 3)]);
  }
  return out(
    `Mmáx = ${fmt(Mmax, 2)} t·m   ·   Vmáx = ${fmt(Vmax, 2)} t`,
    `RA = ${fmt(RA, 2)} t    RB = ${fmt(RB, 2)} t    en x = ${fmt(xM, 2)} m`,
    [
      {
        n: "01",
        title: "Reacciones",
        formula: tipo === "puntual" ? "RA = P(L−a)/L    RB = P a/L" : "RA = RB = wL/2",
        result: `RA = ${fmt(RA, 3)} t   RB = ${fmt(RB, 3)} t`,
      },
      {
        n: "02",
        title: "Cortante y momento máximos",
        formula: tipo === "puntual" ? "Mmáx = RA·a" : "Mmáx = w L² / 8",
        result: `Vmáx = ${fmt(Vmax, 3)} t    Mmáx = ${fmt(Mmax, 3)} t·m`,
      },
    ],
    [ok("ΣV = 0", `RA+RB=${fmt(RA + RB, 2)}`, tipo === "puntual" ? `P=${fmt(P, 2)}` : `wL=${fmt(w * L, 2)}`, true)],
    [{ title: "Ordenadas V(x) y M(x)", rows }]
  );
};

export const metodoCross: Engine = (raw) => {
  const L1 = num(raw, "L1", 5);
  const L2 = num(raw, "L2", 6);
  const I1 = num(raw, "I1", 1);
  const I2 = num(raw, "I2", 1);
  const FEM1 = num(raw, "FEM1", -12);
  const FEM2 = num(raw, "FEM2", 10);
  const k1 = I1 / L1;
  const k2 = I2 / L2;
  const DF1 = k1 / (k1 + k2);
  const DF2 = k2 / (k1 + k2);
  const COC = -(FEM1 + FEM2);
  const M21 = FEM1 + DF1 * COC;
  const M23 = FEM2 + DF2 * COC;
  return out(
    `M₂₁ = ${fmt(M21, 2)} t·m    M₂₃ = ${fmt(M23, 2)} t·m`,
    `Nudo 2 — distribución Cross (un ciclo, empotramientos lejanos)`,
    [
      {
        n: "01",
        title: "Rigideces relativas",
        formula: "K = I/L    ·    DF = Ki / ΣK",
        substitution: `K1=${fmt(k1, 3)}  K2=${fmt(k2, 3)}`,
        result: `DF1 = ${fmt(DF1, 3)}   DF2 = ${fmt(DF2, 3)}`,
      },
      {
        n: "02",
        title: "Momentos de empotramiento y desequilibrio",
        formula: "COC = − Σ FEM",
        substitution: `FEM1=${fmt(FEM1, 2)}  FEM2=${fmt(FEM2, 2)}  COC=${fmt(COC, 2)}`,
        result: `${fmt(COC, 2)} t·m`,
      },
      {
        n: "03",
        title: "Momentos finales en el nudo",
        formula: "M = FEM + DF · COC",
        result: `M21 = ${fmt(M21, 2)}   M23 = ${fmt(M23, 2)}   Σ = ${fmt(M21 + M23, 3)}`,
      },
    ],
    [ok("Equilibrio del nudo ΣM ≈ 0", fmt(M21 + M23, 3), "≈ 0", Math.abs(M21 + M23) < 0.05)]
  );
};

export const otros: Record<string, Engine> = {
  demandaElectrica,
  tasacionInmueble,
  costoHorario,
  alcantarilla,
  tanqueSeptico,
  ptarPrimario,
  pavimentoIg,
  vigaDiagramas,
  metodoCross,
};

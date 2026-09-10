import { fmt, fmtFixed } from "../num";
import { paso, type MemoriaDoc } from "../memoria";
import { kvExpediente, labelOrigenQ, type MetaExpediente, type OrigenCaudal } from "./expediente";
import {
  HIDRO_PACK_META,
  calcularAcueducto,
  calcularAliviadero,
  calcularBocatoma,
  calcularDesarenador,
  calcularOrificio,
  calcularRapida,
  calcularRiego,
} from "./pack";

export type MetaPack = MetaExpediente & { origenQ: OrigenCaudal; justificacionQ: string };

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function portada(meta: MetaPack, extras: { k: string; v: string; u?: string }[] = []) {
  return kvExpediente(meta, [
    { k: "Origen del caudal", v: labelOrigenQ(meta.origenQ) },
    ...(meta.justificacionQ ? [{ k: "Justificación de Q", v: meta.justificacionQ }] : []),
    ...extras,
  ]);
}

export function buildDesarenador(meta: MetaPack, r: ReturnType<typeof calcularDesarenador>): MemoriaDoc {
  const m = HIDRO_PACK_META.desarenador;
  return {
    codigo: m.code,
    titulo: m.title,
    norma: m.norma,
    blocks: [
      { type: "cover", kicker: `${m.code} · Hidráulica de riego · Memoria de cálculo`, titulo: "Diseño hidráulico de desarenador", subtitulo: `Cámara de asiento para d ≥ ${fmt(r.dMm, 2)} mm · ${r.ley}`, meta: portada(meta, [{ k: "Referencias", v: "Camp (1946) · USBR Design of Small Canal Structures · Stokes / Rubey" }]) },
      { type: "h2", text: "1. Objeto y alcance" },
      { type: "p", text: `${meta.justificacionQ} La cámara retiene arenas y limos gruesos antes del canal o de la tubería. Se dimensiona para que el tiempo de residencia permita la caída de la partícula de diseño, con velocidad horizontal que no resuspenda el depósito. El by-pass (${fmt(r.Qbypass, 3)} m³/s) y las transiciones de ${fmt(r.Ltrans, 2)} m se detallan en plano.` },
      { type: "h2", text: "2. Marco normativo" },
      { type: "kv", rows: [{ k: "Camp / USBR", v: "Vh 0.15–0.35 m/s; α = 1.5–2.0; t = 30–180 s para arenas de riego." }, { k: "Stokes / Rubey", v: "Velocidad de caída según Reynolds de la partícula y temperatura del agua." }] },
      { type: "h2", text: "3. Criterios de diseño" },
      { type: "table", caption: "Tabla 1. Criterios", headers: ["Parámetro", "Valor", "Fundamento"], rows: [["d de diseño", `${fmt(r.dMm, 2)} mm`, "Partícula a retener"], ["T del agua", `${fmt(r.T, 0)} °C`, "Viscosidad cinemática"], ["Celdas", `${r.nCeldas}`, "Permite lavar una y operar la otra"], ["α", fmt(r.alfa, 2), "Turbulencia y zona de entrada"]] },
      { type: "h2", text: "4. Datos" },
      { type: "kv", rows: [{ k: "Q", v: fmt(r.Q, 3), u: "m³/s" }, { k: "d", v: fmt(r.dMm, 2), u: "mm" }, { k: "Gs", v: fmt(r.Gs, 2) }, { k: "H", v: fmt(r.H, 2), u: "m" }, { k: "Vh", v: fmt(r.Vh, 2), u: "m/s" }] },
      { type: "h2", text: "5. Procedimiento de cálculo" },
      { type: "eq", text: "Vs = (Gs − 1) g d² / (18 ν)     (Stokes, Re < 1)     ·     Rubey si Re ≥ 1", num: "1" },
      paso("5.1", "Velocidad de caída", "Vs (Stokes o Rubey)", `d = ${fmt(r.dMm, 2)} mm · Gs = ${fmt(r.Gs, 2)} · T = ${fmt(r.T, 0)} °C · Re = ${fmt(r.Re, 2)}`, `${fmt(r.Vs, 4)} m/s (${r.ley})`),
      { type: "eq", text: "A = Q / Vh     ·     B = A / H     ·     L = α Vh H / Vs", num: "2" },
      paso("5.2", "Planta de la cámara", "B = Q/(Vh H)     L = α Vh H / Vs", `Q = ${fmt(r.Q, 3)} · Vh = ${fmt(r.Vh, 2)} · H = ${fmt(r.H, 2)} · α = ${fmt(r.alfa, 2)}`, `B = ${fmt(r.B, 2)} m (${r.nCeldas} celdas de ${fmt(r.Bcelda, 2)} m) · L = ${fmt(r.L, 2)} m`),
      paso("5.3", "Retención y lodos", "t = L / Vh     Vol = B H L     Vol_lodos ≈ 0.15 B L", `L = ${fmt(r.L, 2)} · Vh = ${fmt(r.Vh, 2)}`, `t = ${fmt(r.t, 1)} s · Vol = ${fmt(r.Vol, 2)} m³ · lodos ≈ ${fmt(r.VolLodos, 2)} m³`),
      { type: "eq", text: "Q = Cd (2/3) Lw √(2g) h^{3/2}", num: "3" },
      paso("5.4", "Vertedero de salida", "Lw = Q / [Cd (2/3) √(2g) h^{3/2}]", `h = ${fmt(r.hVert, 2)} m · Cd = ${fmt(r.CdVert, 2)}`, `Lw = ${fmt(r.Lw, 2)} m`),
      paso("5.5", "Lavado de fondo", "Vlav ≈ (1/n) R^{2/3} S^{1/2}", `Sfondo = ${fmt(r.Sfondo, 3)}`, `Vlav = ${fmt(r.Vlav, 2)} m/s`),
      { type: "h2", text: "6. Verificaciones" },
      { type: "table", caption: "Tabla 2. Controles", headers: ["Control", "Valor", "Criterio", "Cumple"], rows: [["Velocidad horizontal", `${fmt(r.Vh, 2)} m/s`, "0.15–0.35 m/s", r.okV ? "Sí" : "No"], ["Tiempo de retención", `${fmt(r.t, 0)} s`, "30–180 s", r.okT ? "Sí" : "No"], ["Lavado de fondo", `${fmt(r.Vlav, 2)} m/s`, "≥ 0.60 m/s", r.okLav ? "Sí" : "Revisar"]] },
      { type: "check", ok: r.ok, text: r.ok ? "La cámara cumple velocidad y tiempo de asiento para la partícula de diseño." : "Ajuste H, Vh o α." },
      { type: "h2", text: "7. Conclusión" },
      { type: "p", text: `Se adopta desarenador de ${fmt(r.B, 2)} × ${fmt(r.L, 2)} m en ${r.nCeldas} celda(s), H = ${fmt(r.H, 2)} m, vertedero de ${fmt(r.Lw, 2)} m, transiciones de ${fmt(r.Ltrans, 2)} m y by-pass de ${fmt(r.Qbypass, 3)} m³/s.` },
    ],
  };
}

export function buildBocatoma(meta: MetaPack, r: ReturnType<typeof calcularBocatoma>): MemoriaDoc {
  const m = HIDRO_PACK_META.bocatoma;
  return {
    codigo: m.code,
    titulo: m.title,
    norma: m.norma,
    blocks: [
      { type: "cover", kicker: `${m.code} · Obra de captación`, titulo: "Diseño hidráulico de bocatoma", subtitulo: "Ventana de estiaje y avenida, barraje Creager y remanso", meta: portada(meta, [{ k: "Referencias", v: "Kiselov · Kratz–Hansen · Creager · USBR Small Dams" }]) },
      { type: "h2", text: "1. Objeto y alcance" },
      { type: "p", text: `${meta.justificacionQ} Se dimensiona la ventana de captación para el caudal de riego en estiaje y se verifica como orificio en avenida. El barraje fija la cresta. El estudio hidrológico del río (serie de Q) debe alimentar Q y Qmáx; esta hoja no sustituye ese estudio.` },
      { type: "h2", text: "2. Marco normativo" },
      { type: "kv", rows: [{ k: "Kratz–Hansen", v: "Coeficiente M del vertedero de cresta ancha con barrotes." }, { k: "Creager", v: "Carga sobre azud He = (Qmáx / C L)^{2/3}." }] },
      { type: "h2", text: "3. Criterios" },
      { type: "table", caption: "Tabla 1. Criterios", headers: ["Parámetro", "Valor", "Fundamento"], rows: [["d50 lecho", `${fmt(r.d50, 1)} mm`, "Arrastre y desripiador"], ["K reja", fmt(r.Kreja, 2), "Pérdida local de la reja"], ["Origen de Q", labelOrigenQ(meta.origenQ), meta.justificacionQ]] },
      { type: "h2", text: "4. Datos" },
      { type: "kv", rows: [{ k: "Q diseño", v: fmt(r.Q, 3), u: "m³/s" }, { k: "Q máx", v: fmt(r.Qmax, 2), u: "m³/s" }, { k: "H estiaje", v: fmt(r.Hest, 2), u: "m" }, { k: "Y1", v: fmt(r.Y1, 2), u: "m" }, { k: "Co", v: fmt(r.Co, 2), u: "msnm" }] },
      { type: "h2", text: "5. Procedimiento de cálculo" },
      { type: "eq", text: "Q = k s M b H^{3/2}     ·     M = [0.407 + 0.045 r][1 + 0.285 r²] √(2g)", num: "1" },
      paso("5.1", "Coeficiente de vertedero", "M (Kratz–Hansen)", `r = H/(H+Y1) = ${fmt(r.Hest / (r.Hest + r.Y1), 3)}`, `M = ${fmt(r.M, 3)}`),
      paso("5.2", "Ancho neto y barrotes", "b = Q/(k s M H^{3/2})", `k = ${fmt(r.k, 2)} · s = ${fmt(r.s, 2)}`, `b neto = ${fmt(r.bNeto, 2)} m · n = ${r.nBarr} · b total = ${fmt(r.bTotal, 2)} m`),
      { type: "eq", text: "Q = Cd A √(2g H)     (avenida)", num: "2" },
      paso("5.3", "Ventana en avenida", "h = Q / [Cd b √(2gH)]", `Cd = ${fmt(r.CdOrif, 2)}`, `h = ${fmt(r.hOrif, 2)} m`),
      paso("5.4", "Pérdida de reja", "h_reja = K V²/2g", `K = ${fmt(r.Kreja, 2)} · d50 = ${fmt(r.d50, 1)} mm`, `h_reja = ${fmt(r.hReja, 3)} m`),
      { type: "eq", text: "Cc = Co + ho + h + hs     ·     He = (Qmáx / C L)^{2/3}", num: "3" },
      paso("5.5", "Barraje y remanso", "P = ho + h + hs     L = Ymáx/S", `Lbarraje = ${fmt(r.Lbarraje, 1)} m`, `P = ${fmt(r.P, 2)} m · Cc = ${fmt(r.Cc, 2)} msnm · He = ${fmt(r.He, 2)} m · Lremanso = ${fmt(r.Lremanso, 1)} m`),
      { type: "h2", text: "6. Verificaciones" },
      { type: "check", ok: r.bTotal > 0 && r.He > 0, text: "Ventana y azud quedan definidos. Encauzar el remanso y prever desripiador hacia HID-06." },
      { type: "h2", text: "7. Conclusión" },
      { type: "p", text: `Ventana de ${fmt(r.bTotal, 2)} m con ${r.nBarr} barrotes, altura ${fmt(r.hOrif, 2)} m. Cresta en ${fmt(r.Cc, 2)} msnm. ht muro ${fmt(r.htMuro, 2)} m.` },
    ],
  };
}

export function buildRapida(meta: MetaPack, r: ReturnType<typeof calcularRapida>): MemoriaDoc {
  const m = HIDRO_PACK_META.rapida;
  const tipoTxt = r.tipo === "escalonada" ? "caída escalonada" : r.tipo === "vertical" ? "caída vertical" : "rápida en un tramo";
  return {
    codigo: m.code,
    titulo: m.title,
    norma: m.norma,
    blocks: [
      { type: "cover", kicker: `${m.code} · Conducción de fuerte pendiente`, titulo: "Rápida, caída y resalto hidráulico", subtitulo: tipoTxt, meta: portada(meta, [{ k: "Referencias", v: "USBR Stilling basins · Chow 1959 · Chanson" }]) },
      { type: "h2", text: "1. Objeto y alcance" },
      { type: "p", text: `${meta.justificacionQ} Se calcula la aproximación, el control crítico, el flujo supercrítico, el resalto y el pozo. El tipo de disipador se adopta según Fr₁ (USBR).` },
      { type: "h2", text: "2. Marco normativo" },
      { type: "kv", rows: [{ k: "USBR", v: "Cuencos I–IV según Fr y y2. Losa de espesor de proyecto." }, { k: "Chow", v: "Tirante conjugado y longitud de resalto." }] },
      { type: "h2", text: "3. Criterios" },
      { type: "table", caption: "Tabla 1. Criterios", headers: ["Parámetro", "Valor", "Fundamento"], rows: [["TW de campo", `${fmt(r.TW, 2)} m`, "Tirante de cola medido o de Manning aguas abajo"], ["Espesor de losa", `${fmt(r.eLosa, 2)} m`, "Abrasión y subpresión"], ["Disipador", r.tipoUSBR, "Según Fr₁"]] },
      { type: "h2", text: "4. Datos" },
      { type: "kv", rows: [{ k: "Q", v: fmt(r.Q, 3), u: "m³/s" }, { k: "b rápida", v: fmt(r.b, 2), u: "m" }, { k: "S rápida", v: fmtFixed(r.Srap, 4) }, { k: "Desnivel", v: fmt(r.Hdesnivel, 2), u: "m" }] },
      { type: "h2", text: "5. Procedimiento de cálculo" },
      { type: "eq", text: "yc = (q²/g)^{1/3}     ·     y2/y1 = ½ (√(1+8 Fr₁²) − 1)", num: "1" },
      paso("5.1", "Canal de aproximación", "Manning yn", `n = ${fmt(r.nCanal, 3)} · S = ${fmtFixed(r.Scanal, 4)}`, `yn = ${fmt(r.ynCan, 3)} m · V = ${fmt(r.Vcan, 2)} m/s · E = ${fmt(r.Ecan, 3)} m`),
      paso("5.2", "Control crítico", "yc = (q²/g)^{1/3}", `q = ${fmt(r.q, 3)} m²/s`, `yc = ${fmt(r.yc, 3)} m`),
      paso("5.3", "Pie de rápida", "yn (Manning, S fuerte)", `S = ${fmtFixed(r.Srap, 3)}`, `y1 = ${fmt(r.y1, 3)} m · V1 = ${fmt(r.V1, 2)} m/s · Fr1 = ${fmt(r.Fr1, 2)}`),
      paso("5.4", "Resalto y pozo", "y2, Lr, tipo USBR", `Fr1 = ${fmt(r.Fr1, 2)} · TW = ${fmt(r.TW, 2)} m`, `y2 = ${fmt(r.y2, 3)} m · Lr = ${fmt(r.Lres, 2)} m · ${r.tipoUSBR}${r.resaltoAhogado ? " · resalto ahogado por TW" : ""}`),
      paso("5.5", "Desarrollo en planta", "Lhoriz = ΔH/S", `ΔH = ${fmt(r.Hdesnivel, 2)} m`, `Lhoriz = ${fmt(r.Lhoriz, 1)} m · losa e = ${fmt(r.eLosa, 2)} m`),
      ...(r.tipo === "escalonada" ? [paso("5.6", "Caída escalonada", "dco, Ce, Hr", `h = ${fmt(r.hEscalon, 2)} · ℓ = ${fmt(r.lEscalon, 2)} · N = ${r.Nesc}`, `dc ${r.skimming ? ">" : "≤"} dco → ${r.skimming ? "flujo rasante" : "nappe"} · Hr = ${fmt(r.Hr, 2)} m`)] : []),
      { type: "h2", text: "6. Verificaciones" },
      { type: "check", ok: r.okResalto, text: r.okResalto ? `Resalto estable. Adoptar ${r.tipoUSBR} con L ≥ ${fmt(Math.max(r.Lres, r.Lpav), 2)} m.` : "Fr₁ bajo o TW ahoga el resalto. Revisar pendiente, b o el tirante de cola." },
      { type: "h2", text: "7. Conclusión" },
      { type: "p", text: `Rápida b = ${fmt(r.b, 2)} m, desnivel ${fmt(r.Hdesnivel, 2)} m. Pozo y₂ = ${fmt(r.y2, 2)} m. ${r.tipoUSBR}.` },
    ],
  };
}

export function buildAliviadero(meta: MetaPack, r: ReturnType<typeof calcularAliviadero>): MemoriaDoc {
  const m = HIDRO_PACK_META.aliviadero;
  return {
    codigo: m.code,
    titulo: m.title,
    norma: m.norma,
    blocks: [
      { type: "cover", kicker: `${m.code} · Seguridad del canal`, titulo: "Aliviadero lateral", subtitulo: "Forchheimer, Weisbach y De Marchi (flujo espacialmente variado)", meta: portada(meta) },
      { type: "h2", text: "1. Objeto y alcance" },
      { type: "p", text: `${meta.justificacionQ} El aliviadero evacua Qmáx − Q2 sin ahogar la plantilla. Se calculan tres longitudes: Forchheimer, Weisbach y De Marchi (energía constante). Se adopta la mayor.` },
      { type: "h2", text: "2. Marco normativo" },
      { type: "kv", rows: [{ k: "Forchheimer / Weisbach", v: "Cresta como vertedero de pared delgada. Weisbach con h = 0.60 BL es el control conservador de borde libre." }, { k: "De Marchi (1934)", v: "Flujo espacialmente variado a energía específica constante. φ es adimensional: L = (3/2) T̄ (φ1−φ2) / Cd. No se divide por √(2g)." }, { k: "Tirante y2 de De Marchi", v: "No es el yn de Manning de Q2. Se obtiene sobre la curva E = cte: Q2 = A(y) √[2g(E−y)]. Rama alta si Fr1 < 1 (pendiente suave); rama baja si Fr1 > 1." }] },
      { type: "h2", text: "3. Criterios" },
      { type: "table", caption: "Tabla 1. Criterios", headers: ["Parámetro", "Valor", "Fundamento"], rows: [["Qevac", `${fmt(r.Qevac, 2)} m³/s`, "Qmáx − Q2"], ["Régimen en 1", `Fr1 = ${fmt(r.Fr1, 2)} · ${r.rama === "alto" ? "subcrítico (superficie que remonta)" : "supercrítico (superficie que baja)"}`, "Determina la rama de y2"], ["Sumergencia", r.sumergido ? "Posible" : "Libre", "Y2 de Manning alta respecto de la cresta"], ["L adoptada", `${fmt(r.Ladopt, 2)} m`, "máx(Weisbach, De Marchi, 0.85 Forchheimer)"]] },
      { type: "h2", text: "4. Datos" },
      { type: "kv", rows: [{ k: "Q", v: fmt(r.Q, 2), u: "m³/s" }, { k: "Qmáx", v: fmt(r.Qmax, 2), u: "m³/s" }, { k: "Q2", v: fmt(r.Q2, 2), u: "m³/s" }, { k: "b / z", v: `${fmt(r.b, 2)} / ${fmt(r.z, 2)}` }, { k: "n / S", v: `${fmt(r.n, 3)} / ${fmtFixed(r.S, 4)}` }, { k: "p", v: fmt(r.p, 2), u: "m" }, { k: "μF / Cd", v: `${fmt(r.muF, 2)} / ${fmt(r.muW, 2)}` }, { k: "BL", v: fmt(r.BL, 2), u: "m" }] },
      { type: "h2", text: "5. Procedimiento de cálculo" },
      { type: "eq", text: "Qevac = Qmáx − Q2     ·     Q = μ (2/3) L √(2g) h^{3/2}", num: "1" },
      paso("5.1", "Excedente", "Qevac = Qmáx − Q2", `${fmt(r.Qmax, 2)} − ${fmt(r.Q2, 2)}`, `${fmt(r.Qevac, 2)} m³/s`),
      paso("5.2", "Tirantes de Manning", "Q = (1/n) A R^{2/3} S^{1/2}", `n = ${fmt(r.n, 3)} · S = ${fmtFixed(r.S, 4)}`, `yn = ${fmt(r.yn, 2)} m · Ymáx = ${fmt(r.Ymax, 2)} m · Y2,Manning = ${fmt(r.Y2, 2)} m`),
      paso("5.3", "Cargas sobre cresta (vertedero)", "h1 = Ymáx − p     h2 = Y2,Manning − p     h = (h1+h2)/2", `p = ${fmt(r.p, 2)} m`, `h1 = ${fmt(r.h1, 2)} m · h2 = ${fmt(r.h2, 2)} m · h = ${fmt(r.h, 2)} m`),
      paso("5.4", "Forchheimer y Weisbach", "L = Qevac / [μ (2/3) √(2g) h^{3/2}]", `μF = ${fmt(r.muF, 2)} · μW = ${fmt(r.muW, 2)} · hW = 0.60 BL = ${fmt(r.hW, 2)} m`, `L_Forch = ${fmt(r.Lforch, 2)} m · L_Weis = ${fmt(r.Lweis, 2)} m`),
      { type: "eq", text: "E1 = Ymáx + V1²/2g     ·     Q2 = A(y2) √[2g(E1−y2)]", num: "2" },
      paso("5.5", "Energía en el arranque y y2 de De Marchi", "E constante; rama alta si Fr1<1", `V1 y Fr1 en la sección de Ymáx. Rama ${r.rama}.`, `E1 = ${fmt(r.E1, 3)} m · Fr1 = ${fmt(r.Fr1, 2)} · y2(E) = ${fmt(r.y2e, 2)} m`),
      { type: "eq", text: "φ(y) = [(2E−3p)/E] √[(E−y)/(y−p)] − 3 arcsen √[(E−y)/(E−p)]", num: "3" },
      paso("5.6", "De Marchi", "L = (3/2) T̄ (φ1−φ2) / Cd     ·     T̄ = (T1+T2)/2", `Cd = μW = ${fmt(r.muW, 2)} · T̄ = ${fmt(r.Beq, 2)} m · φ1 = ${fmt(r.phi1, 3)} · φ2 = ${fmt(r.phi2, 3)}`, `L_DeMarchi = ${fmt(r.Ldemarchi, 2)} m · L adoptada = ${fmt(r.Ladopt, 2)} m`),
      { type: "h2", text: "6. Verificaciones" },
      { type: "check", ok: !r.sumergido, text: r.sumergido ? "La cresta puede trabajar sumergida. Verificar canal de retorno y BL del canal con excedente." : "Cresta libre. Prever canal de retorno y no ahogar la plantilla." },
      { type: "h2", text: "7. Conclusión" },
      { type: "p", text: `Cresta lateral de ${fmt(r.Ladopt, 2)} m (De Marchi ${fmt(r.Ldemarchi, 2)} m, Weisbach ${fmt(r.Lweis, 2)} m).` },
    ],
  };
}

export function buildAcueducto(meta: MetaPack, r: ReturnType<typeof calcularAcueducto>): MemoriaDoc {
  const m = HIDRO_PACK_META.acueducto;
  return {
    codigo: m.code,
    titulo: m.title,
    norma: m.norma,
    blocks: [
      { type: "cover", kicker: `${m.code} · Cruce de depresión`, titulo: "Acueducto", subtitulo: r.tipo === "tubo" ? "Conducción entubada" : "Canal sobre vano", meta: portada(meta) },
      { type: "h2", text: "1. Objeto y alcance" },
      { type: "p", text: `${meta.justificacionQ} Se verifica la hidráulica del vano y, si es colgante, un predimensionado de cables (no sustituye el cálculo estructural AISC / E.030).` },
      { type: "h2", text: "2. Marco normativo" },
      { type: "kv", rows: [{ k: "Manning", v: "Pérdida de fricción del tramo." }, { k: "E.030 / viento", v: `Cs = ${fmt(r.Csismo, 2)} (ingresado). Flecha L/200 o la indicada.` }] },
      { type: "h2", text: "3. Criterios" },
      { type: "table", caption: "Tabla 1. Criterios", headers: ["Parámetro", "Valor", "Fundamento"], rows: [["V", "0.6–3.0 m/s", "Sedimentación y abrasión"], ["Csismo", fmt(r.Csismo, 2), "Coeficiente sísmico de anteproyecto"], ["Flecha", `${fmt(r.fmax, 2)} m`, "L/200 o dato"]] },
      { type: "h2", text: "4. Datos" },
      { type: "kv", rows: [{ k: "Q", v: fmt(r.Q, 3), u: "m³/s" }, { k: "L vano", v: fmt(r.L, 1), u: "m" }, { k: "n", v: fmt(r.n, 3) }] },
      { type: "h2", text: "5. Procedimiento de cálculo" },
      { type: "eq", text: "Q = (1/n) A R^{2/3} S^{1/2}     o     V = Q / (π D²/4)", num: "1" },
      paso("5.1", "Hidráulica", r.tipo === "tubo" ? "tubo lleno" : "canal Manning", `Q = ${fmt(r.Q, 3)} m³/s`, `V = ${fmt(r.V, 2)} m/s · hf = ${fmt(r.hf, 3)} m en L = ${fmt(r.L, 1)} m`),
      { type: "eq", text: "wres = √[(Fv+Fs)² + Fw²]     ·     H = w L² / (8 f)", num: "2" },
      paso("5.2", "Cargas por metro", "agua + tubo + viento + Cs·Fv", `Cs = ${fmt(r.Csismo, 2)}`, `Fv = ${fmt(r.Fv, 2)} kg/m · Fs = ${fmt(r.Fsismo, 2)} · Fw = ${fmt(r.Fviento, 2)} · wres = ${fmt(r.wres, 2)} kg/m`),
      paso("5.3", "Cable y flecha", "V = wres L / 2     H = w L²/(8f)     As = V / (0.5 fy)", `f = ${fmt(r.fmax, 2)} m · fy = ${fmt(r.fy, 0)} kg/cm²`, `V apoyo = ${fmt(r.Vapoyo, 1)} kg · H = ${fmt(r.Hcable, 1)} kg · As = ${fmt(r.As, 3)} cm²`),
      { type: "h2", text: "6. Verificaciones" },
      { type: "check", ok: r.okV, text: r.okV ? "Velocidad en 0.6–3.0 m/s." : "Revise diámetro o pendiente." },
      { type: "h2", text: "7. Conclusión" },
      { type: "p", text: `Vano de ${fmt(r.L, 1)} m, V = ${fmt(r.V, 2)} m/s, hf = ${fmt(r.hf, 3)} m. Cables de anteproyecto As = ${fmt(r.As, 3)} cm². Encargar el cálculo estructural.` },
    ],
  };
}

export function buildRiego(meta: MetaPack, r: ReturnType<typeof calcularRiego>): MemoriaDoc {
  const m = HIDRO_PACK_META.riego;
  return {
    codigo: m.code,
    titulo: m.title,
    norma: m.norma,
    blocks: [
      { type: "cover", kicker: `${m.code} · FAO-56`, titulo: "Demanda y riego parcelario", subtitulo: `${r.cultivo} · mes ${MESES[r.mes - 1]} · ${r.metodo}`, meta: portada(meta) },
      { type: "h2", text: "1. Objeto y alcance" },
      { type: "p", text: `Se calcula la demanda del mes más crítico (${MESES[r.mes - 1]}) con FAO-56, el intervalo según el suelo y un lateral. No es el diseño de la red de matriz ni un estudio de campaña completo.` },
      { type: "h2", text: "2. Marco normativo" },
      { type: "kv", rows: [{ k: "FAO-56", v: "ETc = Kc·ETo; Dn = ETc−Pe; Db = Dn / [Ef(1−Lf)]." }, { k: "Suelo", v: "TAW = (CC−PMP)·Zr; RAW = MAD·TAW." }] },
      { type: "h2", text: "3. Criterios" },
      { type: "table", caption: "Tabla 1. Criterios", headers: ["Parámetro", "Valor", "Fundamento"], rows: [["Cultivo", r.cultivo, "Kc de FAO-56"], ["Mes de diseño", MESES[r.mes - 1], "ETo y Pe de la cédula mensual"], ["MAD", fmt(r.MAD, 2), "Fracción de agotamiento"], ["Lf", fmt(r.Lf, 2), "Lavado de sales"]] },
      { type: "h2", text: "4. Cédula mensual" },
      { type: "table", caption: "Tabla 2. ETo y Pe (mm/d)", headers: ["", ...MESES], rows: [["ETo", ...r.ETo12.map((v) => fmt(v, 1))], ["Pe", ...r.Pe12.map((v) => fmt(v, 1))]] },
      { type: "h2", text: "5. Procedimiento de cálculo" },
      { type: "eq", text: "ETc = Kc · ETo     ·     Dn = ETc − Pe     ·     Db = Dn / [Ef (1 − Lf)]", num: "1" },
      paso("5.1", "Uso consuntivo", "ETc = Kc ETo", `Kc = ${fmt(r.Kc, 2)} · ETo(${MESES[r.mes - 1]}) = ${fmt(r.ETo, 2)} mm/d`, `ETc = ${fmt(r.ETc, 2)} mm/d`),
      paso("5.2", "Suelo y intervalo", "TAW = (CC−PMP) Zr     RAW = MAD·TAW     f = RAW/ETc", `CC = ${fmt(r.CC, 1)} % · PMP = ${fmt(r.PMP, 1)} % · Zr = ${fmt(r.Zr, 2)} m`, `TAW = ${fmt(r.TAW, 1)} mm · RAW = ${fmt(r.RAW, 1)} mm · f ≈ ${fmt(r.freq, 1)} d`),
      paso("5.3", "Demanda neta y bruta", "Dn = ETc−Pe     Db = Dn/[Ef(1−Lf)]", `Pe = ${fmt(r.Pe, 2)} · Ef = ${fmt(r.Ef, 2)} · Lf = ${fmt(r.Lf, 2)}`, `Dn = ${fmt(r.DnMm, 2)} mm/d (${fmt(r.DnM3, 1)} m³/d) · Db = ${fmt(r.DbM3, 1)} m³/d`),
      paso("5.4", "Caudal de turno", "Q = Db / (T · 3600)", `T = ${fmt(r.horas, 1)} h · A = ${fmt(r.areaHa, 1)} ha`, `Qcont = ${fmt(r.Qcont * 1000, 2)} L/s · Qturno = ${fmt(r.Qriego * 1000, 2)} L/s`),
      { type: "eq", text: "hf = 10.67 L Q^{1.852} / (C^{1.852} D^{4.87})", num: "2" },
      paso("5.5", "Lateral", "hf = 10.67 L Q^{1.852} / (C^{1.852} D^{4.87})     ·     hf_adm = 0.01 L", `q = ${fmt(r.qLat, 2)} L/s (${r.Ne}×${fmt(r.qEmisor, 2)}) · L = ${fmt(r.Llat, 1)} m · C = ${fmt(r.C, 0)} · hf_adm = ${fmt(r.hfAdm, 2)} m`, `D ≈ ${fmt(r.Dmm, 0)} mm (${fmt(r.Dpulg, 2)} pulg)`),
      { type: "h2", text: "6. Verificaciones" },
      { type: "check", ok: r.freq >= 1 && r.Qriego > 0, text: r.freq >= 1 ? `Intervalo ${fmt(r.freq, 1)} d. Este Qturno alimenta HID-02 / HID-07 si se declara origen «demanda HID-11».` : "Revise suelo o ETc: el intervalo resulta menor de un día." },
      { type: "h2", text: "7. Conclusión" },
      { type: "p", text: `Demanda de ${r.cultivo} en ${MESES[r.mes - 1]}: Qturno = ${fmt(r.Qriego * 1000, 2)} L/s para ${fmt(r.areaHa, 1)} ha. Lateral Ø ${fmt(r.Dmm, 0)} mm.` },
    ],
  };
}

export function buildOrificio(meta: MetaPack, r: ReturnType<typeof calcularOrificio>): MemoriaDoc {
  const m = HIDRO_PACK_META.orificio;
  return {
    codigo: m.code,
    titulo: m.title,
    norma: m.norma,
    blocks: [
      { type: "cover", kicker: `${m.code} · Salida por orificio`, titulo: "Gasto de orificio y compuerta", subtitulo: `${r.regimen} · ${r.forma} · ${r.nOrif} boca(s)`, meta: portada(meta) },
      { type: "h2", text: "1. Objeto y alcance" },
      { type: "p", text: `${meta.justificacionQ} Se calcula el gasto de ${r.nOrif} orificio(s) ${r.forma}s en régimen ${r.regimen}, con reja de aproximación y apertura de compuerta.` },
      { type: "h2", text: "2. Marco normativo" },
      { type: "kv", rows: [{ k: "Torricelli / Rouse", v: "Q = Cd A √(2g ΔH); Cd = Cv Cc." }] },
      { type: "h2", text: "3. Criterios" },
      { type: "table", caption: "Tabla 1. Criterios", headers: ["Parámetro", "Valor", "Fundamento"], rows: [["Cd", fmt(r.Cd, 2), "Re > 10⁵: 0.60–0.62"], ["Apertura", `${fmt(r.ap * 100, 0)} %`, "Compuerta"], ["K reja", fmt(r.Kreja, 2), "Pérdida de aproximación"]] },
      { type: "h2", text: "4. Datos" },
      { type: "kv", rows: [{ k: "H", v: fmt(r.H, 2), u: "m" }, { k: "n orificios", v: String(r.nOrif) }, { k: "V aproximación", v: fmt(r.Vaprox, 2), u: "m/s" }] },
      { type: "h2", text: "5. Procedimiento de cálculo" },
      { type: "eq", text: "V = √(2 g ΔH)     ·     Q = n Cd A √(2 g ΔH)     ·     ΔH = H − h_reja", num: "1" },
      paso("5.1", "Área efectiva", r.forma === "circular" ? "A = a · π D²/4" : "A = a · b h", r.forma === "circular" ? `D = ${fmt(r.D, 3)} m · a = ${fmt(r.ap, 2)}` : `b = ${fmt(r.b, 2)} · h = ${fmt(r.h, 2)} · a = ${fmt(r.ap, 2)}`, `A = ${fmt(r.A, 4)} m²`),
      paso("5.2", "Carga neta", "ΔH = H − K Vap²/2g", `H = ${fmt(r.dHbruto, 2)} m · h_reja = ${fmt(r.hReja, 3)} m`, `ΔH = ${fmt(r.dH, 2)} m`),
      paso("5.3", "Gasto", "Q = n Cd A √(2g ΔH)", `n = ${r.nOrif} · Cd = ${fmt(r.Cd, 2)} · Re = ${fmt(r.Re, 0)}`, `Q₁ = ${fmt(r.Q1, 3)} m³/s · Q = ${fmt(r.Q, 3)} m³/s (${fmt(r.Q * 1000, 1)} L/s)`),
      { type: "h2", text: "6. Verificaciones" },
      { type: "check", ok: r.Re > 1e4, text: r.Re > 1e4 ? "Re alto: Cd adoptado es aplicable." : "Re bajo: calibrar Cd en laboratorio o con aforo." },
      { type: "h2", text: "7. Conclusión" },
      { type: "p", text: `Q = ${fmt(r.Q, 3)} m³/s con ${r.nOrif} orificio(s), Cd = ${fmt(r.Cd, 2)} y apertura ${fmt(r.ap * 100, 0)} %.` },
    ],
  };
}

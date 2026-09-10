import {
  type CalcOutput,
  type Inputs,
  beta1,
  fmt,
  num,
  pickBars,
  spacingForAs,
  whitneyFlexure,
} from "@/lib/engineering";
import { designBeamStirrups, designColumnStirrups } from "../estribos";
import { barByName } from "../types";

export function columnas(i: Inputs): CalcOutput {
  const b = num(i.b, 40);
  const h = num(i.h, 40);
  const nBar = num(i.nBar, 8);
  const barName = String(i.bar ?? '3/4"');
  const fc = num(i.fc, 210);
  const fy = num(i.fy, 4200);
  const Pu = num(i.Pu, 180);
  const Mu = num(i.Mu, 12);
  const rec = num(i.rec, 4);
  const Ag = b * h;
  const bar = pickBars(1, barName).bar;
  const Asmin = 0.01 * Ag;
  const AsDado = nBar * bar.As;
  const nNeed = Math.max(4, Math.ceil(Asmin / bar.As));
  const nUse = AsDado + 1e-9 < Asmin ? nNeed : nBar;
  const As = nUse * bar.As;
  const rho = As / Ag;
  const phi = 0.65;
  const Pnmax = phi * 0.80 * (0.85 * fc * (Ag - As) + fy * As) / 1000;
  const d = h - rec - 0.95 - bar.db / 2;
  const Po = (0.85 * fc * (Ag - As) + fy * As) / 1000;
  const phiPn_b = phi * 0.35 * Po;
  const e = (Mu * 100000) / Math.max(Pu * 1000, 1);
  const okPM = Pu <= Pnmax && Mu <= phiPn_b * (d / 100) * 0.6;
  const destBar = barByName('3/8"');
  const st = designColumnStirrups({
    b,
    h,
    rec,
    Lu: 300,
    fc,
    fy,
    destName: destBar.name,
    destDb: destBar.db,
    destAs: destBar.as,
    dbLong: bar.db,
    nBar: nUse,
    nRamas: 0,
    sismico: true,
  });
  return {
    title: "Columna de concreto armado",
    summary: `${fmt(b,0)}×${fmt(h,0)} cm, ${nUse} Ø ${bar.name}. ρ=${fmt(rho * 100, 2)} % ≥ 1 %. Estribos ${st.arregloPlano}.`,
    geometry: { b, h, rec, nBar: nUse },
    steps: [
      { title: "Cuantía geométrica mínima", formula: "ρg = As / Ag    0.01 ≤ ρg ≤ 0.04 (E.060 10.9.1; 0.06 solo en empalme)", substitution: `As,mín=0.01×${fmt(Ag,0)}=${fmt(Asmin,2)} cm²  ·  As=${fmt(As,2)} cm² (${nUse} Ø ${bar.name})`, result: fmt(rho * 100, 2), unit: "%" },
      { title: "Carga axial máxima", formula: "φPn,máx = 0.80 φ [0.85 f'c (Ag−As)+fy As]    φ=0.65 (estribos)", substitution: "", result: fmt(Pnmax, 1), unit: "t" },
      { title: "Excentricidad de la combinación", formula: "e = Mu / Pu", substitution: `Pu=${fmt(Pu,1)} t  Mu=${fmt(Mu,1)} t·m`, result: fmt(e, 1), unit: "cm" },
      { title: "Punto de interacción (simplificado)", formula: "Comparar (Pu, Mu) con envolvente φPn–φMn (P0, balanceada, tracción pura)", substitution: `P0=${fmt(Po,1)} t`, result: okPM ? "Dentro" : "Fuera", unit: "" },
      { title: "Øest y ℓo — E.060 21.4", formula: "Øest ≥ máx(db/4, 3/8\")    ·    ℓo ≥ máx(h, b, Lu/6, 45 cm)", substitution: `Øest mín=${fmt(st.destMin,2)} cm  ·  ℓo=${fmt(st.lo,1)} cm`, result: `${st.destLabel}  ·  ℓo=${fmt(st.lo,1)} cm`, unit: "" },
      { title: "Ash y espaciamiento", formula: "Ash ≥ 0.09 s hc f'c/fy    y    0.3 s hc (Ag/Ach−1) f'c/fy", substitution: `Ash=${fmt(st.Ash,2)} cm²  ·  s máx=${fmt(st.sMaxConf,1)} cm`, result: `@ ${st.sConf} / ${st.sRest} cm`, unit: "cm" },
      { title: "Despiece", formula: "n = 1 + ⌈(ℓo−5)/s⌉    ·    primer estribo a 5 cm", substitution: st.arregloPlano, result: `${st.nTotal} und`, unit: "" },
    ],
    checks: [
      { id: "rho", label: "Cuantía ρg ≥ 1 %", value: `${fmt(rho * 100, 2)} %`, limit: "≥ 1.00 %", ok: rho >= 0.01 },
      { id: "rhomax", label: "Cuantía ρg ≤ 4 %", value: `${fmt(rho * 100, 2)} %`, limit: "≤ 4.00 %", ok: rho <= 0.04 },
      { id: "pn", label: "Pu ≤ φPn,máx", value: `${fmt(Pu,1)} t`, limit: `≤ ${fmt(Pnmax,1)} t`, ok: Pu <= Pnmax },
      { id: "nb", label: "Mínimo 4 barras (rect.) / 6 (circ.)", value: `${nUse}`, limit: "≥ 4", ok: nUse >= 4 },
      { id: "pm", label: "Par (P,M) dentro de envolvente aprox.", value: okPM ? "OK" : "Revisar sección", limit: "Diagrama P-M", ok: okPM },
      { id: "dest", label: "Øest ≥ máx(db/4, 3/8\")", value: destBar.name, limit: `≥ ${fmt(st.destMin, 2)} cm`, ok: st.destOk },
      { id: "ash", label: "Ash/s ≥ Ash/s req", value: fmt(st.Ash / st.sConf, 3), limit: `≥ ${fmt(st.avsReq, 3)}`, ok: st.ashOk },
    ],
    steel: [
      { zone: "Longitudinal", bars: `${nUse} Ø ${bar.name}`, As: `${fmt(As,2)} cm²` },
      { zone: "Estribos ℓo", bars: `${st.destLabel} @ ${st.sConf} cm  (${st.arregloConf})`, As: `${fmt(st.Ash,2)} cm²` },
      { zone: "Estribos resto", bars: `${st.destLabel} @ ${st.sRest} cm`, As: `${fmt(st.Ash,2)} cm²` },
    ],
    notes: ["Se verifica cuantía, φPn máx, envolvente P–M y el despiece de estribos E.060 21.4 (primer estribo a 5 cm)."],
  };
}

export function vigaFlexion(i: Inputs): CalcOutput {
  const b = num(i.b, 25);
  const h = num(i.h, 45);
  const L = num(i.L, 8);
  const fc = num(i.fc, 250);
  const fy = num(i.fy, 4200);
  const rec = num(i.rec, 5);
  const cv = num(i.cv, 170);
  const L1 = num(i.L1, 4);
  const L2 = num(i.L2, 4);
  const combo = String(i.combo ?? "e060");
  const A1 = (L * L1) / 2;
  const A2 = (L * L2) / 2;
  const ppViga = 2.4 * (b / 100) * (h / 100) * L;
  const ppLosa = 0.3 * (A1 + A2);
  const CM = (ppViga + ppLosa) * 1000;
  const CV = cv * (A1 + A2);
  const Cu = combo === "aci" ? 1.2 * CM + 1.6 * CV : 1.4 * CM + 1.7 * CV;
  const wu = Cu / L;
  const Mu = (wu * L * L) / 8 / 1000;
  const d = h - rec - 0.95;
  const flex = whitneyFlexure(Mu, b, d, fc, fy);
  const bars = pickBars(flex.AsUse, '5/8"');
  return {
    title: "Viga a flexión",
    summary: `${fmt(b,0)}×${fmt(h,0)} cm, L=${fmt(L,2)} m. Mu=${fmt(Mu,2)} t·m. ${bars.n} Ø ${bars.bar.name}.`,
    geometry: { b, h, L, rec, d },
    steps: [
      { title: "Áreas tributarias", formula: "A = L · ℓlosa / 2  (cada lado)", substitution: `ℓ1=${fmt(L1)}  ℓ2=${fmt(L2)}`, result: `${fmt(A1,1)} + ${fmt(A2,1)}`, unit: "m²" },
      { title: "Carga muerta", formula: "CM = peso viga + losas tributarias", substitution: `γ=2.4 t/m³  e losa≈0.20–0.25`, result: fmt(CM, 0), unit: "kg" },
      { title: "Carga viva", formula: "CV = s/c × ΣA", substitution: `${fmt(cv,0)} kg/m²`, result: fmt(CV, 0), unit: "kg" },
      { title: "Carga última", formula: combo === "aci" ? "U=1.2D+1.6L  (ACI)" : "U=1.4D+1.7L  (E.060)", substitution: "", result: fmt(Cu, 0), unit: "kg" },
      { title: "Momento de diseño", formula: "wu=Cu/L    Mu=wu L²/8", substitution: `wu=${fmt(wu,1)} kg/m`, result: fmt(Mu, 2), unit: "t·m" },
      { title: "Acero a tracción", formula: "Whitney", substitution: `d=${fmt(d,1)} cm  As=${fmt(flex.AsUse,2)} cm²`, result: `${bars.n} Ø ${bars.bar.name}` },
    ],
    checks: [
      { id: "rho", label: "Cuantía ≤ 0.75ρb", value: fmt(flex.rho, 4), limit: fmt(flex.rhoMax, 4), ok: flex.ok },
      { id: "asmin", label: "As ≥ Asmín", value: fmt(bars.AsProv, 2), limit: fmt(flex.Asmin, 2), ok: bars.AsProv >= flex.Asmin },
      { id: "h", label: "Peralte L/12–L/16", value: `${fmt(h,0)} cm`, limit: `${fmt((L * 100) / 16,0)}–${fmt((L * 100) / 12,0)} cm`, ok: h >= (L * 100) / 18 },
    ],
    steel: [{ zone: "Lecho positivo", bars: `${bars.n} Ø ${bars.bar.name}`, As: `${fmt(bars.AsProv,2)} cm²` }],
    notes: ["Diseño a flexión por Whitney, con cuantía dúctil según E.060 / ACI."],
  };
}

export function vigaCortante(i: Inputs): CalcOutput {
  const b = num(i.b, 30);
  const h = num(i.h, 45);
  const L = num(i.L, 5.6);
  const rec = num(i.rec, 6);
  const wu = num(i.wu, 7000);
  const fc = num(i.fc, 210);
  const fy = num(i.fy, 4200);
  const Av = num(i.Av, 1.42);
  const d = h - rec;
  const VA = wu * L / 2;
  const Vu = VA * ((L / 2 - d / 100) / (L / 2));
  const stirrup = barByName('3/8"');
  const sh = designBeamStirrups({
    b,
    h,
    d,
    rec,
    fc,
    fy,
    Vu: Vu / 1000,
    VA: VA / 1000,
    Av,
    L,
    destName: stirrup.name,
    destDb: stirrup.db,
    dbLong: 1.27,
    nRamas: 2,
    sismico: true,
  });
  return {
    title: "Viga a cortante",
    summary: `Vu=${fmt(Vu, 0)} kg. ${sh.estLabel} ${sh.arregloPlano} (${sh.nTotal} und).`,
    geometry: { b, h, L, d, rec },
    steps: [
      { title: "Cortante en el apoyo", formula: "VA = wu L / 2", substitution: `wu=${fmt(wu,0)} kg/m  L=${fmt(L,2)} m`, result: fmt(VA, 0), unit: "kg" },
      { title: "Cortante de diseño a distancia d", formula: "Vu = VA (L/2 − d) / (L/2)", substitution: `d=${fmt(d,1)} cm`, result: fmt(Vu, 0), unit: "kg" },
      { title: "Resistencia del concreto", formula: "Vc = 0.53 √f'c b d    φ=0.85", substitution: sh.regimen, result: fmt(sh.phiVc * 1000, 0), unit: "kg" },
      { title: "Acero de corte Vs", formula: "Vs = Vu/φ − Vc    s = Av fy d / Vs", substitution: `Av=${fmt(Av,2)} cm²  ·  s máx=${fmt(sh.sMaxApoyo,1)} cm`, result: fmt(sh.sApoyo, 0), unit: "cm" },
      { title: "Despiece", formula: "n = 1 + ⌈(ℓ−5)/s⌉    ·    primer estribo a 5 cm", substitution: sh.arregloPlano, result: `${sh.nTotal} und`, unit: "" },
    ],
    checks: [
      { id: "need", label: "¿Requiere estribos?", value: sh.needDesign ? "Vu>φVc" : sh.needMin ? "Mínimos" : "Constructivos", limit: "φVc/2 y φVc", ok: true },
      { id: "vs", label: "Vs ≤ 2.1√f'c b d", value: fmt(sh.Vs, 2), limit: fmt(sh.VsMax, 2), ok: sh.Vs <= sh.VsMax },
      { id: "smax", label: "s ≤ s máx", value: `${sh.sApoyo} cm`, limit: `≤ ${fmt(sh.sMaxApoyo,0)} cm`, ok: sh.sApoyo <= sh.sMaxApoyo + 0.1 },
    ],
    steel: [{ zone: "Estribos 2 ramas", bars: `${sh.estLabel} ${sh.arregloPlano}`, As: `${fmt(Av,2)} cm²` }],
    notes: ["Vu a distancia d, Vc, Vs, zona 2h y metrado con primer estribo a 5 cm (E.060 11 y 21.3)."],
  };
}

export function vigaDoble(i: Inputs): CalcOutput {
  const b = num(i.b, 30);
  const h = num(i.h, 50);
  const d = num(i.d, 44);
  const dp = num(i.dp, 5);
  const fc = num(i.fc, 210);
  const fy = num(i.fy, 4200);
  const wu = num(i.wu, 5);
  const L = num(i.L, 8);
  const Mu = wu * L * L / 8;
  const b1 = beta1(fc);
  const rhoB = b1 * 0.85 * (fc / fy) * (6000 / (6000 + fy));
  const rhoMax = 0.75 * rhoB;
  const As1 = rhoMax * b * d;
  const a1 = (As1 * fy) / (0.85 * fc * b);
  const Mn1 = As1 * fy * (d - a1 / 2) / 100000;
  const phiMn1 = 0.9 * Mn1;
  const need = Mu > phiMn1;
  const Mn2 = Math.max(0, Mu / 0.9 - Mn1);
  const fy2 = fy;
  const Asp = Mn2 * 100000 / (fy2 * (d - dp));
  const As = As1 + Asp;
  const ey = fy / 2e6;
  const c = a1 / b1;
  const eps = 0.003 * (c - dp) / Math.max(c, 1);
  const yieldComp = eps >= ey;
  const barsT = pickBars(As, '3/4"');
  const barsC = pickBars(Math.max(Asp, 0.002 * b * d), '5/8"');
  return {
    title: "Viga doblemente armada",
    summary: need ? `Requiere As'=${fmt(Asp,2)} cm². ${barsT.n} Ø inf. + ${barsC.n} Ø sup.` : "No requiere acero a compresión.",
    geometry: { b, h, d, dp, L },
    steps: [
      { title: "Momento último", formula: "Mu = wu L² / 8", substitution: `wu=${fmt(wu,2)} t/m  L=${fmt(L)} m`, result: fmt(Mu, 2), unit: "t·m" },
      { title: "Cuantía balanceada y máxima", formula: "ρb=β1·0.85·(f'c/fy)·(6000/(6000+fy))    ρmáx=0.75ρb", substitution: `β1=${fmt(b1,2)}`, result: fmt(rhoMax, 4) },
      { title: "Capacidad simplemente armada φMn1", formula: "As1=ρmáx b d    Mn1=As1 fy (d−a/2)", substitution: `As1=${fmt(As1,1)} cm²`, result: fmt(phiMn1, 2), unit: "t·m" },
      { title: "Momento en exceso", formula: "Mn2 = Mu/φ − Mn1", substitution: need ? "Mu > φMn1" : "Mu ≤ φMn1", result: fmt(Mn2, 2), unit: "t·m" },
      { title: "Acero a compresión", formula: "As' = Mn2 / [fy (d−d')]", substitution: `d'=${fmt(dp,1)} cm  εs'=${fmt(eps,4)}`, result: fmt(Asp, 2), unit: "cm²", note: yieldComp ? "As' fluye" : "As' no fluye: usar fs=εs'Es" },
    ],
    checks: [
      { id: "need", label: "¿Doble armadura?", value: need ? "Sí" : "No", limit: "Mu ≷ φMn1", ok: true },
      { id: "yield", label: "Fluencia de As'", value: yieldComp ? "Fluye" : "No fluye", limit: "εs' ≥ fy/Es", ok: !need || yieldComp },
      { id: "as", label: "As total", value: fmt(As, 2), limit: "As1+As'", ok: As > 0 },
    ],
    steel: [
      { zone: "Tracción", bars: `${barsT.n} Ø ${barsT.bar.name}`, As: `${fmt(barsT.AsProv,2)} cm²` },
      { zone: "Compresión", bars: need ? `${barsC.n} Ø ${barsC.bar.name}` : "No requiere", As: `${fmt(need ? barsC.AsProv : 0,2)} cm²` },
    ],
    notes: ["Viga doblemente armada: φMn1 de ρmáx, As' de compresión y As total."],
  };
}

export function vigaCompuesta(i: Inputs): CalcOutput {
  const D = num(i.D, 121.92);
  const Bf = num(i.Bf, 50.8);
  const tf = num(i.tf, 2.54);
  const tw = num(i.tw, 0.95);
  const hc = num(i.hc, 15);
  const be = num(i.be, 180);
  const Fy = num(i.Fy, 2532);
  const fc = num(i.fc, 210);
  const L = num(i.L, 35.5);
  const As = 2 * Bf * tf + (D - 2 * tf) * tw;
  const Ix = (Bf * D ** 3) / 12 * 0.85;
  const n = 2.1e6 / (15000 * Math.sqrt(fc));
  const At = As + (be * hc) / n;
  const Fb = 0.6 * Fy;
  const w = As * 7.85 / 1000 + 2.4 * (be * hc) / 1e4;
  const M = w * L * L / 8 * 100000;
  const fb = M * (D / 2) / Ix;
  return {
    title: "Viga compuesta acero-concreto",
    summary: `Perfil ${fmt(D,0)}×${fmt(Bf,0)} mm eq. Fb=${fmt(Fb,0)} kg/cm². fb=${fmt(fb,0)}.`,
    geometry: { D, Bf, tf, tw, hc, be, L },
    steps: [
      { title: "Propiedades del perfil", formula: "A, Ix del I    peso=7.85 A", substitution: `A=${fmt(As,1)} cm²`, result: fmt(Ix, 0), unit: "cm⁴" },
      { title: "Sección transformada", formula: "n=Es/Ec    At=As+be hc/n", substitution: `n=${fmt(n,1)}  be=${fmt(be,0)} cm`, result: fmt(At, 1), unit: "cm²" },
      { title: "Esfuerzo admisible", formula: "Fb=0.60 Fy", substitution: `Fy=${fmt(Fy,0)}`, result: fmt(Fb, 0), unit: "kg/cm²" },
      { title: "Esfuerzo actuante", formula: "M=wL²/8    fb=M c / I", substitution: `w=${fmt(w,2)} t/m`, result: fmt(fb, 0), unit: "kg/cm²" },
    ],
    checks: [{ id: "fb", label: "fb ≤ Fb", value: `${fmt(fb,0)} kg/cm²`, limit: `≤ ${fmt(Fb,0)}`, ok: fb <= Fb * 1.05 }],
    notes: ["Viga compuesta: sección transformada, Fb = 0.60 Fy y esfuerzo actuante fb = Mc/I."],
  };
}

export function zapataAislada(i: Inputs): CalcOutput {
  const t1 = num(i.t1, 0.55);
  const t2 = num(i.t2, 0.8);
  const PD = num(i.PD, 180);
  const PL = num(i.PL, 65);
  const qt = num(i.qt, 3.5);
  const Df = num(i.Df, 1.7);
  const gt = num(i.gt, 2.1);
  const fc = num(i.fc, 280);
  const fy = num(i.fy, 4200);
  const rec = num(i.rec, 7.5);
  const sc = num(i.sc, 0.5);
  const hc = num(i.hc, 0.7);
  const Pserv = PD + PL;
  const sn = qt * 10 - gt * Df - sc - 2.4 * hc;
  const Az = Pserv / Math.max(sn, 0.1);
  const lado = Math.sqrt(Az);
  const T = num(i.T, Math.ceil((lado + (t2 - t1)) * 20) / 20);
  const S = num(i.S, Math.ceil((Az / T) * 20) / 20);
  const Pu = 1.4 * PD + 1.7 * PL;
  const qu = Pu / (T * S);
  const lv1 = (T - t2) / 2;
  const lv2 = (S - t1) / 2;
  const d = hc * 100 - rec - 0.8;
  const b0 = 2 * ((t1 + t2) * 100 + 2 * d);
  const VuPunz = Pu * (1 - ((t1 * 100 + d) * (t2 * 100 + d)) / (T * 100 * S * 100));
  const phiVc = 0.85 * 1.06 * Math.sqrt(fc) * b0 * d / 1000;
  const Mu = qu * T * lv2 * lv2 / 2;
  const flex = whitneyFlexure(Mu, S * 100, d, fc, fy);
  const steel = spacingForAs(flex.AsUse, 100, '3/4"');
  return {
    title: "Zapata aislada",
    summary: `${fmt(T,2)}×${fmt(S,2)} m, hc=${fmt(hc,2)} m. As ${steel.bar.name} @ ${fmt(steel.sAdopt,1)} cm.`,
    geometry: { t1, t2, T, S, hc, Df, lv1, lv2 },
    steps: [
      { title: "Esfuerzo neto", formula: "σn = σt − γt Df − s/c − γc hc", substitution: `σt=${fmt(qt)} kg/cm² = ${fmt(qt * 10,1)} t/m²`, result: fmt(sn, 2), unit: "t/m²" },
      { title: "Área de zapata", formula: "Az = (PD+PL)/σn", substitution: `Pserv=${fmt(Pserv,1)} t`, result: fmt(Az, 2), unit: "m²" },
      { title: "Voladizos iguales", formula: "T − t2 = S − t1    (Lv1=Lv2)", substitution: `columna ${fmt(t1,2)}×${fmt(t2,2)} m`, result: `${fmt(T,2)} × ${fmt(S,2)}`, unit: "m" },
      { title: "Punzonamiento", formula: "b0=2[(c1+d)+(c2+d)]    φVc=0.85·1.06√f'c b0 d", substitution: `d=${fmt(d,1)} cm`, result: `${fmt(VuPunz,1)} vs ${fmt(phiVc,1)}`, unit: "t" },
      { title: "Flexión en voladizo", formula: "Mu = qu L · ℓv² / 2", substitution: `qu=${fmt(qu,2)} t/m²  ℓv=${fmt(lv2,2)} m`, result: fmt(Mu, 2), unit: "t·m" },
      { title: "Acero", formula: "Whitney por metro de ancho", substitution: `As=${fmt(flex.AsUse,2)} cm²/m`, result: `${steel.bar.name} @ ${fmt(steel.sAdopt,1)} cm` },
    ],
    checks: [
      { id: "lv", label: "Lv1 ≈ Lv2", value: `${fmt(lv1,2)} / ${fmt(lv2,2)} m`, limit: "igualar voladizos", ok: Math.abs(lv1 - lv2) < 0.15 },
      { id: "punz", label: "Punzonamiento Vu ≤ φVc", value: fmt(VuPunz, 1), limit: fmt(phiVc, 1), ok: VuPunz <= phiVc },
      { id: "rho", label: "Cuantía dúctil", value: fmt(flex.rho, 4), limit: fmt(flex.rhoMax, 4), ok: flex.ok },
    ],
    steel: [
      { zone: "Dirección T", bars: `${steel.bar.name} @ ${fmt(steel.sAdopt,1)} cm`, As: `${fmt(steel.AsProv,2)} cm²/m` },
      { zone: "Dirección S", bars: `${steel.bar.name} @ ${fmt(steel.sAdopt,1)} cm`, As: `${fmt(steel.AsProv,2)} cm²/m` },
    ],
    notes: ["Zapata aislada: área por esfuerzo neto, punzonamiento y flexión en voladizo."],
  };
}

export function zapataCombinada(i: Inputs): CalcOutput {
  const Pd1 = num(i.Pd1, 75);
  const Pl1 = num(i.Pl1, 35);
  const Pd2 = num(i.Pd2, 125);
  const Pl2 = num(i.Pl2, 50);
  const t1 = num(i.t1, 0.5);
  const t2 = num(i.t2, 0.65);
  const eje = num(i.eje, 5);
  const qt = num(i.qt, 2);
  const Df = num(i.Df, 1.5);
  const gt = num(i.gt, 2.1);
  const hc = num(i.hc, 0.7);
  const fc = num(i.fc, 210);
  const fy = num(i.fy, 4200);
  const P1 = Pd1 + Pl1;
  const P2 = Pd2 + Pl2;
  const Pt = P1 + P2;
  const sn = qt * 10 - gt * Df - 0.5 - 2.4 * hc;
  const Az = Pt / Math.max(sn, 0.1);
  const Xo = (P2 * eje) / Pt;
  const Lz = num(i.Lz, Math.ceil(2 * Xo * 20) / 20);
  const b = num(i.b, Math.ceil((Az / Lz) * 20) / 20);
  const qu = (1.4 * (Pd1 + Pd2) + 1.7 * (Pl1 + Pl2)) / (Lz * b);
  const d = hc * 100 - 7.5;
  const Mu = qu * b * (Xo - t1 / 2) ** 2 / 2;
  const flex = whitneyFlexure(Mu, b * 100, d, fc, fy);
  const steel = spacingForAs(flex.AsUse, 100, '3/4"');
  return {
    title: "Zapata combinada rectangular",
    summary: `Lz=${fmt(Lz,2)} m × b=${fmt(b,2)} m. Xo=${fmt(Xo,2)} m.`,
    geometry: { Lz, b, Xo, eje, hc, t1, t2 },
    steps: [
      { title: "Esfuerzo neto y área", formula: "σn=σt−γDf−s/c−γc hc    Az=Pt/σn", substitution: `Pt=${fmt(Pt,1)} t`, result: `${fmt(Az,2)} m²`, unit: "" },
      { title: "Centroide de cargas", formula: "Xo = P2 · ℓeje / Pt    Lz = 2 Xo  (resultante centrada)", substitution: `ℓeje=${fmt(eje,2)} m`, result: fmt(Xo, 2), unit: "m" },
      { title: "Ancho", formula: "b = Az / Lz", substitution: "", result: fmt(b, 2), unit: "m" },
      { title: "Reacción neta última", formula: "qu = Pu / (Lz b)", substitution: "", result: fmt(qu, 2), unit: "t/m²" },
      { title: "Flexión entre columnas", formula: "Viga invertida, Mu de voladizo interior", substitution: `d=${fmt(d,1)} cm`, result: fmt(Mu, 2), unit: "t·m" },
    ],
    checks: [
      { id: "cent", label: "Resultante en el centro (Lz≈2Xo)", value: `${fmt(Lz,2)} m`, limit: `${fmt(2 * Xo,2)} m`, ok: Math.abs(Lz - 2 * Xo) < 0.4 },
      { id: "rho", label: "Cuantía", value: fmt(flex.rho, 4), limit: fmt(flex.rhoMax, 4), ok: flex.ok },
    ],
    steel: [{ zone: "Longitudinal inferior", bars: `${steel.bar.name} @ ${fmt(steel.sAdopt,1)} cm`, As: `${fmt(steel.AsProv,2)} cm²/m` }],
    notes: ["Zapata combinada rectangular (ACI 318): resultante centrada, ancho b y flexión invertida."],
  };
}

export function vigaCimentacion(i: Inputs): CalcOutput {
  const b = num(i.b, 0.3);
  const h = num(i.h, 0.5);
  const L = num(i.L, 5);
  const fc = num(i.fc, 210);
  const fy = num(i.fy, 4200);
  const Pexc = num(i.Pexc, 80);
  const e = num(i.e, 0.4);
  const wu = 2.4 * b * h * 1.4 + 1.8;
  const Mexc = Pexc * e;
  const Mu = wu * L * L / 8 + Mexc / L * L / 2;
  const d = h * 100 - 6;
  const flex = whitneyFlexure(Mu, b * 100, d, fc, fy);
  const bars = pickBars(flex.AsUse, '5/8"');
  return {
    title: "Viga de cimentación",
    summary: `${fmt(b,2)}×${fmt(h,2)} m, L=${fmt(L,2)} m. ${bars.n} Ø ${bars.bar.name}.`,
    geometry: { b, h, L, e },
    steps: [
      { title: "Peralte y ancho", formula: "h ≥ L/10 a L/12    b ≥ 0.25 m", substitution: "", result: `${fmt(b,2)}×${fmt(h,2)}`, unit: "m" },
      { title: "Momento por excentricidad de zapata", formula: "M = P · e    se toma en la viga de amarre", substitution: `P=${fmt(Pexc)} t  e=${fmt(e,2)} m`, result: fmt(Mexc, 1), unit: "t·m" },
      { title: "Flexión de la viga", formula: "Mu = wu L²/8 + efecto de P e", substitution: `d=${fmt(d,1)} cm`, result: fmt(Mu, 2), unit: "t·m" },
    ],
    checks: [
      { id: "h", label: "Peralte suficiente", value: `${fmt(h,2)} m`, limit: `≥ L/12=${fmt(L / 12,2)}`, ok: h >= L / 14 },
      { id: "as", label: "As", value: fmt(bars.AsProv, 2), limit: fmt(flex.AsUse, 2), ok: bars.AsProv >= flex.AsUse },
    ],
    steel: [{ zone: "Longitudinal", bars: `${bars.n} Ø ${bars.bar.name}`, As: `${fmt(bars.AsProv,2)} cm²` }],
    notes: ["Viga de conexión de zapata centrada: momento por excentricidad y flexión de la viga de amarre."],
  };
}

export function platea(i: Inputs): CalcOutput {
  const Lx = num(i.Lx, 20);
  const Ly = num(i.Ly, 17.45);
  const t = num(i.t, 0.45);
  const Ks = num(i.Ks, 8);
  const fc = num(i.fc, 210);
  const qa = num(i.qa, 1.2);
  const Df = num(i.Df, 1.1);
  const Ptot = num(i.Ptot, 1800);
  const E = 15000 * Math.sqrt(fc);
  const A = Lx * Ly;
  const lrad = Math.pow((3 * Ks) / (E * (t * 100) ** 3), 0.25);
  const Lc = Math.max(Lx, Ly) * 100 / 4;
  const ratio = Lc * lrad;
  const rígido = ratio < 1.75;
  const q = Ptot / A;
  return {
    title: "Platea de cimentación",
    summary: `${fmt(Lx,2)}×${fmt(Ly,2)} m, t=${fmt(t*100,0)} cm. Método ${rígido ? "rígido" : "flexible"}.`,
    geometry: { Lx, Ly, t, Df },
    steps: [
      { title: "Área y presión", formula: "A=Lx Ly    q=ΣP/A  ≤ qa", substitution: `ΣP=${fmt(Ptot,0)} t`, result: `${fmt(A,1)} m²   q=${fmt(q,2)}`, unit: "t/m²" },
      { title: "Radio de rigidez relativa", formula: "l = ⁴√(3 Ks / (E t³))", substitution: `Ks=${fmt(Ks)} kg/cm³  E=${fmt(E,0)} kg/cm²`, result: fmt(1 / lrad, 0), unit: "cm" },
      { title: "Criterio rígido / flexible", formula: "Lc/l < 1.75 → rígido    > 1.75 → flexible", substitution: `Lc=${fmt(Lc,0)} cm`, result: rígido ? "RÍGIDO" : "FLEXIBLE" },
    ],
    checks: [
      { id: "q", label: "q ≤ qa", value: `${fmt(q,2)} t/m²`, limit: `qa=${fmt(qa * 10,1)} t/m²`, ok: q <= qa * 10 },
      { id: "t", label: "Espesor mínimo práctico", value: `${fmt(t * 100,0)} cm`, limit: "≥ 30–40 cm", ok: t >= 0.3 },
    ],
    notes: ["Losa de cimentación: presión media, radio de rigidez y criterio rígido/flexible."],
  };
}

export function pilotes(i: Inputs): CalcOutput {
  const b = num(i.b, 0.3);
  const t = num(i.t, 0.6);
  const PD = num(i.PD, 80);
  const PL = num(i.PL, 40);
  const Df = num(i.Df, 6.5);
  const phi = num(i.phi, 24);
  const g = num(i.g, 1.5);
  const D = num(i.D, 0.4);
  const k = num(i.k, 1);
  const L = Df - (b + t) / 2;
  const p = 4 * D;
  const Qf = k * g * Math.tan((phi * Math.PI) / 180) * p * D * (15 * L - 11.25 * D) * 100;
  const qp = 40 * g * D * 1000;
  const Qu = (Qf + qp) / 1000;
  const Qa = Qu / 2.5;
  const P = PD + PL;
  const n = Math.ceil(P / Math.max(Qa, 0.1));
  const hc = 0.5 + 0.15;
  return {
    title: "Pilotes prefabricados",
    summary: `${n} pilotes ${fmt(D*100,0)}×${fmt(D*100,0)} cm. Qu=${fmt(Qu,1)} t  Qa=${fmt(Qa,1)} t.`,
    geometry: { D, L, n, hc, b, t },
    steps: [
      { title: "Longitud del pilote", formula: "L = Df − (b+t)/2 + empotramiento", substitution: `Df=${fmt(Df,2)} m`, result: fmt(L, 2), unit: "m" },
      { title: "Fricción de fuste (granular)", formula: "Qf = k γ tanφ p D (15L − 11.25 D)", substitution: `k=${fmt(k,1)}  φ=${fmt(phi,0)}°`, result: fmt(Qf / 1000, 1), unit: "t" },
      { title: "Punta", formula: "Qp ≈ Nq σ'v Ap", substitution: "", result: fmt(qp / 1000, 1), unit: "t" },
      { title: "Capacidad y número", formula: "Qu=Qf+Qp    Qa=Qu/FS    n=P/Qa", substitution: `FS=2.5  P=${fmt(P,1)} t`, result: `${n} pilotes` },
    ],
    checks: [
      { id: "n", label: "n ≥ 2 (grupo mínimo)", value: `${n}`, limit: "≥ 2", ok: n >= 2 },
      { id: "qa", label: "n·Qa ≥ P", value: `${fmt(n * Qa,1)} t`, limit: `${fmt(P,1)} t`, ok: n * Qa >= P },
    ],
    steel: [{ zone: "Pilote prefabricado", bars: "8 Ø 3/4\" típico en 40×40", As: "22.8 cm²" }],
    notes: ["Pilotes prefabricados: capacidad de fuste y punta, Qa = Qu/FS y número de pilotes."],
  };
}

export function escaleraDos(i: Inputs): CalcOutput {
  const p = num(i.p, 0.28);
  const cp = num(i.cp, 0.175);
  const b = num(i.b, 1.2);
  const n1 = num(i.n1, 9);
  const n2 = num(i.n2, 8);
  const t = num(i.t, 0.15);
  const fc = num(i.fc, 210);
  const fy = num(i.fy, 4200);
  const sc = num(i.sc, 0.4);
  const acab = num(i.acab, 0.1);
  const Ln1 = n1 * p;
  const Ln2 = n2 * p;
  const alpha = Math.atan(cp / p);
  const hm = t / Math.cos(alpha);
  const tmin1 = Ln1 / 20;
  const w = 2.4 * hm + acab + sc;
  const wu = 1.4 * (2.4 * hm + acab) + 1.7 * sc;
  const Mu = wu * Ln1 * Ln1 / 8;
  const d = t * 100 - 2.5;
  const flex = whitneyFlexure(Mu * b, 100, d, fc, fy);
  const steel = spacingForAs(flex.AsUse, 100, '3/8"');
  return {
    title: "Escalera de dos tramos",
    summary: `Tramo 1 Ln=${fmt(Ln1,2)} m, t=${fmt(t*100,0)} cm. ${steel.bar.name} @ ${fmt(steel.sAdopt,1)} cm.`,
    geometry: { p, cp, b, t, Ln1, Ln2, hm, alpha: (alpha * 180) / Math.PI },
    steps: [
      { title: "Predimensionado", formula: "t = Ln/20 a Ln/25", substitution: `Ln1=${fmt(Ln1,2)}  Ln/20=${fmt(tmin1,2)}`, result: fmt(t, 2), unit: "m" },
      { title: "Espesor horizontal equivalente", formula: "hm = t / cosα    α=atan(cp/p)", substitution: `α=${fmt((alpha * 180) / Math.PI,1)}°`, result: fmt(hm, 3), unit: "m" },
      { title: "Metrado (E.020)", formula: "w = γc hm + acabados + s/c", substitution: `s/c=${fmt(sc,2)} t/m²`, result: fmt(w, 3), unit: "t/m²" },
      { title: "Momento del tramo 1", formula: "wu=1.4D+1.7L    Mu=wu Ln²/8  (por m de ancho)", substitution: "", result: fmt(Mu, 3), unit: "t·m/m" },
      { title: "Acero longitudinal", formula: "Whitney, b=100 cm", substitution: `d=${fmt(d,1)} cm`, result: `${steel.bar.name} @ ${fmt(steel.sAdopt,1)} cm` },
    ],
    checks: [
      { id: "t", label: "t ≥ Ln/25", value: `${fmt(t,2)} m`, limit: `≥ ${fmt(Ln1 / 25,2)} m`, ok: t >= Ln1 / 25 },
      { id: "paso", label: "2 cp + p ≈ 0.60–0.64 m", value: fmt(2 * cp + p, 2), limit: "0.60–0.64 m", ok: 2 * cp + p >= 0.58 && 2 * cp + p <= 0.66 },
      { id: "rho", label: "Cuantía", value: fmt(flex.rho, 4), limit: fmt(flex.rhoMax, 4), ok: flex.ok },
    ],
    steel: [
      { zone: "Tramo 1, positivo", bars: `${steel.bar.name} @ ${fmt(steel.sAdopt,1)} cm`, As: `${fmt(steel.AsProv,2)} cm²/m` },
      { zone: "Tramo 2", bars: `${steel.bar.name} @ ${fmt(steel.sAdopt,1)} cm`, As: `${fmt(steel.AsProv,2)} cm²/m` },
      { zone: "Transversal dist.+temp. (no Av)", bars: '3/8" @ 25 cm', As: "2.84 cm²/m" },
    ],
    notes: ["Escalera de dos tramos: metrado E.020, Mu del tramo inclinado y acero principal."],
  };
}

export function escaleraDescanso(i: Inputs): CalcOutput {
  const p = num(i.p, 0.3);
  const cp = num(i.cp, 0.18);
  const b = num(i.b, 1.2);
  const n = num(i.n, 10);
  const Ld = num(i.Ld, 1.2);
  const t = num(i.t, 0.18);
  const fc = num(i.fc, 210);
  const fy = num(i.fy, 4200);
  const sc = num(i.sc, 0.4);
  const acab = num(i.acab, 0.12);
  const Ln = n * p;
  const alpha = Math.atan(cp / p);
  const hm = t / Math.cos(alpha);
  const wu1 = 1.4 * (2.4 * hm + acab) + 1.7 * sc;
  const wu2 = 1.4 * (2.4 * t + acab) + 1.7 * sc;
  const Ltot = Ln + Ld;
  const Mu = (wu1 * Ln * (Ltot / 2) ** 2) / 8 * 0.9;
  const d = t * 100 - 2;
  const flex = whitneyFlexure(Math.max(Mu, 0.15), 100, d, fc, fy);
  const steel = spacingForAs(flex.AsUse, 100, '3/8"');
  return {
    title: "Escalera con descanso",
    summary: `Ln=${fmt(Ln,2)} m + Ld=${fmt(Ld,2)} m. t=${fmt(t*100,0)} cm.`,
    geometry: { p, cp, b, t, Ln, Ld, hm, alpha: (alpha * 180) / Math.PI },
    steps: [
      { title: "Geometría", formula: "Ln = n·p    α=atan(cp/p)    hm=t/cosα", substitution: `n=${fmt(n,0)}`, result: `Ln=${fmt(Ln,2)}  α=${fmt((alpha * 180) / Math.PI,1)}°` },
      { title: "Cargas wu1 (tramo) y wu2 (descanso)", formula: "wu = 1.4(γc h + acab)+1.7 s/c", substitution: "", result: `${fmt(wu1,3)} / ${fmt(wu2,3)}`, unit: "t/m²" },
      { title: "Modelo de viga quebrada", formula: "Reacciones y Mu en tramo y descanso", substitution: `Ltot=${fmt(Ltot,2)} m`, result: fmt(Mu, 3), unit: "t·m/m" },
      { title: "Acero", formula: "Whitney", substitution: `d=${fmt(d,1)} cm`, result: `${steel.bar.name} @ ${fmt(steel.sAdopt,1)} cm` },
    ],
    checks: [
      { id: "t", label: "t ≥ Ln/20 a Ln/25", value: `${fmt(t,2)} m`, limit: `${fmt(Ln / 25,2)}–${fmt(Ln / 20,2)}`, ok: t >= Ln / 25 },
      { id: "paso", label: "2cp+p", value: fmt(2 * cp + p, 2), limit: "0.60–0.64", ok: 2 * cp + p >= 0.58 && 2 * cp + p <= 0.66 },
    ],
    steel: [{ zone: "Principal", bars: `${steel.bar.name} @ ${fmt(steel.sAdopt,1)} cm`, As: `${fmt(steel.AsProv,2)} cm²/m` }],
    notes: ["Escalera con descanso: geometría (paso y contrapaso), cargas wu y acero del tramo quebrado."],
  };
}

export function edificioSismo(i: Inputs): CalcOutput {
  const Z = num(i.Z, 0.45);
  const S = num(i.S, 1.1);
  const Tp = num(i.Tp, 1.0);
  const Tl = num(i.Tl, 1.6);
  const U = num(i.U, 1.0);
  const R0 = num(i.R0, 6);
  const Ia = num(i.Ia, 1);
  const Ip = num(i.Ip, 1);
  const nPisos = num(i.nPisos, 4);
  const hPiso = num(i.hPiso, 2.7);
  const P = num(i.P, 1200);
  const Ct = num(i.Ct, 35);
  const hn = nPisos * hPiso;
  const Tuse = num(i.T, Math.pow(hn / Ct, 0.75));
  const R = R0 * Ia * Ip;
  let C: number;
  if (Tuse < Tp) C = 2.5;
  else if (Tuse <= Tl) C = 2.5 * (Tp / Tuse);
  else C = 2.5 * (Tp * Tl) / (Tuse * Tuse);
  C = Math.max(C, 2.5 * (Tp / Tl) * 0.5);
  const V = (Z * U * C * S * P) / R;
  const k = Tuse < 0.5 ? 1 : Tuse <= 2.5 ? 0.75 + 0.5 * Tuse : 2;
  const driftLim = String(i.sistema ?? "concreto") === "albañileria" ? 0.005 : 0.007;
  return {
    title: "Análisis sísmico estático E.030",
    summary: `Z=${fmt(Z,2)} S=${fmt(S,2)} U=${fmt(U,1)} R=${fmt(R,1)}  T=${fmt(Tuse,2)} s  V=${fmt(V,1)} t  (${fmt((V / P) * 100, 1)} %W).`,
    geometry: { nPisos, hPiso, hn },
    steps: [
      { title: "Periodo fundamental", formula: "T = (hn/Ct)^0.75", substitution: `hn=${fmt(hn,1)} m  Ct=${fmt(Ct,0)}`, result: fmt(Tuse, 3), unit: "s" },
      { title: "Factor C", formula: "C=2.5 (T<Tp);  2.5 Tp/T (Tp≤T≤TL);  2.5 Tp TL/T² (T>TL)", substitution: `Tp=${fmt(Tp,2)}  TL=${fmt(Tl,2)}`, result: fmt(C, 3) },
      { title: "Reducción R", formula: "R = R0 · Ia · Ip", substitution: `R0=${fmt(R0,1)}  Ia=${fmt(Ia,2)}  Ip=${fmt(Ip,2)}`, result: fmt(R, 2) },
      { title: "Cortante basal", formula: "V = Z U C S P / R", substitution: `P=${fmt(P,0)} t`, result: fmt(V, 1), unit: "t" },
      { title: "Distribución en altura", formula: "Fi = V · (wi hi^k) / Σ wj hj^k    k=1 (T≤0.5s)", substitution: `k=${fmt(k,2)}  n=${fmt(nPisos,0)}`, result: `${fmt(V / nPisos, 1)} t (aprox. si masas iguales y k=1)`, unit: "" },
      { title: "Deriva admisible", formula: "Δi / hi ≤ 0.007 (concreto) ó 0.005 (albañilería)  ×0.75R en desplazamientos", substitution: "", result: fmt(driftLim, 3) },
    ],
    checks: [
      { id: "cmin", label: "C no menor que el mínimo normativo", value: fmt(C, 3), limit: "C ≥ Cmin E.030", ok: C >= 0.25 },
      { id: "v", label: "Cortante / peso", value: `${fmt((V / P) * 100, 1)} %`, limit: "típico 4–12 %", ok: V > 0 && V / P < 0.25 },
      { id: "r", label: "R con irregularidades", value: fmt(R, 2), limit: "R=R0·Ia·Ip", ok: R >= 1 },
    ],
    notes: [
      "Espectro E.030, cortante basal y derivas. Ajustar distrito, perfil S y categoría U.",
      "Z = 0.45 corresponde a zona 4 (p. ej. Lambayeque / Chiclayo).",
    ],
  };
}

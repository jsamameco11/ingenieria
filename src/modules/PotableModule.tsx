import { useMemo, useState, type ReactNode } from "react";
import { fmt, fmtFixed } from "../lib/num";
import { paso, type MemoriaDoc } from "../lib/memoria";
import {
  type AccesorioConduccionIn,
  type AccesorioTipo,
  type CaptacionTipo,
  type Crecimiento,
  type MaterialTubo,
  type NudoConduccionIn,
  type NudoTipo,
  type PotableKind,
  type Region,
  type TramoConduccionIn,
  ACCESORIO_CATALOG,
  ACCESORIO_TIPOS,
  CAPTACION_LABEL,
  DOTACION_RURAL,
  MAT_LABEL,
  MATERIALES_TUBO,
  NUDO_LABEL,
  NUDO_TIPOS,
  PULG_COMERCIAL,
  cHazenDe,
  calcularCloracion,
  calcularDotacion,
  calcularFiltroLento,
  calcularImpulsion,
  calcularPrefiltro,
  calcularReservorio,
  calcularSedimentador,
  calcularSistema,
  semillaSistemaAbierto,
  syncTramosConduccion,
} from "../lib/saneamiento/potable";
import { Field, Num, OptNum, Text } from "../ui/Field";
import { CalcDirtyNote, CalcularButton, MemoriaPendiente, useMemoriaOnCalcular } from "../ui/calcular";
import { Paper } from "../ui/Paper";
import {
  CloradorSvg,
  DotacionBarrasSvg,
  FiltroLentoSvg,
  ImpulsionSvg,
  PrefiltroSvg,
  ReservorioSvg,
  SedimentadorSvg,
  SistemaPerfilSvg,
} from "../ui/potableDiagrams";
import { exportarWord } from "../lib/exportWord";
import { printMemoria } from "../lib/printDoc";

function uid(p: string) {
  return `${p}${Math.random().toString(36).slice(2, 8)}`;
}

const META = {
  dotacion: { code: "AP-01", title: "Dotación y caudales", norma: "RNE OS.100" },
  sistema: { code: "AP-02", title: "Sistema abierto de agua potable", norma: "RNE OS.100 · OS.030 · OS.010" },
  sedimentador: { code: "AP-03", title: "Sedimentador", norma: "RNE OS.020" },
  prefiltro: { code: "AP-04", title: "Prefiltro de grava", norma: "RNE OS.020" },
  "filtro-lento": { code: "AP-05", title: "Filtro lento de arena", norma: "RNE OS.020" },
  impulsion: { code: "AP-06", title: "Línea de impulsión y bombeo", norma: "RNE OS.040 · OS.100" },
  reservorio: { code: "AP-07", title: "Reservorio apoyado", norma: "RNE OS.030 · IS.010" },
  cloracion: { code: "AP-08", title: "Sistema de cloración", norma: "RNE OS.020 · DS N° 031-2010-SA" },
} as const;

function Ficha({ code, rows, adopt }: { code: string; rows: [string, string, string][]; adopt: string }) {
  return (
    <>
      <aside className="ficha">
        <div className="ficha-head">
          <span>Resultados</span>
          <span>{code}</span>
        </div>
        <table>
          <tbody>
            {rows.map(([k, v, u]) => (
              <tr key={k}>
                <td className="k">{k}</td>
                <td className="v">{v}</td>
                <td className="u">{u}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </aside>
      <div className="ficha-adopt">
        <span>Adopción</span>
        <strong>{adopt}</strong>
      </div>
    </>
  );
}

export function PotableModule({ kind }: { kind: PotableKind }) {
  const info = META[kind];
  const [meta, setMeta] = useState({
    proyecto: "Sistema de agua potable",
    ubicacion: "Perú",
    profesional: "Ingeniero civil",
  });

  const [modo, setModo] = useState<"urbano" | "rural">("urbano");
  const [nLotesPeq, setNLotesPeq] = useState(651);
  const [nLotesGrand, setNLotesGrand] = useState(165);
  const [Dp, setDp] = useState(5);
  const [dotPeq, setDotPeq] = useState(150);
  const [dotGrand, setDotGrand] = useState(220);
  const [Av, setAv] = useState(4086.63);
  const [Ae, setAe] = useState(3174.76);
  const [dotV, setDotV] = useState(2);
  const [dotE, setDotE] = useState(6);
  const [cRet, setCRet] = useState(0.8);
  const [K1, setK1] = useState(1.3);
  const [K2, setK2] = useState(1.8);
  const [Vi, setVi] = useState(50);
  const [fracReg, setFracReg] = useState(0.25);
  const [Po, setPo] = useState(200);
  const [rCrec, setRCrec] = useState(2);
  const [tAnos, setTAnos] = useState(20);
  const [crecimiento, setCrecimiento] = useState<Crecimiento>("aritmetico");
  const [region, setRegion] = useState<Region>("sierra");
  const [arrastre, setArrastre] = useState(true);
  const [perdidas, setPerdidas] = useState(0.25);
  const [Ep, setEp] = useState(50);
  const [Es, setEs] = useState(0);

  const [Qf, setQf] = useState(2.5);
  const [bombeo, setBombeo] = useState(false);
  const [Hcil, setHcil] = useState(2.6);
  const [captacionTipo, setCaptacionTipo] = useState<CaptacionTipo>("manantial");
  const [zCaptNAA, setZCaptNAA] = useState(545.4);
  const [material, setMaterial] = useState<MaterialTubo>("pvc");
  const [recubrimiento, setRecubrimiento] = useState(1);
  const semilla = useMemo(() => semillaSistemaAbierto("pvc"), []);
  const [nudos, setNudos] = useState<NudoConduccionIn[]>(semilla.nudos);
  const [tramos, setTramos] = useState<TramoConduccionIn[]>(semilla.tramos);
  const [accesorios, setAccesorios] = useState<AccesorioConduccionIn[]>(semilla.accesorios);

  const [QmdLs, setQmdLs] = useState(0.451);
  const [Bsed, setBsed] = useState(0.5);
  const [L1sed, setL1sed] = useState(0.8);
  const [Hsed, setHsed] = useState(1);
  const [Sfondo, setSfondo] = useState(0.1);
  const [Vo, setVo] = useState(0.1);
  const [Dorif, setDorif] = useState(0.025);
  const [A2, setA2] = useState(0.02);
  const [VS, setVS] = useState(0.00017);
  const [autoB, setAutoB] = useState(true);

  const [Npf, setNpf] = useState(2);
  const [Vfpf, setVfpf] = useState(0.4);
  const [Hpf, setHpf] = useState(2);
  const [co, setCo] = useState(1000);
  const [c1, setC1] = useState(500);
  const [c2, setC2] = useState(100);
  const [c3, setC3] = useState(50);

  const [Nfl, setNfl] = useState(2);
  const [Vffl, setVffl] = useState(0.2);
  const [Erasp, setErasp] = useState(0.02);
  const [nRasp, setNRasp] = useState(6);
  const [Buse, setBuse] = useState(0);
  const [Ause, setAuse] = useState(0);
  const [hAgua, setHAgua] = useState(1.2);
  const [hLecho, setHLecho] = useState(0.9);
  const [hSop, setHSop] = useState(0.2);
  const [hDren, setHDren] = useState(0.15);
  const [BLfl, setBLfl] = useState(0.25);

  const [hb, setHb] = useState(14);
  const [HgSuc, setHgSuc] = useState(0);
  const [Lsuc, setLsuc] = useState(1);
  const [DsucPulg, setDsucPulg] = useState(1.5);
  const [HgImp, setHgImp] = useState(25);
  const [Limp, setLimp] = useState(250);
  const [DimpPulg, setDimpPulg] = useState(1.5);
  const [matImp, setMatImp] = useState<MaterialTubo>("fg");
  const Cimp = cHazenDe(matImp);
  const [eta, setEta] = useState(0.6);
  const [Ps, setPs] = useState(2);
  const [Ksuc, setKsuc] = useState(2.8);
  const [Kimp, setKimp] = useState(10.8);

  const [bRes, setBRes] = useState(2.1);
  const [Lres, setLRes] = useState(2.1);
  const [hs, setHs] = useState(0.1);
  const [hing, setHing] = useState(0.2);
  const [hreb, setHreb] = useState(0.15);
  const [hrebAgua, setHrebAgua] = useState(0.1);
  const [fracRes, setFracRes] = useState(0);

  const [dosis, setDosis] = useState(2);
  const [rAct, setRAct] = useState(65);
  const [cSol, setCSol] = useState(0.25);
  const [tCiclo, setTCiclo] = useState(12);
  const [Cd, setCd] = useState(0.8);
  const [DorifMm, setDorifMm] = useState(2);
  const [hGoteo, setHGoteo] = useState(0.2);

  const dot = useMemo(
    () =>
      calcularDotacion({
        modo, nLotesPeq, nLotesGrand, Dp, dotPeq, dotGrand, Av, Ae, dotV, dotE, cRet, K1, K2, Vi, fracReg,
        Po, r: rCrec, t: tAnos, crecimiento, region, arrastre, perdidas, Ep, Es, Dep: 20, Des: 25,
      }),
    [modo, nLotesPeq, nLotesGrand, Dp, dotPeq, dotGrand, Av, Ae, dotV, dotE, cRet, K1, K2, Vi, fracReg, Po, rCrec, tAnos, crecimiento, region, arrastre, perdidas, Ep, Es]
  );

  const sis = useMemo(
    () =>
      calcularSistema({
        Po, r: rCrec, t: tAnos, crecimiento,
        dot: arrastre ? DOTACION_RURAL[region].con : DOTACION_RURAL[region].sin,
        K1, K2, perdidas, Qf, bombeo, horasBombeo: hb, Hcil,
        captacionTipo, zCaptNAA, recubrimiento, material, nudos, tramos, accesorios,
      }),
    [Po, rCrec, tAnos, crecimiento, arrastre, region, K1, K2, perdidas, Qf, bombeo, hb, Hcil, captacionTipo, zCaptNAA, recubrimiento, material, nudos, tramos, accesorios]
  );

  const sed = useMemo(
    () => calcularSedimentador({ QmdLs, B: Bsed, L1: L1sed, H: Hsed, Sfondo, Vo, Dorif, A2, VS, autoB }),
    [QmdLs, Bsed, L1sed, Hsed, Sfondo, Vo, Dorif, A2, VS, autoB]
  );
  const pf = useMemo(
    () => calcularPrefiltro({ QmdLs, N: Npf, Vf: Vfpf, H: Hpf, co, c1, c2, c3 }),
    [QmdLs, Npf, Vfpf, Hpf, co, c1, c2, c3]
  );
  const fl = useMemo(
    () => calcularFiltroLento({ QmdLs, N: Nfl, Vf: Vffl, E: Erasp, nRasp, Buse, Ause, hAgua, hLecho, hSop, hDren, BL: BLfl }),
    [QmdLs, Nfl, Vffl, Erasp, nRasp, Buse, Ause, hAgua, hLecho, hSop, hDren, BLfl]
  );
  const imp = useMemo(
    () => calcularImpulsion({ QmdLs, hb, HgSuc, Lsuc, DsucPulg, HgImp, Limp, DimpPulg, C: Cimp, eta, Ps, Ksuc, Kimp }),
    [QmdLs, hb, HgSuc, Lsuc, DsucPulg, HgImp, Limp, DimpPulg, Cimp, eta, Ps, Ksuc, Kimp]
  );
  const res = useMemo(
    () => calcularReservorio({ Pf: dot.Pf || Po, dot: modo === "rural" ? (arrastre ? DOTACION_RURAL[region].con : DOTACION_RURAL[region].sin) : 80, fracReg, fracRes, b: bRes, L: Lres, hs, hing, hreb, hrebAgua }),
    [dot.Pf, Po, modo, arrastre, region, fracReg, fracRes, bRes, Lres, hs, hing, hreb, hrebAgua]
  );
  const clo = useMemo(
    () => calcularCloracion({ QmdLs, d: dosis, rAct, c: cSol, tH: tCiclo, Cd, DorifMm, h: hGoteo, gotaL: 5e-5 }),
    [QmdLs, dosis, rAct, cSol, tCiclo, Cd, DorifMm, hGoteo]
  );

  const applyNudos = (next: NudoConduccionIn[]) => {
    setNudos(next);
    setTramos((prev) => syncTramosConduccion(next, prev, material));
  };
  const patchNudo = (id: string, p: Partial<NudoConduccionIn>) => {
    applyNudos(nudos.map((n) => (n.id === id ? { ...n, ...p } : n)));
  };
  const addNudo = () => {
    const sorted = [...nudos].sort((a, b) => a.pk - b.pk);
    const a = sorted[Math.max(0, sorted.length - 2)] ?? sorted[0];
    const b = sorted[sorted.length - 1] ?? a;
    const i = nudos.length + 1;
    applyNudos([
      ...nudos,
      {
        id: uid("n"),
        codigo: `N-${String(i).padStart(2, "0")}`,
        tipo: "intermedio",
        pk: (a.pk + b.pk) / 2,
        z: (a.z + b.z) / 2,
      },
    ]);
  };
  const removeNudo = (id: string) => {
    if (nudos.length <= 2) return;
    const next = nudos.filter((n) => n.id !== id);
    applyNudos(next);
    setAccesorios((prev) => prev.filter((a) => a.nudoId !== id && next.some((n) => n.id === a.nudoId)));
  };
  const patchTramo = (id: string, p: Partial<TramoConduccionIn>) => {
    setTramos((prev) => prev.map((t) => (t.id === id ? { ...t, ...p } : t)));
  };
  const patchAcc = (id: string, p: Partial<AccesorioConduccionIn>) => {
    setAccesorios((prev) => prev.map((a) => (a.id === id ? { ...a, ...p } : a)));
  };
  const addAcc = () => {
    const host = nudos.find((n) => n.tipo === "valvula") ?? nudos[0];
    setAccesorios((prev) => [...prev, { id: uid("a"), nudoId: host.id, tipo: "codo90", n: 1, K: 0 }]);
  };

  const doc: MemoriaDoc = useMemo(() => {
    const cover = {
      kicker: `${info.code} · Agua potable · Memoria de cálculo`,
      titulo: info.title,
      subtitulo: info.norma,
      meta: [
        { k: "Proyecto", v: meta.proyecto },
        { k: "Ubicación", v: meta.ubicacion },
        { k: "Profesional responsable", v: meta.profesional },
        { k: "Normas", v: info.norma },
      ],
    };
    if (kind === "dotacion") return docDotacion(cover, info, modo, region, arrastre, crecimiento, rCrec, tAnos, Dp, nLotesPeq, nLotesGrand, dotPeq, dotGrand, Av, Ae, Po, dot);
    if (kind === "sistema") return docSistema(cover, info, sis, material);
    if (kind === "sedimentador") return docSed(cover, info, sed);
    if (kind === "prefiltro") return docPf(cover, info, pf);
    if (kind === "filtro-lento") return docFl(cover, info, fl);
    if (kind === "impulsion") return docImp(cover, info, imp, matImp);
    if (kind === "reservorio") return docRes(cover, info, res);
    return docClo(cover, info, clo);
  }, [kind, info, meta, modo, region, arrastre, crecimiento, rCrec, tAnos, Dp, nLotesPeq, nLotesGrand, dotPeq, dotGrand, Av, Ae, Po, dot, sis, sed, pf, fl, imp, res, clo, material, matImp]);
  const livePack = useMemo(
    () => ({ doc, kind, info, material, dot, sis, sed, pf, fl, imp, res, clo }),
    [doc, kind, info, material, dot, sis, sed, pf, fl, imp, res, clo]
  );
  const { doc: pack, dirty, calcular } = useMemoriaOnCalcular(livePack, kind);
  const memoria = pack.doc;
  const pub = pack;

  let extra: ReactNode = null;
  let ficha: ReactNode = null;
  if (pub.kind === "dotacion") {
    extra = <DotacionBarrasSvg Qp={pub.dot.Qp} Qmd={pub.dot.Qmd} Qmh={pub.dot.Qmh} />;
    ficha = (
      <Ficha
        code={pub.info.code}
        rows={[
          ["Pf", fmt(pub.dot.Pf, 0), "hab"],
          ["Qp", fmt(pub.dot.Qp, 3), "L/s"],
          ["Qmd", fmt(pub.dot.Qmd, 3), "L/s"],
          ["Qmh", fmt(pub.dot.Qmh, 3), "L/s"],
          ["Q alc. medio", fmt(pub.dot.Qal, 3), "L/s"],
          ["Vreg", fmt(pub.dot.Vreg, 1), "m³"],
          ["Vt", fmt(pub.dot.Vt, 1), "m³"],
        ]}
        adopt={`${pub.dot.Vadop} m³ de almacenamiento`}
      />
    );
  } else if (pub.kind === "sistema") {
    extra = (
      <SistemaPerfilSvg
        perfil={pub.sis.perfil}
        tramos={pub.sis.tramos}
        Qmd={pub.sis.Qmd}
        Vadop={pub.sis.Vadop}
        Hftot={pub.sis.Hftot}
        presion={pub.sis.presion}
      />
    );
    ficha = (
      <Ficha
        code={pub.info.code}
        rows={[
          ["Pf", fmt(pub.sis.Pf, 0), "hab"],
          ["Qmd", fmt(pub.sis.Qmd, 3), "L/s"],
          ["Q fuente", fmt(pub.sis.Qf, 2), "L/s"],
          ["V adoptado", fmt(pub.sis.Vadop, 0), "m³"],
          ["Ø tramos", pub.sis.Dtxt, "pulg"],
          ["Hf fricción", fmt(pub.sis.Hf, 2), "m"],
          ["Hf local", fmt(pub.sis.Hfacc, 2), "m"],
          ["Hf total", fmt(pub.sis.Hftot, 2), "m"],
          ["P llegada", fmt(pub.sis.presion, 1), "m"],
          ["P mínima", fmt(pub.sis.pMin, 1), "m"],
        ]}
        adopt={`${pub.sis.Dtxt} · ${pub.sis.Vadop} m³ · ${pub.sis.nudos.length} nudos`}
      />
    );
  } else if (pub.kind === "sedimentador") {
    extra = <SedimentadorSvg B={pub.sed.B} H={pub.sed.H} L1={pub.sed.L1} L2={pub.sed.L2} LT={pub.sed.LT} H1={pub.sed.H1} />;
    ficha = (
      <Ficha
        code={pub.info.code}
        rows={[
          ["AS", fmt(pub.sed.AS, 2), "m²"],
          ["B", fmt(pub.sed.B, 2), "m"],
          ["L2", fmt(pub.sed.L2, 2), "m"],
          ["LT", fmt(pub.sed.LT, 2), "m"],
          ["VH", fmt(pub.sed.VH, 3), "cm/s"],
          ["To", fmt(pub.sed.To, 2), "h"],
          ["N orificios", `${pub.sed.N1} × ${pub.sed.N2}`, ""],
        ]}
        adopt={`${pub.sed.B.toFixed(2)} × ${pub.sed.LT.toFixed(2)} × ${pub.sed.H.toFixed(2)} m`}
      />
    );
  } else if (pub.kind === "prefiltro") {
    extra = <PrefiltroSvg B={pub.pf.B} H={pub.pf.H} L1={pub.pf.L1} L2={pub.pf.L2} L3={pub.pf.L3} Lt={pub.pf.Lt} />;
    ficha = (
      <Ficha
        code={pub.info.code}
        rows={[
          ["A filtración", fmt(pub.pf.A, 2), "m²"],
          ["B", fmt(pub.pf.B, 2), "m"],
          ["L1 3–4 cm", fmt(pub.pf.L1, 2), "m"],
          ["L2 2–3 cm", fmt(pub.pf.L2, 2), "m"],
          ["L3 1–2 cm", fmt(pub.pf.L3, 2), "m"],
          ["Lt", fmt(pub.pf.Lt, 2), "m"],
          ["N unidades", fmt(pub.pf.N, 0), ""],
        ]}
        adopt={`${pub.pf.N} unidades · B = ${fmt(pub.pf.B, 2)} m · Lt = ${fmt(pub.pf.Lt, 2)} m`}
      />
    );
  } else if (pub.kind === "filtro-lento") {
    extra = <FiltroLentoSvg A={pub.fl.A} B={pub.fl.B} hAgua={pub.fl.hAgua} hLecho={pub.fl.hLecho} hSop={pub.fl.hSop} hDren={pub.fl.hDren} BL={pub.fl.BL} Htot={pub.fl.Htot} />;
    ficha = (
      <Ficha
        code={pub.info.code}
        rows={[
          ["AS / unidad", fmt(pub.fl.AS, 2), "m²"],
          ["A (ancho)", fmt(pub.fl.A, 2), "m"],
          ["B (largo)", fmt(pub.fl.B, 2), "m"],
          ["Vf real", fmt(pub.fl.VR, 3), "m/h"],
          ["H total", fmt(pub.fl.Htot, 2), "m"],
          ["V arena 2 años", fmt(pub.fl.Vdep, 2), "m³"],
        ]}
        adopt={`${pub.fl.N} filtros ${fmt(pub.fl.A, 2)} × ${fmt(pub.fl.B, 2)} m`}
      />
    );
  } else if (pub.kind === "impulsion") {
    extra = <ImpulsionSvg HgImp={pub.imp.HgImp} Limp={pub.imp.Limp} DimpP={pub.imp.DimpP} Ht={pub.imp.Ht} HP={pub.imp.HP} />;
    ficha = (
      <Ficha
        code={pub.info.code}
        rows={[
          ["Q bombeo", fmt(pub.imp.Qb, 3), "L/s"],
          ["Vc cisterna", fmt(pub.imp.Vc, 1), "m³"],
          ["Ø succión", `${pub.imp.DsucP}"`, ""],
          ["Ø impulsión", `${pub.imp.DimpP}"`, ""],
          ["Ht", fmt(pub.imp.Ht, 2), "m"],
          ["Potencia", fmt(pub.imp.HP, 2), "HP"],
          ["V imp.", fmt(pub.imp.Vimp, 2), "m/s"],
        ]}
        adopt={`${fmt(pub.imp.HP, 2)} HP · Ø ${pub.imp.DimpP}" F°G°`}
      />
    );
  } else if (pub.kind === "reservorio") {
    extra = <ReservorioSvg b={pub.res.bi} L={pub.res.Li} hu={pub.res.hu} Hint={pub.res.Hint} Vadop={pub.res.Vadop} Dent={pub.res.Dent} Dsal={pub.res.Dsal} Dreb={pub.res.Dreb} />;
    ficha = (
      <Ficha
        code={pub.info.code}
        rows={[
          ["Qp", fmt(pub.res.Qp, 3), "L/s"],
          ["V", fmt(pub.res.Vadop, 0), "m³"],
          ["b × L", `${fmt(pub.res.bi, 2)} × ${fmt(pub.res.Li, 2)}`, "m"],
          ["hu", fmt(pub.res.hu, 2), "m"],
          ["Hint", fmt(pub.res.Hint, 2), "m"],
          ["b/h", fmt(pub.res.bh, 2), ""],
          ["Ø salida", `${pub.res.Dsal}"`, ""],
        ]}
        adopt={`${pub.res.Vadop} m³ · ${fmt(pub.res.bi, 2)} × ${fmt(pub.res.Li, 2)} × ${fmt(pub.res.Hint, 2)} m`}
      />
    );
  } else {
    extra = <CloradorSvg Vs={pub.clo.Vs} qs={pub.clo.qs} d={pub.clo.d} rAct={pub.clo.rAct} />;
    ficha = (
      <Ficha
        code={pub.info.code}
        rows={[
          ["Qmd", fmt(pub.clo.Qm3h, 2), "m³/h"],
          ["P cloro", fmt(pub.clo.P, 2), "g/h"],
          ["Pc comercial", fmt(pub.clo.Pc, 2), "g/h"],
          ["qs", fmt(pub.clo.qs, 2), "L/h"],
          ["Vs", fmt(pub.clo.Vs, 1), "L"],
          ["gotas", fmt(pub.clo.gotasS, 1), "got/s"],
        ]}
        adopt={`Recipiente ${pub.clo.recipiente} L · qs ${fmt(pub.clo.qs, 2)} L/h`}
      />
    );
  }

  return (
    <>
      <aside id="app-panel" className="panel">
        <h2>{info.title}</h2>
        <p className="lead">{info.norma}. Ejemplo desarrollado. Edite los datos y pulse Calcular para actualizar el informe.</p>
        <CalcDirtyNote dirty={dirty} />
        <fieldset className="fieldset">
          <legend>Identificación</legend>
          <Field label="Proyecto"><Text value={meta.proyecto} onChange={(v) => setMeta({ ...meta, proyecto: v })} /></Field>
          <Field label="Ubicación"><Text value={meta.ubicacion} onChange={(v) => setMeta({ ...meta, ubicacion: v })} /></Field>
          <Field label="Profesional"><Text value={meta.profesional} onChange={(v) => setMeta({ ...meta, profesional: v })} /></Field>
        </fieldset>
        {(kind === "dotacion" || kind === "sistema" || kind === "reservorio") && (
          <fieldset className="fieldset">
            <legend>Población y dotación</legend>
            {kind === "dotacion" && (
              <Field label="Modo">
                <select value={modo} onChange={(e) => setModo(e.target.value as "urbano" | "rural")}>
                  <option value="urbano">Urbano — lotes (RNE OS.100 / EPS)</option>
                  <option value="rural">Rural — crecimiento (RNE OS.100)</option>
                </select>
              </Field>
            )}
            {kind === "dotacion" && modo === "urbano" ? (
              <div className="grid-2">
                <Field label="Lotes ≤ 90 m²"><Num value={nLotesPeq} onChange={setNLotesPeq} step="1" /></Field>
                <Field label="Lotes > 90 m²"><Num value={nLotesGrand} onChange={setNLotesGrand} step="1" /></Field>
                <Field label="Hab/lote" unit="hab"><Num value={Dp} onChange={setDp} /></Field>
                <Field label="Dot. ≤ 90 m²" unit="L/hab·d"><Num value={dotPeq} onChange={setDotPeq} /></Field>
                <Field label="Dot. > 90 m²" unit="L/hab·d"><Num value={dotGrand} onChange={setDotGrand} /></Field>
                <Field label="Área verde" unit="m²"><Num value={Av} onChange={setAv} /></Field>
                <Field label="Educación / otros" unit="m²"><Num value={Ae} onChange={setAe} /></Field>
                <Field label="Dot. verde" unit="L/m²·d"><Num value={dotV} onChange={setDotV} /></Field>
                <Field label="Dot. educación" unit="L/m²·d"><Num value={dotE} onChange={setDotE} /></Field>
                <Field label="K1">
                  <OptNum value={K1} onChange={setK1} options={[{ value: 1.2, label: "1.20 — mínimo OS.100" }, { value: 1.3, label: "1.30 — habitual" }, { value: 1.4, label: "1.40" }, { value: 1.5, label: "1.50 — máximo OS.100" }]} />
                </Field>
                <Field label="K2">
                  <OptNum value={K2} onChange={setK2} options={[{ value: 1.8, label: "1.80 — mínimo OS.100" }, { value: 2.0, label: "2.00 — habitual" }, { value: 2.2, label: "2.20" }, { value: 2.5, label: "2.50 — máximo OS.100" }]} />
                </Field>
                <Field label="Retorno c">
                  <OptNum value={cRet} onChange={setCRet} options={[{ value: 0.7, label: "0.70" }, { value: 0.8, label: "0.80 — OS.090" }, { value: 0.85, label: "0.85" }, { value: 0.9, label: "0.90" }]} />
                </Field>
                <Field label="V incendio" unit="m³"><Num value={Vi} onChange={setVi} /></Field>
                <Field label="Fracción regulación">
                  <OptNum value={fracReg} onChange={setFracReg} options={[{ value: 0.15, label: "15 % — fuente muy continua" }, { value: 0.2, label: "20 %" }, { value: 0.25, label: "25 % — gravedad OS.030" }, { value: 0.3, label: "30 % — bombeo OS.030" }]} />
                </Field>
              </div>
            ) : (
              <div className="grid-2">
                <Field label="Población actual Po" unit="hab"><Num value={Po} onChange={setPo} step="1" /></Field>
                <Field label="Tasa r" unit="%"><Num value={rCrec} onChange={setRCrec} /></Field>
                <Field label="Periodo t" unit="años"><Num value={tAnos} onChange={setTAnos} step="1" /></Field>
                <Field label="Crecimiento">
                  <select value={crecimiento} onChange={(e) => setCrecimiento(e.target.value as Crecimiento)}>
                    <option value="aritmetico">Aritmético Pf = Po(1+rt)</option>
                    <option value="geometrico">Geométrico Pf = Po(1+r)^t</option>
                  </select>
                </Field>
                <Field label="Región">
                  <select value={region} onChange={(e) => setRegion(e.target.value as Region)}>
                    <option value="costa">Costa (60 / 90)</option>
                    <option value="sierra">Sierra (50 / 80)</option>
                    <option value="selva">Selva (70 / 100)</option>
                  </select>
                </Field>
                <Field label="Arrastre hidráulico">
                  <select value={arrastre ? "si" : "no"} onChange={(e) => setArrastre(e.target.value === "si")}>
                    <option value="si">Con arrastre (inodoro)</option>
                    <option value="no">Sin arrastre</option>
                  </select>
                </Field>
                {(kind === "dotacion" || kind === "sistema") && (
                  <>
                    <Field label="Pérdidas" unit="fracción">
                      <OptNum value={perdidas} onChange={setPerdidas} options={[{ value: 0.15, label: "0.15" }, { value: 0.2, label: "0.20" }, { value: 0.25, label: "0.25 — habitual" }, { value: 0.3, label: "0.30" }]} />
                    </Field>
                    <Field label="K1">
                      <OptNum value={K1} onChange={setK1} options={[{ value: 1.2, label: "1.20 — mínimo OS.100" }, { value: 1.3, label: "1.30 — habitual" }, { value: 1.4, label: "1.40" }, { value: 1.5, label: "1.50 — máximo OS.100" }]} />
                    </Field>
                    <Field label="K2">
                      <OptNum value={K2} onChange={setK2} options={[{ value: 1.8, label: "1.80 — mínimo OS.100" }, { value: 2.0, label: "2.00 — habitual" }, { value: 2.2, label: "2.20" }, { value: 2.5, label: "2.50 — máximo OS.100" }]} />
                    </Field>
                  </>
                )}
                {kind === "dotacion" && (
                  <>
                    <Field label="Alumnos primaria"><Num value={Ep} onChange={setEp} step="1" /></Field>
                    <Field label="Alumnos secundaria"><Num value={Es} onChange={setEs} step="1" /></Field>
                    <Field label="Retorno c">
                      <OptNum value={cRet} onChange={setCRet} options={[{ value: 0.7, label: "0.70" }, { value: 0.8, label: "0.80 — OS.090" }, { value: 0.85, label: "0.85" }, { value: 0.9, label: "0.90" }]} />
                    </Field>
                    <Field label="V incendio" unit="m³"><Num value={Vi} onChange={setVi} /></Field>
                  </>
                )}
                {kind === "reservorio" && (
                  <>
                    <Field label="Fracción regulación">
                      <OptNum value={fracReg} onChange={setFracReg} options={[{ value: 0.15, label: "15 % — fuente continua" }, { value: 0.2, label: "20 %" }, { value: 0.25, label: "25 % — gravedad OS.030" }, { value: 0.3, label: "30 % — bombeo OS.030" }]} />
                    </Field>
                    <Field label="Fracción reserva">
                      <OptNum value={fracRes} onChange={setFracRes} options={[{ value: 0, label: "0 % — sin reserva" }, { value: 0.1, label: "10 %" }, { value: 0.15, label: "15 %" }, { value: 0.25, label: "25 %" }]} />
                    </Field>
                  </>
                )}
              </div>
            )}
          </fieldset>
        )}
        {kind === "sistema" && (
          <>
            <fieldset className="fieldset">
              <legend>Captación y reservorio</legend>
              <p className="lead">Cotas y PK se editan en los nudos. No se piden coordenadas UTM.</p>
              <div className="grid-2">
                <Field label="Tipo de captación">
                  <select value={captacionTipo} onChange={(e) => setCaptacionTipo(e.target.value as CaptacionTipo)}>
                    {(Object.keys(CAPTACION_LABEL) as CaptacionTipo[]).map((id) => (
                      <option key={id} value={id}>{CAPTACION_LABEL[id]}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Q fuente (estiaje)" unit="L/s"><Num value={Qf} onChange={setQf} /></Field>
                <Field label="NAA captación" unit="msnm" note="Nivel de agua que inicia la línea piezométrica.">
                  <Num value={zCaptNAA} onChange={setZCaptNAA} />
                </Field>
                <Field label="Abastecimiento">
                  <select value={bombeo ? "bombeo" : "gravedad"} onChange={(e) => setBombeo(e.target.value === "bombeo")}>
                    <option value="gravedad">Gravedad (25 % Qmd)</option>
                    <option value="bombeo">Bombeo (30 % Qmd)</option>
                  </select>
                </Field>
                <Field label="H cilindro" unit="m"><Num value={Hcil} onChange={setHcil} /></Field>
                <Field label="Recubrimiento" unit="m" note="Cota de tubo = cota de terreno − recubrimiento.">
                  <OptNum value={recubrimiento} onChange={setRecubrimiento} options={[{ value: 0.8, label: "0.80 m — mínimo" }, { value: 1, label: "1.00 m — habitual" }, { value: 1.2, label: "1.20 m" }, { value: 1.5, label: "1.50 m" }]} />
                </Field>
                <Field label="Material por defecto" note="Se aplica a tramos nuevos. Cada tramo puede cambiarse.">
                  <select value={material} onChange={(e) => setMaterial(e.target.value as MaterialTubo)}>
                    {MATERIALES_TUBO.map((id) => (
                      <option key={id} value={id}>{MAT_LABEL[id]}</option>
                    ))}
                  </select>
                </Field>
              </div>
            </fieldset>
            <fieldset className="fieldset">
              <legend>Nudos y vértices del perfil</legend>
              <div className="sis-row-head">
                <p className="lead">PK y cota de terreno. El primer nudo es captación; el último, reservorio.</p>
                <button type="button" className="btn secondary sis-add" onClick={addNudo}>Añadir nudo</button>
              </div>
              {nudos
                .slice()
                .sort((a, b) => a.pk - b.pk)
                .map((n) => (
                  <div key={n.id} className={`topo-card${n.tipo === "captacion" || n.tipo === "reservorio" ? " is-est" : ""}`}>
                    <div className="topo-card-head">
                      <select value={n.tipo} onChange={(e) => patchNudo(n.id, { tipo: e.target.value as NudoTipo })}>
                        {NUDO_TIPOS.map((t) => (
                          <option key={t} value={t}>{NUDO_LABEL[t]}</option>
                        ))}
                      </select>
                      <button type="button" className="topo-x" onClick={() => removeNudo(n.id)} aria-label="Quitar nudo">×</button>
                    </div>
                    <div className="grid-3">
                      <Field label="Código"><input value={n.codigo} onChange={(e) => patchNudo(n.id, { codigo: e.target.value })} /></Field>
                      <Field label="PK" unit="m"><Num value={n.pk} onChange={(v) => patchNudo(n.id, { pk: v })} /></Field>
                      <Field label="Cota terreno" unit="msnm"><Num value={n.z} onChange={(v) => patchNudo(n.id, { z: v })} /></Field>
                    </div>
                  </div>
                ))}
            </fieldset>
            <fieldset className="fieldset">
              <legend>Tramos — Ø y fricción por longitud</legend>
              <p className="lead">Hf = Sf · L (Hazen–Williams). L = 0 usa ΔPK entre nudos. Ø = 0 elige comercial.</p>
              {tramos.map((t) => {
                const de = nudos.find((n) => n.id === t.de);
                const a = nudos.find((n) => n.id === t.a);
                return (
                  <div key={t.id} className="topo-card">
                    <div className="topo-card-head">
                      <strong>{de?.codigo ?? "—"} → {a?.codigo ?? "—"}</strong>
                    </div>
                    <div className="grid-3">
                      <Field label="L" unit="m" note="0 = ΔPK">
                        <Num value={t.L} onChange={(v) => patchTramo(t.id, { L: v })} />
                      </Field>
                      <Field label="Ø" unit="pulg">
                        <OptNum
                          value={t.Dpulg}
                          onChange={(v) => patchTramo(t.id, { Dpulg: v })}
                          options={[{ value: 0, label: "Comercial auto" }, ...PULG_COMERCIAL.map((p) => ({ value: p, label: `Ø ${p}"` }))]}
                        />
                      </Field>
                      <Field label="Material">
                        <select value={t.material} onChange={(e) => patchTramo(t.id, { material: e.target.value as MaterialTubo })}>
                          {MATERIALES_TUBO.map((id) => (
                            <option key={id} value={id}>{MAT_LABEL[id]}</option>
                          ))}
                        </select>
                      </Field>
                    </div>
                  </div>
                );
              })}
            </fieldset>
            <fieldset className="fieldset">
              <legend>Accesorios — pérdidas locales</legend>
              <div className="sis-row-head">
                <p className="lead">Hf,loc = n · K · V² / 2g. K = 0 toma el catálogo (Crane / práctica MVCS).</p>
                <button type="button" className="btn secondary sis-add" onClick={addAcc}>Añadir accesorio</button>
              </div>
              {accesorios.map((ac) => (
                <div key={ac.id} className="topo-card">
                  <div className="topo-card-head">
                    <select value={ac.tipo} onChange={(e) => patchAcc(ac.id, { tipo: e.target.value as AccesorioTipo })}>
                      {ACCESORIO_TIPOS.map((t) => (
                        <option key={t} value={t}>{ACCESORIO_CATALOG[t].label} · K {ACCESORIO_CATALOG[t].k}</option>
                      ))}
                    </select>
                    <button type="button" className="topo-x" onClick={() => setAccesorios((p) => p.filter((x) => x.id !== ac.id))} aria-label="Quitar accesorio">×</button>
                  </div>
                  <div className="grid-3">
                    <Field label="Nudo">
                      <select value={ac.nudoId} onChange={(e) => patchAcc(ac.id, { nudoId: e.target.value })}>
                        {nudos.map((n) => (
                          <option key={n.id} value={n.id}>{n.codigo} · {NUDO_LABEL[n.tipo]}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Cantidad n"><Num value={ac.n} onChange={(v) => patchAcc(ac.id, { n: v })} step="1" /></Field>
                    <Field label="K unitario" note="0 = catálogo"><Num value={ac.K} onChange={(v) => patchAcc(ac.id, { K: v })} /></Field>
                  </div>
                </div>
              ))}
            </fieldset>
          </>
        )}
        {kind === "sedimentador" && (
          <fieldset className="fieldset">
            <legend>Sedimentador</legend>
            <div className="grid-2">
              <Field label="Qmd" unit="L/s"><Num value={QmdLs} onChange={setQmdLs} /></Field>
              <Field label="VS Stokes" unit="m/s"><Num value={VS} onChange={setVS} /></Field>
              <Field label="B ancho" unit="m"><Num value={Bsed} onChange={setBsed} /></Field>
              <Field label="Ancho">
                <select value={autoB ? "auto" : "fijo"} onChange={(e) => setAutoB(e.target.value === "auto")}>
                  <option value="auto">Ajustar B (L2/B ≈ 4)</option>
                  <option value="fijo">Usar B propuesto</option>
                </select>
              </Field>
              <Field label="L1 entrada" unit="m"><Num value={L1sed} onChange={setL1sed} /></Field>
              <Field label="H" unit="m"><Num value={Hsed} onChange={setHsed} /></Field>
              <Field label="S fondo"><Num value={Sfondo} onChange={setSfondo} /></Field>
              <Field label="Vo orificio" unit="m/s"><Num value={Vo} onChange={setVo} /></Field>
              <Field label="Ø orificio" unit="m"><Num value={Dorif} onChange={setDorif} /></Field>
              <Field label="A2 limpieza" unit="m²"><Num value={A2} onChange={setA2} /></Field>
            </div>
          </fieldset>
        )}
        {kind === "prefiltro" && (
          <fieldset className="fieldset">
            <legend>Prefiltro de grava</legend>
            <div className="grid-2">
              <Field label="Qmd" unit="L/s"><Num value={QmdLs} onChange={setQmdLs} /></Field>
              <Field label="N unidades">
                <OptNum value={Npf} onChange={setNpf} options={[{ value: 2, label: "2 — mínimo OS.020" }, { value: 3, label: "3" }, { value: 4, label: "4" }]} />
              </Field>
              <Field label="Vf" unit="m/h">
                <OptNum value={Vfpf} onChange={setVfpf} options={[{ value: 0.1, label: "0.10" }, { value: 0.2, label: "0.20" }, { value: 0.4, label: "0.40 — habitual" }, { value: 0.6, label: "0.60 — máximo" }]} />
              </Field>
              <Field label="H grava" unit="m"><Num value={Hpf} onChange={setHpf} /></Field>
              <Field label="Turbiedad co" unit="UNT"><Num value={co} onChange={setCo} /></Field>
              <Field label="Salida tramo 1" unit="UNT"><Num value={c1} onChange={setC1} /></Field>
              <Field label="Salida tramo 2" unit="UNT"><Num value={c2} onChange={setC2} /></Field>
              <Field label="Efluente cl" unit="UNT"><Num value={c3} onChange={setC3} /></Field>
            </div>
          </fieldset>
        )}
        {kind === "filtro-lento" && (
          <fieldset className="fieldset">
            <legend>Filtro lento</legend>
            <div className="grid-2">
              <Field label="Qmd" unit="L/s"><Num value={QmdLs} onChange={setQmdLs} /></Field>
              <Field label="N unidades">
                <OptNum value={Nfl} onChange={setNfl} options={[{ value: 2, label: "2 — mínimo OS.020" }, { value: 3, label: "3" }, { value: 4, label: "4" }]} />
              </Field>
              <Field label="Vf" unit="m/h">
                <OptNum value={Vffl} onChange={setVffl} options={[{ value: 0.1, label: "0.10 — mínimo OS.020" }, { value: 0.15, label: "0.15" }, { value: 0.2, label: "0.20 — habitual" }, { value: 0.25, label: "0.25" }, { value: 0.3, label: "0.30 — máximo OS.020" }]} />
              </Field>
              <Field label="E raspado" unit="m"><Num value={Erasp} onChange={setErasp} /></Field>
              <Field label="Raspados/año"><Num value={nRasp} onChange={setNRasp} step="1" /></Field>
              <Field label="B forzado" unit="m"><Num value={Buse} onChange={setBuse} /></Field>
              <Field label="A forzado" unit="m"><Num value={Ause} onChange={setAuse} /></Field>
              <Field label="Capa de agua" unit="m">
                <OptNum value={hAgua} onChange={setHAgua} options={[{ value: 1, label: "1.00 m — mínimo OS.020" }, { value: 1.2, label: "1.20 m — habitual" }, { value: 1.5, label: "1.50 m — máximo" }]} />
              </Field>
              <Field label="Lecho arena" unit="m">
                <OptNum value={hLecho} onChange={setHLecho} options={[{ value: 0.8, label: "0.80 m — mínimo OS.020" }, { value: 0.9, label: "0.90 m — habitual" }, { value: 1, label: "1.00 m — máximo" }]} />
              </Field>
              <Field label="Soporte" unit="m">
                <OptNum value={hSop} onChange={setHSop} options={[{ value: 0.1, label: "0.10 m" }, { value: 0.2, label: "0.20 m — habitual" }, { value: 0.3, label: "0.30 m" }]} />
              </Field>
              <Field label="Drenes" unit="m">
                <OptNum value={hDren} onChange={setHDren} options={[{ value: 0.1, label: "0.10 m" }, { value: 0.15, label: "0.15 m — habitual" }, { value: 0.25, label: "0.25 m" }]} />
              </Field>
              <Field label="Borde libre" unit="m">
                <OptNum value={BLfl} onChange={setBLfl} options={[{ value: 0.2, label: "0.20 m" }, { value: 0.25, label: "0.25 m — habitual" }, { value: 0.3, label: "0.30 m" }]} />
              </Field>
            </div>
            <p className="lead">A o B = 0 adopta la sección de mínimo costo K = 2N/(N+1).</p>
          </fieldset>
        )}
        {kind === "impulsion" && (
          <fieldset className="fieldset">
            <legend>Bombeo e impulsión</legend>
            <div className="grid-2">
              <Field label="Qmd" unit="L/s"><Num value={QmdLs} onChange={setQmdLs} /></Field>
              <Field label="Horas bombeo" unit="h">
                <OptNum value={hb} onChange={setHb} options={[8, 10, 12, 14, 16, 18, 20].map((h) => ({ value: h, label: `${h} h` }))} />
              </Field>
              <Field label="Hg succión" unit="m"><Num value={HgSuc} onChange={setHgSuc} /></Field>
              <Field label="L succión" unit="m"><Num value={Lsuc} onChange={setLsuc} /></Field>
              <Field label="Ø succión" unit="pulg">
                <OptNum value={DsucPulg} onChange={setDsucPulg} options={PULG_COMERCIAL.map((p) => ({ value: p, label: `Ø ${p}"` }))} />
              </Field>
              <Field label="Hg impulsión" unit="m"><Num value={HgImp} onChange={setHgImp} /></Field>
              <Field label="L impulsión" unit="m"><Num value={Limp} onChange={setLimp} /></Field>
              <Field label="Ø impulsión" unit="pulg">
                <OptNum value={DimpPulg} onChange={setDimpPulg} options={PULG_COMERCIAL.map((p) => ({ value: p, label: `Ø ${p}"` }))} />
              </Field>
              <Field label="Material (C Hazen–Williams)" note="C según material de tubería nueva. Valores habituales de diseño.">
                <select value={matImp} onChange={(e) => setMatImp(e.target.value as MaterialTubo)} title={MAT_LABEL[matImp]}>
                  {MATERIALES_TUBO.map((id) => (
                    <option key={id} value={id}>{MAT_LABEL[id]}</option>
                  ))}
                </select>
              </Field>
              <Field label="η bomba">
                <OptNum value={eta} onChange={setEta} options={[{ value: 0.55, label: "0.55" }, { value: 0.6, label: "0.60 — habitual" }, { value: 0.65, label: "0.65" }, { value: 0.7, label: "0.70" }, { value: 0.75, label: "0.75" }, { value: 0.8, label: "0.80" }]} />
              </Field>
              <Field label="Ps residual" unit="m">
                <OptNum value={Ps} onChange={setPs} options={[{ value: 2, label: "2 m — mínimo IS.010" }, { value: 5, label: "5 m" }, { value: 10, label: "10 m — red OS.100" }]} />
              </Field>
              <Field label="ΣK succión"><Num value={Ksuc} onChange={setKsuc} /></Field>
              <Field label="ΣK impulsión"><Num value={Kimp} onChange={setKimp} /></Field>
            </div>
          </fieldset>
        )}
        {kind === "reservorio" && (
          <fieldset className="fieldset">
            <legend>Geometría del tanque</legend>
            <div className="grid-2">
              <Field label="Ancho interno b" unit="m"><Num value={bRes} onChange={setBRes} /></Field>
              <Field label="Largo interno L" unit="m"><Num value={Lres} onChange={setLRes} /></Field>
              <Field label="Fondo a salida hs" unit="m"><Num value={hs} onChange={setHs} /></Field>
              <Field label="Techo a ingreso" unit="m"><Num value={hing} onChange={setHing} /></Field>
              <Field label="Rebose–ingreso" unit="m"><Num value={hreb} onChange={setHreb} /></Field>
              <Field label="Rebose–N.A." unit="m"><Num value={hrebAgua} onChange={setHrebAgua} /></Field>
            </div>
          </fieldset>
        )}
        {kind === "cloracion" && (
          <fieldset className="fieldset">
            <legend>Cloración</legend>
            <div className="grid-2">
              <Field label="Qmd" unit="L/s"><Num value={QmdLs} onChange={setQmdLs} /></Field>
              <Field label="Dosis d" unit="mg/L">
                <OptNum value={dosis} onChange={setDosis} options={[{ value: 0.5, label: "0.5 — residual mínimo" }, { value: 1, label: "1.0 — habitual" }, { value: 1.5, label: "1.5" }, { value: 2, label: "2.0" }]} />
              </Field>
              <Field label="Cloro activo r" unit="%">
                <OptNum value={rAct} onChange={setRAct} options={[{ value: 12, label: "12 % — hipoclorito de sodio" }, { value: 65, label: "65 % — hipoclorito de calcio" }, { value: 70, label: "70 % — hipoclorito de calcio" }]} />
              </Field>
              <Field label="Concentración c" unit="%">
                <OptNum value={cSol} onChange={setCSol} options={[{ value: 0.25, label: "0.25 % — habitual" }, { value: 0.5, label: "0.50 %" }, { value: 1, label: "1.00 %" }]} />
              </Field>
              <Field label="Ciclo t" unit="h">
                <OptNum value={tCiclo} onChange={setTCiclo} options={[{ value: 6, label: "6 h" }, { value: 8, label: "8 h" }, { value: 12, label: "12 h" }]} />
              </Field>
              <Field label="Cd orificio">
                <OptNum value={Cd} onChange={setCd} options={[{ value: 0.6, label: "0.60" }, { value: 0.62, label: "0.62 — habitual" }, { value: 0.65, label: "0.65" }]} />
              </Field>
              <Field label="Ø orificio" unit="mm"><Num value={DorifMm} onChange={setDorifMm} /></Field>
              <Field label="Carga h" unit="m"><Num value={hGoteo} onChange={setHGoteo} /></Field>
            </div>
          </fieldset>
        )}
        <div className="actions">
          <CalcularButton onClick={calcular} dirty={dirty} />
          <button className="btn" disabled={!memoria} onClick={() => memoria && exportarWord(memoria)}>Exportar Word</button>
          <button className="btn secondary" disabled={!memoria} onClick={() => memoria && printMemoria(memoria.titulo)}>Imprimir / PDF</button>
        </div>
      </aside>
      {memoria ? <Paper
        doc={memoria}
        extra={
          <div className="croquis-board croquis-board-compact">
            <div className="croquis">{extra}</div>
            {ficha}
          </div>
        }
      /> : <MemoriaPendiente />}
    </>
  );
}

type Cover = { kicker: string; titulo: string; subtitulo: string; meta: { k: string; v: string }[] };

function docDotacion(cover: Cover, info: { code: string; norma: string }, modo: string, region: Region, arrastre: boolean, crecimiento: Crecimiento, r: number, t: number, Dp: number, nPeq: number, nGrand: number, dPeq: number, dGrand: number, Av: number, Ae: number, Po: number, d: ReturnType<typeof calcularDotacion>): MemoriaDoc {
  const tabla = DOTACION_RURAL[region];
  return {
    codigo: info.code,
    titulo: "Dotación, caudales y almacenamiento",
    norma: info.norma,
    blocks: [
      { type: "cover", ...cover },
      { type: "h2", text: "1. Objeto" },
      { type: "p", text: "Se determina la población de diseño, la dotación, los caudales medio, máximo diario y máximo horario, el volumen de almacenamiento y la contribución al alcantarillado, conforme al RNE OS.100. No es un simple producto Pf × d." },
      { type: "h2", text: "2. Población de diseño" },
      modo === "urbano"
        ? { type: "eq", text: "Pf = Dp · Nlotes     (lotes ≤ 90 m² y lotes > 90 m²)", num: "1" }
        : { type: "eq", text: crecimiento === "geometrico" ? "Pf = Po · (1 + r)^t" : "Pf = Po · (1 + r t)     (crecimiento aritmético)", num: "1" },
      paso("01", "Población futura", modo === "urbano" ? "Pf = Dp · (N≤90 + N>90)" : "Pf = Po (1 + r t)", modo === "urbano" ? `${fmt(Dp, 1)} × (${fmt(nPeq, 0)} + ${fmt(nGrand, 0)})` : `${fmt(Po, 0)} · (1 + ${fmt(r / 100, 4)} × ${fmt(t, 0)})`, `${fmt(d.Pf, 0)} hab`),
      { type: "h2", text: "3. Caudales de agua potable" },
      { type: "eq", text: "Qp = Σ (P · d) / 86 400     (L/s)     ·     Qmd = K1 Qp     ·     Qmh = K2 Qp", num: "2" },
      modo === "urbano"
        ? paso("02", "Demanda de viviendas", "Qm = Pf · d / 86 400", `≤90 m²: ${fmt(d.PfPeq, 0)} × ${fmt(dPeq, 0)} / 86 400 = ${fmt(d.QvivPeq, 3)} L/s;  >90 m²: ${fmt(d.PfGrand, 0)} × ${fmt(dGrand, 0)} / 86 400 = ${fmt(d.QvivGrand, 3)} L/s`, `${fmt(d.QvivPeq + d.QvivGrand, 3)} L/s`)
        : paso("02", "Demanda doméstica y educacional", "Qp = (Pf d + Ep Dep + Es Des) / 86 400 / (1 − p)", `d = ${fmt(d.dotHab ?? 80, 0)} L/hab·d (${region}, ${arrastre ? "con" : "sin"} arrastre). Dotación rural OS.100 / Guía MVCS: costa ${tabla.sin}/${tabla.con}, sierra 50/80, selva 70/100.`, `${fmt(d.Qp, 3)} L/s`),
      paso("03", "Áreas verdes y educación (si aplica)", "Qv = Av · dv / 86 400", `Av = ${fmt(Av, 1)} m² · dv típica 2 L/m²·d;  Ae = ${fmt(Ae, 1)} m² · 6 L/m²·d`, `Qv = ${fmt(d.Qv, 4)} L/s   ·   Qe = ${fmt(d.Qe, 4)} L/s`),
      paso("04", "Caudales característicos", "Qmd = K1 Qp    Qmh = K2 Qp", `K1 = ${fmt(d.K1, 2)} (máx. diario OS.100) · K2 = ${fmt(d.K2, 2)} (máx. horario, 1.8 a 2.5)`, `Qp = ${fmt(d.Qp, 3)} L/s   ·   Qmd = ${fmt(d.Qmd, 3)} L/s   ·   Qmh = ${fmt(d.Qmh, 3)} L/s`),
      { type: "h2", text: "4. Volumen de almacenamiento" },
      { type: "eq", text: "Vreg = Qp · 86.4 · f     ·     Vr = Vreg / 3     ·     Vt = Vreg + Vi + Vr", num: "3" },
      paso("05", "Regulación, incendio y reserva", "Vt = 0.25 Qp · 86.4 + Vi + Vreg/3", `f = ${fmt(d.fracReg, 2)} (fuente continua, RNE OS.100 / OS.030). Vi = ${fmt(d.Vi, 0)} m³.`, `Vreg = ${fmt(d.Vreg, 1)} m³  ·  Vr = ${fmt(d.Vr, 1)} m³  ·  Vt = ${fmt(d.Vt, 1)} m³  →  se adopta ${d.Vadop} m³`),
      { type: "h2", text: "5. Alcantarillado" },
      paso("06", "Contribución al desagüe", "Qal = c · Qp     ·     Qal,mh = c · Qmh", `c = ${fmt(d.cRet, 2)} (retorno 80 % típico OS.090)`, `Qal = ${fmt(d.Qal, 3)} L/s   ·   Qal,mh = ${fmt(d.QalMh, 3)} L/s`),
      { type: "h2", text: "6. Verificaciones" },
      { type: "check", ok: d.Pf > 0, text: `Población de diseño Pf = ${fmt(d.Pf, 0)} habitantes.` },
      { type: "check", ok: d.K1 >= 1.2 && d.K1 <= 1.5, text: `K1 = ${fmt(d.K1, 2)} dentro de 1.2–1.5 (OS.100).` },
      { type: "check", ok: d.K2 >= 1.8 && d.K2 <= 2.5, text: `K2 = ${fmt(d.K2, 2)} dentro de 1.8–2.5 (OS.100).` },
      { type: "check", ok: d.Vadop >= d.Vt - 0.5, text: `Volumen adoptado ${d.Vadop} m³ ≥ Vt = ${fmt(d.Vt, 1)} m³.` },
      { type: "note", text: "Contrastar la densidad y la dotación con la EPS local y con el RNE OS.100. El volumen contra incendio de 50 m³ es criterio urbano; en ámbito rural suele omitirse." },
    ],
  };
}

function docSistema(cover: Cover, info: { code: string; norma: string }, s: ReturnType<typeof calcularSistema>, mat: MaterialTubo): MemoriaDoc {
  return {
    codigo: info.code,
    titulo: "Sistema abierto de agua potable — captación, conducción por tramos y reservorio",
    norma: info.norma,
    blocks: [
      { type: "cover", ...cover },
      { type: "h2", text: "1. Objeto y alcance" },
      { type: "p", text: `Se dimensiona un sistema rural abierto a gravedad: ${CAPTACION_LABEL[s.captacionTipo]} → línea de conducción por nudos y tramos → reservorio apoyado, conforme al RNE OS.100 (dotación y caudales), OS.030 (almacenamiento) y OS.010 (tubería). Cada tramo se resuelve con Hazen–Williams (pérdida por longitud). Cada accesorio (reja, válvula, codo, ventosa, purga, ingreso) aporta pérdida local Hf = n K V²/2g. No se usan coordenadas UTM: el eje se define por PK y cota de terreno.` },
      { type: "list", items: [
        "Caudales: Pf, Qp, Qmd (fuente, conducción y tanque) y Qmh (red, otro módulo).",
        "Perfil: nudos con tipo, PK y cota; tramos con L, material y Ø; accesorios con K en el nudo que los hospeda.",
        "Hidráulica: HGL desde el NAA de captación, descontando Hf de tramo y Hf local de cada nudo; presión = HGL − cota de tubo.",
      ] },
      { type: "h2", text: "2. Población de diseño" },
      { type: "eq", text: "Pf = Po (1 + r t)     (aritmético)     ·     Pf = Po (1 + r)^t     (geométrico)", num: "1" },
      paso(
        "01",
        "Población futura",
        "Pf = Po (1 + r t)",
        `Po = ${fmt(s.Po, 0)} hab · r = ${fmt(s.r, 2)} % = ${fmt(s.r / 100, 4)} · t = ${fmt(s.t, 0)} años`,
        `${fmt(s.Pf, 1)} hab  →  se adopta ${fmt(s.Pf, 0)} hab`,
        "Periodo rural habitual: 20 años (OS.100 / guía MVCS). Contrastar r con el INEI del distrito."
      ),
      { type: "table", caption: "Cuadro 1 · Población", variant: "valores", headers: ["Parámetro", "Símbolo", "Valor", "Unidad"], rows: [
        ["Población actual", "Po", fmt(s.Po, 0), "hab"],
        ["Tasa de crecimiento", "r", fmt(s.r, 2), "% anual"],
        ["Periodo de diseño", "t", fmt(s.t, 0), "años"],
        ["Población futura", "Pf", fmt(s.Pf, 0), "hab"],
      ] },
      { type: "h2", text: "3. Dotación y caudales (OS.100)" },
      { type: "eq", text: "Qneto = Pf · d / 86 400     ·     Qp = Qneto / (1 − p)     ·     Qmd = K1 Qp     ·     Qmh = K2 Qp", num: "2" },
      paso(
        "02",
        "Dotación y caudal medio",
        "Qp = (Pf · d / 86 400) / (1 − p)",
        `d = ${fmt(s.dot, 0)} L/hab·d · p = ${fmt(s.perd * 100, 0)} % · Pf = ${fmt(s.Pf, 0)} hab`,
        `Qneto = ${fmt(s.Qneto, 3)} L/s   ·   Qp = ${fmt(s.Qp, 3)} L/s`,
        "Dotación rural: sierra 50/80, costa 60/90, selva 70/100 L/hab·d (sin/con arrastre). No usar 220 L/hab·d urbano."
      ),
      paso(
        "03",
        "Caudales característicos",
        "Qmd = K1 Qp     ·     Qmh = K2 Qp     ·     Qdía = Qmd · 86.4",
        `K1 = ${fmt(s.K1, 2)} (1.20–1.50) · K2 = ${fmt(s.K2, 2)} (1.80–2.50). Qmh no es 2 Qmd.`,
        `Qmd = ${fmt(s.Qmd, 3)} L/s   ·   Qmh = ${fmt(s.Qmh, 3)} L/s   ·   Qdía = ${fmt(s.Qdia, 2)} m³/d`
      ),
      { type: "table", caption: "Cuadro 2 · Caudales de diseño", variant: "valores", headers: ["Caudal", "Fórmula", "Valor", "Uso"], rows: [
        ["Medio diario Qp", "Pf d / 86 400 / (1−p)", `${fmt(s.Qp, 3)} L/s`, "Operación"],
        ["Máximo diario Qmd", "K1 Qp", `${fmt(s.Qmd, 3)} L/s`, "Fuente, conducción, reservorio"],
        ["Máximo horario Qmh", "K2 Qp", `${fmt(s.Qmh, 3)} L/s`, "Red de distribución (AP-09)"],
        ["Volumen diario", "Qmd · 86.4", `${fmt(s.Qdia, 2)} m³/d`, "Balance fuente / tanque"],
      ] },
      { type: "h2", text: "4. Captación y aforo" },
      paso(
        "04",
        "Tipo de captación y aforo de estiaje",
        "Qf ≥ Qmd",
        `${CAPTACION_LABEL[s.captacionTipo]} · NAA = ${fmt(s.zCaptNAA, 2)} msnm · Qf = ${fmt(s.Qf, 3)} L/s · Qmd = ${fmt(s.Qmd, 3)} L/s`,
        s.okFuente ? `Holgura ${fmt(s.Qf - s.Qmd, 3)} L/s. La fuente cubre el máximo diario.` : `Déficit ${fmt(s.Qmd - s.Qf, 3)} L/s. Ampliar captación o complementar fuente.`,
        "El aforo que gobierna es el de estiaje (tres aforos en época seca). La línea piezométrica arranca en el NAA de la cámara, no en la cota de terreno."
      ),
      { type: "h2", text: "5. Reservorio de regulación (OS.030)" },
      { type: "eq", text: s.bombeo ? "Vreg = 0.30 · Qmd · 86.4     (bombeo)" : "Vreg = 0.25 · Qmd · 86.4     (gravedad, fuente continua)", num: "3" },
      paso(
        "05",
        "Volumen de regulación",
        s.bombeo ? "V = 0.30 Qmd · 86.4" : "V = 0.25 Qmd · 86.4",
        `Qmd = ${fmt(s.Qmd, 3)} L/s · f = ${fmt(s.frac, 2)}`,
        `Vcálc = ${fmt(s.Vcalc, 2)} m³  →  se adopta ${s.Vadop} m³ (serie típica MVCS)`
      ),
      paso(
        "06",
        "Geometría cilíndrica apoyada",
        "D = 2 √(V / (π H))     ·     A = V / H",
        `V = ${s.Vadop} m³ · H = ${fmt(s.Hcil, 2)} m · fondo = ${fmt(s.zFondo, 2)} msnm`,
        `Dint = ${fmt(s.Dcil, 2)} m  ·  A = ${fmt(s.Aplanta, 2)} m²  ·  perímetro = ${fmt(s.perimetro, 2)} m`
      ),
      { type: "table", caption: "Cuadro 3 · Reservorio — cotas de corte", variant: "valores", headers: ["Elemento", "Valor", "Criterio"], rows: [
        ["Fondo interno / radier", `${fmt(s.zFondo, 2)} msnm`, "Último nudo del perfil"],
        ["Nivel mínimo (salida)", `${fmt(s.zMin, 2)} msnm`, "Fondo + 0.15 m"],
        ["NAA de diseño", `${fmt(s.zNAA, 2)} msnm`, `Fondo + H = ${fmt(s.Hcil, 2)} m`],
        ["Rebose", `${fmt(s.zReb, 2)} msnm`, "NAA + 0.10 m"],
        ["Intrados de techo (ref.)", `${fmt(s.zTecho, 2)} msnm`, "Rebose + 0.20 m"],
        ["Diámetro interno", `${fmt(s.Dcil, 2)} m`, "Cilindro del volumen adoptado"],
        ["Ø ingreso / salida red", `${s.Dtxt} / ${s.DsalPulg}"`, "Ingreso = conducción; salida con Qmh"],
      ] },
      { type: "h2", text: "6. Nudos, vértices y tramos" },
      { type: "eq", text: "L_i = |PK_{i+1} − PK_i|     ·     S_i = (z_i − z_{i+1}) / L_i     ·     D = [Q / (0.2785 C S^{0.54})]^{1/2.63}", num: "4" },
      { type: "eq", text: "Hf,i = Sf,i · L_i     ·     Hf,loc = Σ n K V² / 2g     ·     HGL_{i+1} = HGL_i − Hf,i − Hf,loc,i+1", num: "5" },
      paso(
        "07",
        "Eje de conducción",
        "Σ L y desnivel global",
        `${s.nudos.length} nudos · ${s.tramos.length} tramos · PK ${fmt(s.nudos[0]?.pk ?? 0, 1)} a ${fmt(s.L, 1)} m`,
        `L = ${fmt(s.L, 1)} m   ·   Δz = ${fmt(s.dh, 2)} m   ·   S global = ${fmt(s.S * 1000, 2)} ‰`
      ),
      { type: "table", caption: "Cuadro 4 · Nudos del perfil (PK y cota de terreno; sin UTM)", variant: "wide", headers: ["Nudo", "Tipo", "PK (m)", "Cota terreno (msnm)", "Cota tubo (msnm)", "ΣK en el nudo"], rows: s.perfil.map((p) => [
        p.codigo,
        NUDO_LABEL[p.tipo],
        fmt(p.pk, 1),
        fmt(p.zTerreno, 2),
        fmt(p.zTubo, 2),
        fmt(p.Kloc, 2),
      ]) },
      paso(
        "08",
        "Diámetro por tramo",
        "Ø comercial ≥ Dcálc (Hazen–Williams con S geométrica del tramo)",
        `Q = Qmd = ${fmt(s.Qmd, 3)} L/s. Material por defecto ${MAT_LABEL[mat]}.`,
        `Ø adoptados: ${s.Dtxt}`
      ),
      { type: "table", caption: "Cuadro 5 · Tramos — pérdida por longitud (Hazen–Williams)", variant: "wide", headers: ["Tramo", "De → A", "L (m)", "Ø (pulg)", "C", "V (m/s)", "Sf (m/m)", "Hf (m)"], rows: s.tramos.map((t) => [
        t.codigo,
        `${t.deCod} → ${t.aCod}`,
        fmt(t.L, 1),
        `${t.Dpulg}`,
        fmt(t.C, 0),
        fmt(t.V, 2),
        fmtFixed(t.Sf, 5),
        fmt(t.Hf, 3),
      ]) },
      paso(
        "09",
        "Pérdidas locales en captación, válvulas y accesorios",
        "Hf,loc = n K V² / 2g     ·     Leq = Hf,loc / Sf",
        `ΣK = ${fmt(s.Kacc, 2)} · V de referencia (primer tramo) = ${fmt(s.V, 2)} m/s · V²/2g = ${fmt(s.hVel, 3)} m`,
        `Σ Hf local = ${fmt(s.Hfacc, 3)} m   ·   Σ Hf fricción = ${fmt(s.Hf, 3)} m   ·   Hf tot = ${fmt(s.Hftot, 3)} m`
      ),
      { type: "table", caption: "Cuadro 6 · Accesorios — pérdida local y longitud equivalente", variant: "wide", headers: ["Nudo", "Accesorio", "n", "K", "n·K", "V (m/s)", "Hf (m)", "Leq (m)"], rows: s.accesorios.map((a) => [
        a.nudoCod,
        a.label,
        fmt(a.n, 0),
        fmt(a.Kunit, 2),
        fmt(a.Ktot, 2),
        fmt(a.V, 2),
        fmt(a.Hf, 3),
        fmt(a.Leq, 1),
      ]) },
      paso(
        "10",
        "Línea piezométrica y presión de llegada",
        "HGL_0 = NAA_cap − Hf,loc,cap     ·     P = HGL − (z − recubrimiento)",
        `NAA captación = ${fmt(s.zCaptNAA, 2)} msnm · recubrimiento = ${fmt(s.recubrimiento, 2)} m`,
        `HGL llegada = ${fmt(s.Hpiez, 2)} msnm · P llegada = ${fmt(s.presion, 2)} m · P mín. = ${fmt(s.pMin, 2)} m · P máx. = ${fmt(s.pMax, 2)} m`
      ),
      { type: "table", caption: "Cuadro 7 · Perfil hidráulico en cada nudo", variant: "wide", headers: ["Nudo", "PK (m)", "Terreno", "Tubo", "HGL", "P (m)", "Hf loc (m)"], rows: s.perfil.map((p) => [
        p.codigo,
        fmt(p.pk, 1),
        fmt(p.zTerreno, 2),
        fmt(p.zTubo, 2),
        fmt(p.hgl, 2),
        fmt(p.presion, 2),
        fmt(p.Hfacc, 3),
      ]) },
      { type: "h2", text: "7. Verificaciones" },
      { type: "check", ok: s.okFuente, text: `Fuente Qf = ${fmt(s.Qf, 3)} L/s ${s.okFuente ? "≥" : "<"} Qmd = ${fmt(s.Qmd, 3)} L/s.` },
      { type: "check", ok: s.okS, text: `Desnivel positivo Δz = ${fmt(s.dh, 2)} m en L = ${fmt(s.L, 1)} m.` },
      { type: "check", ok: s.okV, text: `Velocidad en todos los tramos dentro de 0.60–3.0 m/s (OS.010).` },
      { type: "check", ok: s.okHgl, text: `HGL por encima de la cota de tubo en todos los nudos (no hay sifón no previsto).` },
      { type: "check", ok: s.okP, text: `Presión de llegada ${fmt(s.presion, 1)} m y P mín. ${fmt(s.pMin, 1)} m (objetivo 5–50 m; si P > 50 m, cámara rompe-carga).` },
      { type: "check", ok: s.okK2, text: `K2 = ${fmt(s.K2, 2)} dentro de 1.80–2.50 (OS.100).` },
      { type: "check", ok: s.Vadop + 1e-9 >= s.Vcalc, text: `Volumen adoptado ${s.Vadop} m³ ≥ Vcálc = ${fmt(s.Vcalc, 2)} m³.` },
      { type: "h2", text: "8. Qué cubre este cálculo para el plano" },
      { type: "p", text: "Con nudos, Ø por tramo y accesorios se dibuja el perfil hidráulico, el inventario de válvulas/ventosas/purgas y el corte del reservorio. Sigue fuera de alcance:" },
      { type: "list", items: [
        "Planta georreferenciada (UTM): no se pide; el eje queda en PK + cota.",
        "Red de distribución mallada o ramificada con demanda por nudo (módulo AP-09, caudal Qmh).",
        "Diseño estructural de la captación, desarenador, cámara de válvulas y tanque (AP-03 a AP-08, AP-07).",
        "Clase de tubería: si P máx. ≤ 50 m basta PN-10; si algún nudo supera 50 m, PN-16 o rompe-carga.",
      ] },
    ],
  };
}

function docSed(cover: Cover, info: { code: string; norma: string }, s: ReturnType<typeof calcularSedimentador>): MemoriaDoc {
  return {
    codigo: info.code,
    titulo: "Diseño de sedimentador",
    norma: info.norma,
    blocks: [
      { type: "cover", ...cover },
      { type: "h2", text: "1. Criterio de diseño (RNE OS.020)" },
      { type: "p", text: "El sedimentador retira partículas sedimentables antes del prefiltro o del filtro lento, como unidad de tratamiento del RNE OS.020. El área superficial se obtiene de la velocidad de sedimentación (Stokes / Allen / Newton). Se verifican L2/B, L2/H, velocidad horizontal y tiempo de retención." },
      { type: "eq", text: "AS = Q / VS     ·     L2 = AS / B     ·     VH = Q / (B H)     ·     To = AS H / Q", num: "1" },
      paso("01", "Área superficial", "AS = Q / VS", `${fmt(s.Q, 6)} m³/s / ${fmt(s.VS, 6)} m/s`, `${fmt(s.AS, 3)} m²`),
      paso("02", "Geometría de la zona de decantación", "L2 = AS / B     LT = L1 + L2", `B = ${fmt(s.B, 2)} m · L1 = ${fmt(s.L1, 2)} m (entrada) · L2cálc = ${fmt(s.L2calc, 2)} m → L2 = ${fmt(s.L2, 2)} m`, `LT = ${fmt(s.LT, 2)} m`),
      paso("03", "Relaciones y velocidad horizontal", "2.8 < L2/B < 6     ·     6 < L2/H < 20     ·     VH < 0.55 cm/s", `L2/B = ${fmt(s.L2B, 2)} · L2/H = ${fmt(s.L2H, 2)}`, `VH = ${fmt(s.VH, 3)} cm/s  ·  To = ${fmt(s.To, 2)} h`),
      paso("04", "Tolva, vertedero y cortina de orificios", "H1 = H + S L2     ·     H2 = [Q / (1.84 B)]^{2/3}     ·     Ao = Q / Vo", `H1 = ${fmt(s.H1, 2)} m · H2 = ${fmt(s.H2, 4)} m · Ao = ${fmt(s.Ao * 1e4, 2)} cm²`, `n = ${fmt(s.nOrif, 1)} → ${s.N1} × ${s.N2} orificios Ø ${fmt(s.Dorif * 1000, 0)} mm, a = ${fmt(s.a, 2)} m`),
      paso("05", "Vaciado", "T1 = 60 AS √H / (4850 A2)", `A2 = ${fmt(s.A2, 3)} m²`, `T1 = ${fmt(s.T1, 2)} min  ·  q desagüe = ${fmt(s.qDes, 1)} L/s`),
      { type: "h2", text: "2. Verificaciones" },
      { type: "check", ok: s.okL2B, text: `L2/B = ${fmt(s.L2B, 2)} ${s.okL2B ? "dentro de" : "fuera de"} 2.8–6. Si excede, aumentar B.` },
      { type: "check", ok: s.okL2H, text: `L2/H = ${fmt(s.L2H, 2)} ${s.okL2H ? "dentro de" : "fuera de"} 6–20.` },
      { type: "check", ok: s.okVH, text: `VH = ${fmt(s.VH, 3)} cm/s < 0.55 cm/s.` },
      { type: "check", ok: s.okTo, text: `To = ${fmt(s.To, 2)} h (objetivo 1.5–4 h).` },
    ],
  };
}

function docPf(cover: Cover, info: { code: string; norma: string }, p: ReturnType<typeof calcularPrefiltro>): MemoriaDoc {
  return {
    codigo: info.code,
    titulo: "Diseño de prefiltro de grava",
    norma: info.norma,
    blocks: [
      { type: "cover", ...cover },
      { type: "h2", text: "1. Criterio" },
      { type: "p", text: "El prefiltro de grava es pretratamiento del RNE OS.020: reduce la turbiedad en cámaras de diámetro decreciente 3–4, 2–3 y 1–2 cm, antes del filtro lento. El área se dimensiona con Vf = 0.10–0.60 m/h. La longitud de cada tramo usa el módulo de impedimento: Li = −ln(cl/co) / a." },
      { type: "eq", text: "A = 3 600 Q / (N Vf)     ·     B = A / H     ·     Li = −ln(ci/ci−1) / a(Vf, Ø)", num: "1" },
      paso("01", "Área y ancho", "A = 3600 Q / (N Vf)", `Q = ${fmt(p.Qls, 3)} L/s · N = ${p.N} (mínimo 2) · Vf = ${fmt(p.Vf, 2)} m/h`, `A = ${fmt(p.A, 3)} m²  ·  B = ${fmt(p.B, 3)} m  (H = ${fmt(p.H, 2)} m)`),
      paso("02", "Tramo 1 — grava 3 a 4 cm", "L1 = −ln(c1/co) / a1", `co = ${fmt(p.co, 0)} UNT → c1 = ${fmt(p.c1, 0)} UNT · a1 = ${fmt(p.a1, 3)} m⁻¹ (Vf = ${fmt(p.Vf, 2)} m/h)`, `L1 = ${fmt(p.L1, 3)} m`),
      paso("03", "Tramo 2 — grava 2 a 3 cm", "L2 = −ln(c2/c1) / a2", `c1 = ${fmt(p.c1, 0)} → c2 = ${fmt(p.c2, 0)} UNT · a2 = ${fmt(p.a2, 3)} m⁻¹`, `L2 = ${fmt(p.L2, 3)} m`),
      paso("04", "Tramo 3 — grava 1 a 2 cm", "L3 = −ln(c3/c2) / a3", `c2 = ${fmt(p.c2, 0)} → cl = ${fmt(p.c3, 0)} UNT · a3 = ${fmt(p.a3, 3)} m⁻¹`, `L3 = ${fmt(p.L3, 3)} m  ·  Lt = ${fmt(p.Lt, 3)} m (sin muros)`),
      { type: "table", caption: "Módulo de impedimento a (m⁻¹) — prefiltración gruesa, RNE OS.020", headers: ["Vf (m/h)", "Ø 1–2 cm", "Ø 2–3 cm", "Ø 3–4 cm"], rows: [["0.10", "1.20", "0.80", "0.60"], ["0.20", "0.85", "0.70", "0.50"], ["0.40", "0.75", "0.55", "0.425"], ["0.80", "0.65", "0.45", "0.325"]] },
      { type: "check", ok: p.okVf, text: `Vf = ${fmt(p.Vf, 2)} m/h dentro de 0.10–0.60 m/h.` },
      { type: "check", ok: p.N >= 2, text: `N = ${p.N} ≥ 2 unidades (una en lavado).` },
      { type: "check", ok: p.Lt > 0, text: `Longitud total Lt = ${fmt(p.Lt, 2)} m.` },
    ],
  };
}

function docFl(cover: Cover, info: { code: string; norma: string }, f: ReturnType<typeof calcularFiltroLento>): MemoriaDoc {
  return {
    codigo: info.code,
    titulo: "Diseño de filtro lento de arena",
    norma: info.norma,
    blocks: [
      { type: "cover", ...cover },
      { type: "h2", text: "1. Criterio de diseño (RNE OS.020)" },
      { type: "p", text: "El filtro lento es la unidad de pulimento del RNE OS.020: Vf = 0.10–0.30 m/h, mínimo dos unidades, lecho de arena 0.80–1.00 m sobre grava soporte y drenes. El rectángulo de mínimo costo usa K = 2N/(N+1)." },
      { type: "eq", text: "AS = Q / (N Vf)     ·     K = 2N/(N+1)     ·     B = √(AS K)     ·     A = √(AS/K)", num: "1" },
      paso("01", "Área filtrante por unidad", "AS = Q / (N Vf)", `Q = ${fmt(f.Qmh, 3)} m³/h · N = ${f.N} · Vf = ${fmt(f.Vf, 2)} m/h`, `AS = ${fmt(f.AS, 3)} m²`),
      paso("02", "Planta de mínimo costo", "K = 2N/(N+1)     B = √(AS K)     A = √(AS/K)", `K = ${fmt(f.K, 3)} → Bcálc = ${fmt(f.Bcalc, 2)} m · Acálc = ${fmt(f.Acalc, 2)} m`, `Se adopta A = ${fmt(f.A, 2)} m × B = ${fmt(f.B, 2)} m`),
      paso("03", "Velocidad real y depósito de arena", "VR = Q / (N A B)     ·     V = 2 A B E n", `E = ${fmt(f.E, 2)} m por raspado · n = ${fmt(f.nRasp, 0)} raspados/año · 2 años de almacenamiento`, `VR = ${fmt(f.VR, 3)} m/h  ·  Vdep = ${fmt(f.Vdep, 2)} m³`),
      { type: "table", caption: "Parámetros de diseño — RNE OS.020 (filtro lento)", headers: ["Parámetro", "Rango"], rows: [["Velocidad de filtración", "0.10 – 0.30 m/h"], ["Área por unidad", "10 – 200 m² (rural: menor admisible)"], ["N mínimo", "2"], ["Borde libre", "0.20 – 0.30 m"], ["Capa de agua", "1.0 – 1.5 m"], ["Lecho filtrante", "0.80 – 1.00 m · 0.15–0.35 mm"], ["Capa soporte", "0.10 – 0.30 m"], ["Drenes", "0.10 – 0.25 m"]] },
      { type: "kv", rows: [
        { k: "H total", v: fmt(f.Htot, 2), u: "m" },
        { k: "Capa de agua", v: fmt(f.hAgua, 2), u: "m" },
        { k: "Lecho", v: fmt(f.hLecho, 2), u: "m" },
        { k: "Soporte", v: fmt(f.hSop, 2), u: "m" },
        { k: "Drenes", v: fmt(f.hDren, 2), u: "m" },
        { k: "BL", v: fmt(f.BL, 2), u: "m" },
      ] },
      { type: "check", ok: f.okVf, text: `VR = ${fmt(f.VR, 3)} m/h dentro de 0.10–0.30 m/h.` },
      { type: "check", ok: f.okN, text: `N = ${f.N} ≥ 2.` },
      { type: "check", ok: f.okAS, text: `AS = ${fmt(f.AS, 2)} m² por unidad.` },
    ],
  };
}

function docImp(cover: Cover, info: { code: string; norma: string }, r: ReturnType<typeof calcularImpulsion>, mat: MaterialTubo): MemoriaDoc {
  return {
    codigo: info.code,
    titulo: "Estación de bombeo y línea de impulsión",
    norma: info.norma,
    blocks: [
      { type: "cover", ...cover },
      { type: "h2", text: "1. Caudal de bombeo y cisterna" },
      { type: "p", text: "La estación se dimensiona según el RNE OS.040 y OS.100: horas de bombeo hb, cisterna para el descanso más largo, diámetro económico de Bresse y altura dinámica total Ht = Hg + Hf + accesorios + Ps." },
      { type: "eq", text: "Qb = Qmd · 24 / hb     ·     Vc = Qmd · tb · 3.6     ·     tb = (24 − hb)/2", num: "1" },
      paso("01", "Caudal de la bomba y volumen de cisterna", "Qb = Qmd · 24/hb", `Qmd = ${fmt(r.Qmd, 3)} L/s · hb = ${fmt(r.hb, 1)} h · tb = ${fmt(r.tb, 1)} h`, `Qb = ${fmt(r.Qb, 3)} L/s  ·  Vc = ${fmt(r.Vc, 2)} m³`),
      { type: "h2", text: "2. Diámetro económico (Bresse)" },
      { type: "eq", text: "D = 1.3 λ^{1/4} √Q     ·     λ = hb / 24     (Q en m³/s, D en m)", num: "2" },
      paso("02", "Diámetro de Bresse y comerciales F°G°", "D = 1.3 (hb/24)^{0.25} √Qb", `λ = ${fmt(r.lam, 3)} → D = ${fmt(r.Dbresse * 1000, 1)} mm`, `Succión Ø ${r.DsucP}" (Di = ${fmt(r.Dsuc * 1000, 1)} mm) · Impulsión Ø ${r.DimpP}" (Di = ${fmt(r.Dimp * 1000, 1)} mm)`),
      { type: "h2", text: "3. Pérdidas y altura dinámica" },
      { type: "eq", text: "Sf = [Q / (0.2785 C D^{2.63})]^{1/0.54}     ·     hacc = ΣK V²/2g     ·     Ht = Hg + Hf + hacc + Ps", num: "3" },
      paso("03", "Succión", "Hf,s = Sf Ls + ΣKs V²/2g", `V = ${fmt(r.Vsuc, 2)} m/s · Sf = ${fmtFixed(r.SfSuc, 5)} · Ls = ${fmt(r.Lsuc, 2)} m · ΣK = ${fmt(r.Ksuc, 2)}`, `Hf succión = ${fmt(r.HfSuc, 3)} m`),
      paso("04", "Impulsión", "Hf,i = Sf Li + ΣKi V²/2g", `V = ${fmt(r.Vimp, 2)} m/s · Li = ${fmt(r.Limp, 1)} m · ${MAT_LABEL[mat]} · ΣK = ${fmt(r.Kimp, 2)}`, `Hf impulsión = ${fmt(r.HfImp, 2)} m  ·  Hg = ${fmt(r.HgImp, 2)} m`),
      paso("05", "Potencia de la bomba", "HP = Qb Ht / (76 η)", `Ht = ${fmt(r.HgSuc, 2)} + ${fmt(r.HfSuc, 2)} + ${fmt(r.HgImp, 2)} + ${fmt(r.HfImp, 2)} + ${fmt(r.Ps, 2)} = ${fmt(r.Ht, 2)} m · η = ${fmt(r.eta, 2)}`, `${fmt(r.HP, 2)} HP  (${fmt(r.kW, 2)} kW)`),
      { type: "h2", text: "4. Sumergencia de la succión" },
      paso("06", "Antivórtice", "S ≥ 2.5 D + 0.10     y     S ≥ 2.5 V²/2g + 0.20", `2.5D+0.10 = ${fmt(r.Smin, 2)} m · 2.5 V²/2g+0.20 = ${fmt(r.Shid, 2)} m`, `Adoptar S ≥ ${fmt(Math.max(r.Smin, r.Shid, 0.35), 2)} m`),
      { type: "check", ok: r.okVsuc, text: `Velocidad de succión ${fmt(r.Vsuc, 2)} m/s (0.3–1.5 m/s).` },
      { type: "check", ok: r.okVimp, text: `Velocidad de impulsión ${fmt(r.Vimp, 2)} m/s (0.6–2.0 m/s).` },
      { type: "check", ok: r.okHP, text: `Potencia ${fmt(r.HP, 2)} HP. Instalar 1+1 (100 % + reserva) según RNE OS.040.` },
    ],
  };
}

function docRes(cover: Cover, info: { code: string; norma: string }, r: ReturnType<typeof calcularReservorio>): MemoriaDoc {
  return {
    codigo: info.code,
    titulo: "Dimensionamiento de reservorio apoyado",
    norma: info.norma,
    blocks: [
      { type: "cover", ...cover },
      { type: "h2", text: "1. Volumen" },
      { type: "p", text: "El reservorio apoyado se dimensiona con el 25 % de Qp (fuente continua, RNE OS.030 / OS.100) más reserva de emergencia si aplica, y se verifica la relación b/h entre 0.5 y 3. Los niples de entrada, salida, rebose, limpia y ventilación siguen el RNE IS.010." },
      { type: "eq", text: "V = freg · Pf · d / 1 000     =     Qp · 86.4 · freg", num: "1" },
      paso("01", "Caudales y volumen", "Qp = Pf d / 86 400", `Pf = ${fmt(r.Pf, 0)} hab · d = ${fmt(r.dot, 0)} L/hab·d`, `Qp = ${fmt(r.Qp, 3)} L/s · Qmd = ${fmt(r.Qmd, 3)} L/s · Qmh = ${fmt(r.Qmh, 3)} L/s`),
      paso("02", "Almacenamiento", "Vreg = 0.25 Qp · 86.4", `freg = ${fmt(r.fracReg, 2)} · freserva = ${fmt(r.fracRes, 2)}`, `Vreg = ${fmt(r.Vreg, 2)} m³ · Vres = ${fmt(r.Vres, 2)} m³ → se adopta ${r.Vadop} m³`),
      { type: "h2", text: "2. Geometría" },
      { type: "eq", text: "hu = V / (b L)     ·     Hint = hu + hs + hing + hreb + hreb−NA     ·     0.5 ≤ b/h ≤ 3", num: "2" },
      paso("03", "Planta y alturas", "hu = V /(b L)", `b = ${fmt(r.bi, 2)} m · L = ${fmt(r.Li, 2)} m`, `hu = ${fmt(r.hu, 2)} m · h agua = ${fmt(r.hAgua, 2)} m · Hint = ${fmt(r.Hint, 2)} m · b/h = ${fmt(r.bh, 2)}`),
      { type: "h2", text: "3. Niples" },
      { type: "kv", rows: [
        { k: "Entrada", v: `${r.Dent}"`, u: "F°G°" },
        { k: "Salida", v: `${r.Dsal}"`, u: "F°G°" },
        { k: "Rebose", v: `${r.Dreb}"`, u: "F°G°" },
        { k: "Limpia (≈ 0.5 h)", v: `${r.Dlimpia}"`, u: "F°G°" },
        { k: "Ventilación", v: `2"`, u: "F°G°" },
      ] },
      { type: "check", ok: r.okBh, text: `b/h = ${fmt(r.bh, 2)} dentro de 0.5–3 (RNE OS.030).` },
      { type: "check", ok: r.okHu, text: `Altura útil hu = ${fmt(r.hu, 2)} m (objetivo 0.8–3.5 m).` },
      { type: "note", text: "hs ≥ 0.10 m (canastilla). Distancia techo–ingreso ≥ 0.20 m, rebose–ingreso ≥ 0.15 m y rebose–nivel máximo ≥ 0.10 m (IS.010)." },
    ],
  };
}

function docClo(cover: Cover, info: { code: string; norma: string }, c: ReturnType<typeof calcularCloracion>): MemoriaDoc {
  return {
    codigo: info.code,
    titulo: "Sistema de cloración por goteo",
    norma: info.norma,
    blocks: [
      { type: "cover", ...cover },
      { type: "h2", text: "1. Dosificación" },
      { type: "p", text: "Se dimensiona un dosificador de hipoclorito de calcio (o sodio) para desinfección del agua de consumo. La dosis típica de diseño es 1–2 mg/L de cloro residual, con hipoclorito al 65 % y solución al 0.25 %. El recipiente se dimensiona a ciclos de 6, 8 o 12 h." },
      { type: "eq", text: "P = Q d     ·     Pc = P · 100 / r     ·     qs = Pc / c     ·     Vs = qs t", num: "1" },
      paso("01", "Peso de cloro", "P = Q · d    (g/h)", `Q = ${fmt(c.Qm3h, 3)} m³/h · d = ${fmt(c.d, 2)} g/m³ (mg/L)`, `P = ${fmt(c.P, 3)} g/h`),
      paso("02", "Producto comercial", "Pc = P · 100 / r", `r = ${fmt(c.rAct, 1)} % de cloro activo (hipoclorito de calcio típico 65 %)`, `Pc = ${fmt(c.Pc, 3)} g/h = ${fmt(c.Pc / 1000, 4)} kg/h`),
      paso("03", "Caudal de solución", "qs = Pc / c     (L/h, ρ ≈ 1 kg/L)", `c = ${fmt(c.c, 2)} %`, `qs = ${fmt(c.qs, 3)} L/h`),
      paso("04", "Volumen del recipiente", "Vs = qs · t", `t = ${fmt(c.tH, 0)} h (ciclo de preparación)`, `Vs = ${fmt(c.Vs, 1)} L  →  recipiente comercial ${c.recipiente} L`),
      { type: "h2", text: "2. Orificio de goteo" },
      { type: "eq", text: "Qg = Cd A √(2 g h)", num: "2" },
      paso("05", "Caudal del orificio", "Qg = Cd (π Ø²/4) √(2gh)", `Cd = ${fmt(c.Cd, 2)} · Ø = ${fmt(c.Dorif * 1000, 1)} mm · h = ${fmt(c.h, 2)} m`, `Qg = ${fmt(c.Qgls, 5)} L/s = ${fmt(c.gotasS, 1)} gotas/s`),
      { type: "check", ok: c.okDosis, text: `Dosis ${fmt(c.d, 2)} mg/L (rango de diseño 0.5–5 mg/L; residual libre 0.5–1.0 mg/L en red, DS 031-2010-SA).` },
      { type: "check", ok: c.okC, text: `Solución al ${fmt(c.c, 2)} % (0.1–1 % para evitar precipitados).` },
      { type: "note", text: "Verificar cloro residual libre en el punto más desfavorable de la red. El hipoclorito de calcio al 65 % es higroscópico: almacenar seco y dosificar con solución recién preparada." },
    ],
  };
}

import { useMemo, useState, type ReactNode } from "react";
import {
  HIDRO_PACK_META,
  calcularAcueducto,
  calcularAliviadero,
  calcularBocatoma,
  calcularDesarenador,
  calcularOrificio,
  calcularRapida,
  calcularRiego,
  SEMILLA_ACU,
  SEMILLA_ALI,
  SEMILLA_BOC,
  SEMILLA_DES,
  SEMILLA_ORI,
  SEMILLA_RAP,
  SEMILLA_RIE,
  type AcueductoIn,
  type AliviaderoIn,
  type BocatomaIn,
  type DesarenadorIn,
  type HidroPackKind,
  type OrificioIn,
  type RapidaIn,
  type RiegoIn,
} from "../lib/hidro/pack";
import { ORIGEN_Q, type OrigenCaudal } from "../lib/hidro/expediente";
import {
  buildAcueducto,
  buildAliviadero,
  buildBocatoma,
  buildDesarenador,
  buildOrificio,
  buildRapida,
  buildRiego,
  type MetaPack,
} from "../lib/hidro/packMemoria";
import { fmt } from "../lib/num";
import { Field, Num, Text } from "../ui/Field";
import { CalcDirtyNote, CalcularButton, MemoriaPendiente, useMemoriaOnCalcular } from "../ui/calcular";
import { Paper } from "../ui/Paper";
import {
  AcueductoSvg,
  AliviaderoSvg,
  BocatomaSvg,
  DesarenadorSvg,
  OrificioSvg,
  RapidaSvg,
  RiegoSvg,
} from "../ui/hidroPackSvg";
import { exportarWord } from "../lib/exportWord";
import { printMemoria } from "../lib/printDoc";

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

export function HidroPackModule({ kind }: { kind: HidroPackKind }) {
  const info = HIDRO_PACK_META[kind];
  const [meta, setMeta] = useState<MetaPack>({
    proyecto: `${info.title} — ejemplo`,
    ubicacion: "Perú",
    profesional: "Ingeniero civil",
    cip: "",
    estacionSenamhi: "",
    codigoEstacion: "",
    periodoRegistro: "",
    cota: 0,
    utmEste: 0,
    utmNorte: 0,
    origenQ: kind === "riego" ? "riego" : "impuesto",
    justificacionQ: kind === "riego" ? "Demanda del mes crítico (FAO-56)." : "Caudal del expediente o del estudio hidrológico.",
  });
  const [des, setDes] = useState<DesarenadorIn>(SEMILLA_DES);
  const [boc, setBoc] = useState<BocatomaIn>(SEMILLA_BOC);
  const [rap, setRap] = useState<RapidaIn>(SEMILLA_RAP);
  const [ali, setAli] = useState<AliviaderoIn>(SEMILLA_ALI);
  const [acu, setAcu] = useState<AcueductoIn>(SEMILLA_ACU);
  const [rie, setRie] = useState<RiegoIn>(SEMILLA_RIE);
  const [ori, setOri] = useState<OrificioIn>(SEMILLA_ORI);

  const rDes = useMemo(() => calcularDesarenador(des), [des]);
  const rBoc = useMemo(() => calcularBocatoma(boc), [boc]);
  const rRap = useMemo(() => calcularRapida(rap), [rap]);
  const rAli = useMemo(() => calcularAliviadero(ali), [ali]);
  const rAcu = useMemo(() => calcularAcueducto(acu), [acu]);
  const rRie = useMemo(() => calcularRiego(rie), [rie]);
  const rOri = useMemo(() => calcularOrificio(ori), [ori]);

  const doc = useMemo(() => {
    if (kind === "desarenador") return buildDesarenador(meta, rDes);
    if (kind === "bocatoma") return buildBocatoma(meta, rBoc);
    if (kind === "rapida") return buildRapida(meta, rRap);
    if (kind === "aliviadero") return buildAliviadero(meta, rAli);
    if (kind === "acueducto") return buildAcueducto(meta, rAcu);
    if (kind === "riego") return buildRiego(meta, rRie);
    return buildOrificio(meta, rOri);
  }, [kind, meta, rDes, rBoc, rRap, rAli, rAcu, rRie, rOri]);

  const live = useMemo(
    () => ({ doc, kind, rDes, rBoc, rRap, rAli, rAcu, rRie, rOri }),
    [doc, kind, rDes, rBoc, rRap, rAli, rAcu, rRie, rOri],
  );
  const { doc: pack, dirty, calcular } = useMemoriaOnCalcular(live, kind);
  const memoria = pack.doc;
  const v = pack;

  let extra: ReactNode = null;
  if (kind === "desarenador") {
    extra = (
      <div className="croquis-board croquis-board-compact">
        <div className="croquis"><DesarenadorSvg B={v.rDes.B} H={v.rDes.H} L={v.rDes.L} /></div>
        <Ficha code={info.code} adopt={`${fmt(v.rDes.B, 2)} × ${fmt(v.rDes.L, 2)} m`} rows={[["Q", fmt(v.rDes.Q, 3), "m³/s"], ["B", fmt(v.rDes.B, 2), "m"], ["L", fmt(v.rDes.L, 2), "m"], ["t", fmt(v.rDes.t, 0), "s"], ["Vs", fmt(v.rDes.Vs, 4), "m/s"]]} />
      </div>
    );
  } else if (kind === "bocatoma") {
    extra = (
      <div className="croquis-board croquis-board-compact">
        <div className="croquis"><BocatomaSvg b={v.rBoc.bTotal} P={v.rBoc.P} /></div>
        <Ficha code={info.code} adopt={`b = ${fmt(v.rBoc.bTotal, 2)} m · Cc = ${fmt(v.rBoc.Cc, 2)}`} rows={[["b total", fmt(v.rBoc.bTotal, 2), "m"], ["h ventana", fmt(v.rBoc.hOrif, 2), "m"], ["P azud", fmt(v.rBoc.P, 2), "m"], ["He", fmt(v.rBoc.He, 2), "m"], ["L remanso", fmt(v.rBoc.Lremanso, 1), "m"]]} />
      </div>
    );
  } else if (kind === "rapida") {
    extra = (
      <div className="croquis-board croquis-board-compact">
        <div className="croquis"><RapidaSvg y1={v.rRap.y1} y2={v.rRap.y2} L={v.rRap.Lres} /></div>
        <Ficha code={info.code} adopt={`y2 = ${fmt(v.rRap.y2, 2)} m · Lr = ${fmt(v.rRap.Lres, 2)} m`} rows={[["yc", fmt(v.rRap.yc, 3), "m"], ["y1", fmt(v.rRap.y1, 3), "m"], ["Fr1", fmt(v.rRap.Fr1, 2), "—"], ["y2", fmt(v.rRap.y2, 3), "m"], ["Lr", fmt(v.rRap.Lres, 2), "m"]]} />
      </div>
    );
  } else if (kind === "aliviadero") {
    extra = (
      <div className="croquis-board croquis-board-compact">
        <div className="croquis"><AliviaderoSvg L={v.rAli.Ladopt} h={v.rAli.hW} /></div>
        <Ficha code={info.code} adopt={`L = ${fmt(v.rAli.Ladopt, 1)} m`} rows={[["Qevac", fmt(v.rAli.Qevac, 2), "m³/s"], ["De Marchi", fmt(v.rAli.Ldemarchi, 1), "m"], ["Weisbach", fmt(v.rAli.Lweis, 1), "m"], ["Ymáx", fmt(v.rAli.Ymax, 2), "m"]]} />
      </div>
    );
  } else if (kind === "acueducto") {
    extra = (
      <div className="croquis-board croquis-board-compact">
        <div className="croquis"><AcueductoSvg L={v.rAcu.L} V={v.rAcu.V} /></div>
        <Ficha code={info.code} adopt={`V = ${fmt(v.rAcu.V, 2)} m/s`} rows={[["V", fmt(v.rAcu.V, 2), "m/s"], ["hf", fmt(v.rAcu.hf, 3), "m"], ["wres", fmt(v.rAcu.wres, 1), "kg/m"], ["As cable", fmt(v.rAcu.As, 3), "cm²"]]} />
      </div>
    );
  } else if (kind === "riego") {
    extra = (
      <div className="croquis-board croquis-board-compact">
        <div className="croquis"><RiegoSvg metodo={v.rRie.metodo} /></div>
        <Ficha code={info.code} adopt={`${fmt(v.rRie.Qriego * 1000, 1)} L/s`} rows={[["ETc", fmt(v.rRie.ETc, 2), "mm/d"], ["Db", fmt(v.rRie.DbM3, 0), "m³/d"], ["Q turno", fmt(v.rRie.Qriego * 1000, 2), "L/s"], ["Ø lat.", fmt(v.rRie.Dmm, 0), "mm"]]} />
      </div>
    );
  } else {
    extra = (
      <div className="croquis-board croquis-board-compact">
        <div className="croquis"><OrificioSvg H={v.rOri.dH} D={v.rOri.forma === "circular" ? v.rOri.D : v.rOri.h} /></div>
        <Ficha code={info.code} adopt={`Q = ${fmt(v.rOri.Q, 3)} m³/s`} rows={[["A", fmt(v.rOri.A, 4), "m²"], ["V", fmt(v.rOri.V, 2), "m/s"], ["Q", fmt(v.rOri.Q, 3), "m³/s"], ["Re", fmt(v.rOri.Re, 0), "—"]]} />
      </div>
    );
  }

  return (
    <>
      <aside id="app-panel" className="panel">
        <h2>{info.title}</h2>
        <p className="lead">{info.blurb} Complete las variables de expediente y pulse Calcular.</p>
        <CalcDirtyNote dirty={dirty} />
        <fieldset className="fieldset">
          <legend>Identificación</legend>
          <Field label="Proyecto"><Text value={meta.proyecto} onChange={(v) => setMeta({ ...meta, proyecto: v })} /></Field>
          <Field label="Ubicación"><Text value={meta.ubicacion} onChange={(v) => setMeta({ ...meta, ubicacion: v })} /></Field>
          <Field label="Profesional"><Text value={meta.profesional} onChange={(v) => setMeta({ ...meta, profesional: v })} /></Field>
          <Field label="CIP"><Text value={meta.cip} onChange={(v) => setMeta({ ...meta, cip: v })} /></Field>
          <Field label="Origen del caudal">
            <select value={meta.origenQ} onChange={(e) => setMeta({ ...meta, origenQ: e.target.value as OrigenCaudal })}>
              {ORIGEN_Q.map((o) => (
                <option key={o.id} value={o.id}>{o.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Justificación de Q"><Text value={meta.justificacionQ} onChange={(v) => setMeta({ ...meta, justificacionQ: v })} /></Field>
        </fieldset>
        {kind === "desarenador" && (
          <fieldset className="fieldset">
            <legend>Cámara</legend>
            <div className="grid-2">
              <Field label="Q" unit="m³/s"><Num value={des.Q} onChange={(v) => setDes({ ...des, Q: v })} /></Field>
              <Field label="d partícula" unit="mm"><Num value={des.dMm} onChange={(v) => setDes({ ...des, dMm: v })} /></Field>
              <Field label="Gs"><Num value={des.Gs} onChange={(v) => setDes({ ...des, Gs: v })} /></Field>
              <Field label="T agua" unit="°C"><Num value={des.T} onChange={(v) => setDes({ ...des, T: v })} /></Field>
              <Field label="H cámara" unit="m"><Num value={des.H} onChange={(v) => setDes({ ...des, H: v })} /></Field>
              <Field label="Vh" unit="m/s"><Num value={des.Vh} onChange={(v) => setDes({ ...des, Vh: v })} /></Field>
              <Field label="α seguridad"><Num value={des.alfa} onChange={(v) => setDes({ ...des, alfa: v })} /></Field>
              <Field label="Celdas"><Num value={des.nCeldas} onChange={(v) => setDes({ ...des, nCeldas: v })} step="1" /></Field>
              <Field label="h vertedero" unit="m"><Num value={des.hVert} onChange={(v) => setDes({ ...des, hVert: v })} /></Field>
              <Field label="S fondo"><Num value={des.Sfondo} onChange={(v) => setDes({ ...des, Sfondo: v })} /></Field>
              <Field label="Q by-pass" unit="m³/s"><Num value={des.Qbypass} onChange={(v) => setDes({ ...des, Qbypass: v })} /></Field>
              <Field label="L transición" unit="m"><Num value={des.Ltrans} onChange={(v) => setDes({ ...des, Ltrans: v })} /></Field>
            </div>
          </fieldset>
        )}
        {kind === "bocatoma" && (
          <fieldset className="fieldset">
            <legend>Río y ventana</legend>
            <div className="grid-2">
              <Field label="Q diseño" unit="m³/s"><Num value={boc.Q} onChange={(v) => setBoc({ ...boc, Q: v })} /></Field>
              <Field label="Q máx" unit="m³/s"><Num value={boc.Qmax} onChange={(v) => setBoc({ ...boc, Qmax: v })} /></Field>
              <Field label="H estiaje" unit="m"><Num value={boc.Hest} onChange={(v) => setBoc({ ...boc, Hest: v })} /></Field>
              <Field label="Y1 río" unit="m"><Num value={boc.Y1} onChange={(v) => setBoc({ ...boc, Y1: v })} /></Field>
              <Field label="k barrotes"><Num value={boc.kBarrote} onChange={(v) => setBoc({ ...boc, kBarrote: v })} /></Field>
              <Field label="luz barrotes" unit="m"><Num value={boc.eLuz} onChange={(v) => setBoc({ ...boc, eLuz: v })} /></Field>
              <Field label="Co lecho" unit="msnm"><Num value={boc.Co} onChange={(v) => setBoc({ ...boc, Co: v })} /></Field>
              <Field label="ho arrastre" unit="m"><Num value={boc.ho} onChange={(v) => setBoc({ ...boc, ho: v })} /></Field>
              <Field label="S río"><Num value={boc.Srio} onChange={(v) => setBoc({ ...boc, Srio: v })} /></Field>
              <Field label="Ymáx" unit="m"><Num value={boc.Ymax} onChange={(v) => setBoc({ ...boc, Ymax: v })} /></Field>
              <Field label="L barraje" unit="m"><Num value={boc.Lbarraje} onChange={(v) => setBoc({ ...boc, Lbarraje: v })} /></Field>
              <Field label="C Creager"><Num value={boc.Ccreager} onChange={(v) => setBoc({ ...boc, Ccreager: v })} /></Field>
              <Field label="d50 lecho" unit="mm"><Num value={boc.d50} onChange={(v) => setBoc({ ...boc, d50: v })} /></Field>
              <Field label="K reja"><Num value={boc.Kreja} onChange={(v) => setBoc({ ...boc, Kreja: v })} /></Field>
            </div>
          </fieldset>
        )}
        {kind === "rapida" && (
          <fieldset className="fieldset">
            <legend>Rápida / caída</legend>
            <Field label="Tipo">
              <select value={rap.tipo} onChange={(e) => setRap({ ...rap, tipo: e.target.value as RapidaIn["tipo"] })}>
                <option value="rapida">Rápida en un tramo</option>
                <option value="vertical">Caída vertical</option>
                <option value="escalonada">Caída escalonada</option>
              </select>
            </Field>
            <div className="grid-2">
              <Field label="Q" unit="m³/s"><Num value={rap.Q} onChange={(v) => setRap({ ...rap, Q: v })} /></Field>
              <Field label="b rápida" unit="m"><Num value={rap.b} onChange={(v) => setRap({ ...rap, b: v })} /></Field>
              <Field label="S rápida"><Num value={rap.Srap} onChange={(v) => setRap({ ...rap, Srap: v })} /></Field>
              <Field label="n rápida"><Num value={rap.nRap} onChange={(v) => setRap({ ...rap, nRap: v })} /></Field>
              <Field label="Desnivel" unit="m"><Num value={rap.Hdesnivel} onChange={(v) => setRap({ ...rap, Hdesnivel: v })} /></Field>
              <Field label="b canal" unit="m"><Num value={rap.bCanal} onChange={(v) => setRap({ ...rap, bCanal: v })} /></Field>
              <Field label="z canal"><Num value={rap.zCanal} onChange={(v) => setRap({ ...rap, zCanal: v })} /></Field>
              <Field label="S canal"><Num value={rap.Scanal} onChange={(v) => setRap({ ...rap, Scanal: v })} /></Field>
              <Field label="TW cola" unit="m"><Num value={rap.TW} onChange={(v) => setRap({ ...rap, TW: v })} /></Field>
              <Field label="e losa" unit="m"><Num value={rap.eLosa} onChange={(v) => setRap({ ...rap, eLosa: v })} /></Field>
              {rap.tipo === "escalonada" ? (
                <>
                  <Field label="h escalón" unit="m"><Num value={rap.hEscalon} onChange={(v) => setRap({ ...rap, hEscalon: v })} /></Field>
                  <Field label="ℓ escalón" unit="m"><Num value={rap.lEscalon} onChange={(v) => setRap({ ...rap, lEscalon: v })} /></Field>
                </>
              ) : null}
            </div>
          </fieldset>
        )}
        {kind === "aliviadero" && (
          <fieldset className="fieldset">
            <legend>Canal y cresta</legend>
            <div className="grid-2">
              <Field label="Q normal" unit="m³/s"><Num value={ali.Q} onChange={(v) => setAli({ ...ali, Q: v })} /></Field>
              <Field label="Q máx" unit="m³/s"><Num value={ali.Qmax} onChange={(v) => setAli({ ...ali, Qmax: v })} /></Field>
              <Field label="Q2 remanente" unit="m³/s"><Num value={ali.Q2} onChange={(v) => setAli({ ...ali, Q2: v })} /></Field>
              <Field label="b" unit="m"><Num value={ali.b} onChange={(v) => setAli({ ...ali, b: v })} /></Field>
              <Field label="z"><Num value={ali.z} onChange={(v) => setAli({ ...ali, z: v })} /></Field>
              <Field label="S"><Num value={ali.S} onChange={(v) => setAli({ ...ali, S: v })} /></Field>
              <Field label="n"><Num value={ali.n} onChange={(v) => setAli({ ...ali, n: v })} /></Field>
              <Field label="p plantilla" unit="m"><Num value={ali.p} onChange={(v) => setAli({ ...ali, p: v })} /></Field>
              <Field label="Borde libre" unit="m"><Num value={ali.BL} onChange={(v) => setAli({ ...ali, BL: v })} /></Field>
              <Field label="μ Forchheimer"><Num value={ali.muF} onChange={(v) => setAli({ ...ali, muF: v })} /></Field>
              <Field label="Cd De Marchi / μW"><Num value={ali.muW} onChange={(v) => setAli({ ...ali, muW: v })} /></Field>
            </div>
          </fieldset>
        )}
        {kind === "acueducto" && (
          <fieldset className="fieldset">
            <legend>Conducción</legend>
            <Field label="Sección">
              <select value={acu.tipo} onChange={(e) => setAcu({ ...acu, tipo: e.target.value as AcueductoIn["tipo"] })}>
                <option value="tubo">Tubo</option>
                <option value="canal">Canal</option>
              </select>
            </Field>
            <div className="grid-2">
              <Field label="Q" unit="m³/s"><Num value={acu.Q} onChange={(v) => setAcu({ ...acu, Q: v })} /></Field>
              <Field label="L vano" unit="m"><Num value={acu.L} onChange={(v) => setAcu({ ...acu, L: v })} /></Field>
              <Field label="n"><Num value={acu.n} onChange={(v) => setAcu({ ...acu, n: v })} /></Field>
              <Field label="S"><Num value={acu.S} onChange={(v) => setAcu({ ...acu, S: v })} /></Field>
              {acu.tipo === "tubo" ? (
                <>
                  <Field label="D int." unit="mm"><Num value={acu.DintMm} onChange={(v) => setAcu({ ...acu, DintMm: v })} /></Field>
                  <Field label="D ext." unit="mm"><Num value={acu.DextMm} onChange={(v) => setAcu({ ...acu, DextMm: v })} /></Field>
                  <Field label="Peso tramo" unit="kg"><Num value={acu.pesoTubo} onChange={(v) => setAcu({ ...acu, pesoTubo: v })} /></Field>
                  <Field label="Long. tramo" unit="m"><Num value={acu.longTramo} onChange={(v) => setAcu({ ...acu, longTramo: v })} /></Field>
                </>
              ) : (
                <>
                  <Field label="b" unit="m"><Num value={acu.b} onChange={(v) => setAcu({ ...acu, b: v })} /></Field>
                  <Field label="z"><Num value={acu.z} onChange={(v) => setAcu({ ...acu, z: v })} /></Field>
                </>
              )}
              <Field label="fy cable" unit="kg/cm²"><Num value={acu.fy} onChange={(v) => setAcu({ ...acu, fy: v })} /></Field>
              <Field label="q viento" unit="kg/m²"><Num value={acu.qViento} onChange={(v) => setAcu({ ...acu, qViento: v })} /></Field>
              <Field label="Csismo"><Num value={acu.Csismo} onChange={(v) => setAcu({ ...acu, Csismo: v })} /></Field>
              <Field label="Flecha" unit="m"><Num value={acu.flecha} onChange={(v) => setAcu({ ...acu, flecha: v })} /></Field>
            </div>
          </fieldset>
        )}
        {kind === "riego" && (
          <fieldset className="fieldset">
            <legend>Cédula y lateral</legend>
            <Field label="Método">
              <select value={rie.metodo} onChange={(e) => setRie({ ...rie, metodo: e.target.value as RiegoIn["metodo"] })}>
                <option value="aspersión">Aspersión</option>
                <option value="goteo">Goteo</option>
                <option value="cinta">Cinta</option>
              </select>
            </Field>
            <Field label="Cultivo"><Text value={rie.cultivo} onChange={(v) => setRie({ ...rie, cultivo: v })} /></Field>
            <div className="grid-2">
              <Field label="Área" unit="ha"><Num value={rie.areaHa} onChange={(v) => setRie({ ...rie, areaHa: v })} /></Field>
              <Field label="Mes diseño (1-12)"><Num value={rie.mesDiseno} onChange={(v) => setRie({ ...rie, mesDiseno: v })} step="1" /></Field>
              <Field label="Kc"><Num value={rie.Kc} onChange={(v) => setRie({ ...rie, Kc: v })} /></Field>
              <Field label="Eficiencia"><Num value={rie.Ef} onChange={(v) => setRie({ ...rie, Ef: v })} /></Field>
              <Field label="Horas turno" unit="h"><Num value={rie.horas} onChange={(v) => setRie({ ...rie, horas: v })} /></Field>
              <Field label="CC" unit="%"><Num value={rie.CC} onChange={(v) => setRie({ ...rie, CC: v })} /></Field>
              <Field label="PMP" unit="%"><Num value={rie.PMP} onChange={(v) => setRie({ ...rie, PMP: v })} /></Field>
              <Field label="Zr" unit="m"><Num value={rie.Zr} onChange={(v) => setRie({ ...rie, Zr: v })} /></Field>
              <Field label="MAD"><Num value={rie.MAD} onChange={(v) => setRie({ ...rie, MAD: v })} /></Field>
              <Field label="Lf lavado"><Num value={rie.Lf} onChange={(v) => setRie({ ...rie, Lf: v })} /></Field>
              <Field label="q emisor" unit={rie.metodo === "aspersión" ? "L/s" : "L/h"}><Num value={rie.qEmisor} onChange={(v) => setRie({ ...rie, qEmisor: v })} /></Field>
              <Field label="N emisores"><Num value={rie.Ne} onChange={(v) => setRie({ ...rie, Ne: v })} /></Field>
              <Field label="L lateral" unit="m"><Num value={rie.Llat} onChange={(v) => setRie({ ...rie, Llat: v })} /></Field>
              <Field label="C HW"><Num value={rie.C} onChange={(v) => setRie({ ...rie, C: v })} /></Field>
            </div>
          </fieldset>
        )}
        {kind === "orificio" && (
          <fieldset className="fieldset">
            <legend>Orificio</legend>
            <div className="grid-2">
              <Field label="Régimen">
                <select value={ori.regimen} onChange={(e) => setOri({ ...ori, regimen: e.target.value as OrificioIn["regimen"] })}>
                  <option value="libre">Libre</option>
                  <option value="sumergido">Sumergido</option>
                </select>
              </Field>
              <Field label="Forma">
                <select value={ori.forma} onChange={(e) => setOri({ ...ori, forma: e.target.value as OrificioIn["forma"] })}>
                  <option value="circular">Circular</option>
                  <option value="rectangular">Rectangular</option>
                </select>
              </Field>
              <Field label="Cd"><Num value={ori.Cd} onChange={(v) => setOri({ ...ori, Cd: v })} /></Field>
              <Field label="H" unit="m"><Num value={ori.H} onChange={(v) => setOri({ ...ori, H: v })} /></Field>
              {ori.regimen === "sumergido" ? <Field label="H2" unit="m"><Num value={ori.H2} onChange={(v) => setOri({ ...ori, H2: v })} /></Field> : null}
              {ori.forma === "circular" ? <Field label="D" unit="m"><Num value={ori.D} onChange={(v) => setOri({ ...ori, D: v })} /></Field> : (
                <>
                  <Field label="b" unit="m"><Num value={ori.b} onChange={(v) => setOri({ ...ori, b: v })} /></Field>
                  <Field label="h" unit="m"><Num value={ori.h} onChange={(v) => setOri({ ...ori, h: v })} /></Field>
                </>
              )}
              <Field label="N orificios"><Num value={ori.nOrif} onChange={(v) => setOri({ ...ori, nOrif: v })} step="1" /></Field>
              <Field label="Apertura" unit="0-1"><Num value={ori.apertura} onChange={(v) => setOri({ ...ori, apertura: v })} /></Field>
              <Field label="K reja"><Num value={ori.Kreja} onChange={(v) => setOri({ ...ori, Kreja: v })} /></Field>
              <Field label="V aprox." unit="m/s"><Num value={ori.Vaprox} onChange={(v) => setOri({ ...ori, Vaprox: v })} /></Field>
            </div>
          </fieldset>
        )}
        <div className="actions">
          <CalcularButton onClick={calcular} dirty={dirty} />
          <button className="btn" disabled={!memoria} onClick={() => memoria && exportarWord(memoria)}>Exportar Word</button>
          <button className="btn secondary" disabled={!memoria} onClick={() => memoria && printMemoria(memoria.titulo)}>Imprimir / PDF</button>
        </div>
      </aside>
      {memoria ? (
        <Paper doc={memoria} extra={extra} />
      ) : (
        <MemoriaPendiente />
      )}
    </>
  );
}

import { useMemo, useState } from "react";
import { leerArchivoAgua, leerTextoAgua, type LecturaAgua } from "../lib/lotizacion/importarAgua";
import {
  PVC_C10,
  PVC_C75,
  PVC_PN10,
  bresse,
  camaraDe,
  caudalesDe,
  datosAguaBase,
  datosDesagueBase,
  elegirTuberia,
  lineaDesagueDe,
  motorComercialHp,
  potenciaPozo,
  tablaRugosidad,
  type DatosAgua,
  type DatosDesague,
  type Veredicto,
} from "../lib/lotizacion/hidraulica";

function n(v: number, d = 2) {
  if (!Number.isFinite(v)) return "—";
  return v.toLocaleString("es-PE", { minimumFractionDigits: d, maximumFractionDigits: d });
}

function Num({ value, onChange, step = 0.01 }: { value: number; onChange: (v: number) => void; step?: number }) {
  return (
    <input
      type="number"
      step={step}
      value={Number.isFinite(value) ? value : 0}
      onChange={(e) => {
        const x = Number(e.target.value);
        if (Number.isFinite(x)) onChange(x);
      }}
    />
  );
}

function Veredictos({ items }: { items: Veredicto[] }) {
  if (!items.length) return null;
  return (
    <ul className="lz-ver">
      {items.map((item) => (
        <li key={item.texto} className={item.ok ? "ok" : "bad"}>
          <strong>{item.ok ? "Cumple." : "Observado."}</strong> {item.texto}
        </li>
      ))}
    </ul>
  );
}

export function LotizacionHidraulica({ lotesPlano }: { lotesPlano: number }) {
  const [agua, setAgua] = useState<DatosAgua>(() => datosAguaBase());
  const [des, setDes] = useState<DatosDesague>(() => datosDesagueBase());
  const [etapas, setEtapas] = useState<number[] | null>(null);
  const [diamLibre, setDiamLibre] = useState(true);
  const lotes = etapas ?? [Math.max(0, lotesPlano)];
  const setLote = (i: number, v: number) => {
    const next = lotes.slice();
    next[i] = Math.max(0, v);
    setEtapas(next);
  };
  const fijarDiam = (patch: Partial<DatosDesague>) => {
    setDiamLibre(false);
    setDes({ ...des, diamNom: lin.tubo.ext, diamInt: lin.tubo.int, ...patch });
  };

  const cau = useMemo(() => caudalesDe(lotes, agua), [lotes, agua]);
  const pozo = agua.pozos[0]?.qb ?? 0;
  const sumaPozos = agua.pozos.reduce((s, p) => s + p.qb, 0);
  const imp = useMemo(() => bresse(pozo, agua.horasBombeo, agua.vel), [pozo, agua.horasBombeo, agua.vel]);
  const tuboPozo = useMemo(() => elegirTuberia(pozo, agua.horasBombeo, PVC_PN10, 0.6, 2), [pozo, agua.horasBombeo]);
  const pot = useMemo(() => potenciaPozo(agua, pozo), [agua, pozo]);
  const cam = useMemo(() => camaraDe(cau.tot.qp, des, agua.k1, agua.k2), [cau.tot.qp, des, agua.k1, agua.k2]);
  const hEst = des.cotaDescarga - des.cotaSuccion;
  const lin = useMemo(() => lineaDesagueDe(cam.qb, des, hEst, diamLibre), [cam.qb, des, hEst, diamLibre]);
  const hpEquipo = Math.max(lin.hp, lin.pMotorHp);
  const motorEq = motorComercialHp(hpEquipo);

  const verCaudal: Veredicto[] = cau.tot.lotes > 0 ? [
    {
      ok: sumaPozos + 1e-6 >= cau.qb,
      texto: `Los pozos suman ${n(sumaPozos)} L/s y el bombeo de agua pide ${n(cau.qb)} L/s (Qmd × 24 / t).`,
    },
    {
      ok: cam.qMaxc + 1e-6 >= cau.qDiseno,
      texto: `Caudal máximo de la cámara ${n(cam.qMaxc)} L/s frente al caudal de diseño del alcantarillado ${n(cau.qDiseno)} L/s.`,
    },
  ] : [];
  const observados = [...verCaudal, ...pot.veredictos, ...cam.veredictos, ...lin.veredictos].filter((x) => !x.ok).length;
  const [avisoImp, setAvisoImp] = useState("");
  const [pega, setPega] = useState("");
  const [pegando, setPegando] = useState(false);
  const aplicarImport = (leido: LecturaAgua) => {
    if (leido.lotes.length) setEtapas(leido.lotes);
    if (Object.keys(leido.agua).length || leido.pozos.length) {
      setAgua((a) => ({
        ...a,
        ...leido.agua,
        pozos: leido.pozos.length ? leido.pozos : a.pozos,
      }));
    }
    setAvisoImp(leido.aviso);
    setPegando(false);
  };
  const [hoja, setHoja] = useState<"caudal" | "impulsion" | "potencia" | "camara" | "desague" | "golpe">("caudal");
  const hojas = [
    ["caudal", "1. Caudal"],
    ["impulsion", "2. Impulsión"],
    ["potencia", "3. Potencia"],
    ["camara", "4. Cámara"],
    ["desague", "5. Desagüe"],
    ["golpe", "6. Golpe de ariete"],
  ] as const;

  return (
    <section className="lz-hid">
      <h3>Memoria de agua y desagüe</h3>
      <p className="lz-hint">
        Los lotes de cada etapa entran al caudal, a la cámara y a la impulsión de desagüe.
        {lotesPlano > 0 ? ` El plano de esta sesión tiene ${lotesPlano.toLocaleString("es-PE")} lotes de vivienda.` : ""}
        {" "}
        {cau.tot.lotes === 0
          ? "Importe un CSV o Excel, pegue la tabla o escriba la cantidad en la etapa."
          : observados === 0
            ? "Todas las verificaciones cierran con los datos actuales."
            : `Hay ${observados} verificación${observados === 1 ? "" : "es"} observada${observados === 1 ? "" : "s"}.`}
      </p>
      <div className="lz-files">
        <label className="btn secondary">
          Importar CSV o Excel
          <input
            type="file"
            accept=".csv,.txt,.xlsx,.xls"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void leerArchivoAgua(f).then(aplicarImport);
              e.target.value = "";
            }}
          />
        </label>
        <button type="button" className="btn secondary" onClick={() => setPegando((v) => !v)}>Pegar tabla</button>
        {lotesPlano > 0 ? (
          <button
            type="button"
            className="btn secondary"
            onClick={() => aplicarImport({
              lotes: [lotesPlano],
              agua: {},
              pozos: [],
              aviso: `Se tomaron ${lotesPlano.toLocaleString("es-PE")} lotes de vivienda del plano, en una etapa.`,
            })}
          >
            Usar los {lotesPlano.toLocaleString("es-PE")} lotes del plano
          </button>
        ) : null}
      </div>
      {pegando ? (
        <div className="lz-block">
          <textarea
            rows={5}
            value={pega}
            placeholder={"Etapa;Lotes\nI;400\nII;194\nDensidad;4,62\nDotación;150"}
            onChange={(e) => setPega(e.target.value)}
          />
          <button type="button" className="btn secondary" onClick={() => aplicarImport(leerTextoAgua(pega))}>Leer tabla</button>
        </div>
      ) : null}
      <p className="lz-hint">Una columna Lotes, una cantidad por fila, o el Excel del expediente. Si el archivo trae densidad, dotación, k1, k2 o pozos, esos datos también entran.</p>
      {avisoImp ? <p className="lz-aviso">{avisoImp}</p> : null}
      <div className="lz-pestanas" role="tablist" aria-label="Memorias de agua y desagüe">
        {hojas.map(([id, nombre]) => (
          <button key={id} type="button" role="tab" aria-selected={hoja === id} className={hoja === id ? "is-on" : ""} onClick={() => setHoja(id)}>
            {nombre}
          </button>
        ))}
      </div>

      {hoja === "caudal" && <>
      <h4>1. Caudal de agua y alcantarillado</h4>
      <div className="lz-hid-grid">
        <label>Densidad hab/viv <Num value={agua.densidad} step={0.01} onChange={(v) => setAgua({ ...agua, densidad: v })} /></label>
        <label>Dotación L/hab·día <Num value={agua.dotacion} step={1} onChange={(v) => setAgua({ ...agua, dotacion: v })} /></label>
        <label>k1 diario <Num value={agua.k1} step={0.05} onChange={(v) => setAgua({ ...agua, k1: v })} /></label>
        <label>k2 horario <Num value={agua.k2} step={0.05} onChange={(v) => setAgua({ ...agua, k2: v })} /></label>
        <label>Contribución al alcantarillado <Num value={agua.contribucion} step={0.05} onChange={(v) => setAgua({ ...agua, contribucion: v })} /></label>
        <label>Infiltración sobre Qcmh <Num value={agua.infiltracion} step={0.01} onChange={(v) => setAgua({ ...agua, infiltracion: v })} /></label>
        <label>Horas de bombeo de agua <Num value={agua.horasBombeo} step={1} onChange={(v) => setAgua({ ...agua, horasBombeo: v })} /></label>
      </div>
      <ol className="lz-pasos">
        <li>Habitantes de cada etapa: redondeo de densidad × lotes. Con {n(agua.densidad, 2)} hab/viv, la etapa I da {n(cau.filas[0]?.hab ?? 0, 0)} habitantes.</li>
        <li>Qp = dotación × habitantes / 86 400. Qmd = k1·Qp y Qmh = k2·Qp, cada uno redondeado a dos decimales. Total de agua: Qp = {n(cau.tot.qp)} L/s, Qmd = {n(cau.tot.qmd)} L/s, Qmh = {n(cau.tot.qmh)} L/s.</li>
        <li>Alcantarillado = contribución × caudal de agua. Qcprom = {n(cau.tot.qcprom)} L/s, Qcmd = {n(cau.tot.qcmd)} L/s, Qcmh = {n(cau.tot.qcmh)} L/s.</li>
        <li>Infiltración = {n(agua.infiltracion * 100, 0)} % de Qcmh = {n(cau.qInfil)} L/s. Caudal máximo horario de diseño = {n(cau.qDiseno)} L/s.</li>
        <li>Qb de agua = Qmd × 24 / {n(agua.horasBombeo, 0)} = {n(cau.qb)} L/s. Los pozos de explotación se informan aparte y tienen que cubrir este caudal.</li>
        <li>
          Volumen del día medio = Qp × 86,4 = {n(cau.volDiaMedio)} m³. Regulación adoptada = 25 % de ese volumen = {n(cau.volReg)} m³.
          La celda del expediente multiplica además por t/24 y da {n(cau.volRegCelda)} m³. El rótulo “25 % × Qp × (24/t)” daría {n(cau.volRegRotulo)} m³.
          Incendio = {n(cau.volIncendio, 0)} m³. Reservorio adoptado = {n(cau.volReservorio)} m³.
        </li>
      </ol>
      <table className="lz-hid-tab">
        <thead>
          <tr>
            <th>Etapa</th><th>Lotes</th><th>Hab.</th><th>Qp</th><th>Qmd</th><th>Qmh</th><th>Qcprom</th><th>Qcmd</th><th>Qcmh</th>
          </tr>
        </thead>
        <tbody>
          {cau.filas.map((f, i) => (
            <tr key={f.etapa}>
              <td>{["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX"][i] ?? f.etapa}</td>
              <td><Num value={f.lotes} step={1} onChange={(v) => setLote(i, v)} /></td>
              <td>{n(f.hab, 0)}</td>
              <td>{n(f.qp)}</td>
              <td>{n(f.qmd)}</td>
              <td>{n(f.qmh)}</td>
              <td>{n(f.qcprom)}</td>
              <td>{n(f.qcmd)}</td>
              <td>{n(f.qcmh)}</td>
            </tr>
          ))}
          <tr>
            <td>Total</td>
            <td>{n(cau.tot.lotes, 0)}</td>
            <td>{n(cau.tot.hab, 0)}</td>
            <td>{n(cau.tot.qp)}</td>
            <td>{n(cau.tot.qmd)}</td>
            <td>{n(cau.tot.qmh)}</td>
            <td>{n(cau.tot.qcprom)}</td>
            <td>{n(cau.tot.qcmd)}</td>
            <td>{n(cau.tot.qcmh)}</td>
          </tr>
        </tbody>
      </table>
      <p className="lz-hint">Caudales en L/s. El total suma las etapas ya redondeadas.</p>
      {lotes.length < 9 ? (
        <button type="button" className="btn secondary" onClick={() => setEtapas([...lotes, 0])}>Agregar etapa</button>
      ) : null}
      <Veredictos items={verCaudal} />
      </>}

      {hoja === "impulsion" && <>
      <h4>2. Línea de impulsión del pozo</h4>
      <div className="lz-hid-grid">
        {agua.pozos.map((p, i) => (
          <label key={p.nombre}>
            {p.nombre} (L/s)
            <Num value={p.qb} step={0.1} onChange={(v) => {
              const pozos = agua.pozos.slice();
              pozos[i] = { ...p, qb: v };
              setAgua({ ...agua, pozos });
            }} />
          </label>
        ))}
        <label>Velocidad de diseño (m/s) <Num value={agua.vel} step={0.1} onChange={(v) => setAgua({ ...agua, vel: v })} /></label>
      </div>
      <ol className="lz-pasos">
        <li>Bresse: D = 1,3 · (t/24)^0,25 · √(Qb). Con {n(pozo)} L/s y {n(agua.horasBombeo, 0)} h, D = {n(imp.dEcoMm, 1)} mm ({n(imp.dEcoPulg, 2)}").</li>
        <li>Diámetro interior a {n(agua.vel, 2)} m/s: D = 2 · √(Qb / (V · π · 1000)) = {n(imp.dVelM * 1000, 1)} mm. La diferencia (D económico − D interior) / 2 = {n(imp.espesorMm, 1)} mm es solo una comparación; el espesor real es el de la clase comercial.</li>
        <li>
          En la NTP ISO 4422-1 PN-10, el comercial que cumple 0,60 a 2,00 m/s y cubre el diámetro económico es {tuboPozo.tubo ? `${tuboPozo.tubo.nombre}, interior ${n(tuboPozo.tubo.int, 1)} mm, velocidad ${n(tuboPozo.v, 2)} m/s` : "ninguno de la tabla"}.
          El cálculo de potencia usa el interior escrito para la línea de 8", {n(agua.diametros.d8, 1)} mm, que es el de la clase 15 del expediente.
        </li>
      </ol>
      <table className="lz-hid-tab">
        <thead><tr><th>PN-10</th><th>Exterior</th><th>Interior</th><th>Espesor</th></tr></thead>
        <tbody>
          {PVC_PN10.map((t) => (
            <tr key={t.nombre} className={tuboPozo.tubo?.nombre === t.nombre ? "is-on" : ""}>
              <td>{t.nombre}</td><td>{n(t.ext, 1)}</td><td>{n(t.int, 1)}</td><td>{n(t.e, 1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <ImpulsionFig ext={tuboPozo.tubo?.ext ?? imp.dEcoMm} int={tuboPozo.tubo?.int ?? imp.dVelM * 1000} />
      </>}

      {hoja === "potencia" && <>
      <h4>3. Potencia del pozo tubular — Darcy–Weisbach</h4>
      <div className="lz-hid-grid">
        <label>Longitud (m) <Num value={agua.longPozo} step={1} onChange={(v) => setAgua({ ...agua, longPozo: v })} /></label>
        <label>Ks PVC (mm) <Num value={agua.ks} step={0.0001} onChange={(v) => setAgua({ ...agua, ks: v })} /></label>
        <label>ν × 10⁻⁶ a 15 °C <Num value={agua.nu} step={0.001} onChange={(v) => setAgua({ ...agua, nu: v })} /></label>
        <label>Desnivel Z (m) <Num value={agua.desnivel} step={0.1} onChange={(v) => setAgua({ ...agua, desnivel: v })} /></label>
        <label>Eficiencia de bomba (%) <Num value={agua.eficBomba} step={0.1} onChange={(v) => setAgua({ ...agua, eficBomba: v })} /></label>
        <label>Presión de salida (m) <Num value={agua.presionSalida} step={0.1} onChange={(v) => setAgua({ ...agua, presionSalida: v })} /></label>
        <label>Interior de la línea 8" (mm) <Num value={agua.diametros.d8} step={0.1} onChange={(v) => setAgua({ ...agua, diametros: { ...agua.diametros, d8: v } })} /></label>
        <label>Interior 10" (mm) <Num value={agua.diametros.d10} step={0.1} onChange={(v) => setAgua({ ...agua, diametros: { ...agua.diametros, d10: v } })} /></label>
        <label>Interior 12" (mm) <Num value={agua.diametros.d12} step={0.1} onChange={(v) => setAgua({ ...agua, diametros: { ...agua.diametros, d12: v } })} /></label>
      </div>
      <ol className="lz-pasos">
        <li>El mismo caudal del pozo, {n(pozo)} L/s, pasa por todos los tramos. Área = π D² / 4. V(8") = {n(pot.V.d8, 3)} m/s, V(10") = {n(pot.V.d10, 3)} m/s, V(12") = {n(pot.V.d12, 3)} m/s, V(6") = {n(pot.V.d6, 3)} m/s.</li>
        <li>Pérdida menor = Km · n · V² / (2 · 9,82). Cada accesorio usa la velocidad de su diámetro. Suma hm = {n(pot.hm, 2)} m.</li>
        <li>Re = V·D / ν = {n(pot.re, 0)} con ν = {n(agua.nu, 3)}×10⁻⁶ m²/s, que es el agua a 15 °C (densidad {n(agua.densidadAgua, 1)} kg/m³). Ks/D = {n(pot.ksD, 6)}.</li>
        <li>1/√f = −2 log₁₀(Ks/D / 3,7 + 2,51 / (Re √f)), catorce iteraciones desde f = 0,001. f = {n(pot.f, 5)}. Régimen {pot.regimen}.</li>
        <li>hf = f·L·V² / (D · 2 · 9,81) sobre los {n(agua.longPozo, 0)} m del interior de 8". hf = {n(pot.hf, 2)} m.</li>
        <li>H = {n(agua.factorAltura, 2)} · (Z + hf + hm + Ps) = {n(agua.factorAltura, 2)} · ({n(agua.desnivel, 2)} + {n(pot.hf, 2)} + {n(pot.hm, 2)} + {n(agua.presionSalida, 2)}) = {n(pot.H, 2)} m.</li>
        <li>Potencia de bomba = ρ·Q·g·H / (η · 1000) = {n(pot.pKw, 2)} kW ({n(pot.pHp, 2)} HP). Motor = bomba / {n(agua.eficMotor, 3)} = {n(pot.pMotorKw, 2)} kW ({n(pot.pMotorHp, 2)} HP). Se adopta motor de {n(pot.comercial, 2)} HP.</li>
      </ol>
      <table className="lz-hid-tab">
        <thead><tr><th>Accesorio</th><th>Km</th><th>Cant.</th><th>h (m)</th></tr></thead>
        <tbody>
          {pot.acc.map((a) => (
            <tr key={a.nombre}><td>{a.nombre}</td><td>{n(a.km, 2)}</td><td>{a.n}</td><td>{n(a.h, 3)}</td></tr>
          ))}
          <tr><td>Total</td><td></td><td></td><td>{n(pot.hm, 3)}</td></tr>
        </tbody>
      </table>
      <details>
        <summary>Iteración de Colebrook–White del pozo</summary>
        <table className="lz-hid-tab">
          <thead><tr><th>Paso</th><th>g</th><th>f</th></tr></thead>
          <tbody>
            {pot.pasos.map((p, i) => (
              <tr key={i}><td>{i + 1}</td><td>{n(p.g, 4)}</td><td>{n(p.f, 5)}</td></tr>
            ))}
          </tbody>
        </table>
      </details>
      <details>
        <summary>Rugosidad absoluta Ks</summary>
        <table className="lz-hid-tab">
          <tbody>
            {tablaRugosidad().map((r) => (
              <tr key={r.material}><td>{r.material}</td><td>{r.ks} mm</td></tr>
            ))}
          </tbody>
        </table>
      </details>
      <Veredictos items={pot.veredictos} />
      </>}

      {hoja === "camara" && <>
      <h4>4. Cámara de bombeo de aguas servidas</h4>
      <div className="lz-hid-grid">
        <label>Factor de caudal mínimo <Num value={des.fMin} step={0.05} onChange={(v) => setDes({ ...des, fMin: v })} /></label>
        <label>Retención máxima (min) <Num value={des.pretMax} step={1} onChange={(v) => setDes({ ...des, pretMax: v })} /></label>
        <label>Retención mínima (min) <Num value={des.pretMin} step={1} onChange={(v) => setDes({ ...des, pretMin: v })} /></label>
        <label>Volumen escrito (m³) <Num value={des.volDisenado} step={0.01} onChange={(v) => setDes({ ...des, volDisenado: v })} /></label>
        <label>Diámetro de cámara (m) <Num value={des.diamCamara} step={0.1} onChange={(v) => setDes({ ...des, diamCamara: v })} /></label>
        <label>Altura seca (m) <Num value={des.alturaSeca} step={0.01} onChange={(v) => setDes({ ...des, alturaSeca: v })} /></label>
        <label>Altura operativa (m) <Num value={des.alturaOperativa} step={0.01} onChange={(v) => setDes({ ...des, alturaOperativa: v })} /></label>
      </div>
      <ol className="lz-pasos">
        <li>La cámara arranca del Qp de agua del plano, {n(cau.tot.qp)} L/s. Q máximo diario = k1·Qp = {n(cam.qMaxDiario)} L/s. Q máximo maximorum = k1·k2·Qp = {n(cam.qMaxc)} L/s. Q máximo horario = k2·Qp = {n(cam.qMh)} L/s.</li>
        <li>Q mínimo de contribución = f·Qp = {n(des.fMin, 2)} × {n(cau.tot.qp)} = {n(cam.qMinc)} L/s. El rótulo de la hoja dice Qmh·f; la fórmula que cierra el diseño es f·Qp.</li>
        <li>K = Qmaxc / Qminc = {n(cam.K, 3)}. a = retención máxima / retención mínima = {n(des.pretMax, 0)} / {n(des.pretMin, 0)} = {n(cam.a, 2)}. La hoja consigna a = {n(des.relacionA, 0)}, que no es el cociente de esos periodos. Con a = {n(cam.a, 2)} los tiempos de retención caen sobre los periodos fijados.</li>
        <li>(K² − a)² = {n(cam.izq, 2)} y 4(K − a)(K − 1)K(a + 1) = {n(cam.der, 2)}. {cau.tot.qp <= 0 ? "Con Qp en cero esta condición espera el número de lotes." : cam.cumple ? "La desigualdad se cumple y K1 es real." : "Con estos caudales la desigualdad no deja una raíz útil."}</li>
        <li>A = K − a = {n(cam.A, 3)}, B = a − K² = {n(cam.B, 3)}, C = K(K − 1)(a + 1) = {n(cam.C, 3)}. Raíz con signo más = {n(cam.k1a, 3)}. Raíz con signo menos = {n(cam.k1b, 3)}. Se adopta K1 = {n(cam.K1, 3)}.</li>
        <li>Qb = K1 · Qminc = {n(cam.qb)} L/s. Volumen útil = Pret máx · 60 · (K − K1) · Qminc / ((K − K1 − 1) · 1000) = {n(cam.vUtil, 2)} m³.</li>
        <li>Llenado mínimo {n(cam.tLlenMin, 1)} min y máximo {n(cam.tLlenMax, 1)} min. Bombeo mínimo {n(cam.tBombMin, 1)} min y máximo {n(cam.tBombMax, 1)} min. Retención máxima {n(cam.tRetMax, 1)} min y mínima {n(cam.tRetMin, 1)} min.</li>
        <li>Área = π · {n(des.diamCamara, 2)}² / 4 = {n(cam.area, 3)} m². Altura húmeda = volumen adoptado / área = {n(cam.hUtil, 3)} m. Con la altura seca {n(des.alturaSeca, 2)} m y la operativa {n(des.alturaOperativa, 2)} m, la altura total es {n(cam.hTotal, 3)} m.</li>
      </ol>
      <CamaraFig d={des.diamCamara} h={cam.hTotal} humeda={cam.hUtil} seca={des.alturaSeca} />
      <Veredictos items={cam.veredictos} />
      </>}

      {hoja === "desague" && <>
      <h4>5. Impulsión de desagüe, Hazen–Williams y potencia</h4>
      <div className="lz-hid-grid">
        <label>Horas de bombeo <Num value={des.horasBombeo} step={1} onChange={(v) => setDes({ ...des, horasBombeo: v })} /></label>
        <label>Longitud PVC (m) <Num value={des.longPvc} step={1} onChange={(v) => setDes({ ...des, longPvc: v })} /></label>
        <label>C de accesorios metálicos <Num value={des.cMetal} step={1} onChange={(v) => setDes({ ...des, cMetal: v })} /></label>
        <label>C de PVC <Num value={des.cPvc} step={1} onChange={(v) => setDes({ ...des, cPvc: v })} /></label>
        <label>Cota de succión (m) <Num value={des.cotaSuccion} step={0.001} onChange={(v) => setDes({ ...des, cotaSuccion: v })} /></label>
        <label>Cota de descarga (m) <Num value={des.cotaDescarga} step={0.001} onChange={(v) => setDes({ ...des, cotaDescarga: v })} /></label>
        <label>Eficiencia de bomba (%) <Num value={des.eficBomba} step={0.1} onChange={(v) => setDes({ ...des, eficBomba: v })} /></label>
        <label>Factor eléctrico <Num value={des.factorElec} step={0.01} onChange={(v) => setDes({ ...des, factorElec: v })} /></label>
        <label>Ø exterior (mm) <Num value={diamLibre ? lin.tubo.ext : des.diamNom} step={1} onChange={(v) => fijarDiam({ diamNom: v })} /></label>
        <label>Ø interior (mm) <Num value={diamLibre ? lin.tubo.int : des.diamInt} step={0.1} onChange={(v) => fijarDiam({ diamInt: v })} /></label>
      </div>
      {diamLibre ? (
        <p className="lz-hint">El diámetro sigue al caudal de la cámara. Para fijar otro, escriba el exterior o el interior.</p>
      ) : (
        <button type="button" className="btn secondary" onClick={() => setDiamLibre(true)}>Volver al diámetro calculado</button>
      )}
      <ol className="lz-pasos">
        <li>Qb de la cámara = {n(cam.qb)} L/s, con {n(des.horasBombeo, 0)} h de bombeo. Bresse da {n(lin.bre.dEcoMm, 1)} mm ({n(lin.bre.dEcoMm / 10, 2)} cm, {n(lin.bre.dEcoPulg, 2)}"). El interior a 1,50 m/s es {n(lin.dVel * 1000, 1)} mm.</li>
        <li>Se adopta {lin.tubo.nombre} {lin.tubo.clase}: exterior {n(lin.tubo.ext, 1)} mm, interior {n(lin.tubo.int, 1)} mm, espesor {n(lin.tubo.e, 1)} mm. La velocidad en el interior es {n(lin.V, 3)} m/s. Hazen–Williams usa ese interior. Con el exterior, la pérdida de los {n(des.longPvc, 0)} m sería {n(lin.hfPvcExt, 2)} m, menor que la del diámetro hidráulico.</li>
        <li>Longitud equivalente de la estación: Leq = (K / f) · D, con f = {n(des.fDarcy, 3)} y D = 200 mm. Leq total = {n(lin.leqMetal, 2)} m. Esa longitud no se suma a la del PVC bajo un solo C: cada tramo lleva el suyo.</li>
        <li>S = [Q / (278,8 · C · D^2,63)]^(1/0,54). Accesorios metálicos C = {n(des.cMetal, 0)} en Ø 200 mm: S = {n(lin.sMetal, 6)} y hf = {n(lin.hfMetal, 2)} m. PVC C = {n(des.cPvc, 0)}: S = {n(lin.sPvc, 6)} y hf = {n(lin.hfPvc, 2)} m. hf total = {n(lin.hf, 2)} m.</li>
        <li>Altura estática = {n(des.cotaDescarga, 3)} − {n(des.cotaSuccion, 3)} = {n(lin.hEstatica, 3)} m. HDT = {n(des.factorAltura, 2)} · (hf + Δz + Ps) = {n(lin.hdt, 2)} m.</li>
        <li>Potencia de cada bomba, método de la cámara: ρ·g·Q·HDT / (η · 1000) · 1,341 / factor eléctrico. η entra como {n(des.eficBomba, 1)} % = {n(des.eficBomba / 100, 3)}. Resultado = {n(lin.hp, 2)} HP. Son {des.numBombas} equipos sumergibles en alternancia, cada uno para el caudal completo.</li>
        <li>Darcy–Weisbach de la misma línea, con el interior adoptado: f = {n(lin.f, 5)}, hf = {n(lin.hfDarcy, 2)} m. Las cuatro piezas de la estación suman hm = {n(lin.hm, 2)} m y H = {n(lin.H, 2)} m. Bomba {n(lin.pKw, 2)} kW ({n(lin.pHp, 2)} HP), motor {n(lin.pMotorKw, 2)} kW ({n(lin.pMotorHp, 2)} HP).</li>
        <li>La hoja de potencia aplica además una lista larga de accesorios, todos con la misma velocidad, y da hm = {n(lin.hmHoja, 2)} m y H = {n(lin.Hhoja, 2)} m ({n(lin.pMotorHoja / 0.746, 2)} HP de motor). Esa lista mezcla piezas de 8" y de 12". El equipo se dimensiona con la mayor de las dos potencias: {n(hpEquipo, 2)} HP. Motor comercial {n(motorEq, 2)} HP.</li>
      </ol>
      <table className="lz-hid-tab">
        <thead><tr><th>Accesorio de estación</th><th>K</th><th>Cant.</th><th>Leq unit. (m)</th><th>Leq total (m)</th></tr></thead>
        <tbody>
          {lin.acc.map((a) => (
            <tr key={a.nombre}><td>{a.nombre}</td><td>{n(a.k, 2)}</td><td>{a.n}</td><td>{n(a.leq, 2)}</td><td>{n(a.leqTot, 2)}</td></tr>
          ))}
        </tbody>
      </table>
      <table className="lz-hid-tab">
        <thead><tr><th>Ø</th><th>Exterior</th><th>Interior C-7,5</th><th>Interior C-10</th></tr></thead>
        <tbody>
          {PVC_C75.map((t) => {
            const c10 = PVC_C10.find((x) => x.nombre === t.nombre);
            const activo = lin.tubo.nombre === t.nombre;
            return (
              <tr key={t.nombre} className={activo ? "is-on" : ""}>
                <td>{t.nombre}</td><td>{n(t.ext, 1)}</td><td>{n(t.int, 1)}</td><td>{n(c10?.int ?? 0, 1)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <Veredictos items={lin.veredictos} />
      </>}

      {hoja === "golpe" && <>
      <h4>6. Golpe de ariete</h4>
      <ol className="lz-pasos">
        <li>Celeridad de la línea, con el interior y el espesor adoptados: c = √(2,23×10⁶ / (1 + 0,923·D/e)) = {n(lin.cEmp, 1)} m/s. h = c·V / 9,81 = {n(lin.hAriete, 2)} m. T = 2L/c = {n(lin.T, 2)} s.</li>
        <li>La misma tubería con los módulos de la hoja (K = {n(des.moduloAgua, 0)} kg/cm² del agua y E = {n(des.moduloTubo, 0)} kg/cm² del PVC): c = 1 452 / √(1 + K·D / (E·e)) = {n(lin.cMod, 1)} m/s y h = {n(lin.hMod, 2)} m. El diseño toma la mayor de las dos sobrepresiones.</li>
        <li>Presión máxima de diseño = HDT + h = {n(lin.hdt, 2)} + {n(lin.hDis, 2)} = {n(lin.pMaxDiseno, 2)} m. Se compara con la clase {lin.tubo.clase} ({n(lin.tubo.pnM, 0)} m).</li>
        <li>La celda del golpe usa De = 3×0,025 + 2×{n(des.espesorAriete, 4)} = {n(lin.DeCelda, 4)} m y la velocidad de un Ø 8" ({n(lin.V8, 3)} m/s). Con eso, Vw = {n(lin.VwCelda, 1)} m/s, h = {n(lin.hCelda, 2)} m y Pmáx = h + altura estática = {n(lin.pMaxCelda, 2)} m. Ese diámetro no es el de la impulsión, así que no dimensiona la clase.</li>
        <li>Válvula de alivio: D = √(4Q / (π·Vmáx)) con Vmáx = {n(des.velValvula, 1)} m/s, da {n(lin.dva, 2)}". Se adopta {n(lin.dvaCom, 2)}". Hace falta cuando la presión máxima supera la clase de la tubería.</li>
      </ol>
      </>}
    </section>
  );
}

function ImpulsionFig({ ext, int }: { ext: number; int: number }) {
  const R = 46;
  const r = Math.max(8, Math.min(40, (int / Math.max(ext, 1)) * R));
  return (
    <svg className="lz-hid-fig" viewBox="0 0 420 140" role="img" aria-label="Sección de la tubería de impulsión">
      <circle cx="78" cy="70" r={R} fill="#d5e0e6" stroke="#1a1a1a" />
      <circle cx="78" cy="70" r={r} fill="#f7f4ee" stroke="#1a1a1a" />
      <line x1="78" y1={70 - R} x2="78" y2={70 + R} stroke="#1a1a1a" strokeDasharray="2 2" />
      <text x="150" y="48" fontSize="12">Exterior {ext.toFixed(0)} mm</text>
      <text x="150" y="70" fontSize="12">Interior {int.toFixed(1)} mm</text>
      <text x="150" y="92" fontSize="12">Espesor {((ext - int) / 2).toFixed(1)} mm</text>
    </svg>
  );
}

function CamaraFig({ d, h, humeda, seca }: { d: number; h: number; humeda: number; seca: number }) {
  const H = 96;
  const yAgua = 18 + H * (1 - Math.min(humeda / Math.max(h, 0.01), 1));
  const ySeca = 18 + H * (1 - Math.min((humeda + seca) / Math.max(h, 0.01), 1));
  return (
    <svg className="lz-hid-fig" viewBox="0 0 420 150" role="img" aria-label="Sección de la cámara húmeda">
      <ellipse cx="78" cy="74" rx="46" ry="46" fill="#d5e3ea" stroke="#1a1a1a" />
      <text x="78" y="78" textAnchor="middle" fontSize="11">Ø {d.toFixed(2)} m</text>
      <rect x="168" y="18" width="48" height={H} fill="#f4f7f8" stroke="#1a1a1a" />
      <rect x="168" y={yAgua} width="48" height={18 + H - yAgua} fill="#c5d7e2" stroke="none" />
      <line x1="168" y1={yAgua} x2="216" y2={yAgua} stroke="#1a1a1a" />
      <line x1="168" y1={ySeca} x2="216" y2={ySeca} stroke="#1a1a1a" />
      <text x="230" y="42" fontSize="12">Altura total {h.toFixed(2)} m</text>
      <text x="230" y="64" fontSize="12">Húmeda {humeda.toFixed(2)} m</text>
      <text x="230" y="86" fontSize="12">Seca y operativa sobre el agua</text>
      <text x="230" y="108" fontSize="12">Volumen adoptado / área</text>
    </svg>
  );
}

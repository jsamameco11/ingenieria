import { useEffect, useMemo, useState } from "react";
import { LotizacionPlano, aristaCercana } from "../components/LotizacionPlano";
import { dist, fmtCoord, fmtM } from "../lib/lotizacion/geom";
import { trazosDe } from "../lib/lotizacion/dibujo";
import { descargarTexto, dxfDe, imprimirA1 } from "../lib/lotizacion/exportar";
import { leerArchivoPerimetro } from "../lib/lotizacion/importar";
import { proponer, referenciaDensidad } from "../lib/lotizacion/modelo";
import {
  ESTRUCTURA_EXPEDIENTE,
  LOTES_VIVIENDA,
  NORMA,
  anchoSeccion,
  criteriosDeNorma,
  etiquetaVia,
  firmar,
  radioEsquina,
  seccionPorTipo,
  maxManzana,
  nid,
  proyectoVacio,
  puntosEjemplo,
  pavimentoVacio,
  viaVacia,
} from "../lib/lotizacion/norma";
import { svgSeccion } from "../lib/lotizacion/seccionVia";
import type { CategoriaParque, Criterios, EstiloParque, Ingreso, Modelo, ModoParque, Pavimento, ProyectoLot, Punto, Seccion, TipoHab, TipoVia, ViaCampo, ViaExistente, ViaInterna } from "../lib/lotizacion/tipos";

const PASOS = ["Perímetro", "Emplazamiento", "Vías existentes", "Ingresos", "Criterios GH.020", "Confirmación", "Plano"] as const;

const CAMPOS: { k: ViaCampo; label: string; ayuda: string }[] = [
  { k: "pia", label: "PIA — interno de acera", ayuda: "Contacto con el terreno" },
  { k: "pea", label: "PEA — externo de acera", ayuda: "Contacto con la calzada" },
  { k: "eje", label: "Eje de la vía", ayuda: "Eje para el empalme" },
  { k: "pea2", label: "PEA' — externo opuesto", ayuda: "Acera del otro frente" },
  { k: "pia2", label: "PIA' — interno opuesto", ayuda: "Límite exterior de la sección" },
];

function numTxt(v: string): number | null {
  const t = v.trim().replace(",", ".");
  if (!t || t === "-" || t === "." || t === "-.") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function NumBox({ value, onChange, allowEmpty = false }: { value: number | null; onChange: (n: number | null) => void; allowEmpty?: boolean }) {
  const [txt, setTxt] = useState<string | null>(null);
  const shown = txt ?? (value === null ? "" : String(value));
  return (
    <input
      value={shown}
      inputMode="decimal"
      onFocus={() => setTxt(value === null ? "" : String(value))}
      onChange={(e) => {
        const t = e.target.value.replace(",", ".");
        if (t !== "" && !/^-?\d*\.?\d*$/.test(t)) return;
        setTxt(t);
        if (t === "") {
          if (allowEmpty) onChange(null);
          return;
        }
        const n = numTxt(t);
        if (n !== null && !t.endsWith(".")) onChange(n);
      }}
      onBlur={() => {
        if (txt !== null) {
          const n = numTxt(txt);
          if (n !== null) onChange(n);
          else if (allowEmpty && txt.trim() === "") onChange(null);
        }
        setTxt(null);
      }}
    />
  );
}

export function LotizacionModule() {
  const [proy, setProy] = useState<ProyectoLot>(() => proyectoVacio());
  const [plano, setPlano] = useState<ProyectoLot>(() => proyectoVacio());
  const [menu, setMenu] = useState(false);
  const [paso, setPaso] = useState(0);
  const [aviso, setAviso] = useState("Terreno vacío. Cargue un CSV, un DXF de AutoCAD o digite los vértices.");
  const [pick, setPick] = useState<{ id: string; campo: ViaCampo } | null>(null);
  const [marcarArista, setMarcarArista] = useState(false);
  const [arista, setArista] = useState(0);
  const [distancia, setDistancia] = useState(20);
  const [anchoIng, setAnchoIng] = useState(8);
  const [nombreIng, setNombreIng] = useState("Ingreso principal");
  const [acepto, setAcepto] = useState(false);
  const [firmaOk, setFirmaOk] = useState("");
  const [pega, setPega] = useState("");
  const [viaSel, setViaSel] = useState("");

  const modelo = useMemo(() => proponer(plano), [plano]);
  const firma = useMemo(() => firmar(plano), [plano]);
  const sucio = firmar(proy) !== firma;
  const emitido = firmaOk !== "" && firmaOk === firma;
  const trazos = useMemo(() => trazosDe(modelo), [modelo]);
  const desfasado = firmaOk !== "" && firmaOk !== firma;
  const falla = modelo.verificaciones.some((v) => v.estado === "no-cumple");
  const alcance = modelo.verificaciones.find((v) => v.id === "alcance");
  const c = proy.criterios;
  const pav = proy.pavimento ?? pavimentoVacio();
  const borde = modelo.lindero;
  const largoArista = borde.length > arista ? dist(borde[arista], borde[(arista + 1) % borde.length]) : 0;

  useEffect(() => {
    setPlano((pl) => {
      if (
        pl.puntos === proy.puntos &&
        pl.cierre === proy.cierre &&
        pl.vias === proy.vias &&
        pl.ingresos === proy.ingresos &&
        pl.sinIngreso === proy.sinIngreso
      ) {
        return pl;
      }
      return {
        ...pl,
        puntos: proy.puntos,
        cierre: proy.cierre,
        vias: proy.vias,
        ingresos: proy.ingresos,
        sinIngreso: proy.sinIngreso,
      };
    });
  }, [proy.puntos, proy.cierre, proy.vias, proy.ingresos, proy.sinIngreso]);

  const dibujar = () => {
    setPlano(structuredClone(proy));
    setAviso("Plano dibujado. Los cortes A-A y las secciones usan estos datos.");
  };

  const setC = (patch: Partial<Criterios>) => setProy((p) => ({ ...p, criterios: { ...p.criterios, ...patch } }));
  const fijarParque = (clave: string, patch: { categoria?: CategoriaParque; estilo?: EstiloParque }) => {
    const aplicar = (p: ProyectoLot): ProyectoLot => {
      const prev = (p.parques ?? []).find((a) => a.clave === clave);
      const categoria = patch.categoria ?? prev?.categoria ?? "pasiva";
      const estilo = patch.estilo ?? prev?.estilo;
      return {
        ...p,
        parques: [...(p.parques ?? []).filter((a) => a.clave !== clave), { clave, categoria, ...(estilo ? { estilo } : {}) }],
      };
    };
    setProy(aplicar);
    setPlano(aplicar);
  };
  const fijarModoParque = (modoParque: ModoParque) => {
    const aplicar = (p: ProyectoLot): ProyectoLot => ({ ...p, modoParque });
    setProy(aplicar);
    setPlano(aplicar);
  };
  const setPav = (patch: Partial<Pavimento>) =>
    setProy((p) => ({ ...p, pavimento: { ...(p.pavimento ?? pavimentoVacio()), ...patch } }));
  const setMeta = (k: keyof ProyectoLot["meta"], v: string) => setProy((p) => ({ ...p, meta: { ...p.meta, [k]: v } }));

  const aplicarNorma = (tipoHab: TipoHab, densidad: Criterios["tipoDensidad"], via: TipoVia, limpiarVias = false) => {
    setProy((p) => ({
      ...p,
      ajustesVias: limpiarVias ? [] : (p.ajustesVias ?? []),
      criterios: {
        ...p.criterios,
        tipoHab,
        tipoDensidad: densidad,
        tipoVia: via,
        ...criteriosDeNorma(tipoHab, densidad, via),
      },
    }));
  };

  const onMundo = (pt: { e: number; n: number }) => {
    if (pick) {
      const campo = pick.campo;
      const id = pick.id;
      setProy((p) => ({
        ...p,
        vias: p.vias.map((v) =>
          v.id === id
            ? { ...v, [campo]: { num: String(CAMPOS.findIndex((c0) => c0.k === campo) + 1), e: Number(pt.e.toFixed(3)), n: Number(pt.n.toFixed(3)) } }
            : v,
        ),
      }));
      setPick(null);
      setAviso("Punto tomado del plano. Puede afinar Este y Norte en la tabla.");
      return;
    }
    if (!borde.length) return;
    const hit = aristaCercana(borde, pt.e, pt.n);
    if (!hit) return;
    if (marcarArista || paso === 3) {
      if (hit.distM < Math.max(12, (modelo.areaBruta > 0 ? Math.sqrt(modelo.areaBruta) : 40) * 0.15)) {
        setArista(hit.edge);
        setDistancia(Number(hit.along.toFixed(2)));
        setMarcarArista(false);
        setAviso(`Arista ${hit.edge + 1}, a ${hit.along.toFixed(2)} m del vértice ${hit.edge + 1}.`);
      }
    }
  };

  const cargar = async (file: File) => {
    const leido = await leerArchivoPerimetro(file);
    if (!leido.puntos.length) {
      setAviso(leido.aviso);
      return;
    }
    setProy((p) => ({ ...p, puntos: leido.puntos }));
    setAviso(leido.aviso);
    setArista(0);
  };

  const pegarTabla = () => {
    const filas = pega
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    const puntos: Punto[] = [];
    for (const linea of filas) {
      const celdas = linea.split(/[;\t,]/).map((x) => x.trim()).filter((x) => x !== "");
      if (celdas.length < 2) continue;
      if (/num|este|norte/i.test(celdas.join(" "))) continue;
      const nums = celdas.map((x) => numTxt(x));
      if (celdas.length >= 3 && nums[1] !== null && nums[2] !== null) {
        puntos.push({ num: celdas[0], e: nums[1], n: nums[2] });
      } else if (nums[0] !== null && nums[1] !== null) {
        puntos.push({ num: String(puntos.length + 1), e: nums[0], n: nums[1] });
      }
    }
    if (puntos.length < 3) {
      setAviso("Pegue al menos tres filas Numero, Este, Norte.");
      return;
    }
    setProy((p) => ({ ...p, puntos }));
    setAviso(`${puntos.length} vértices pegados.`);
    setPega("");
  };

  const confirmar = () => {
    if (!acepto || !modelo.ok || sucio) return;
    setFirmaOk(firma);
    setPaso(6);
    setAviso("Estructura confirmada. El plano queda emitido para PDF A1 y DXF.");
  };

  const ancho = anchoSeccion(c.seccion);
  const seccionBorrador = svgSeccion(c.seccion, pav, "SECCIÓN TIPO", etiquetaVia(c.tipoVia));

  return (
    <div className="lz-app">
      <header className="lz-head">
        <div>
          <p className="lz-kicker">{NORMA}</p>
          <h2>Lotización urbana</h2>
        </div>
        <div className="lz-head-tools">
          <button type="button" className="btn lz-dibujar" onClick={dibujar}>Dibujar</button>
          <div className="lz-menu">
            <button type="button" className="btn secondary" aria-expanded={menu} onClick={() => setMenu((v) => !v)}>Opciones</button>
            {menu ? (
              <div className="lz-menu-list" role="menu">
                {PASOS.map((nombre, i) => (
                  <button
                    key={nombre}
                    type="button"
                    role="menuitem"
                    className={i === paso ? "is-on" : emitido && i === 6 ? "is-done" : ""}
                    onClick={() => { setPaso(i); setMenu(false); }}
                  >
                    <i>{i + 1}</i>
                    {nombre}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </header>
      {sucio ? <p className="lz-banner">Hay datos sin dibujar. Escriba los valores y pulse Dibujar para redibujar el plano y los cortes.</p> : null}
      {desfasado ? <p className="lz-banner">Cambió un dato del modelo. Vuelva a confirmar antes de exportar.</p> : null}
      {aviso ? <p className="lz-aviso">{aviso}</p> : null}
      {alcance ? <p className="lz-aviso">{alcance.texto}</p> : null}
      <div className="lz-body">
        <div className="lz-side">
          {paso === 0 && (
            <section>
              <h3>Perímetro del terreno</h3>
              <p>Tres vías de ingreso, siempre con número de vértice, Este y Norte. El DXF toma la polilínea cerrada de mayor área.</p>
              <div className="lz-meta">
                <label>Proyecto<input value={proy.meta.proyecto} onChange={(e) => setMeta("proyecto", e.target.value)} /></label>
                <label>Distrito<input value={proy.meta.distrito} onChange={(e) => setMeta("distrito", e.target.value)} /></label>
                <label>Provincia<input value={proy.meta.provincia} onChange={(e) => setMeta("provincia", e.target.value)} /></label>
                <label>Ubicación<input value={proy.meta.ubicacion} onChange={(e) => setMeta("ubicacion", e.target.value)} /></label>
              </div>
              <div className="lz-files">
                <label className="btn secondary">
                  CSV o Excel
                  <input
                    type="file"
                    accept=".csv,.txt,.xlsx,.xls"
                    hidden
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void cargar(f);
                      e.target.value = "";
                    }}
                  />
                </label>
                <label className="btn secondary">
                  AutoCAD DXF / DWG
                  <input
                    type="file"
                    accept=".dxf,.dwg"
                    hidden
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void cargar(f);
                      e.target.value = "";
                    }}
                  />
                </label>
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() => {
                    setProy((p) => ({ ...p, puntos: puntosEjemplo() }));
                    setAviso("Terreno de ejemplo. Reemplácelo con el perímetro del expediente.");
                  }}
                >
                  Ejemplo
                </button>
              </div>
              <p className="lz-hint">DWG binario: en AutoCAD use Guardar como → DXF. El archivo queda en metros, Este = X y Norte = Y. Cada lado entre vértices, y el recinto en Este y en Norte, se limitan a 3 200 m.</p>
              <label className="lz-block">
                Pegar Numero, Este, Norte
                <textarea value={pega} onChange={(e) => setPega(e.target.value)} rows={4} placeholder={"1;1000.000;5000.000\n2;1200.000;5000.000"} />
              </label>
              <button type="button" className="btn secondary" onClick={pegarTabla}>
                Usar el pegado
              </button>
              <div className="lz-row">
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() =>
                    setProy((p) => ({
                      ...p,
                      puntos: [...p.puntos, { num: String(p.puntos.length + 1), e: (p.puntos.at(-1)?.e ?? 0) + 10, n: p.puntos.at(-1)?.n ?? 0 }],
                    }))
                  }
                >
                  Agregar vértice
                </button>
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() => setProy((p) => ({ ...p, puntos: p.puntos.map((q) => ({ ...q, e: q.n, n: q.e })) }))}
                >
                  Invertir E / N
                </button>
              </div>
              <table className="lz-table">
                <thead>
                  <tr>
                    <th>N.°</th>
                    <th>Este</th>
                    <th>Norte</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {proy.puntos.map((q, i) => (
                    <tr key={`${q.num}-${i}`}>
                      <td>
                        <input
                          value={q.num}
                          onChange={(e) =>
                            setProy((p) => ({ ...p, puntos: p.puntos.map((pt, j) => (j === i ? { ...pt, num: e.target.value } : pt)) }))
                          }
                        />
                      </td>
                      <td>
                        <NumBox value={q.e} onChange={(n) => { if (n === null) return; setProy((p) => ({ ...p, puntos: p.puntos.map((pt, j) => (j === i ? { ...pt, e: n } : pt)) })); }} />
                      </td>
                      <td>
                        <NumBox value={q.n} onChange={(n) => { if (n === null) return; setProy((p) => ({ ...p, puntos: p.puntos.map((pt, j) => (j === i ? { ...pt, n } : pt)) })); }} />
                      </td>
                      <td>
                        <button type="button" className="lz-x" onClick={() => setProy((p) => ({ ...p, puntos: p.puntos.filter((_, j) => j !== i) }))} aria-label="Quitar vértice">
                          ×
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          {paso === 1 && (
            <section>
              <h3>Tipo de habilitación</h3>
              <p>GH.020 Art. 2, 5 y 6. La vía es de uso público. Lo que cambia es si el predio se cierra o continúa la trama.</p>
              <div className="lz-choice">
                <button type="button" className={proy.cierre === "cercada" ? "is-on" : ""} onClick={() => setProy((p) => ({ ...p, cierre: "cercada" }))}>
                  <strong>Cercada</strong>
                  <span>Cerco sobre el lindero. Los vanos existen solo donde se proyecta un ingreso.</span>
                </button>
                <button type="button" className={proy.cierre === "abierta" ? "is-on" : ""} onClick={() => setProy((p) => ({ ...p, cierre: "abierta" }))}>
                  <strong>Abierta</strong>
                  <span>Empalma y continúa las habilitaciones colindantes. El rumbo de la trama sigue la vía preexistente.</span>
                </button>
              </div>
            </section>
          )}

          {paso === 2 && (
            <section>
              <h3>Vías preexistentes</h3>
              <p>Cinco puntos de la sección, en este orden, con coordenada exacta. Sirven para empalmar la calzada proyectada.</p>
              <button
                type="button"
                className="btn secondary"
                onClick={() => setProy((p) => ({ ...p, vias: [...p.vias, viaVacia(p.vias.length ? `Vía ${p.vias.length + 1}` : "Vía existente")] }))}
              >
                Agregar vía
              </button>
              {proy.vias.map((via) => (
                <ViaForm
                  key={via.id}
                  via={via}
                  pick={pick}
                  onPick={(campo) => {
                    setPick({ id: via.id, campo });
                    setAviso(`Marque en el plano: ${CAMPOS.find((c0) => c0.k === campo)?.label}.`);
                  }}
                  onChange={(next) => setProy((p) => ({ ...p, vias: p.vias.map((v) => (v.id === via.id ? next : v)) }))}
                  onRemove={() => setProy((p) => ({ ...p, vias: p.vias.filter((v) => v.id !== via.id) }))}
                />
              ))}
              {!proy.vias.length ? <p className="lz-hint">Si no hay vía por empalmar, continúe. En una habilitación abierta el plano lo dejará observado.</p> : null}
            </section>
          )}

          {paso === 3 && (
            <section>
              <h3>Ingresos</h3>
              <label className="lz-check">
                <input type="checkbox" checked={proy.sinIngreso} onChange={(e) => setProy((p) => ({ ...p, sinIngreso: e.target.checked }))} />
                Esta habilitación no lleva pórtico de ingreso
              </label>
              {!proy.sinIngreso && (
                <>
                  <p>Elija una arista del perímetro y la distancia desde su vértice inicial hasta el eje del ingreso.</p>
                  <label className="lz-block">
                    Arista
                    <select value={arista} onChange={(e) => setArista(Number(e.target.value))}>
                      {borde.map((a, i) => {
                        const b = borde[(i + 1) % borde.length];
                        return (
                          <option key={i} value={i}>
                            {i + 1}: vértice {i + 1} → {(i + 1) % borde.length + 1} · {fmtM(dist(a, b), 2)} m
                          </option>
                        );
                      })}
                    </select>
                  </label>
                  <button type="button" className={`btn secondary${marcarArista ? " is-on" : ""}`} onClick={() => setMarcarArista(true)}>
                    {marcarArista ? "Pulse la arista en el plano" : "Seleccionar arista en el plano"}
                  </button>
                  <div className="lz-meta">
                    <label>
                      Nombre
                      <input value={nombreIng} onChange={(e) => setNombreIng(e.target.value)} />
                    </label>
                    <label>
                      Distancia desde el vértice (m)
                      <NumBox value={distancia} onChange={(n) => { if (n !== null) setDistancia(n); }} />
                    </label>
                    <label>
                      Ancho del vano (m)
                      <NumBox value={anchoIng} onChange={(n) => { if (n !== null) setAnchoIng(n); }} />
                    </label>
                  </div>
                  <p className="lz-hint">
                    Arista {borde.length ? arista + 1 : "—"} · longitud {fmtM(largoArista, 2)} m · el vano queda centrado en la distancia indicada.
                  </p>
                  <button
                    type="button"
                    className="btn"
                    disabled={!borde.length || distancia < 0 || distancia > largoArista + 0.01}
                    onClick={() => {
                      const ing: Ingreso = {
                        id: nid("ing"),
                        nombre: nombreIng || "Ingreso",
                        arista,
                        distancia,
                        ancho: anchoIng,
                      };
                      setProy((p) => ({ ...p, ingresos: [...p.ingresos, ing], sinIngreso: false }));
                      setNombreIng(`Ingreso ${proy.ingresos.length + 2}`);
                    }}
                  >
                    Agregar ingreso
                  </button>
                  <ul className="lz-list">
                    {proy.ingresos.map((ing) => (
                      <li key={ing.id}>
                        <span>
                          {ing.nombre}: arista {ing.arista + 1}, a {fmtM(ing.distancia, 2)} m, vano {fmtM(ing.ancho, 2)} m
                        </span>
                        <button type="button" className="lz-x" onClick={() => setProy((p) => ({ ...p, ingresos: p.ingresos.filter((x) => x.id !== ing.id) }))}>
                          ×
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>
          )}

          {paso === 4 && (
            <section>
              <h3>Estructura de diseño</h3>
              <p>{referenciaDensidad(c)}. Los cuadros de TH.010 son la referencia; la municipalidad provincial puede redistribuir aportes sin bajar el porcentaje total.</p>
              <label className="lz-block">
                Tipo de habilitación
                <select
                  value={c.tipoHab}
                  onChange={(e) => aplicarNorma(e.target.value as TipoHab, c.tipoDensidad, c.tipoVia)}
                >
                  <option value="vivienda">Vivienda — TH.010</option>
                  <option value="vivienda-taller">Vivienda taller — asimilada al tipo 3</option>
                  <option value="club">Vivienda tipo club</option>
                  <option value="comercio">Comercio exclusivo — sin aporte obligatorio</option>
                  <option value="industrial">Industrial — TH.030</option>
                  <option value="especial">Usos especiales — sin aporte obligatorio</option>
                </select>
              </label>
              {c.tipoHab === "vivienda" && (
                <label className="lz-block">
                  Tipo de densidad TH.010 Art. 9
                  <select
                    value={c.tipoDensidad}
                    onChange={(e) => aplicarNorma(c.tipoHab, Number(e.target.value) as Criterios["tipoDensidad"], c.tipoVia)}
                  >
                    {LOTES_VIVIENDA.map((f) => (
                      <option key={f.tipo} value={f.tipo}>
                        Tipo {f.tipo} · {f.nota} · lote {f.area || "s/mín"} m² · frente {f.frente || "s/mín"} m
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <p className="lz-hint">Elija la sección, escriba los datos con decimales si hace falta y pulse Dibujar. El plano no cambia mientras tipea.</p>
              <div className="lz-opciones">
                {(["local-secundaria", "local-principal", "acceso-exclusivo"] as TipoVia[]).map((via) => {
                  const sec = seccionPorTipo(via);
                  return (
                    <button
                      key={via}
                      type="button"
                      className={c.tipoVia === via && !(proy.ajustesVias ?? []).length ? "is-on" : ""}
                      onClick={() => aplicarNorma(c.tipoHab, c.tipoDensidad, via, true)}
                    >
                      <strong>{etiquetaVia(via)}</strong>
                      <span>Sección {fmtM(anchoSeccion(sec), 2)} m · radio de acera {fmtM(radioEsquina(via), 2)} m. Se aplica al pulsar Dibujar.</span>
                    </button>
                  );
                })}
              </div>
              <label className="lz-block">
                Vía interna por defecto
                <select value={c.tipoVia} onChange={(e) => aplicarNorma(c.tipoHab, c.tipoDensidad, e.target.value as TipoVia, true)}>
                  <option value="local-secundaria">Local secundaria — Art. 10</option>
                  <option value="local-principal">Local principal — Art. 9</option>
                  <option value="acceso-exclusivo">Acceso exclusivo — Art. 11, sección 7.20 m</option>
                </select>
              </label>
              <div className="lz-meta">
                <label>Vereda (m)<NumBox value={c.seccion.vereda} onChange={(n) => { if (n !== null) setC({ seccion: { ...c.seccion, vereda: n } }); }} /></label>
                <label>
                  Veredas
                  <select value={c.seccion.nVeredas} onChange={(e) => setC({ seccion: { ...c.seccion, nVeredas: Number(e.target.value) as 1 | 2 } })}>
                    <option value={1}>Un lado</option>
                    <option value={2}>Ambos lados</option>
                  </select>
                </label>
                <label>Módulo de calzada (m)<NumBox value={c.seccion.moduloCalzada} onChange={(n) => { if (n !== null) setC({ seccion: { ...c.seccion, moduloCalzada: n } }); }} /></label>
                <label>Estacionamiento (m)<NumBox value={c.seccion.estacionamiento} onChange={(n) => { if (n !== null) setC({ seccion: { ...c.seccion, estacionamiento: n } }); }} /></label>
                <label>
                  Franjas de estacionamiento
                  <select value={c.seccion.nEstacionamientos} onChange={(e) => setC({ seccion: { ...c.seccion, nEstacionamientos: Number(e.target.value) as 0 | 1 | 2 } })}>
                    <option value={0}>Ninguna</option>
                    <option value={1}>Una</option>
                    <option value={2}>Ambas</option>
                  </select>
                </label>
                <label>Separador central (m)<NumBox value={c.seccion.separador} onChange={(n) => { if (n !== null) setC({ seccion: { ...c.seccion, separador: n } }); }} /></label>
                <label>Longitud objetivo de manzana (m)<NumBox value={c.largoManzana} onChange={(n) => { if (n !== null) setC({ largoManzana: n }); }} /></label>
                <label>Frente mínimo de lote (m)<NumBox value={c.frenteMin} onChange={(n) => { if (n !== null) setC({ frenteMin: n }); }} /></label>
                <label>Área mínima de lote (m²)<NumBox value={c.areaMin} onChange={(n) => { if (n !== null) setC({ areaMin: n }); }} /></label>
                <label>Profundidad de lote (m)<NumBox value={c.profundidad} onChange={(n) => { if (n !== null) setC({ profundidad: n }); }} /></label>
                <label>Recreación pública (%)<NumBox value={c.aporteRec + c.aporteParque} onChange={(n) => { if (n !== null) setC({ aporteRec: n, aporteParque: 0 }); }} /></label>
                <label>Educación (%)<NumBox value={c.aporteEdu} onChange={(n) => { if (n !== null) setC({ aporteEdu: n }); }} /></label>
                <label>Otros fines (%)<NumBox value={c.aporteOtros} onChange={(n) => { if (n !== null) setC({ aporteOtros: n }); }} /></label>
                <label>Lote normativo de aporte (m²)<NumBox value={c.loteNormativo} onChange={(n) => { if (n !== null) setC({ loteNormativo: n }); }} /></label>
                <label>Cesión vías expresa, arterial y colectora (m²)<NumBox value={c.cesionPrimaria} onChange={(n) => { if (n !== null) setC({ cesionPrimaria: n }); }} /></label>
                <label>Reserva regional o provincial (m²)<NumBox value={c.reservaRegional} onChange={(n) => { if (n !== null) setC({ reservaRegional: n }); }} /></label>
                <label>Servidumbre de alta tensión (m²)<NumBox value={c.servidumbreAT} onChange={(n) => { if (n !== null) setC({ servidumbreAT: n }); }} /></label>
                <label>
                  Calidad de obras
                  <select value={c.calidad} onChange={(e) => setC({ calidad: e.target.value as Criterios["calidad"] })}>
                    {["A", "B", "C", "D", "E", "F"].map((q) => (
                      <option key={q} value={q}>Tipo {q}</option>
                    ))}
                  </select>
                </label>
              </div>
              <p className="lz-hint">Parques zonales quedan dentro de recreación pública. Educación y otros fines no bajan de 400 m². El lote usa el frente y el fondo mínimos del área.</p>
              {c.tipoVia === "acceso-exclusivo" ? (
                <label className="lz-check">
                  <input type="checkbox" checked={c.accesoUnico} onChange={(e) => setC({ accesoUnico: e.target.checked })} />
                  Acceso único (máximo 50 m; plazoleta de volteo Ø 12 m — Art. 13)
                </label>
              ) : null}
              <p className="lz-hint">
                {etiquetaVia(c.tipoVia)} · sección {fmtM(ancho, 2)} m · manzana máxima normativa {maxManzana(c) >= 1000 ? "no aplica el tope de 400 m (TH.030 tipo 4)" : `${maxManzana(c)} m`}
              </p>
              <svg className="lz-seccion-pro" viewBox={seccionBorrador.viewBox} role="img" aria-label="Sección tipo de la vía" dangerouslySetInnerHTML={{ __html: seccionBorrador.body }} />
              <h4>Carpetas del pavimento</h4>
              <p className="lz-hint">Espesores del corte, en metros. Entran al plano y al A1 al pulsar Dibujar.</p>
              <div className="lz-meta">
                <label>Carpeta asfáltica (m)<NumBox value={pav.carpeta} onChange={(n) => { if (n !== null) setPav({ carpeta: n }); }} /></label>
                <label>Base (m)<NumBox value={pav.base} onChange={(n) => { if (n !== null) setPav({ base: n }); }} /></label>
                <label>Subbase (m)<NumBox value={pav.subbase} onChange={(n) => { if (n !== null) setPav({ subbase: n }); }} /></label>
                <label>Espesor de vereda (m)<NumBox value={pav.veredaEsp} onChange={(n) => { if (n !== null) setPav({ veredaEsp: n }); }} /></label>
                <label>Sardinel (m)<NumBox value={pav.sardinel} onChange={(n) => { if (n !== null) setPav({ sardinel: n }); }} /></label>
              </div>
              <CortesPanel modelo={modelo} />
              <EditorVia
                vias={modelo.viasInternas}
                sel={viaSel}
                tipo={((proy.ajustesVias ?? []).find((a) => a.id === viaSel)?.tipo) ?? modelo.viasInternas.find((v) => v.id === viaSel)?.tipo ?? c.tipoVia}
                seccion={((proy.ajustesVias ?? []).find((a) => a.id === viaSel)?.seccion) ?? c.seccion}
                onSel={setViaSel}
                onChange={(tipo, seccion) => {
                  if (!viaSel) return;
                  setProy((p) => ({
                    ...p,
                    ajustesVias: [...(p.ajustesVias ?? []).filter((a) => a.id !== viaSel), { id: viaSel, tipo, seccion }],
                  }));
                }}
                onSoltar={() => setProy((p) => ({ ...p, ajustesVias: (p.ajustesVias ?? []).filter((a) => a.id !== viaSel) }))}
              />
            </section>
          )}

          {paso === 5 && (
            <section>
              <h3>Confirmación previa al plano</h3>
              <p>Revise la estructura. El plano definitivo y la exportación se habilitan al aceptar.</p>
              <dl className="lz-dl">
                <div><dt>Área bruta</dt><dd>{fmtM(modelo.areaBruta, 2)} m²</dd></div>
                <div><dt>Perímetro</dt><dd>{fmtM(modelo.perimetro, 2)} m · {proy.puntos.length} vértices</dd></div>
                <div><dt>Cierre</dt><dd>{proy.cierre === "abierta" ? "Abierta" : "Cercada"}</dd></div>
                <div><dt>Manzana de diseño</dt><dd>{fmtM(modelo.largoManzana, 2)} m</dd></div>
                <div><dt>Profundidad de lote</dt><dd>{fmtM(modelo.profundidad, 2)} m</dd></div>
                <div><dt>Sección vial</dt><dd>{fmtM(modelo.seccionTotal, 2)} m</dd></div>
                <div><dt>Manzanas / lotes</dt><dd>{modelo.nManzanas} / {modelo.lotes.filter((l) => l.uso === "vivienda").length}</dd></div>
                <div><dt>Área base de aportes</dt><dd>{fmtM(modelo.areaBaseAporte, 0)} m²</dd></div>
              </dl>
              <h4>Vías preexistentes</h4>
              {modelo.viasExistentes.length ? modelo.viasExistentes.map((v) => (
                <div key={v.nombre} className="lz-block-note">
                  <strong>{v.nombre}</strong>
                  <ul>
                    {v.lineas.map((ln) => (
                      <li key={ln.nombre}>{ln.nombre}: E {fmtCoord(ln.p.x)} · N {fmtCoord(ln.p.y)}</li>
                    ))}
                    {v.anchos.map((a) => (
                      <li key={a.etiqueta}>{a.etiqueta}: {fmtM(a.metros, 2)} m</li>
                    ))}
                  </ul>
                </div>
              )) : <p className="lz-hint">No se cargaron vías preexistentes.</p>}
              <h4>Expediente GH.020 Art. 54–60</h4>
              <ul className="lz-list">
                {ESTRUCTURA_EXPEDIENTE.map((item) => (
                  <li key={item.item}><b>{item.norma}.</b> {item.item} <em>{item.lamina}</em></li>
                ))}
              </ul>
              <h4>Verificación</h4>
              <ul className="lz-checks">
                {modelo.verificaciones.map((v) => (
                  <li key={v.id} data-estado={v.estado}>
                    <b>{v.estado === "cumple" ? "Cumple" : v.estado === "no-cumple" ? "No cumple" : v.estado === "observacion" ? "Observación" : "Nota"}</b>
                    <span>{v.norma}. {v.texto}</span>
                    <small>{v.valor}</small>
                  </li>
                ))}
              </ul>
              {!modelo.ok ? <p className="lz-bad">El modelo no puede emitirse: corrija el perímetro o la sección antes de confirmar.</p> : null}
              {falla && modelo.ok ? <p className="lz-bad">Hay controles que no cumplen. Si confirma, esas observaciones quedan en la lámina y en el DXF no se ocultan.</p> : null}
              <label className="lz-check">
                <input type="checkbox" checked={acepto} onChange={(e) => setAcepto(e.target.checked)} />
                Confirmo que el perímetro, el tipo de habilitación, las vías, los ingresos y la estructura normativa están correctamente definidos.
              </label>
              <button type="button" className="btn" disabled={!acepto || !modelo.ok} onClick={confirmar}>
                Confirmar y emitir el plano
              </button>
            </section>
          )}

          {paso === 6 && (
            <section>
              <h3>Plano emitido</h3>
              {!emitido ? (
                <p className="lz-bad">Falta la confirmación del paso anterior, o los datos cambiaron después de emitir.</p>
              ) : (
                <p>Lámina de trazado y lotización. El DXF está en coordenadas reales, en metros, para abrir en AutoCAD y guardar como DWG.</p>
              )}
              <div className="lz-meta">
                <label>Propietario<input value={proy.meta.propietario} onChange={(e) => setMeta("propietario", e.target.value)} /></label>
                <label>Profesional<input value={proy.meta.profesional} onChange={(e) => setMeta("profesional", e.target.value)} /></label>
                <label>CIP<input value={proy.meta.cip} onChange={(e) => setMeta("cip", e.target.value)} /></label>
                <label>Fecha<input value={proy.meta.fecha} onChange={(e) => setMeta("fecha", e.target.value)} /></label>
                <label>Lámina<input value={proy.meta.lamina} onChange={(e) => setMeta("lamina", e.target.value)} /></label>
              </div>
              <div className="lz-files">
                <button type="button" className="btn" disabled={!emitido} onClick={() => imprimirA1(modelo, proy.meta)}>
                  Exportar PDF A1
                </button>
                <button
                  type="button"
                  className="btn secondary"
                  disabled={!emitido}
                  onClick={() => descargarTexto(`${(proy.meta.lamina || "U-01").replace(/\s+/g, "-")}-lotizacion.dxf`, dxfDe(modelo, proy.meta), "application/dxf")}
                >
                  Exportar DWG (DXF)
                </button>
              </div>
              <p className="lz-hint">En el diálogo de impresión elija tamaño A1 horizontal y escala real. El DXF trae la manzana (MC-MANZANA), el ochavo recto (MC-OCHAVO) y el martillo del sardinel con su radio (MC-VEREDA).</p>
              <table className="lz-table">
                <thead>
                  <tr>
                    <th>Lote</th>
                    <th>Frente</th>
                    <th>Prof.</th>
                    <th>Área</th>
                  </tr>
                </thead>
                <tbody>
                  {modelo.lotes.filter((l) => l.uso === "vivienda").slice(0, 160).map((l) => (
                    <tr key={l.id}>
                      <td>{l.id}</td>
                      <td>{fmtM(l.frente, 2)}</td>
                      <td>{fmtM(l.profundidad, 2)}</td>
                      <td>{fmtM(l.area, 2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}
          {modelo.parques.length > 0 && (
            <section>
              <h3>Parques</h3>
              <p>GH.020 Art. 29 y Art. 56.e. El parque se arma dentro del perímetro: primero los recorridos, después plaza, juegos, descanso y vegetación. La losa deportiva solo entra si cabe entera.</p>
              <div className="lz-choice">
                <button type="button" className={(plano.modoParque ?? "lotes") === "manzana" ? "is-on" : ""} onClick={() => fijarModoParque("manzana")}>
                  <strong>Una manzana</strong>
                  <span>El parque ocupa la manzana completa. No quedan lotes de vivienda a su costado.</span>
                </button>
                <button type="button" className={(plano.modoParque ?? "lotes") === "lotes" ? "is-on" : ""} onClick={() => fijarModoParque("lotes")}>
                  <strong>Con lotes aledaños</strong>
                  <span>El parque toma el área exigida y deja lotes de vivienda en la misma manzana.</span>
                </button>
              </div>
              {modelo.parques.map((pk) => (
                <div key={pk.clave} className="lz-block-note">
                  <strong>{pk.nombre}</strong>
                  <span> · {fmtM(pk.area, 0)} m²</span>
                  <p>{pk.nota}</p>
                  <div className="lz-choice">
                    <button
                      type="button"
                      className={pk.categoria === "pasiva" ? "is-on" : ""}
                      onClick={() => fijarParque(pk.clave, { categoria: "pasiva" })}
                    >
                      <strong>Recreación pasiva</strong>
                      <span>Plaza, senderos, descanso y vegetación, sin losa.</span>
                    </button>
                    <button
                      type="button"
                      className={pk.categoria === "activa" ? "is-on" : ""}
                      onClick={() => fijarParque(pk.clave, { categoria: "activa" })}
                    >
                      <strong>Recreación activa</strong>
                      <span>Losa si el paño la admite, más juegos y recorridos.</span>
                    </button>
                    {(["organico", "geometrico", "lineal"] as EstiloParque[]).map((est) => (
                      <button
                        key={est}
                        type="button"
                        className={pk.estilo === est ? "is-on" : ""}
                        onClick={() => fijarParque(pk.clave, { estilo: est })}
                      >
                        <strong>{est === "organico" ? "Orgánico" : est === "geometrico" ? "Geométrico" : "Lineal"}</strong>
                        <span>{est === "organico" ? "Recorrido curvo." : est === "geometrico" ? "Anillo y cruces." : "Paseo de un eje."}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </section>
          )}
          <div className="lz-nav">
            <button type="button" className="btn secondary" disabled={paso === 0} onClick={() => setPaso((n) => Math.max(0, n - 1))}>
              Anterior
            </button>
            <button type="button" className="btn" disabled={paso === PASOS.length - 1} onClick={() => setPaso((n) => Math.min(PASOS.length - 1, n + 1))}>
              Siguiente
            </button>
          </div>
        </div>
        <LotizacionPlano
          modelo={modelo}
          trazos={trazos}
          arista={paso === 3 || marcarArista ? arista : -1}
          borrador={!proy.sinIngreso && (paso === 3 || marcarArista) ? { arista, distancia, ancho: anchoIng } : null}
          emitir={emitido}
          viaSel={viaSel}
          onVia={paso >= 4 ? setViaSel : undefined}
          onMundo={onMundo}
        />
      </div>
    </div>
  );
}

function ViaForm({
  via,
  pick,
  onPick,
  onChange,
  onRemove,
}: {
  via: ViaExistente;
  pick: { id: string; campo: ViaCampo } | null;
  onPick: (campo: ViaCampo) => void;
  onChange: (via: ViaExistente) => void;
  onRemove: () => void;
}) {
  return (
    <article className="lz-via">
      <header>
        <input value={via.nombre} onChange={(e) => onChange({ ...via, nombre: e.target.value })} />
        <button type="button" className="lz-x" onClick={onRemove} aria-label="Quitar vía">×</button>
      </header>
      {CAMPOS.map((campo) => {
        const p = via[campo.k];
        const activo = pick?.id === via.id && pick.campo === campo.k;
        return (
          <div key={campo.k} className="lz-pt">
            <div>
              <b>{campo.label}</b>
              <small>{campo.ayuda}</small>
            </div>
            <label>E<NumBox allowEmpty value={p ? p.e : null} onChange={(n) => onChange({ ...via, [campo.k]: n === null ? null : { num: (p?.num || campo.k.toUpperCase()), e: n, n: p?.n ?? 0 } })} /></label>
            <label>N<NumBox allowEmpty value={p ? p.n : null} onChange={(n) => onChange({ ...via, [campo.k]: n === null ? null : { num: (p?.num || campo.k.toUpperCase()), e: p?.e ?? 0, n } })} /></label>
            <button type="button" className={`btn secondary${activo ? " is-on" : ""}`} onClick={() => onPick(campo.k)}>
              {activo ? "Marque…" : "En plano"}
            </button>
          </div>
        );
      })}
    </article>
  );
}

function CortesPanel({ modelo }: { modelo: Modelo }) {
  const cortes = modelo.cortes ?? [];
  if (!cortes.length) return <p className="lz-hint">Pulse Dibujar para generar los cortes A-A, B-B de las vías.</p>;
  const pavimento = modelo.pavimento ?? pavimentoVacio();
  return (
    <div className="lz-cortes">
      <h4>Cortes de las vías</h4>
      <p className="lz-hint">Persona en línea y vehículos a escala. Salen en el PDF A1 y en el DXF.</p>
      {cortes.map((corte) => {
        const d = svgSeccion(corte.seccion, pavimento, `CORTE ${corte.titulo}`, corte.via);
        return (
          <figure key={corte.titulo}>
            <figcaption>Corte {corte.titulo} · {corte.via}</figcaption>
            <svg viewBox={d.viewBox} className="lz-seccion-pro" role="img" aria-label={`Corte ${corte.titulo}`} dangerouslySetInnerHTML={{ __html: d.body }} />
          </figure>
        );
      })}
    </div>
  );
}

function EditorVia({
  vias,
  sel,
  tipo,
  seccion,
  onSel,
  onChange,
  onSoltar,
}: {
  vias: ViaInterna[];
  sel: string;
  tipo: TipoVia;
  seccion: Seccion;
  onSel: (id: string) => void;
  onChange: (tipo: TipoVia, seccion: Seccion) => void;
  onSoltar: () => void;
}) {
  const via = vias.find((v) => v.id === sel);
  return (
    <div>
      <h4>Vías del trazado</h4>
      <p className="lz-hint">Seleccione una vía aquí o en el plano. El cambio queda en los datos y se dibuja al pulsar Dibujar.</p>
      <div className="lz-vias-pick">
        {vias.map((v) => (
          <button key={v.id} type="button" className={`btn secondary${v.id === sel ? " is-on" : ""}`} onClick={() => onSel(v.id)}>
            {v.nombre} · {fmtM(v.ancho, 2)} m · R {fmtM(v.radio, 0)}
          </button>
        ))}
      </div>
      {via ? (
        <div className="lz-block-note">
          <strong>{via.nombre}</strong>
          <p>Radio de acera {fmtM(via.radio, 2)} m al sardinel. El ancho nuevo se toma de las manzanas al dibujar.</p>
          <label className="lz-block">
            Clase de esta vía
            <select
              value={tipo}
              onChange={(e) => {
                const next = e.target.value as TipoVia;
                onChange(next, seccionPorTipo(next));
              }}
            >
              <option value="local-secundaria">Local secundaria</option>
              <option value="local-principal">Local principal</option>
              <option value="acceso-exclusivo">Acceso exclusivo</option>
            </select>
          </label>
          <div className="lz-meta">
            <label>Vereda (m)<NumBox value={seccion.vereda} onChange={(n) => { if (n !== null) onChange(tipo, { ...seccion, vereda: n }); }} /></label>
            <label>Módulo de calzada (m)<NumBox value={seccion.moduloCalzada} onChange={(n) => { if (n !== null) onChange(tipo, { ...seccion, moduloCalzada: n }); }} /></label>
            <label>Estacionamiento (m)<NumBox value={seccion.estacionamiento} onChange={(n) => { if (n !== null) onChange(tipo, { ...seccion, estacionamiento: n }); }} /></label>
          </div>
          <button type="button" className="btn secondary" onClick={onSoltar}>Volver a la sección general</button>
        </div>
      ) : (
        <p className="lz-hint">Ninguna vía seleccionada.</p>
      )}
    </div>
  );
}

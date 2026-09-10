import { useMemo, useState } from "react";
import { Field, OptText } from "../ui/Field";
import { CalcDirtyNote, CalcularButton, MemoriaPendiente, useMemoriaOnCalcular } from "../ui/calcular";
import { Paper } from "../ui/Paper";
import { exportarWord } from "../lib/exportWord";
import { printMemoria } from "../lib/printDoc";
import {
  TAS_DEFAULTS,
  calcTasacion,
  catsDePiso,
  catsTodasPiso,
  fdRnt,
  informeTasacion,
  uid,
  type CompTas,
  type FloorTas,
  type MaterialTas,
  type ModoTas,
  type PhotoTas,
  type EstadoTas,
  type TablaFd,
  type TasacionInput,
  type TipoLote,
  type VocTas,
  OPT_ACCESOS,
  OPT_AGUA,
  OPT_CIMENTACION,
  OPT_DESAGUE,
  OPT_ESTRUCTURAS,
  OPT_FM,
  OPT_INST_ELEC,
  OPT_INST_SAN,
  OPT_LUZ,
  OPT_MUROS,
  OPT_TECHOS,
  OPT_TELEFONIA,
  OPT_VIA,
  TIPO_LOTE_LABEL,
  ZONA_OTRA,
  ZONIFICACION_GRUPOS,
  zonaEnCatalogo,
  esFotoNivel,
  fotosDeNivel,
  indiceImagenArquitectura,
  leyendaImagen,
  padImg,
  slotNivel,
  tituloFoto,
} from "../lib/tasacion";
import {
  CATEG_VUO,
  VUO_NORMA,
  VUO_RUBRO_GRUPO,
  VUO_RUBRO_LABEL,
  VUO_RUBROS,
  VUO_VIGENCIA,
  VUO_ZONA_META,
  celdaVuo,
  omiteTechos,
  tituloCategVuo,
  totalVuoSol,
  vuoAUsd,
  zonaVuoDesdeRegion,
  type CategVuo,
  type VuoZona,
  type VuoRubro,
} from "../lib/vuo";

async function fileToJpeg(file: File): Promise<string> {
  const bmp = await createImageBitmap(file);
  const max = 1280;
  const s = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(bmp.width * s));
  c.height = Math.max(1, Math.round(bmp.height * s));
  const ctx = c.getContext("2d");
  if (!ctx) return "";
  ctx.drawImage(bmp, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.82);
}

export function TasacionModule({ modo }: { modo: ModoTas }) {
  const [inp, setInp] = useState<TasacionInput>({
    ...TAS_DEFAULTS,
    modo,
    uso: modo === "terreno" ? "Terreno urbano" : TAS_DEFAULTS.uso,
    floors: TAS_DEFAULTS.floors.map((f) => ({ ...f })),
    comps: TAS_DEFAULTS.comps.map((c) => ({ ...c })),
    voc: TAS_DEFAULTS.voc.map((v) => ({ ...v })),
    photos: TAS_DEFAULTS.photos.map((p) => ({ ...p })),
  });
  const set = <K extends keyof TasacionInput>(k: K, v: TasacionInput[K]) => setInp((s) => ({ ...s, [k]: v, modo }));
  const r = useMemo(() => calcTasacion({ ...inp, modo }), [inp, modo]);
  const doc = useMemo(() => informeTasacion({ ...inp, modo }), [inp, modo]);
  const { doc: memoria, dirty, calcular } = useMemoriaOnCalcular(doc, modo);

  const addFloor = () => {
    const id = uid();
    const nombre = `${inp.floors.length + 1}° nivel`;
    const titulo = `Ambientes interiores del ${nombre}`;
    const n = inp.photos.filter((p) => esFotoNivel(p.slot)).length + 1;
    setInp((s) => {
      const prev = s.floors[s.floors.length - 1] ?? s.floors[0];
      return {
        ...s,
        floors: [
          ...s.floors,
          {
            id,
            nombre,
            area: "0",
            vu: prev?.vu ?? "380",
            categVuo: prev?.categVuo ?? "C",
            catMuros: prev?.catMuros,
            catTechos: prev?.catTechos,
            catPisos: prev?.catPisos,
            catPuertas: prev?.catPuertas,
            catRevest: prev?.catRevest,
            catBanos: prev?.catBanos,
            catInstala: prev?.catInstala,
            plus5: prev?.plus5,
            ambientes: "",
          },
        ],
        photos: [...s.photos, { id: uid(), slot: slotNivel(id), titulo, caption: leyendaImagen(n, titulo), dataUrl: "" }],
      };
    });
  };
  const patchFloor = (id: string, patch: Partial<FloorTas>) => set("floors", inp.floors.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  const FLOOR_CAT: Record<VuoRubro, keyof FloorTas> = {
    muros: "catMuros",
    techos: "catTechos",
    pisos: "catPisos",
    puertas: "catPuertas",
    revest: "catRevest",
    banos: "catBanos",
    instala: "catInstala",
  };
  const aplicarVuOficial = (f: FloorTas, extra?: Partial<FloorTas>) => {
    const merged = { ...f, ...extra };
    const cats = catsDePiso(merged);
    const zona = inp.vuoZona ?? "costa";
    const tot = totalVuoSol(zona, cats, !!merged.plus5);
    const usd = vuoAUsd(tot, Number(inp.tc) || 3.8);
    patchFloor(f.id, { ...extra, vu: String(usd) });
  };
  const addComp = () =>
    set("comps", [...inp.comps, { id: uid(), dir: "", area: "", precio: "", zon: "1.00", dist: "1.00", ub: "1.00", ent: "1.00", sup: "1.00", ser: "1.00", fn: "1.00" }]);
  const patchComp = (id: string, patch: Partial<CompTas>) => set("comps", inp.comps.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  const addVoc = () => set("voc", [...inp.voc, { id: uid(), desc: "", metrado: "1", vu: "0" }]);
  const patchVoc = (id: string, patch: Partial<VocTas>) => set("voc", inp.voc.map((v) => (v.id === id ? { ...v, ...patch } : v)));
  const addPhoto = (slot: string, caption: string, titulo?: string) =>
    set("photos", [...inp.photos, { id: uid(), slot, caption, dataUrl: "", titulo }]);
  const patchPhoto = (id: string, patch: Partial<PhotoTas>) => set("photos", inp.photos.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  const removePhoto = (id: string) => set("photos", inp.photos.filter((p) => p.id !== id));

  const onPhoto = async (id: string, file?: File) => {
    if (!file) return;
    const dataUrl = await fileToJpeg(file);
    patchPhoto(id, { dataUrl });
  };

  const addFotosNivel = async (floorId: string, nombre: string, files: FileList | File[]) => {
    const list = Array.from(files);
    if (!list.length) return;
    const converted: string[] = [];
    for (const file of list) converted.push(await fileToJpeg(file));
    setInp((s) => {
      const delNivel = fotosDeNivel(s.photos, floorId);
      const vacias = delNivel.filter((p) => !p.dataUrl);
      const photos = s.photos.map((p) => ({ ...p }));
      let i = 0;
      for (const vacia of vacias) {
        if (i >= converted.length) break;
        const idx = photos.findIndex((p) => p.id === vacia.id);
        if (idx >= 0) photos[idx] = { ...photos[idx], dataUrl: converted[i] };
        i += 1;
      }
      const restantes = converted.slice(i);
      const existentes = fotosDeNivel(photos, floorId).length;
      const nuevas: PhotoTas[] = restantes.map((dataUrl, j) => {
        const nLocal = existentes + j + 1;
        const titulo = `Ambiente ${padImg(nLocal)} — ${nombre}`;
        return {
          id: uid(),
          slot: slotNivel(floorId),
          titulo,
          caption: leyendaImagen(nLocal, titulo),
          dataUrl,
        };
      });
      return { ...s, photos: [...photos, ...nuevas] };
    });
  };

  const quitarNivel = (id: string) =>
    setInp((s) => ({
      ...s,
      floors: s.floors.filter((x) => x.id !== id),
      photos: s.photos.filter((p) => p.slot !== slotNivel(id)),
    }));

  const fdPct = (fdRnt(Number(inp.anios) || 0, inp.material, inp.estado, inp.tablaFd) * 100).toFixed(1);
  const extraLote = inp.tipoLote === "pasadizo" || inp.tipoLote === "servidumbre" || inp.tipoLote === "restriccion";
  const multiFrente = inp.tipoLote === "2frentes" || inp.tipoLote === "3frentes";
  const zonaSelect = zonaEnCatalogo(inp.zonificacion) ? inp.zonificacion : ZONA_OTRA;

  return (
    <>
      <aside id="app-panel" className="panel">
        <h2>{modo === "vivienda" ? "Tasación terreno + edificación" : "Tasación de terreno"}</h2>
        <p className="lead">
          {modo === "vivienda"
            ? "R.M. 172-2016-Vivienda. Ejemplo desarrollado. Edite niveles, comparables o VOC y pulse Calcular para actualizar el informe."
            : "R.M. 172-2016-Vivienda. Ejemplo desarrollado. Edite el terreno y pulse Calcular para actualizar el informe."}
        </p>
        <CalcDirtyNote dirty={dirty} />

        <fieldset className="fieldset">
          <legend>Identificación</legend>
          <Field label="Solicitante"><input value={inp.solicitante} onChange={(e) => set("solicitante", e.target.value)} /></Field>
          <div className="grid-2">
            <Field label="Teléfono"><input value={inp.telefono} onChange={(e) => set("telefono", e.target.value)} /></Field>
            <Field label="Fecha"><input value={inp.fecha} onChange={(e) => set("fecha", e.target.value)} /></Field>
          </div>
          <div className="grid-2">
            <Field label="Tipo de bien"><input value={inp.tipoBien} onChange={(e) => set("tipoBien", e.target.value)} /></Field>
            <Field label="Uso">
              <select value={inp.uso} onChange={(e) => set("uso", e.target.value)}>
                <option>Vivienda Unifamiliar</option>
                <option>Vivienda Multifamiliar</option>
                <option>Departamento</option>
                <option>Terreno urbano</option>
                <option>Comercio</option>
                <option>Oficina</option>
                <option>Depósito / almacén</option>
              </select>
            </Field>
          </div>
          <div className="grid-2">
            <Field label="Perito"><input value={inp.perito} onChange={(e) => set("perito", e.target.value)} /></Field>
            <Field label="Tipo de cambio" unit="S//US$"><input type="number" step="0.01" value={inp.tc} onChange={(e) => set("tc", e.target.value)} /></Field>
          </div>
          <Field label="% acciones"><input type="number" step="1" value={inp.acciones} onChange={(e) => set("acciones", e.target.value)} /></Field>
        </fieldset>

        <fieldset className="fieldset">
          <legend>Ubicación y predio</legend>
          <Field label="Dirección"><input value={inp.direccion} onChange={(e) => set("direccion", e.target.value)} /></Field>
          <div className="grid-2">
            <Field label="Calle / frente"><input value={inp.calle} onChange={(e) => set("calle", e.target.value)} /></Field>
            <Field label="Urbanización"><input value={inp.urb} onChange={(e) => set("urb", e.target.value)} /></Field>
          </div>
          <div className="grid-3">
            <Field label="Distrito"><input value={inp.distrito} onChange={(e) => set("distrito", e.target.value)} /></Field>
            <Field label="Provincia"><input value={inp.provincia} onChange={(e) => set("provincia", e.target.value)} /></Field>
            <Field label="Región">
              <input
                value={inp.region}
                onChange={(e) => {
                  const region = e.target.value;
                  setInp((s) => ({ ...s, region, vuoZona: zonaVuoDesdeRegion(region), modo }));
                }}
              />
            </Field>
          </div>
          <div className="grid-2">
            <Field label="Manzana"><input value={inp.mz} onChange={(e) => set("mz", e.target.value)} /></Field>
            <Field label="Lote"><input value={inp.lote} onChange={(e) => set("lote", e.target.value)} /></Field>
          </div>
          <div className="grid-2">
            <Field label="Partida electrónica"><input value={inp.partida} onChange={(e) => set("partida", e.target.value)} /></Field>
            <Field label="Gravámenes"><input value={inp.gravamenes} onChange={(e) => set("gravamenes", e.target.value)} /></Field>
          </div>
          <Field label="Zonificación">
            <select
              value={zonaSelect}
              onChange={(e) => {
                const v = e.target.value;
                if (v === ZONA_OTRA) {
                  if (zonaEnCatalogo(inp.zonificacion)) set("zonificacion", "");
                  return;
                }
                set("zonificacion", v);
              }}
            >
              {ZONIFICACION_GRUPOS.map((g) => (
                <optgroup key={g.grupo} label={g.grupo}>
                  {g.items.map((z) => (
                    <option key={z} value={z}>{z}</option>
                  ))}
                </optgroup>
              ))}
              <option value={ZONA_OTRA}>Otra (clave del PDU local)</option>
            </select>
          </Field>
          {zonaSelect === ZONA_OTRA ? (
            <Field label="Clave / descripción municipal">
              <input
                value={inp.zonificacion}
                onChange={(e) => set("zonificacion", e.target.value)}
                placeholder="Ej. RDA-7, Mixto Centro Histórico, clave del certificado de parámetros"
              />
            </Field>
          ) : null}
          <Field label="Declaratoria de fábrica"><input value={inp.declaratoria} onChange={(e) => set("declaratoria", e.target.value)} /></Field>
          <div className="grid-2">
            <Field label="HR / PU"><input value={inp.hrpu} onChange={(e) => set("hrpu", e.target.value)} /></Field>
            <Field label="Tasación anterior"><input value={inp.tasacionAnt} onChange={(e) => set("tasacionAnt", e.target.value)} /></Field>
          </div>
          <Field label="Documentación sustentatoria"><input value={inp.docsRef} onChange={(e) => set("docsRef", e.target.value)} /></Field>
          <Field label="Fachada / descripción"><textarea rows={2} value={inp.fachada} onChange={(e) => set("fachada", e.target.value)} /></Field>
        </fieldset>

        <fieldset className="fieldset">
          <legend>Tipo de tasación del lote (RNT)</legend>
          <p className="lead">Cada tipo abre su propia sección de cálculo en el informe, con las mismas condicionales del Excel de terreno.</p>
          <Field label="Criterio reglamentario">
            <select value={inp.tipoLote} onChange={(e) => set("tipoLote", e.target.value as TipoLote)}>
              {(Object.keys(TIPO_LOTE_LABEL) as TipoLote[]).map((k) => (
                <option key={k} value={k}>{TIPO_LOTE_LABEL[k]}</option>
              ))}
            </select>
          </Field>
          <div className="grid-2">
            <Field label="Área terreno At" unit="m²"><input type="number" step="0.01" value={inp.At} onChange={(e) => set("At", e.target.value)} /></Field>
            <Field label="Perímetro" unit="ml"><input type="number" step="0.01" value={inp.perimetro} onChange={(e) => set("perimetro", e.target.value)} /></Field>
          </div>
          <div className="grid-2">
            <Field label="Frente A (a)" unit="m"><input type="number" step="0.01" value={inp.frente} onChange={(e) => set("frente", e.target.value)} /></Field>
            <Field label="Fondo" unit="m"><input type="number" step="0.01" value={inp.fondo} onChange={(e) => set("fondo", e.target.value)} /></Field>
          </div>
          {multiFrente ? (
            <div className="grid-2">
              <Field label="Frente B" unit="m"><input type="number" step="0.01" value={inp.frenteB} onChange={(e) => set("frenteB", e.target.value)} /></Field>
              <Field label="VAU B" unit="US$/m²"><input type="number" step="1" value={inp.vauB} onChange={(e) => set("vauB", e.target.value)} /></Field>
            </div>
          ) : null}
          {inp.tipoLote === "3frentes" ? (
            <div className="grid-2">
              <Field label="Frente C" unit="m"><input type="number" step="0.01" value={inp.frenteC} onChange={(e) => set("frenteC", e.target.value)} /></Field>
              <Field label="VAU C" unit="US$/m²"><input type="number" step="1" value={inp.vauC} onChange={(e) => set("vauC", e.target.value)} /></Field>
            </div>
          ) : null}
          {extraLote ? (
            <>
              <p className="lead">Geometría de pasadizo / servidumbre (x, y, a, b, c, d y VATU).</p>
              <div className="grid-3">
                <Field label="x (frente exclusivo)" unit="m"><input type="number" step="0.01" value={inp.loteX} onChange={(e) => set("loteX", e.target.value)} /></Field>
                <Field label="y (fondo exclusivo)" unit="m"><input type="number" step="0.01" value={inp.loteY} onChange={(e) => set("loteY", e.target.value)} /></Field>
                <Field label="a (ancho pasaje)" unit="m"><input type="number" step="0.01" value={inp.pasaA} onChange={(e) => set("pasaA", e.target.value)} /></Field>
              </div>
              <div className="grid-3">
                <Field label="b (manzana)" unit="m"><input type="number" step="0.01" value={inp.manzanaB} onChange={(e) => set("manzanaB", e.target.value)} /></Field>
                <Field label="c (manzana)" unit="m"><input type="number" step="0.01" value={inp.manzanaC} onChange={(e) => set("manzanaC", e.target.value)} /></Field>
                <Field label="d (largo pasaje)" unit="m"><input type="number" step="0.01" value={inp.pasaD} onChange={(e) => set("pasaD", e.target.value)} /></Field>
              </div>
              <div className="grid-2">
                <Field label="VATU (vacío = VAU)" unit="US$/m²"><input type="number" step="1" value={inp.vatu} onChange={(e) => set("vatu", e.target.value)} /></Field>
                {inp.tipoLote === "restriccion" ? (
                  <Field label="Φ castigo"><input type="number" step="0.01" value={inp.phi} onChange={(e) => set("phi", e.target.value)} /></Field>
                ) : (
                  <span />
                )}
              </div>
            </>
          ) : null}
        </fieldset>

        <fieldset className="fieldset">
          <legend>Linderos</legend>
          <Field label="Frente"><input value={inp.lindFrente} onChange={(e) => set("lindFrente", e.target.value)} /></Field>
          <Field label="Derecho"><input value={inp.lindDer} onChange={(e) => set("lindDer", e.target.value)} /></Field>
          <Field label="Izquierdo"><input value={inp.lindIzq} onChange={(e) => set("lindIzq", e.target.value)} /></Field>
          <Field label="Posterior"><input value={inp.lindPost} onChange={(e) => set("lindPost", e.target.value)} /></Field>
        </fieldset>

        <fieldset className="fieldset">
          <legend>Servicios urbanos</legend>
          <div className="grid-2">
            <Field label="Vía">
              <OptText value={inp.via} onChange={(v) => set("via", v)} options={OPT_VIA} />
            </Field>
            <Field label="Accesos">
              <OptText value={inp.nAccesos} onChange={(v) => set("nAccesos", v)} options={OPT_ACCESOS} />
            </Field>
          </div>
          <Field label="Agua">
            <OptText value={inp.agua} onChange={(v) => set("agua", v)} options={OPT_AGUA} />
          </Field>
          <Field label="Desagüe">
            <OptText value={inp.desague} onChange={(v) => set("desague", v)} options={OPT_DESAGUE} />
          </Field>
          <div className="grid-2">
            <Field label="Luz">
              <OptText value={inp.luz} onChange={(v) => set("luz", v)} options={OPT_LUZ} />
            </Field>
            <Field label="Telefonía">
              <OptText value={inp.telefonia} onChange={(v) => set("telefonia", v)} options={OPT_TELEFONIA} />
            </Field>
          </div>
        </fieldset>

        {modo === "vivienda" ? (
          <>
            <fieldset className="fieldset">
              <legend>Edificación — depreciación RNT</legend>
              <div className="grid-2">
                <Field label="Antigüedad" unit="años"><input type="number" step="1" value={inp.anios} onChange={(e) => set("anios", e.target.value)} /></Field>
                <Field label="Tabla FD Art. II.D.37">
                  <select value={inp.tablaFd} onChange={(e) => set("tablaFd", e.target.value as TablaFd)}>
                    <option value="vivienda">Casa-habitación / vivienda / dpto.</option>
                    <option value="comercio">Tiendas, depósitos, club, instituciones</option>
                  </select>
                </Field>
              </div>
              <div className="grid-2">
                <Field label="Material">
                  <select value={inp.material} onChange={(e) => set("material", e.target.value as MaterialTas)}>
                    <option>Concreto</option>
                    <option>Ladrillo</option>
                    <option>Liviano/Adobe</option>
                  </select>
                </Field>
                <Field label="Estado">
                  <select value={inp.estado} onChange={(e) => set("estado", e.target.value as EstadoTas)}>
                    <option>Muy bueno</option>
                    <option>Bueno</option>
                    <option>Regular</option>
                    <option>Malo</option>
                  </select>
                </Field>
              </div>
              <p className="lead">FD Art. II.D.37 = {fdPct} % (se aplica a VE y VOC). Fm se aplica después, solo a edificación y VOC.</p>
              <Field label="Factor de mejoramiento Fm">
                <OptText value={inp.fm} onChange={(v) => set("fm", v)} options={OPT_FM} />
              </Field>
              <Field label="Cimentación">
                <OptText value={inp.cimentacion} onChange={(v) => set("cimentacion", v)} options={OPT_CIMENTACION} />
              </Field>
              <Field label="Estructuras">
                <OptText value={inp.estructuras} onChange={(v) => set("estructuras", v)} options={OPT_ESTRUCTURAS} />
              </Field>
              <Field label="Techos">
                <OptText value={inp.techos} onChange={(v) => set("techos", v)} options={OPT_TECHOS} />
              </Field>
              <Field label="Muros">
                <OptText value={inp.muros} onChange={(v) => set("muros", v)} options={OPT_MUROS} />
              </Field>
              <Field label="Inst. sanitarias">
                <OptText value={inp.instSan} onChange={(v) => set("instSan", v)} options={OPT_INST_SAN} />
              </Field>
              <Field label="Inst. eléctricas">
                <OptText value={inp.instElec} onChange={(v) => set("instElec", v)} options={OPT_INST_ELEC} />
              </Field>
              <Field label="Acabados 1° nivel"><textarea rows={2} value={inp.acabados1} onChange={(e) => set("acabados1", e.target.value)} /></Field>
              <Field label="Acabados otros niveles"><textarea rows={2} value={inp.acabados2} onChange={(e) => set("acabados2", e.target.value)} /></Field>
            </fieldset>

            <fieldset className="fieldset">
              <legend>Niveles (añadir pisos)</legend>
              <Field label="Zona del cuadro oficial MVCS">
                <select
                  value={inp.vuoZona ?? "costa"}
                  onChange={(e) => set("vuoZona", e.target.value as VuoZona)}
                >
                  {(Object.keys(VUO_ZONA_META) as VuoZona[]).map((z) => (
                    <option key={z} value={z}>
                      {VUO_ZONA_META[z].anexo} — {VUO_ZONA_META[z].label}
                    </option>
                  ))}
                </select>
              </Field>
              <p className="lead">
                {VUO_NORMA}. {VUO_VIGENCIA}. El VU por m² se obtiene sumando las siete partidas del cuadro oficial (muros y columnas, techos, pisos, puertas y ventanas, revestimientos, baños e instalaciones eléctricas y sanitarias). Cada rubro tiene su propia categoría A–H. En A y D no se suma techos. El valor adoptado se puede editar.
              </p>
              {inp.floors.map((f) => {
                const cats = catsDePiso(f);
                const zona = inp.vuoZona ?? "costa";
                const totSol = totalVuoSol(zona, cats, !!f.plus5);
                const totUsd = vuoAUsd(totSol, Number(inp.tc) || 3.8);
                const skipT = omiteTechos(cats.muros);
                return (
                <div key={f.id} className="tas-card">
                  <div className="grid-2">
                    <Field label="Nombre"><input value={f.nombre} onChange={(e) => patchFloor(f.id, { nombre: e.target.value })} /></Field>
                    <Field label="Área techada" unit="m²"><input type="number" step="0.01" value={f.area} onChange={(e) => patchFloor(f.id, { area: e.target.value })} /></Field>
                  </div>
                  <Field label="Categoría VUO (aplica a las 7 partidas)">
                    <select
                      value={f.categVuo ?? "C"}
                      onChange={(e) => {
                        const cat = e.target.value as CategVuo;
                        aplicarVuOficial(f, catsTodasPiso(cat));
                      }}
                    >
                      {CATEG_VUO.map((cat) => (
                        <option key={cat} value={cat}>
                          {tituloCategVuo(cat)}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <div className="tas-vuo">
                    <h4>Desglose oficial · 7 partidas · {VUO_ZONA_META[zona].anexo}</h4>
                    {VUO_RUBROS.map((key, i) => {
                      const cat = cats[key];
                      const cel = celdaVuo(zona, cat, key);
                      const omitido = key === "techos" && skipT;
                      const grupo = VUO_RUBRO_GRUPO[key];
                      const prevGrupo = i > 0 ? VUO_RUBRO_GRUPO[VUO_RUBROS[i - 1]] : "";
                      return (
                        <div key={key}>
                          {grupo !== prevGrupo ? <div className="tas-vuo-grupo">{grupo}</div> : null}
                          <div className={`tas-vuo-row${omitido ? " is-omit" : ""}`}>
                            <div className="tas-vuo-head">
                              <select
                                value={cat}
                                onChange={(e) => aplicarVuOficial(f, { [FLOOR_CAT[key]]: e.target.value as CategVuo })}
                                aria-label={`Categoría ${VUO_RUBRO_LABEL[key]}`}
                              >
                                {CATEG_VUO.map((c) => (
                                  <option key={c} value={c}>{c}</option>
                                ))}
                              </select>
                              <strong>{VUO_RUBRO_LABEL[key]}</strong>
                              <span className="tas-vuo-val">
                                {omitido ? "No se suma" : `S/ ${cel.valor.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                              </span>
                            </div>
                            <p>{omitido ? "La categoría de muros ya incluye el techo (notas 5 y A del cuadro oficial)." : cel.desc}</p>
                          </div>
                        </div>
                      );
                    })}
                    <label className="tas-vuo-plus">
                      <input
                        type="checkbox"
                        checked={!!f.plus5}
                        onChange={(e) => aplicarVuOficial(f, { plus5: e.target.checked })}
                      />
                      +5 % desde el 5.° piso (nota del cuadro oficial para edificios)
                    </label>
                    <div className="tas-vuo-total">
                      <span>VU oficial</span>
                      <strong>
                        S/ {totSol.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/m²
                        {" · "}
                        US$ {totUsd.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/m²
                      </strong>
                    </div>
                  </div>
                  <div className="grid-2">
                    <Field label="VU adoptado (tasación)" unit="US$/m²">
                      <input type="number" step="0.01" value={f.vu} onChange={(e) => patchFloor(f.id, { vu: e.target.value })} />
                    </Field>
                    <div className="tas-row-actions" style={{ alignItems: "flex-end" }}>
                      <button type="button" className="btn secondary" onClick={() => aplicarVuOficial(f)}>
                        Usar VU oficial
                      </button>
                    </div>
                  </div>
                  <Field label="Ambientes / distribución">
                    <textarea rows={3} value={f.ambientes} onChange={(e) => patchFloor(f.id, { ambientes: e.target.value })} />
                  </Field>
                  <div className="tas-fotos-nivel">
                    <h4>Fotografías de arquitectura</h4>
                    <p className="lead">Varias por nivel. El código se numera solo; el título queda entre comillas en la memoria.</p>
                    {fotosDeNivel(inp.photos, f.id).map((p) => {
                      const n = indiceImagenArquitectura(inp.photos, inp.floors, p.id);
                      const titulo = tituloFoto(p);
                      return (
                        <div key={p.id} className="tas-foto-item">
                          {p.dataUrl ? (
                            <img className="tas-foto-thumb" src={p.dataUrl} alt={titulo} />
                          ) : (
                            <div className="tas-foto-ph">Sin foto</div>
                          )}
                          <div className="tas-foto-meta">
                            <div className="tas-foto-codigo">Imagen {padImg(n)}.</div>
                            <Field label="Título de la foto">
                              <input
                                value={titulo}
                                placeholder="Sala de recepción"
                                onChange={(e) => {
                                  const t = e.target.value;
                                  patchPhoto(p.id, { titulo: t, caption: leyendaImagen(n, t) });
                                }}
                              />
                            </Field>
                            <p className="tas-foto-preview">
                              Imagen {padImg(n)}. &ldquo;{titulo || "Aquí el título de la foto"}&rdquo;
                            </p>
                            <div className="tas-row-actions">
                              <label className="btn secondary">
                                {p.dataUrl ? "Cambiar foto" : "Cargar foto"}
                                <input type="file" accept="image/*" hidden onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  e.target.value = "";
                                  void onPhoto(p.id, file);
                                }} />
                              </label>
                              <button type="button" className="btn secondary" onClick={() => removePhoto(p.id)}>
                                Quitar foto
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <div className="tas-row-actions">
                      <label className="btn secondary">
                        Añadir fotos de este nivel
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          hidden
                          onChange={(e) => {
                            const files = e.target.files;
                            e.target.value = "";
                            if (files?.length) void addFotosNivel(f.id, f.nombre, files);
                          }}
                        />
                      </label>
                      <button
                        type="button"
                        className="btn secondary"
                        onClick={() => {
                          const n = fotosDeNivel(inp.photos, f.id).length + 1;
                          const titulo = `Ambiente ${padImg(n)} — ${f.nombre}`;
                          addPhoto(slotNivel(f.id), leyendaImagen(n, titulo), titulo);
                        }}
                      >
                        Añadir recuadro vacío
                      </button>
                      {inp.floors.length > 1 ? (
                        <button type="button" className="btn secondary" onClick={() => quitarNivel(f.id)}>
                          Quitar nivel
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
                );
              })}
              <button type="button" className="btn secondary" onClick={addFloor}>
                Añadir otro nivel
              </button>
            </fieldset>

            <fieldset className="fieldset">
              <legend>Obras complementarias / IF</legend>
              {inp.voc.map((v) => (
                <div key={v.id} className="grid-3">
                  <Field label="Partida"><input value={v.desc} onChange={(e) => patchVoc(v.id, { desc: e.target.value })} /></Field>
                  <Field label="Metrado"><input type="number" step="0.01" value={v.metrado} onChange={(e) => patchVoc(v.id, { metrado: e.target.value })} /></Field>
                  <Field label="VU US$"><input type="number" step="1" value={v.vu} onChange={(e) => patchVoc(v.id, { vu: e.target.value })} /></Field>
                </div>
              ))}
              <button type="button" className="btn secondary" onClick={addVoc}>Añadir partida VOC</button>
            </fieldset>
          </>
        ) : null}

        <fieldset className="fieldset">
          <legend>Comparables de terreno</legend>
          {inp.comps.map((c) => (
            <div key={c.id} className="tas-card">
              <Field label="Dirección / oferta"><input value={c.dir} onChange={(e) => patchComp(c.id, { dir: e.target.value })} /></Field>
              <div className="grid-2">
                <Field label="Área" unit="m²"><input type="number" step="0.01" value={c.area} onChange={(e) => patchComp(c.id, { area: e.target.value })} /></Field>
                <Field label="Precio" unit="US$"><input type="number" step="1" value={c.precio} onChange={(e) => patchComp(c.id, { precio: e.target.value })} /></Field>
              </div>
              <div className="grid-2">
                <Field label="F. zonificación"><input type="number" step="0.01" value={c.zon} onChange={(e) => patchComp(c.id, { zon: e.target.value })} /></Field>
                <Field label="F. distancia"><input type="number" step="0.01" value={c.dist} onChange={(e) => patchComp(c.id, { dist: e.target.value })} /></Field>
              </div>
              <div className="grid-2">
                <Field label="F. ubicación"><input type="number" step="0.01" value={c.ub} onChange={(e) => patchComp(c.id, { ub: e.target.value })} /></Field>
                <Field label="F. entorno"><input type="number" step="0.01" value={c.ent} onChange={(e) => patchComp(c.id, { ent: e.target.value })} /></Field>
              </div>
              <div className="grid-3">
                <Field label="F. superficie"><input type="number" step="0.01" value={c.sup} onChange={(e) => patchComp(c.id, { sup: e.target.value })} /></Field>
                <Field label="F. servicios"><input type="number" step="0.01" value={c.ser} onChange={(e) => patchComp(c.id, { ser: e.target.value })} /></Field>
                <Field label="F. negociación"><input type="number" step="0.01" value={c.fn} onChange={(e) => patchComp(c.id, { fn: e.target.value })} /></Field>
              </div>
              {inp.comps.length > 1 ? (
                <button type="button" className="btn secondary" onClick={() => set("comps", inp.comps.filter((x) => x.id !== c.id))}>Quitar comparable</button>
              ) : null}
            </div>
          ))}
          <button type="button" className="btn secondary" onClick={addComp}>Añadir comparable</button>
        </fieldset>

        <fieldset className="fieldset">
          <legend>Deducciones VRM (%)</legend>
          <div className="grid-2">
            <Field label="Pérdida / deterioro"><input type="number" step="0.01" value={inp.dPerdida} onChange={(e) => set("dPerdida", e.target.value)} /></Field>
            <Field label="Gastos de valuación"><input type="number" step="0.01" value={inp.dValuac} onChange={(e) => set("dValuac", e.target.value)} /></Field>
            <Field label="Depreciación ejecución"><input type="number" step="0.01" value={inp.dDeprec} onChange={(e) => set("dDeprec", e.target.value)} /></Field>
            <Field label="Mantenimiento"><input type="number" step="0.01" value={inp.dMant} onChange={(e) => set("dMant", e.target.value)} /></Field>
          </div>
          <Field label="Ajuste de mercado (180 días)"><input type="number" step="0.01" value={inp.dMercado} onChange={(e) => set("dMercado", e.target.value)} /></Field>
        </fieldset>

        <fieldset className="fieldset">
          <legend>Fotografías del informe</legend>
          <p className="lead">Ubicación, zonificación, fachada, entorno y anexos. Las fotos de cada piso se cargan en Niveles.</p>
          {inp.photos.filter((p) => !esFotoNivel(p.slot)).map((p) => (
            <div key={p.id} className="tas-card">
              <Field label="Título de la figura"><input value={p.caption} onChange={(e) => patchPhoto(p.id, { caption: e.target.value })} /></Field>
              <Field label="Dónde se coloca">
                <select value={p.slot} onChange={(e) => patchPhoto(p.id, { slot: e.target.value })}>
                  <option value="ubicacion">2.1 Ubicación (Maps)</option>
                  <option value="zonificacion">2.6 Zonificación</option>
                  <option value="fachada">Fachada / panel 7</option>
                  <option value="entorno">Entorno / panel 7</option>
                  <option value="interior">Interiores / panel 7</option>
                  <option value="anexo">Anexo / panel 7</option>
                </select>
              </Field>
              <div className="tas-row-actions">
                <label className="btn secondary">
                  {p.dataUrl ? "Cambiar foto" : "Cargar foto"}
                  <input type="file" accept="image/*" hidden onChange={(e) => void onPhoto(p.id, e.target.files?.[0])} />
                </label>
                {p.dataUrl ? <span className="unit">Lista</span> : null}
                <button type="button" className="btn secondary" onClick={() => removePhoto(p.id)}>Quitar</button>
              </div>
              {p.dataUrl ? <img className="tas-thumb" src={p.dataUrl} alt="" /> : null}
            </div>
          ))}
          <button type="button" className="btn secondary" onClick={() => addPhoto("anexo", `Fig. ${String(inp.photos.filter((p) => !esFotoNivel(p.slot)).length + 1).padStart(2, "0")}. Fotografía del inmueble.`)}>
            Añadir foto
          </button>
        </fieldset>

        <div className="actions">
          <CalcularButton onClick={calcular} dirty={dirty} />
          <button className="btn" disabled={!memoria} onClick={() => memoria && exportarWord(memoria)}>Exportar Word</button>
          <button className="btn secondary" disabled={!memoria} onClick={() => memoria && printMemoria(memoria.titulo)}>Imprimir / PDF</button>
        </div>
        <p className="lead">
          VT {r.VT.toLocaleString("es-PE", { maximumFractionDigits: 0 })} US$
          {modo === "vivienda" ? ` · VE ${r.VEaj.toLocaleString("es-PE", { maximumFractionDigits: 0 })} · VOC ${r.VOCaj.toLocaleString("es-PE", { maximumFractionDigits: 0 })}` : ""}
          {" · "}VC {r.VCprop.toLocaleString("es-PE", { maximumFractionDigits: 0 })} US$
        </p>
      </aside>
      {memoria ? <Paper doc={memoria} /> : <MemoriaPendiente />}
    </>
  );
}

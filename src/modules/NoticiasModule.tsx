import { useEffect, useMemo, useRef, useState } from "react";
import {
  CATEGORIAS,
  POR_PAGINA,
  TOTAL_CATEGORIAS,
  TOTAL_NOTICIAS,
  buscarNoticias,
  catPorId,
  conteoPorCategoria,
  heroNoticia,
  noticiaPorId,
  paginar,
  relacionadas,
  type Noticia,
} from "../lib/noticias/indice";
import { ilustracionSrc, varianteDe } from "../lib/noticias/ilustraciones";
import { candidatas } from "../lib/noticias/wasabi";
import {
  buscarMaestra,
  obtenerCategorias,
  obtenerDetalle,
  obtenerUltimas,
  type CategoriaMaestra,
} from "../lib/noticias/fuente";

type CatV = {
  slug: string;
  nombre: string;
  grupo: string;
  descripcion: string;
  color: string;
  orden: number;
};

const CAT_LOCAL: CatV[] = CATEGORIAS.map((c) => ({
  slug: c.id,
  nombre: c.nombre,
  grupo: c.grupo,
  descripcion: c.descripcion,
  color: c.color,
  orden: c.numero,
}));

/** Foto única y consistente: mismas candidatas estables en tarjeta, hero y lectura; con respaldo automático. */
function Foto({ noticia, color, cual, maestra, alt }: { noticia: Noticia; color: string; cual: "a" | "b" | "c"; maestra?: string | null; alt: string }) {
  const v = varianteDe(noticia);
  const slug = noticia.slug ?? noticia.id;
  const lista = useMemo(
    () => candidatas({ catSlug: noticia.cat, artSlug: slug, cual, maestra: maestra ?? noticia.imagenIA, respaldo: ilustracionSrc(noticia, v, color) }),
    [noticia, slug, cual, maestra, v, color],
  );
  const [i, setI] = useState(0);
  const clave = lista.join("|");
  useEffect(() => {
    setI(0);
  }, [clave]);
  const src = lista[Math.min(i, lista.length - 1)] ?? "";
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      draggable={false}
      onError={() => setI((x) => Math.min(x + 1, lista.length - 1))}
    />
  );
}

/** Portada: foto estable (Wasabi → maestra) o ilustración editorial. */
function Portada({ noticia, nombre, color, grande = false }: { noticia: Noticia; nombre: string; color: string; grande?: boolean }) {
  const etiqueta = noticia.imagenIA || noticia.enVivo ? "Foto" : "Ilustración editorial";
  return (
    <span className={`noti-cover${grande ? " is-hero" : ""}`} aria-hidden>
      <Foto noticia={noticia} color={color} cual="a" alt="" />
      <i className="noti-cover-tag">{etiqueta} · {nombre}</i>
    </span>
  );
}

function Meta({ noticia, nombre, color }: { noticia: Noticia; nombre: string; color: string }) {
  return (
    <span className="noti-meta">
      <em style={{ background: color }}>{nombre}</em>
      <time>{noticia.fecha}</time>
      <small>{noticia.lectura} min</small>
      {noticia.enVivo ? <small className="noti-live">En vivo</small> : null}
      {noticia.verificadaEn ? <small className="noti-verif">✓ {noticia.verificadaEn}</small> : null}
    </span>
  );
}

function Paginador({ actual, paginas, onIr }: { actual: number; paginas: number; onIr: (p: number) => void }) {
  if (paginas <= 1) return null;
  const nums: (number | "…")[] = [];
  for (let i = 1; i <= paginas; i++) {
    if (i === 1 || i === paginas || Math.abs(i - actual) <= 1) nums.push(i);
    else if (nums[nums.length - 1] !== "…") nums.push("…");
  }
  return (
    <nav className="noti-pager" aria-label="Paginación de noticias">
      <button type="button" disabled={actual <= 1} onClick={() => onIr(actual - 1)} aria-label="Página anterior">
        ← Anterior
      </button>
      {nums.map((n, i) =>
        n === "…" ? (
          <span key={`e${i}`} className="noti-ellipsis">…</span>
        ) : (
          <button
            key={n}
            type="button"
            className={n === actual ? "on" : ""}
            aria-current={n === actual ? "page" : undefined}
            onClick={() => onIr(n)}
          >
            {n}
          </button>
        ),
      )}
      <button type="button" disabled={actual >= paginas} onClick={() => onIr(actual + 1)} aria-label="Página siguiente">
        Siguiente →
      </button>
    </nav>
  );
}

export function NoticiasModule() {
  const [modo, setModo] = useState<"cargando" | "maestra" | "local">("cargando");
  const [catsM, setCatsM] = useState<CategoriaMaestra[]>([]);
  const [baseM, setBaseM] = useState<Noticia[]>([]);
  const [totalM, setTotalM] = useState(0);
  const [resQ, setResQ] = useState<Noticia[] | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [cat, setCat] = useState("");
  const [q, setQ] = useState("");
  const [pagina, setPagina] = useState(1);
  const [abierta, setAbierta] = useState("");
  const [detalleM, setDetalleM] = useState<Noticia | null>(null);
  const [cargandoDet, setCargandoDet] = useState(false);
  const [catsOpen, setCatsOpen] = useState(false);
  const topRef = useRef<HTMLDivElement>(null);

  const enVivo = modo === "maestra";

  // Carga inicial desde la maestra; sin conexión → paquete local.
  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const [cats, { notas, total }] = await Promise.all([
          obtenerCategorias(),
          obtenerUltimas(120, 0),
        ]);
        if (!vivo) return;
        setCatsM(cats);
        setBaseM(notas);
        setTotalM(total);
        setModo("maestra");
      } catch {
        if (vivo) setModo("local");
      }
    })();
    return () => {
      vivo = false;
    };
  }, []);

  const catsV: CatV[] = useMemo(
    () =>
      enVivo
        ? catsM.map((c) => ({ slug: c.slug, nombre: c.nombre, grupo: c.grupo, descripcion: c.descripcion, color: c.color, orden: c.orden }))
        : CAT_LOCAL,
    [enVivo, catsM],
  );
  const grupos: string[] = useMemo(() => {
    const seen: string[] = [];
    for (const c of catsV) if (!seen.includes(c.grupo)) seen.push(c.grupo);
    return seen;
  }, [catsV]);
  const infoCat = (slug: string): CatV =>
    catsV.find((c) => c.slug === slug) ?? { slug, nombre: slug, grupo: "", descripcion: "", color: "#1a4473", orden: 0 };

  const conteoLocal = useMemo(() => conteoPorCategoria(), []);
  const conteo: Record<string, number> = useMemo(() => {
    if (!enVivo) return conteoLocal;
    const m: Record<string, number> = {};
    for (const n of baseM) m[n.cat] = (m[n.cat] ?? 0) + 1;
    return m;
  }, [enVivo, baseM, conteoLocal]);

  // Buscador en vivo contra la maestra (debounce).
  useEffect(() => {
    if (!enVivo) return;
    const t = q.trim();
    if (!t) {
      setResQ(null);
      setBuscando(false);
      return;
    }
    setBuscando(true);
    const h = setTimeout(async () => {
      try {
        const r = await buscarMaestra(t, 30, 0);
        setResQ(r.notas);
      } catch {
        setResQ([]);
      } finally {
        setBuscando(false);
      }
    }, 450);
    return () => clearTimeout(h);
  }, [q, enVivo]);

  const listaLocal = useMemo(() => buscarNoticias(q, cat), [q, cat]);
  const lista: Noticia[] = useMemo(() => {
    if (!enVivo) return listaLocal;
    if (q.trim()) return resQ ?? [];
    return cat ? baseM.filter((n) => n.cat === cat) : baseM;
  }, [enVivo, listaLocal, baseM, cat, q, resQ]);

  const nCats = enVivo ? catsV.length : TOTAL_CATEGORIAS;
  const nNotas = enVivo ? (q.trim() ? lista.length : cat ? lista.length : totalM || baseM.length) : TOTAL_NOTICIAS;
  const hero = enVivo ? baseM[0] : heroNoticia();
  const { page: visibles, paginas, actual, total } = useMemo(() => paginar(lista, pagina, POR_PAGINA), [lista, pagina]);

  useEffect(() => {
    setPagina(1);
  }, [cat, q]);

  useEffect(() => {
    if (!abierta) return;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [abierta]);

  const irPagina = (p: number) => {
    setPagina(p);
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const abrir = async (id: string) => {
    if (!enVivo) {
      setAbierta(id);
      return;
    }
    setCargandoDet(true);
    try {
      const r = await obtenerDetalle(id);
      setDetalleM(r.nota);
      setAbierta(id);
    } catch {
      setDetalleM(null);
    } finally {
      setCargandoDet(false);
    }
  };

  const elegirCat = (id: string) => {
    setCat(id);
    setCatsOpen(false);
  };

  const lectura: Noticia | undefined = enVivo ? (detalleM ?? undefined) : abierta ? noticiaPorId(abierta) : undefined;
  const rel: Noticia[] = useMemo(() => {
    if (!lectura) return [];
    if (!enVivo) return relacionadas(lectura, 3);
    const misma = baseM.filter((x) => x.cat === lectura.cat && x.id !== lectura.id).slice(0, 3);
    if (misma.length >= 3) return misma;
    const grupo = infoCat(lectura.cat).grupo;
    const resto = baseM.filter((x) => x.id !== lectura.id && x.cat !== lectura.cat && infoCat(x.cat).grupo === grupo);
    return [...misma, ...resto].slice(0, 3);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lectura?.id, enVivo, baseM]);

  if (modo === "cargando") {
    return (
      <div className="plaza-desk noti" data-guest-ok>
        <div className="plaza-empty">
          <span className="plaza-empty-mark" aria-hidden>MC</span>
          <h3>Conectando con la redacción Folio…</h3>
          <p>Cargando las categorías y notas verificadas.</p>
        </div>
      </div>
    );
  }

  if (lectura) {
    const info = infoCat(lectura.cat);
    const paras = lectura.cuerpo.length ? lectura.cuerpo : [lectura.bajada];
    const etiquetaFoto = lectura.imagenIA || lectura.enVivo ? "Foto" : "Ilustración editorial";
    return (
      <div className="plaza-desk noti" data-guest-ok>
        <article className="noti-art">
          <button type="button" className="noti-back" onClick={() => { setAbierta(""); setDetalleM(null); }}>
            ← Volver a Noticias
          </button>
          <Meta noticia={lectura} nombre={info.nombre} color={info.color} />
          <h1>{lectura.titular}</h1>
          <p className="noti-bajada">{lectura.bajada}</p>
          <p className="noti-firma">
            {lectura.autor || "Redacción"} · {lectura.fecha} · {lectura.lectura} min de lectura
            {typeof lectura.vistas === "number" ? ` · ${lectura.vistas.toLocaleString("es-PE")} vistas` : null}
          </p>
          {lectura.notaLegal ? (
            <p className="noti-legal" role="note">
              <b>⚖ Aviso legal:</b> {lectura.notaLegal}
            </p>
          ) : null}

          <p className="noti-lead">{paras[0]}</p>
          <figure className="noti-fig">
            <Foto noticia={lectura} color={info.color} cual="a" alt={lectura.titular} />
            <figcaption>{etiquetaFoto} · {info.nombre}</figcaption>
          </figure>
          {paras[1] ? <p>{paras[1]}</p> : null}
          <figure className="noti-fig">
            <Foto noticia={lectura} color={info.color} cual="b" maestra={lectura.apoyo?.[0]} alt={`${lectura.titular} (apoyo 1)`} />
            <figcaption>Imagen de apoyo · {lectura.fuentes[0]?.medio ?? info.nombre}</figcaption>
          </figure>
          {paras[2] ? <p>{paras[2]}</p> : null}
          {paras.length > 3 ? (
            <figure className="noti-fig">
              <Foto noticia={lectura} color={info.color} cual="c" maestra={lectura.apoyo?.[1]} alt={`${lectura.titular} (apoyo 2)`} />
              <figcaption>Imagen de apoyo · {lectura.fuentes[1]?.medio ?? lectura.fuentes[0]?.medio ?? info.nombre}</figcaption>
            </figure>
          ) : null}
          {paras.slice(3).map((p, i) => (
            <p key={i}>{p}</p>
          ))}
          <section className="noti-fuentes" aria-label="Fuentes verificadas">
            <h3>✓ Fuentes verificadas{lectura.verificadaEn ? ` · ${lectura.verificadaEn}` : " antes de publicar"}</h3>
            {lectura.notaVerificacion ? <p className="noti-verfnote">{lectura.notaVerificacion}</p> : null}
            <ul>
              {lectura.fuentes.map((f, i) => (
                <li key={i}>
                  <b>{f.medio}</b>
                  {f.url ? (
                    <> — <a href={f.url} target="_blank" rel="noopener noreferrer">{f.url.replace(/^https?:\/\//, "").split("/")[0]}</a></>
                  ) : f.nota ? (
                    <> — {f.nota}</>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
          {lectura.canonica ? (
            <p className="noti-canon">
              <a href={lectura.canonica} target="_blank" rel="noopener noreferrer">Leer completa en Folio →</a>
            </p>
          ) : null}
          <p className="noti-catline">
            {enVivo ? <>{info.nombre} · {info.grupo}</> : <>Categoría {catPorId(lectura.cat).numero}/28 · {info.nombre} · {info.grupo}</>}
          </p>
        </article>

        <section className="noti-rel" aria-label="Noticias relacionadas">
          <h2>Relacionadas</h2>
          <div className="noti-grid">
            {rel.map((r) => {
              const ri = infoCat(r.cat);
              return (
                <article key={r.id} className="noti-card" onClick={() => abrir(r.id)}>
                  <Portada noticia={r} nombre={ri.nombre} color={ri.color} />
                  <div className="noti-card-body">
                    <Meta noticia={r} nombre={ri.nombre} color={ri.color} />
                    <h3>{r.titular}</h3>
                    <p>{r.bajada}</p>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="plaza-desk noti" data-guest-ok ref={topRef}>
      <header className="noti-hero-head">
        <div>
          <p className="plaza-kicker">PLA-05 · Noticias · {nCats} categorías verificadas{enVivo ? "" : " · edición local"}</p>
          <h1>Noticias</h1>
          <p className="noti-sub">
            {nCats} categorías · {nNotas} notas{enVivo ? "" : " (3 por categoría)"} · {enVivo ? "fotos y verificación de la redacción Folio" : "ilustración editorial por nota"} · fuentes verificadas antes de publicar.
          </p>
        </div>
      </header>

      <div className="noti-toolbar">
        <div className="noti-catdrop">
          <button
            type="button"
            className="noti-catbtn"
            aria-expanded={catsOpen}
            aria-haspopup="listbox"
            onClick={() => setCatsOpen(!catsOpen)}
          >
            <span>{cat ? infoCat(cat).nombre : "Categorías"}</span>
            <small>{cat ? conteo[cat] ?? 0 : nCats}</small>
            <i aria-hidden>{catsOpen ? "▴" : "▾"}</i>
          </button>
          {catsOpen ? (
            <>
              <span className="noti-catveil" onClick={() => setCatsOpen(false)} aria-hidden />
              <div className="noti-catpanel" role="listbox" aria-label="Categorías de noticias">
                <button type="button" role="option" aria-selected={cat === ""} className={cat === "" ? "on" : ""} onClick={() => elegirCat("")}>
                  Todas <small>{enVivo ? totalM || baseM.length : TOTAL_NOTICIAS}</small>
                </button>
                {grupos.map((g) => (
                  <div key={g} className="noti-catgroup">
                    <h4>{g}</h4>
                    {catsV.filter((cc) => cc.grupo === g).map((cc, ix) => (
                      <button
                        key={cc.slug}
                        type="button"
                        role="option"
                        aria-selected={cat === cc.slug}
                        className={cat === cc.slug ? "on" : ""}
                        title={cc.descripcion}
                        onClick={() => elegirCat(cat === cc.slug ? "" : cc.slug)}
                      >
                        <i style={{ background: cc.color }} aria-hidden>{cc.orden || ix + 1}</i>
                        {cc.nombre} <small>{conteo[cc.slug] ?? 0}</small>
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </>
          ) : null}
        </div>
        <label className="noti-search">
          <span aria-hidden>⌕</span>
          <input
            type="search"
            placeholder={`Buscar en las ${nNotas} notas…`}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Buscar noticias"
          />
          {q ? (
            <button type="button" onClick={() => setQ("")} aria-label="Limpiar búsqueda">×</button>
          ) : null}
        </label>
      </div>
      {cat ? (
        <p className="noti-activecat">
          Viendo <b>{infoCat(cat).nombre}</b>
          <button type="button" onClick={() => setCat("")} aria-label="Quitar filtro de categoría">×</button>
        </p>
      ) : null}
      {buscando ? <p className="noti-count">Buscando en la maestra…</p> : null}

      {!cat && !q && hero ? (
        <article className="noti-hero" onClick={() => abrir(hero.id)}>
          <Portada noticia={hero} nombre={infoCat(hero.cat).nombre} color={infoCat(hero.cat).color} grande />
          <div className="noti-hero-body">
            <Meta noticia={hero} nombre={infoCat(hero.cat).nombre} color={infoCat(hero.cat).color} />
            <h2>{hero.titular}</h2>
            <p>{hero.bajada}</p>
            <span className="noti-more">Leer nota →</span>
          </div>
        </article>
      ) : null}

      <section className="noti-main" aria-label="Listado de noticias">
        <p className="noti-count">
          {cat ? (
            <>Categoría <b>{infoCat(cat).nombre}</b>: {total} nota{total === 1 ? "" : "s"}</>
          ) : q ? (
            <><b>{total}</b> resultado{total === 1 ? "" : "s"} para “{q}”</>
          ) : (
            <>Página {actual} de {paginas} · <b>{total}</b> notas</>
          )}
        </p>
        {cargandoDet ? (
          <div className="plaza-empty">
            <span className="plaza-empty-mark" aria-hidden>MC</span>
            <h3>Abriendo nota…</h3>
          </div>
        ) : visibles.length === 0 ? (
          <div className="plaza-empty">
            <span className="plaza-empty-mark" aria-hidden>MC</span>
            <h3>Sin resultados</h3>
            <p>Pruebe con otra palabra o elija una de las {nCats} categorías.</p>
          </div>
        ) : (
          <div className="noti-grid">
            {visibles.map((n) => {
              const ni = infoCat(n.cat);
              return (
                <article key={n.id} className="noti-card" onClick={() => abrir(n.id)}>
                  <Portada noticia={n} nombre={ni.nombre} color={ni.color} />
                  <div className="noti-card-body">
                    <Meta noticia={n} nombre={ni.nombre} color={ni.color} />
                    <h3>{n.titular}</h3>
                    <p>{n.bajada}</p>
                    <span className="noti-more">Leer →</span>
                  </div>
                </article>
              );
            })}
          </div>
        )}
        <Paginador actual={actual} paginas={paginas} onIr={irPagina} />
      </section>
    </div>
  );
}

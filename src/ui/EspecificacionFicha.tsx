import { etiquetaKind, type EspecificacionTecnica } from "../lib/presupuesto";

export function EspecificacionFicha({
  s,
  n,
  metrado,
}: {
  s: EspecificacionTecnica;
  n?: number;
  metrado?: number;
}) {
  const metradoTxt =
    metrado != null
      ? metrado.toLocaleString("es-PE", { maximumFractionDigits: 3 })
      : null;
  return (
    <article className="et-ficha" id={`et-${s.codigo}`}>
      <header className="et-ficha-head">
        <div className="et-ficha-code">
          <span>Partida</span>
          <strong>{s.codigo}</strong>
        </div>
        <div className="et-ficha-title">
          {n != null ? <small>Ficha {String(n).padStart(3, "0")}</small> : null}
          <h3>{s.titulo}</h3>
          <p>
            {s.especialidad} · {s.capitulo}
          </p>
        </div>
        <div className="et-ficha-und">
          <span>Unidad</span>
          <strong>{s.unidad}</strong>
          {metradoTxt != null ? (
            <>
              <span>Metrado</span>
              <b>
                {metradoTxt} {s.unidad}
              </b>
            </>
          ) : null}
        </div>
      </header>

      <div className="et-ficha-body">
        <section>
          <h4>1. Descripción del trabajo</h4>
          <p>{s.definicion}</p>
        </section>

        <section>
          <h4>2. Alcance · incluye</h4>
          <ul>
            {s.incluye.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </section>

        <section>
          <h4>3. Análisis de precio unitario</h4>
          {s.apu.length ? (
            <table className="et-apu">
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Código</th>
                  <th>Insumo</th>
                  <th>Und</th>
                  <th>Cant. / P.U.</th>
                </tr>
              </thead>
              <tbody>
                {s.apu.map((row) => (
                  <tr key={`${row.codigo}-${row.nombre}`}>
                    <td>{etiquetaKind(row.kind)}</td>
                    <td>{row.codigo}</td>
                    <td>{row.nombre}</td>
                    <td>{row.und}</td>
                    <td>{row.cantidad}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p>Sin receta de catálogo.</p>
          )}
        </section>

        <section>
          <h4>4. Materiales</h4>
          <p>{s.materiales}</p>
        </section>
        <section>
          <h4>5. Mano de obra</h4>
          <p>{s.manoObra}</p>
        </section>
        <section>
          <h4>6. Equipo y maquinaria</h4>
          <p>{s.equipo}</p>
        </section>
        <section>
          <h4>7. Procedimiento de ejecución</h4>
          <ol>
            {s.procedimiento.map((paso) => (
              <li key={paso}>{paso}</li>
            ))}
          </ol>
        </section>
        <section>
          <h4>8. Método de medición</h4>
          <p>{s.metrado}</p>
        </section>
        <section>
          <h4>9. Bases de pago</h4>
          <p>{s.medicionPago}</p>
        </section>
        <section>
          <h4>10. Control de calidad y aceptación</h4>
          <ul>
            {s.controlAceptacion.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
        <section>
          <h4>11. Normas de referencia</h4>
          <ul>
            {s.normas.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      </div>
    </article>
  );
}

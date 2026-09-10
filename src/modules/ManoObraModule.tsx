import { useMemo } from "react";
import {
  CATEGORIAS_CC,
  CC_VIGENCIA,
  GG_CONDUCTOR,
  costoDia,
  costoHora,
  lineasJornal,
  loadPresupuesto,
  money,
} from "../lib/presupuesto";
import { printMemoria } from "../lib/printDoc";

function soles(n: number) {
  return `S/ ${money(n)}`;
}

export function ManoObraModule() {
  const state = loadPresupuesto();
  const hoy = new Date().toLocaleDateString("es-PE", { day: "2-digit", month: "long", year: "numeric" });
  const lugar = [state.direccion, state.distrito, state.provincia, state.departamento, state.lugar]
    .map((x) => (x ?? "").trim())
    .filter(Boolean)
    .filter((x, i, a) => a.indexOf(x) === i)
    .join(" · ");

  const filas = useMemo(
    () =>
      CATEGORIAS_CC.map((cat) => ({
        cat,
        lineas: lineasJornal(cat),
        dia: costoDia(cat),
        hora: costoHora(cat),
      })),
    [],
  );

  return (
    <div className="pdf-shell et-shell mo-shell">
      <header className="pdf-hero no-print">
        <p className="doc-kicker">PRE-06 · jornales de construcción civil</p>
        <h2>Mano de obra — desglose de jornales</h2>
        <p>
          En costo directo solo existen seis categorías: peón, oficial, operario, capataz, topógrafo y operador de
          maquinaria pesada. El oficio (armador, encofrador, albañil, gasfitero) no es un cargo distinto: es operario.
          Aquí está el desglose CAPECO–FTCCP: jornal, BUC (vestimenta, herramientas, alimentación), escolaridad,
          gratificaciones, vacaciones, CTS, EsSalud y CONAFOVICER.
        </p>
        <button type="button" className="pdf-add-esp" onClick={() => printMemoria(`Jornales CC — ${state.obra || "obra"}`, "et-printing")}>
          Imprimir / PDF
        </button>
      </header>

      <article className="et-doc paper">
        <header className="et-cover">
          <div className="et-cover-top">
            <div>
              <p className="et-brand">MemoriaCalc</p>
              <p className="et-cover-kicker">Expediente técnico de obra</p>
            </div>
            <div className="et-cover-doc">
              <span>Documento</span>
              <strong>PRE-06</strong>
              <em>Jornales de construcción civil</em>
            </div>
          </div>
          <h1>Desglose de jornales — régimen de construcción civil</h1>
          <p className="et-cover-lead">
            Convenio colectivo CAPECO — FTCCP. {CC_VIGENCIA.norma}. Vigencia {CC_VIGENCIA.desde} a {CC_VIGENCIA.hasta}.
            Jornada de {CC_VIGENCIA.jornadaHoras} horas. Seis días laborables. El costo hora del APU es el jornal
            completo (beneficios incluidos) dividido entre {CC_VIGENCIA.jornadaHoras} h.
          </p>
          <table className="et-meta">
            <tbody>
              <tr>
                <th>Obra</th>
                <td>{state.obra || "—"}</td>
              </tr>
              <tr>
                <th>Ubicación</th>
                <td>{lugar || "—"}</td>
              </tr>
              <tr>
                <th>Norma</th>
                <td>
                  {CC_VIGENCIA.norma} · {CC_VIGENCIA.convenio}
                </td>
              </tr>
              <tr>
                <th>Fecha</th>
                <td>
                  {state.fecha || hoy} · {hoy}
                </td>
              </tr>
            </tbody>
          </table>
        </header>

        <section className="mo-nota">
          <h3>Categorías de costo directo</h3>
          <p>
            No se usan oficios como «fierrero», «encofrador» o «albañil» en el APU. Esos trabajadores son{" "}
            <strong>operario</strong>. El oficial es el ayudante. El peón no está calificado. El capataz manda la
            cuadrilla. El topógrafo controla ejes. El operador de maquinaria pesada conduce equipo de obra. La mano de
            obra especializada (BAE) existe en el régimen, pero este expediente trabaja solo con las seis categorías
            oficiales.
          </p>
        </section>

        <section className="mo-resumen-wrap">
          <h3>Resumen del costo hora de APU</h3>
          <table className="et-apu mo-tabla">
            <thead>
              <tr>
                <th>Categoría</th>
                <th>Jornal básico</th>
                <th>BUC</th>
                <th>Costo día</th>
                <th>Costo hora</th>
              </tr>
            </thead>
            <tbody>
              {filas.map(({ cat, dia, hora, lineas }) => {
                const buc = lineas.find((l) => l.id === "buc")?.diario ?? 0;
                return (
                  <tr key={cat.id}>
                    <td>
                      <strong>{cat.nombre}</strong>
                      <div className="mo-rol">{cat.rol}</div>
                    </td>
                    <td>{soles(cat.jornal * cat.factor)}</td>
                    <td>{soles(buc)}</td>
                    <td>{soles(dia)}</td>
                    <td>
                      <strong>{soles(hora)}</strong>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        {filas.map(({ cat, lineas, dia, hora }) => (
          <section key={cat.id} className="et-ficha mo-cat">
            <h3>
              {cat.nombre}
              <small>
                {cat.id} · costo hora {soles(hora)} · costo día {soles(dia)}
              </small>
            </h3>
            <p>{cat.rol}</p>
            <table className="et-apu mo-tabla">
              <thead>
                <tr>
                  <th>Concepto</th>
                  <th>Base de cálculo</th>
                  <th>Importe diario</th>
                </tr>
              </thead>
              <tbody>
                {lineas.map((l) => (
                  <tr key={l.id} className={l.computable ? undefined : l.id.startsWith("vest") || l.concepto.startsWith("  ·") ? "mo-sub" : undefined}>
                    <td>{l.concepto}</td>
                    <td>{l.detalle}</td>
                    <td>{soles(l.diario)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={2}>Costo día cargado al APU (sin duplicar el desglose interno de la BUC)</td>
                  <td>{soles(dia)}</td>
                </tr>
                <tr>
                  <td colSpan={2}>Costo hora = costo día / {CC_VIGENCIA.jornadaHoras} h</td>
                  <td>{soles(hora)}</td>
                </tr>
              </tfoot>
            </table>
          </section>
        ))}

        <section className="et-ficha mo-cat">
          <h3>Escolaridad, vestimenta y beneficios</h3>
          <ul>
            <li>
              <strong>Vestimenta.</strong> Forma parte de la BUC (bonificación unificada de construcción). No se paga
              como partida suelta: ya está prorrateada en el jornal. Cubre ropa de faena, casco y calzado de obra.
            </li>
            <li>
              <strong>Colegio de los hijos (asignación por escolaridad).</strong> 30 jornales básicos al año por cada
              hijo en edad escolar (hasta 24 años si cursa estudios técnicos o superiores). El cuadro usa 1 hijo. Si hay
              más, se multiplica esa línea.
            </li>
            <li>
              <strong>Movilidad.</strong> {soles(CC_VIGENCIA.movilidad)} por día laborado. No es remuneración
              computable para CTS, gratificaciones ni EsSalud.
            </li>
            <li>
              <strong>Gratificaciones.</strong> 40 jornales al año (Fiestas Patrias y Navidad), prorrateados al día.
            </li>
            <li>
              <strong>Vacaciones truncas.</strong> 10 % del jornal básico.
            </li>
            <li>
              <strong>CTS.</strong> 15 % del jornal básico.
            </li>
            <li>
              <strong>EsSalud.</strong> 9 % de la remuneración computable.
            </li>
            <li>
              <strong>CONAFOVICER.</strong> 2 % del jornal básico, fondo de vivienda del trabajador de construcción
              civil.
            </li>
          </ul>
        </section>

        <section className="et-ficha mo-cat">
          <h3>Gastos generales — no es costo directo</h3>
          <p>{GG_CONDUCTOR.detalle}</p>
          <table className="et-apu mo-tabla">
            <thead>
              <tr>
                <th>Cargo</th>
                <th>Sueldo mensual</th>
                <th>Meses</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <strong>{GG_CONDUCTOR.cargo}</strong>
                </td>
                <td>{soles(GG_CONDUCTOR.sueldo)}</td>
                <td>{GG_CONDUCTOR.meses}</td>
                <td>{soles(GG_CONDUCTOR.sueldo * GG_CONDUCTOR.meses)}</td>
              </tr>
            </tbody>
          </table>
          <p>
            El conductor aparece en el organigrama de gastos generales (PRE-01), no en las recetas de partidas. El
            chofer de camioneta de residencia no se metra como operario ni como operador de maquinaria pesada.
          </p>
        </section>
      </article>
    </div>
  );
}

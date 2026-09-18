# Losa 2 dir., zapata corrida y platea — memorias clásicas

El cálculo vive en las memorias ya existentes del catálogo **Edificaciones**, no en una pestaña extra:

| Memoria | Slug | Motor |
| --- | --- | --- |
| Losa en dos direcciones | `losa-2dir` | `losa2d` |
| Zapata corrida | `zapata-corrida` | `zapataCorrida` |
| Platea de cimentación | `platea` | `platea` |

No hay módulo `maestria-estructuras` (Taller de maestría). El croquis clicable (`MaeCatalogHost`) está en el panel de cada memoria.

Si el usuario aún no ha pintado planta, se carga un **ejemplo de expediente** y se calcula completo. No se emite un recuadro vacío con «NO CUMPLE celdas = 0».

## Losa en dos direcciones — flujo

1. Defina el número de **Paños X / Y** y pulse **Crear ejes**. Aparecen los ejes en planta; las celdas empiezan vacías (hueco / patio).
2. Edite los **vanos** (decimales: 0,5 m, 1,2 m, 3,4 m). La geometría sale de esos vanos, no de un par A × B.
3. **Paño on/off**: verde = losa (techo); beige / trazos = hueco.
4. **Unir / separar**: clic en la **línea interior dorada** entre dos paños techo.
5. **Apoyo del eje**: viga / muro / libre.
6. Elija **losa maciza** o **losa aligerada** y pulse Calcular.

La memoria es expediente: identificación de cada paño (ℓx, ℓy, bordes, caso), pesos maciza/aligerada, wu = 1,4D+1,7L, ACI-3 y Marcus **por paño**, pórtico equivalente **por cada franja real**, As distinto por paño.

## Zapata corrida — pasos del expediente

1. Geometría: A = Σ bi ℓi, baricentro, Ixx e Iyy.
2. Cargas por columna P1–P3 y M1–M3, combinación Pu ≈ 1,5 P3 y momentos trasladados al suelo.
3. Esfuerzo neto E.050 y q = P/A ± Mc/I en vértices.
4. Prediseño de h (corte 1 dir., punzonamiento 11.12, flexión de vuelo).
5. Flexión de vuelo y As transversal.
6. Corte en una dirección φVc.
7. Punzonamiento Vu y φVn (perímetro recortado).
8. Viga invertida por tramos: Mu, Vu y As.
9. Desarrollo y anclaje ℓd (E.060 12.2).

## Platea — pasos del expediente

1. Geometría y columnas 6 GDL.
2. Metrado (columnas + platea + relleno + s/c).
3. Presión media y esfuerzo neto E.050.
4. Westergaard: rígida (Lc/l < 1,75) o flexible (×1,20).
5. Iteración del espesor t.
6–8. Método de fajas: franjas interior/borde en X e Y, momentos por cara.
9. Mallas inf./sup.
10. Punzonamiento Vu–φVn de cada columna.
11. Corte en una dirección.
12. Desarrollo y anclaje.

## Pesos de losa

- **Maciza:** 2,4 t/m³ × h.
- **Aligerada (Perú):** nervio + loseta + ladrillo hueco o EPS. Entre-eje típico 0,40 m.

## Límites

- No es un modelo de elementos finitos de placa ni Winkler de resortes (la platea flexible mayorá 1,20).
- Paños unidos deben formar rectángulos; una L en losa se parte en rectángulos.
- El despiece dibuja un Ø representativo por lecho **de cada paño**, no cada barra de la malla.

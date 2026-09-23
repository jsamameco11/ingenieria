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
4. **Unir / separar**: clic en la **línea interior dorada** entre dos paños techo. Eso **elimina la viga** de esa arista: un solo paño rectangular, sin eje interior. Clic otra vez (rojo discontinuo) **separa** y vuelve la viga. No une contra un hueco.
5. **Apoyo del eje**: viga / muro / libre.
6. Elija **losa maciza** o **losa aligerada** y pulse Calcular.

La memoria es expediente: identificación de cada paño (ℓx, ℓy, bordes, caso), pesos maciza/aligerada, wu = 1,4D+1,7L, ACI-3 y Marcus **por paño**, pórtico equivalente **por cada franja real**, As distinto por paño. El **acero negativo (superior)** usa longitud teórica (inflexión del pórtico o 0,30 ℓn) más extensión **máx(12 db, d, ℓn/16)** (E.060 / ACI 318 9.7.3.8.4 y 7.7.3.8); al menos 1/3 del As− se prolonga esa distancia. En dos direcciones la faja de apoyo cubre ~ℓn/4 a cada lado; **dentro de esa faja la barra se corta con L_teo+L_ext**, no a ojo. El despiece A1 concatena el acero (no un U por paño): As+ continuo con gancho 90° en extremos; As− un acero recto sobre el apoyo, gancho de un lado solo en extremo de análisis. Cada pieza muestra Ø en pulgadas.

## Zapata corrida — pasos del expediente

1. Geometría: A = Σ bi ℓi, baricentro, Ixx e Iyy.
2. Cargas por columna P1–P3 y M1–M3, combinación Pu ≈ 1,5 P3 y momentos trasladados al suelo.
3. Esfuerzo neto E.050 y q = ΣP/A ± Mc/I en vértices (columnas; no duplicar peso propio contra σn).
4. **Peralte h** (espesor): iteración de 5 en 5 cm con d = 100h − rec, h ≥ máx(35 cm, ℓv/2), Vu = qu(ℓv−d) ≤ φVc y punzonamiento 11.12 de **todas** las columnas (αs 40/30/20; α momento 1.00/1.15/1.25).
5. Flexión de vuelo **por paño** y As transversal (lecho inferior, ⊥ al eje).
6. Corte en una dirección: diagrama V(x) = qu x; sección crítica a d de la cara.
7. Punzonamiento Vu y φVn de **cada** columna (perímetro recortado a d/2 sobre el concreto pintado).
8. **Vigas de cimentación**: cada tramo continuo (VC) se analiza como viga invertida rígida (q lineal de equilibrio, M, V). Acero **n Ø** (no malla Ø @ s) y estribos φ(Vc+Vs). En el croquis, **Viga cim.** borra o coloca **un vano a la vez**. El vacío no es estructura.
9. Desarrollo y anclaje ℓd (E.060 12.2).

El despiece A1 es **en planta** (no hay corte perpendicular al eje ni acero a media altura). Las barras se **recortan al concreto pintado** (no cruzan el hueco de una L). **Lecho inferior** longitudinal **continuo** de extremo a extremo de cada franja. **Lecho superior** con **cortes**: L_barra = L_teo (≈ 0,30 ℓn) + ℓd, y extensión ≥ máx(d, 12 db, ℓn/16), gancho 90° en borde libre. En la ficha de columna, **esquinera** / **borde** mete el pedestal entero sobre el concreto (punzonamiento αs = 20 / 30). La viga invertida es de extremos libres: q(x) se calibra a las columnas para que M(0)=M(L)=0; un VC sin columnas no gobierna el diagrama.

## Platea — pasos del expediente

1. Geometría y columnas 6 GDL.
2. Metrado (columnas + platea + relleno + s/c).
3. Presión media y esfuerzo neto E.050: σn = σadm − γt Df − γc t − s/c. q en planta = ΣP/A ± Mc/I de **columnas** (no duplicar peso propio).
4. Westergaard: rígida (Lc/l < 1,75) o flexible (×1,20).
5. Iteración del espesor t por **punzonamiento y corte** (subir t no arregla σn).
6–8. Método de fajas: franjas interior/borde en X e Y, momentos por cara.
9. Mallas inf./sup. recortadas al concreto pintado (no cruzan huecos).
10. Punzonamiento Vu–φVn de cada columna, con α de momento 1.00/1.15/1.25. **Esquinera / borde** asienta el pedestal entero (αs = 20 / 30).
11. Corte en una dirección y VC gobernante (n Ø + estribos).
12. Desarrollo y anclaje.

## Pesos de losa

- **Maciza:** 2,4 t/m³ × h.
- **Aligerada (Perú):** nervio + loseta + ladrillo hueco o EPS. Entre-eje típico 0,40 m.

## Límites

- No es un modelo de elementos finitos de placa ni Winkler de resortes (la platea flexible mayorá 1,20).
- Paños unidos deben formar rectángulos; una L en losa se parte en rectángulos.
- El despiece dibuja **una malla en planta** (no corte de vigueta): positivo inferior **continuo** en la franja de techos (se corta en huecos), gancho 90° hacia el interior **en ambos extremos del tramo**; negativo superior **un solo acero** sobre el apoyo viga/muro, **sin doblez interior**, longitud **L_barra = L_teo + máx(12 db, d, ℓn/16)** y gancho 90° de un lado **solo en extremo de análisis** (borde libre o hueco). Cada pieza lleva Ø en pulgadas. Si Unir quitó la viga, no hay negativo ni eje ahí. Ø 3/8, 1/2, 5/8, 3/4, 1, 1¼, 1½ y s de norma; si un paño pide más momento se sube Ø o se aprieta s **solo en esa zona**.

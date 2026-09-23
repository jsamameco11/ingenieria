# Motor de despiece de aceros (A1)

Cada cálculo de flexión deja **una marca**: Ø, separación, cara, **As req / As disp**, **ℓd** y **recubrimiento**. Grosor de barra proporcional al Ø. No se dibuja la malla completa: una polilínea (o cortes) por lecho, **en su posición** (recubrimiento, lecho, ganchos 90°, desarrollo).

## Estribo tipo pantalla

El gráfico de zonas DC (concreto 1–7) es metrado de peso, no armado. El despiece A1 se genera en el paso 38 y en el tablero tras Calcular.

Aceros en el corte (franja 1,00 m):

- **1** pantalla trasdós: vertical contra la cara de tierra, **penetra la zapata** y se **apoya en el lecho inferior** con gancho 90°. No muere en la junta ni en el lecho superior.
- **2** pantalla intradós: sigue el talud, **penetra la zapata** y se **apoya en el lecho inferior** con gancho 90° (ambos verticales del alma).
- **3** lecho **inferior** de cimentación: **continuo de cara a cara** del peralte D (talón ↔ puntera), gancho 90° en ambos extremos.
- **4** lecho **superior** de cimentación: **continuo de cara a cara** del peralte D, gancho 90° en ambos extremos.
- **5** temperatura / distribución de zapata: cortes ⊥ a la flexión en **ambos lechos**, a lo ancho (incluido bajo el fuste).

Las cajas de marca se pegan al acero que describen (relleno junto al fuste, talud de intradós, talón izquierdo, puntera derecha), con líderes cortos. No tapan el concreto ni las cotas B, H, Lp, D.

Cada marca muestra As req, As disp, Ø, s, ℓd y rec. El recubrimiento se dibuja a trazos. Grosor de barra proporcional al Ø.

Sismo (paso 25, croquis `mSismo`): mismas posiciones que el muro de contención — **Pa (EH1X) a H/3**, **ΔPae = PAE−EH1X a 0,6 H**, **PIR = Kh·W en el c.g. ȳ**.

## Losa en 2 direcciones

Flujo: **Crear ejes** → marcar techos (verde) y huecos → **Unir/separar** con clic en la línea interior entre dos techos (**quita la viga**; un rectángulo). Vanos editables (0,5 m, 1,2 m). Geometría de los ejes, no de un par A×B.

El motor identifica paños, franjas y **tramos de acero** antes de analizar: un hueco corta las franjas y el positivo; Unir elimina el apoyo interior. Maciza (2,4 t/m³ × h) o aligerada (nervio + loseta + ladrillo/EPS). Una malla: Ø en pulgadas 3/8…1½ y s de norma, con refuerzo local si un paño pide más momento. El despiece A1 es **en planta** (análogo al corte de vigueta aligerada, no un U por paño): As+ continuo con gancho 90° en los extremos del análisis; As− = L_teo + máx(12 db, d, ℓn/16) en un acero recto sobre el apoyo, gancho 90° de un lado solo en borde libre. Cada pieza muestra Ø en pulgadas en el cuadro de marca.

## Zapata corrida

- **Zapata corrida** — **Despiece A1 en planta**: acero **solo en paños pintados**. **Un transversal por paño** (lecho inf., ganchos 90° en B, Ø del Mu de ese paño). **Un longitudinal inf. por franja**, continuo de extremo a extremo (no se corta). **Un longitudinal sup. por franja**, cortado en cada apoyo con L_teo (0,30 ℓn) + ℓd, proporcional al vano. Varilla fina. Punzonamiento 11.12 con pedestal asentado.

## Platea

Misma lógica de clics. Westergaard, franjas, espesor iterado, punzonamiento con gráfico Vu/φVn/OK.

## Muro en voladizo

Corte A-A a escala: **ambos** verticales del alma **penetran la zapata y se apoyan en el lecho inferior** con gancho 90°. Lechos superior e inferior de cimentación **continuos de cara a cara** del peralte, ganchos 90° en ambos extremos. Transversales de zapata y dentellón en corte (puntos) a lo ancho, sin hueco bajo el alma. Cara suelo del dentellón sube al alma; la otra cara ancla en la zapata con doblez. Cajas de marca pegadas al acero, líderes cortos. Cada marca lleva As req/disp, ℓd y rec.

## Reservorios / tanques INTZE

Pared por zonas (base–corona) con Whitney. Collarines superior e inferior a tracción de anillo + flexión local. Fuste: verticales en dos caras, horizontales y anillos de arriostre cada 2,5–3,5 m, confinamiento en ℓp de la base. Torre < 500 m³: cada nivel de viga de anillo y columnas con estribos E.060 21.4. Cúpulas y agua como casquetes esféricos, no polígonos.

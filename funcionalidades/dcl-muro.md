# Diagrama de cuerpo libre del muro

El DCL del muro de contención en voladizo es una **elevación 2D** (franja de 1.00 m), no un isométrico. Lo arma el motor `src/lib/dcl/muroVoladizo.ts` y lo dibuja `src/components/DclMuroVoladizo.tsx`.

Las cargas distribuidas (triángulo, rectángulo, trapecio) las pinta `src/components/DclCargas.tsx`: envolvente + flechas hacia la cara, no un polígono con una etiqueta.

## Qué muestra

- Sección acotada: puntera C, alma F / B′, talón A, ancho B, altura H, pantalla Hs, peralte e, desplante D y corona B′.
- Si el FS al deslizamiento no cumple, el croquis muestra el **dentellón** bajo el fuste (hk × bk) con su nombre técnico.
- **Empujes en columnas, al costado derecho**, sin superponerse: Pa (triángulo, resultante a H/3), Pq (rectángulo de sobrecarga), Pw (agua) y ΔPae (sismo, a 0,6 H). Cada carga lleva su etiqueta encima.
- En el croquis de **Cimentación y pantalla**, Pa y Pw van en **columnas al costado** (no superpuestas), con envolventes más estrechas. Las cotas de h″ y del peralte del talón quedan a la derecha de las cargas.
- Peso W en el centro de gravedad, con x̄, en una placa aparte.
- Presión de contacto q(x) bajo la zapata, también como carga distribuida (flechas hacia arriba).
- Reacciones Rh (deslizamiento) y Rv (vertical, en x̄).

## Sismo — posiciones de aplicación (paso 11)

El croquis `mSismo` (`src/components/MuroDidactica.tsx`) detalla **dónde** actúa cada acción sísmica:

- **Pa** estático, resultante a **H/3** desde la base.
- **ΔPae** de Mononobe–Okabe, resultante a **0,6 H** (COVENIN). Si Pae ≤ Pa, ΔPae = 0: se dibuja a trazos y no hay incremento de tierra.
- **PIR = Kh·W**, inercia del muro y relleno, en el **centro de gravedad ȳ** (no en 0,6 H). Gobierna el deslizamiento sísmico cuando ΔPae es nulo.
- **Kv·W**, alivio vertical del peso, también en el c.g.
- Cota vertical didáctica: base, H/3, ȳ, 0,6 H y H.

El estribo tipo pantalla usa el mismo criterio (`SismoEstriboFig`, paso 25): Pa = EH1X a H/3, ΔPae = PAE−EH1X a 0,6 H y PIR en ȳ del metrado DC+EV.

## Dónde sale

- Tras el paso 01: croquis geométrico con todas las cotas (`mGeom`).
- Tras el paso 03: DCL de empujes y reacciones (`mDCL`).
- Tras el paso 07b: prediseño y plano de deslizamiento del dentellón (`mDentellon`).
- Tras el paso 11: aplicación de las acciones sísmicas (`mSismo`).
- El mismo croquis acotado sigue en la ficha de la izquierda.

# Dentellón del muro en voladizo

Si el **FS al deslizamiento** (estático o sísmico) no alcanza el mínimo, el motor **prediseña** un **dentellón** (taco / diente de cimentación) bajo el fuste, lo **itera** y lo **verifica** (estabilidad + sección E.060). El paso dedicado es el **07b**, con croquis didáctico (`mDentellon`).

## Predimensionamiento

- Sin llave se calcula `FS_d` y `FS_d,sis`.
- Si alguno falla, `bk = F` (mismo ancho que el alma, **bajo el fuste**, no bajo la puntera).
- `hk,pre = máx(e, 0,30 m)`, acotado a 0,60 m. Se itera `hk` de 5 en 5 cm hasta 0,60 m (llave típica 0,30–0,60 m; Bowles, Das, FHWA). Más de 0,60 m deja de ser constructivo en un muro de esta escala.
- El plano de deslizamiento baja a `D + hk`: `Pp = ½ Kp γsat (D+hk)²`.
- El peso del dentellón entra al metrado (zona 6).
- `ΔPp = Pp − Pp0` es la fuerza extra que flexiona el taco.

## Verificación de sección

El taco se diseña como voladizo corto de espesor `bk` y altura `hk` (franja 1,00 m):

- `Vu = 1,4 ΔPp`
- `Mu = Vu · hk/2`
- Acero U anclado en la zapata (`designFranja`, recubrimiento de zapata).
- Se sella `φMn ≥ Mu` y `φVc ≥ Vu`.

## Croquis

El alma se dibuja **trapezoidal** en todos los cortes: espesor `F` en la base y `B′` en coronación (talud en intradós y trasdós).

Si hay dentellón, aparece con su nombre técnico en:

- Croquis de metrados
- Croquis de geometría (ficha)
- DCL
- Despiece de aceros (barra en U, marca 5)
- Figura del paso 07b: plano D vs D+hk, Pp, cotas `bk × hk` y prediseño

Si el muro ya cumple al deslizamiento, **no** se dibuja ni se vierte concreto de taco.

## Despiece

Una marca por lecho. El corte se dibuja grande, a escala de plano. Barras **delgadas** (cerca de la escala real, levemente exageradas):

- **1** longitudinal vertical al **trasdós** (flexión, continúa en la zapata, gancho 90° al lecho superior del talón, ℓd).
- **2** longitudinal vertical al **intradós** (reparto, sigue el talud, entra a la zapata y ancla en el lecho inferior de la puntera).
- **3** temperatura horizontal en corte, **interior** a los verticales, ambas caras.
- **4 / 5** zapata inferior (puntera, flexión) y **superior** (reparto / talón), ganchos 90° **en ambos extremos**, continuidad bajo el fuste.
- **6** transversales de zapata en corte, a lo ancho (incluido bajo el alma).
- **7 / 8 / 9** dentellón si hay llave: **7** cara de suelo (dowel al alma, capa interior, sin coincidir con el intradós); **8** cara interior (gancho 90° en la zapata, no llega al fuste); **9** longitudinales del taco en corte, interiores al recubrimiento y desfasados de los verticales.

Cajas de marca pegadas al acero (no flotando al borde ni tapando el concreto). Cotas de Corona, Intradós, Trasdós, Puntera, Cimentación y Dentellón.

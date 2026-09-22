# Muro de sostenimiento en voladizo — expediente con motor propio de elementos finitos

Módulo `muro-sostenimiento` (Estructuras especiales). Cubre el expediente completo
de un muro en voladizo y lo resuelve **por dos vías en paralelo**: el cálculo
analítico clásico y un modelo de elementos finitos propio. El usuario elige con
qué vía se arma el acero; la memoria deja constancia de las dos y de su contraste.

No hay ninguna conexión con software externo de análisis: el motor FEM es propio
y vive en `src/lib/fem/`.

## Motor de elementos finitos (`src/lib/fem/`)

| Archivo | Qué hace |
| --- | --- |
| `shell.ts` | Lámina plana de 4 nodos: flexión MITC4 (libre de bloqueo por cortante) + membrana Q4, con 6 GDL por nodo. Cargas de superficie con tracción arbitraria. |
| `solve.ts` | Ensamble en perfil *skyline*, reordenamiento **RCM** para reducir el ancho de banda, factorización directa **LDLᵀ** y eliminación de GDL apoyados (sin penalizaciones que mal condicionen la matriz). Lazo de contacto para resortes **sin tracción**. |
| `woodArmer.ts` | Convierte Mxx, Myy y Mxy en momentos de armado ortogonal para cara superior e inferior. |

Verificación: `npx tsx scripts/check-fem.mts` contrasta el núcleo contra
soluciones cerradas (placa en voladizo, placa simplemente apoyada, membrana en
tracción pura, viga sobre fundación elástica de Hetényi, despegue de resortes y
los seis casos de Wood & Armer).

## Modelo del muro (`src/lib/engines/muro/`)

- `perfil.ts` — perfil geotécnico multicapa con nivel freático y sobrecarga.
  Coeficientes por Rankine, Coulomb o reposo (K₀ de Jáky), e incremento sísmico
  por el criterio simplificado de la E.050 §39.13.4 o por **Mononobe–Okabe**
  completo.
- `fem.ts` — mallador del muro: fuste y zapata con láminas MITC4 sobre resortes
  de Winkler. El fuste se modela desde el plano medio de la zapata, con un tramo
  embebido que aporta la rigidez del nudo pero no recibe carga propia (así no se
  contabiliza dos veces el volumen del encuentro). Casos CM, CV, CE y CS, y las
  seis combinaciones de la E.060 §9.2.
- `estabilidad.ts` — deslizamiento, volteo, excentricidad y presión de contacto,
  en estático y pseudo-dinámico, con uña y empuje pasivo reducido.
- `diseno.ts` — diseño de franja de 1 m por E.060: flexión, cortante, cuantías
  mínimas y longitud de desarrollo.
- `engine.ts` — orquesta las 9 secciones del expediente y publica los datos de
  las figuras.

## Inercia sísmica: el relleno no se cuenta dos veces

La fuerza de inercia kh·W actúa **solo sobre el concreto** por omisión: la
inercia de la cuña de relleno ya está dentro de ΔPae, y volver a sumarla la
duplica. El campo «Masa que genera la fuerza de inercia kh·W» permite incluir
también el relleno sobre el talón si el EMS pide tratar el bloque muro-relleno
como un sólido. La opción afecta por igual a la estabilidad y al modelo FEM.

Un solo módulo (`muro-sostenimiento`) cubre lo que antes se listaba como muro de
contención y muro de sostenimiento: es el mismo elemento. El enlace antiguo
`muro-contencion-sismo` redirige aquí.

## Selector de método

El campo «Método de diseño» decide si el armado lo gobierna el cálculo analítico
o la envolvente FEM. La sección 8 tabula las dos columnas:

- **En el fuste las dos vías coinciden** (dentro del 5 %): es un voladizo
  isostático y el momento en su arranque solo depende del empuje aplicado, no de
  la rigidez del apoyo. Una diferencia apreciable ahí delata un dato mal
  introducido.
- **En la zapata la diferencia es esperable** y suele favorecer al FEM: el método
  analítico supone presión lineal y dos voladizos independientes, mientras el FEM
  reparte la presión según la rigidez relativa zapata–suelo y reconoce el nudo
  como marco rígido.

## Figuras (`src/components/MuroSostenimientoFig.tsx`)

Siete croquis, todos dibujados con los resultados de la corrida vigente:

1. `esquema` — geometría acotada, estratos, nivel freático, sobrecarga y uña.
2. `empujes` — presión lateral estática y envolvente sísmica, con retícula de
   profundidad y las resultantes en su punto de aplicación.
3. `estabilidad` — cuerpo libre (bloques de peso, Eh, ΔPae, Fi, Ep) y diagrama
   de presiones de contacto con la excentricidad.
4. `malla` — malla de láminas y resortes de Winkler.
5. `calor` — mapa de la envolvente de Wood & Armer por elemento.
6. `presiones` — reparto lineal frente a la reacción de los resortes.
7. `despiece` — armado con posiciones ①–⑥, ℓd, punto de corte y ganchos.

Las cotas se colocan por nombre de lado (`izq`, `der`, `arriba`, `abajo`) y no
por el signo de una distancia, porque ese signo depende del orden de los
extremos y colocaba cotas del lado contrario.

## Verificación

```
npx tsx scripts/check-fem.mts                  # núcleo FEM contra soluciones cerradas
npx tsx scripts/check-muro-fem.mts             # malla, cargas, equilibrio y envolvente
npx tsx scripts/check-muro-sostenimiento.mts   # expediente, figuras y sensibilidad física
npx tsx scripts/render-muro-figs.mts .tmp-figs # vuelca las 7 figuras a SVG para revisarlas
```

El ejemplo por defecto cumple las 13 verificaciones de norma, y el test lo exige:
si un cambio deja el ejemplo con un FS por debajo del mínimo, falla.

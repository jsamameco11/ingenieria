# Fórmulas KaTeX en la memoria

Las ecuaciones de cada paso se escriben en LaTeX y se **renderizan con KaTeX** en la hoja A4. No se muestran como una sola línea de código plano.

## Qué ve el usuario

- Bloque **Fórmula**: modo display, una ecuación por renglón (`aligned`), fracciones, raíces y subíndices tipográficos.
- **Sustitución** y **resultado**: si la línea es una asignación (`ρ = …`, `H = 4.00`), también va en KaTeX.
- El párrafo explicativo del **Cálculo** sigue en texto; solo las líneas que son ecuación se renderizan.
- Al **Imprimir / PDF** se imprime el mismo KaTeX (fuentes y color exactos), no el ASCII crudo.
- El bloque de fórmula **no lleva fondo distinto**: mismo papel que el resto de la hoja.

## Cómo se arma

- Si el motor trae `formulaTex`, se apilan los `\qquad` en un `aligned`.
- Si no hay LaTeX (p. ej. varios módulos geotécnicos), se convierte el texto Unicode (`ρmín`, `√f'c`, `tan²`) a LaTeX.
- El muro de contención con sismo (pasos 01–20) ya lleva `formulaTex` propio.

## Archivos

- `src/components/Formula.tsx` — render KaTeX
- `src/lib/tex.ts` — apilado y conversión ASCII → LaTeX
- `src/ui/Paper.tsx` — fórmula, cálculo, sustitución y resultado
- `src/styles.css` — presentación en pantalla y `@media print`

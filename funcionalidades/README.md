# Funcionalidades — MemoriaCalc

Catálogo vivo de lo que hace el sitio. Actualizar esta carpeta cuando cambie el comportamiento.

| App | Dominio |
| --- | --- |
| Sitio público | `ingenieria.miacademiapreu.com` |
| Panel de control | `control-ingenieria.miacademiapreu.com` |

## Memorias de cálculo

- Módulos de hidrología, hidráulica, estructuras, geotecnia, puentes, tanques y más.
- Cada paso de memoria muestra fórmula, cálculo, sustitución, resultado y criterio de norma.
- **Las fórmulas se renderizan con KaTeX** (modo display, ecuaciones apiladas), en pantalla y al imprimir PDF, **sin recuadro de otro color**.
- El muro de contención lleva croquis acotado con cada valor y un **diagrama de cuerpo libre 2D** (no isométrico). Pa, Pw, Pq y q(x) se dibujan como **carga distribuida** (envolvente + flechas).
- La **deflexión de servicio** de la pantalla se calcula paso a paso (Branson + elástica). Si no cumple Hs/150, el espesor F se aumenta automáticamente hasta cumplir.
- El **alma se dibuja con talud** (F en la base, B′ en coronación) en metrados, DCL, geometría y despiece. Si el muro desliza, se prediseña y verifica un **dentellón** (taco) bajo el fuste (paso 07b). El despiece de aceros se renderiza grande, con barras visibles y cotas de plano. El sismo se dibuja con las posiciones de Pa (H/3), ΔPae (0,6 H) y PIR (centro de gravedad).
- **Motor de despiece A1**: un Ø representativo por cálculo (estribo pantalla, losa 2 dir. con grilla de paños techados, zapata corrida con columnas 6 GDL y dos cortes, platea por franjas, reservorios por zona).

## Presupuesto y Revit

- PRE-0R conecta el add-in (código + sync), cruza el modelo con una plantilla RN, permite unir o crear partidas y carga PRE-01.
- El plugin extrae familias y volúmenes HOST; **no calcula encofrado** y el acero solo sale si hay armadura modelada. El instalador se genera con `src/revit-addin/build.ps1`; en el repo no van las DLL.

## Panel de control

- Inventario de usuarios, planes, equipos y comercio en `control-ingenieria.miacademiapreu.com`.
- El censo entra por `/api/control/snapshot`. Si esa ruta no llega a Node, el panel **no** declara «0 cuentas»: avisa que no pudo leer. Las cuentas siguen en Supabase.

Detalle:

- [Fórmulas KaTeX (pantalla e impresión)](formulas-katex.md)
- [DCL del muro de contención](dcl-muro.md)
- [Deflexión de la pantalla](deflexion-muro.md)
- [Dentellón y talud del alma](dentellon-muro.md)
- [Vincular Revit → presupuesto (auditoría)](revit-presupuesto.md)
- [Inventario de usuarios (panel)](control-inventario.md)
- [Motor de despiece de aceros A1](despiece-aceros.md)

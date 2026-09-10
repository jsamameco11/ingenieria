# Auditoría 18 — Instrucciones Revit → Presupuesto (¿sirven para producción?)

**Objeto:** Instrucciones 16 y 17.  
**Referentes de producción:** Cost-it + Presto (RIB), MedBIM + Arquímedes (CYPE), CostX / iTWO, Navisworks Quantification, Cubicost (Glodon).  
**Fecha:** 5 de septiembre de 2026.  
**Dictamen:** las instrucciones son un **buen pliego de producto para un MVP de concreto en edificaciones**. **No** están completas para armar un conector de **producción** comparable a Cost-it. Construir ahora «como si ya estuviera en el mercado» saldría un exportador frágil.

---

## 1. Veredicto

| Pregunta | Respuesta |
|---|---|
| ¿La idea es correcta y profesional? | **Sí.** Un elemento → varias partidas RN, plantilla que filtra, Actualizar con delta, no regenerar el presupuesto. Eso es oficio, no un dump. |
| ¿El mapeo a su catálogo (EST-04.01.xx) está bien pensado? | **Sí.** Mejor anclado a Perú que el Cost-it «de fábrica», que exporta tipos Revit como unidades de obra y reestructura después. |
| ¿El Actualizar tipo Presto está bien especificado? | **Sí en criterio** (altas / bajas / modificados / aceptación / recompute / UniqueId). Faltan casos reales de oficina (vínculos, fases, central). |
| ¿Se puede implementar ya un Cost-it? | **No.** Falta el motor de medición, el add-in de producción y la hoja de configuración portable. |
| ¿Se puede implementar un MVP honesto? | **Sí, con condiciones:** solo pórticos de concreto en un RVT no vinculado, y cerrando los bloqueantes de la §4. |

**Nota de nombre:** el plugin de Presto se llama **Cost-it** (a veces Cost-It), no «Cossit». El de CYPE es **MedBIM – Revit** hacia Arquímedes.

---

## 2. Qué hace cada referente (y qué copiamos bien)

### Cost-it + Presto (el que usted oyó)

Add-in en Revit. Mide sin parámetros propios (usa Código de montaje, Nota clave, categorías nativas). Un elemento puede tener **varias unidades de obra** (hormigón + encofrado + armadura) **duplicando categorías** y criterios (volumen, área L×H, peso, expresión). Exporta / Añade / compara líneas. Escribe códigos de vuelta al modelo. Localiza y colorea. Respeta **fase** de la vista 3D. Descuenta **huecos** mayores de un umbral. Tiene **hoja de configuración** (`.CostitLayout`) reutilizable entre modelos. Scripts JS para códigos. IFC aparte (IFCost). Viewer de Revit para casi todo. No localiza bien elementos de **vínculos**. Encofrado circular y muros con fase de derribo van documentados.

**Lo que ya tenemos bien (16/17):** varias partidas por elemento; Actualizar ≠ exportar de nuevo; aceptación selectiva; no pisar lo manual; UniqueId; escribir códigos; localizar; pie económico; herencia de código del tipo en altas.

**Lo que Cost-it tiene y nosotros no escribimos:** criterios de medición por categoría (no solo «volumen HOST»), descuento de huecos, fases, layout portable, Assembly Code / Keynote nativos, expresiones, habitaciones/áreas, IFC, Viewer, colorear por partida, certificación 4D/5D.

### MedBIM + Arquímedes (CYPE)

Dos comandos en cinta: extraer (`.mcsv`) y **vincular a una obra ya abierta**. La unidad de la partida manda la magnitud que se lee del tipo. Notas clave. Se pueden crear partidas nuevas. Sincroniza omisiones modelo ↔ presupuesto.

**Lo que ya tenemos bien:** archivo de intercambio + vínculo a obra existente + crear partida + huecos de plantilla.

**Falta:** unidad de la partida como criterio de medición (ellos lo resuelven muy bien); formato de extracción estable y documentado para terceros; vínculo a obra abierta como flujo primario (nosotros lo pusimos en fase tardía).

### CostX / iTWO (RIB)

QTO 2D+3D/IFC. Las cantidades viven en el modelo de coste y se **refrescan** al cambiar el BIM. No es un plugin «dentro de Revit» como Cost-it; es un tomador que come RVT/IFC.

**Lección:** el valor de producción es **revisión de modelo + delta de cantidades**, no el listado bonito la primera vez. Nuestra 17 apunta ahí. CostX además mide **planos 2D** cuando el BIM no está. Nosotros no (y no hace falta en v1).

### Navisworks Quantification

Libro de toma, catálogo, search sets, actualización al cambiar el NWD. Filtros potentes. No presupuesta APU peruano.

**Lección:** en modelo grande no se itera «todas las categorías». Se miden **conjuntos**. Nos falta search set / filtro por workset, fase, parámetro.

### Cubicost (Glodon)

Fuerte en concreto/encofrado/acero con **reglas de cálculo de encofrado** (caras, encuentros, no cobrar junta). Eso es años de motor geométrico.

**Lección:** decir «suma de caras laterales, no contar juntas» **no es implementable** sin un capítulo de caras, intersecciones viga-columna y losa-viga. Sin eso el encofrado de producción miente.

---

## 3. Puntuación (0–10) frente a un conector de producción

| Dimensión | Nota | Comentario |
|---|---|---|
| Visión de producto y mapeo RN Perú | 8.5 | Lo más sólido. No copiar tipos Revit como partidas. |
| Flujo Actualizar (tipo Presto) | 8.0 | Criterio correcto. Faltan vínculos, fases y alcance cambiado. |
| Pestaña web + plantilla + crear partida | 8.0 | Didáctico y alineado a MemoriaCalc. |
| Motor de medición (m³, m², kg reales) | 4.0 | Volumen de sólido sí; encofrado, aligerado neto y huecos no. |
| Interoperabilidad (links, IFC, Assembly Code) | 3.0 | Casi ausente. En oficina peruana el estructural suele ir **vinculado**. |
| Add-in de producción (versiones, instalador, errores, 50 k elementos) | 2.5 | No hay pliego de ingeniería. |
| Completitud para implementar ya | 5.5 | Un equipo senior improvisaría la mitad. Eso no es A1 de producción. |

Cobertura estimada respecto de Cost-it (superficie de producto, no de calidad de APU): **~40 %**. Respecto de un MVP de pórticos de concreto: **~70 %** de instrucciones de negocio, **~35 %** de instrucciones de ingeniería.

---

## 4. Bloqueantes — no se arma producción sin esto

Estos capítulos **no existen** o están en una frase. Hay que redactarlos antes de programar el add-in «en serio».

### B1. Modelos vinculados y UniqueId

Cost-it reconoce que **no localiza** bien líneas de vínculos. En Perú el RVT de arquitectura vincula estructuras. Si solo se lee el documento anfitrión, el presupuesto sale vacío o a medias.

Falta: ¿se miden `RevitLinkInstance`? ¿Documento transformado a coordenadas del anfitrión? ¿Clave = `LinkUniqueId + Element.UniqueId`? ¿Un link descargado cuenta como «eliminado» (falso positivo grave)?

### B2. Motor de encofrado (no un comentario)

Cost-it duplica categoría y usa área L×H o expresiones; Cubicost calcula caras. Nosotros dijimos «caras laterales menos juntas» sin:

- qué caras (laterales, fondo de viga, cielo de losa, zapata);
- intersección columna–viga–losa (la junta no se cobra dos veces);
- huecos de puerta/ventana en muro de concreto;
- pilares circulares;
- tolerancia y fallback si falla `Face`.

Sin B2, `EST-04.03.xx` no es metrado profesional.

### B3. Losa aligerada neta

«Si Revit da volumen lleno, advertir» no basta. Hay que fijar el método: volumen sólido menos ladrillos (fórmula RN o familia con vacíos), o espesor equivalente × área. Si no, el concreto de losa (la partida más gorda) sale mal y el APU miente.

### B4. Fases y derribo

Cost-it mide según la fase de la vista 3D (creación ≤ fase, sin derribo). Un RVT de ampliación tiene demolición + nuevo. Hoy todo se sumaría al concreto nuevo.

### B5. Hoja de configuración portable

Cost-it: `.CostitLayout` se aplica a muchos RVT **sin modificar el modelo**. MedBIM: asociación tipos ↔ partidas en Arquímedes. Nosotros: diccionario en código + reglas de obra + `MC_*`.

Falta un archivo `obra.mcrevit.map.json` (familia/tipo/categoría → códigos + criterio de medición) versionable, compartible con la oficina, independiente del RVT.

### B6. Código de montaje y Nota clave

Estándar BIM (OmniClass / UniFormat / oficina). Cost-it y MedBIM los leen **primero**. Nosotros inventamos `MC_*` y no mencionamos Assembly Code. Un modelo bien hecho ya trae códigos; ignorarlos es poco profesional.

### B7. Add-in de producción

No hay: matriz Revit 2023–2026 (un `dll` por año), manifiesto `.addin`, instalador, firma Authenticode, Viewer vs edición, barra de progreso, cancelar, try/catch **por elemento**, log `%AppData%\MemoriaCalc\revit\`, tope de memoria, modelos de 30–80 mil elementos, transacciones al escribir parámetros, worksharing (quién graba ExtensibleStorage en el central).

Sin B7 el plugin se cae en el primer RVT real.

### B8. Alcance y search sets

«Todo el documento» en un hospital es impresentable. Falta: workset, fase, selección, filtro por parámetro, «solo estructural». Si el alcance cambia entre dos Actualizar, las bajas falsas (17 lo menciona) necesitan **regla**: no marcar eliminado lo que quedó fuera de alcance.

### B9. API y concurrencia (si hay nube)

Los `POST /api/presupuestos/:id/revit/delta` no existen. Falta contrato OpenAPI, auth del add-in, tamaño máximo, `revisionBase` (eso sí está), idempotencia, obra compartida con colega Plan Pro (dos Actualizar a la vez).

### B10. Requisitos del modelo (BEP corto)

Cost-it asume que el usuario entiende familias/tipos. Un producto de producción entrega **una página**: material estructural obligatorio, no in-place para pórticos, losa aligerada con vacíos o parámetro de espesor equivalente, zapatas como Foundation, no Generic Model. Sin eso el clasificador por palabras (`aliger`, `ciment`) falla en oficinas que nombran `L-01` y `V-02`.

---

## 5. Huecos graves (v1 puede vivir; no se proclame paridad Cost-it)

| Hueco | Quién lo resuelve en el mercado | ¿v1? |
|---|---|---|
| IFC (el estructurista no entrega RVT) | IFCost, CostX, Cubicost | No |
| Habitaciones, áreas, útiles vs construidas | Cost-it | No |
| Acabados / materiales / pintura | Cost-it capítulos de materiales | No |
| Expresiones / scripts de medición | Cost-it JS | No |
| Colorear modelo por partida / certificación | Cost-it + Presto gestión | No |
| 4D / Gantt sobre el modelo | Cost-it + Presto planificación | No (ya tienen cronograma web) |
| Planos 2D cuando no hay BIM | CostX, Presto lectura DWG | No |
| Grupos, assemblies, parts de Revit | Cost-it parcialmente | No |
| Design options | — | No |
| Acero: empalmes, ganchos, desperdicio RN | Despiece, no QTO bruto | Correcto no inventar kg; falta desperdicio 5 % al anexar si se decide |

---

## 6. Lo que está bien y no se debe desarmar

1. **Un elemento ≠ una partida.** Concreto / encofrado / acero. Cost-it lo hace duplicando categorías; nosotros lo dejamos explícito en RN. Mantener.  
2. **La plantilla manda.** MedBIM vincula a obra existente. Misma idea.  
3. **No inventar acero ni códigos de catálogo.** Oficio.  
4. **Actualizar = delta + recompute, no suma de Δ encadenados.** Correcto y mejor que muchos clones.  
5. **Eliminado no borra la partida.** Presto/Cost-it también evitan el wipe.  
6. **Metrado manual no se pisa.** Imprescindible en obra real.  
7. **Crear partida de obra con `origenCodigo`.** Alineado a MemoriaCalc.  
8. **f'c 280 ≠ inventar EST-99.** Conflicto + clonar. Correcto.

---

## 7. Defectos internos de las instrucciones 16 y 17

| Defecto | Dónde | Qué hacer |
|---|---|---|
| El flujo 16 §2 sigue diciendo «Exportar» y la 17 dice «Enviar / Actualizar» | 16 §2 | Unificar nombres de cinta |
| Grupo vs UniqueId: ¿se anexa un metrado resumido o líneas por ejemplar? | 16 agrupa; 17 diferencia por ejemplar | Decir: **medir y diferir por UniqueId; anexar sumando a la partida**. El presupuesto no debe nacer con 800 líneas de columnas |
| `grupoId` como hash de clave: si cambia el nivel o el nombre de tipo, el grupo «muere» y parece baja | 16 §4.2 | El grupo es vista; la clave estable es UniqueId |
| Fase E (16) vs C2–C5 (17) | Ambos | Un solo roadmap |
| Palabras clave (`aliger`, `column`) como clasificador principal | 16 §5 | Debe ser **tercero**, detrás de Assembly Code / `MC_CODIGO` / categoría+material |
| «No contar juntas» sin algoritmo | 16 §4.3 | Mover a capítulo B2 o quitar la promesa |
| API y OAuth descritos como si existieran | 17 §10–12 | Marcar «por diseñar»; el MVP archivo+delta local es el camino real |
| Una obra por RVT | 17 §2.10 | Correcto para v1; documentar dos edificios en un RVT (alcance por selección) |

---

## 8. ¿Las instrucciones bastan para programar?

| Destinatario | ¿Puede implementar sin inventar? |
|---|---|
| Motor web de mapeo (fase A) + pestaña (fase B) + JSON de ejemplo | **Sí**, con matices de §7 |
| Add-in que exporta columnas/vigas/losas de un RVT de juguete | **Casi sí** |
| Add-in de producción en oficina (central, links, 40 k elementos, Actualizar cada semana) | **No** |
| Paridad Cost-it / MedBIM | **No** — faltan B1–B10 y la §5 |

Un desarrollador de Revit API que lea solo 16 y 17 tendrá que **inventar** encofrado, links, fases, instalador y criterios de losa. Eso no es un pliego A1 de producción.

---

## 9. Instrucciones que faltan (para completar el expediente)

Redactar **antes** de programar el add-in, no después:

1. **19 — Motor de medición** (volumen neto, encofrado por caras, huecos, redondeo, fallos de geometría).  
2. **20 — Alcance del modelo** (documento / vínculo / fase / workset / selección; UniqueId de links).  
3. **21 — Hoja de mapeo portable** + Assembly Code + Nota clave + `MC_*`.  
4. **22 — Add-in de producción** (versiones Revit, `.addin`, instalador, log, progreso, worksharing, Viewer).  
5. **23 — Requisitos BIM de modelado** (una página para el estructurista).  
6. **24 — Contrato API** (OpenAPI) solo cuando exista nube; hasta entonces delta en archivo.

Con 16 + 17 + 19 + 20 + 21 + 22 + 23 sí se puede armar un v1 **vendible** para edificaciones de concreto. Sigue sin ser Cost-it (IFC, habitaciones, 4D, scripts).

---

## 10. Qué no copiar de Presto / Cost-it

- Convertir **cada tipo Revit** en unidad de obra y reestructurar luego. Ustedes ya tienen RN.  
- Regenerar el presupuesto entero «porque es más seguro». En MemoriaCalc rompe APU, Excel y GG.  
- Exigir Presto abierto. El presupuesto es la web.  
- Prometer certificación y 4D en el modelo en el primer año.

---

## 11. Cierre

Las instrucciones 16 y 17 están **bien orientadas** y en varios puntos (delta, recompute, plantilla, tres partidas por columna) están **por encima** de un plugin amateur. No están **mal**: están **incompletas para producción**.

**No se implementa el add-in de mercado con este expediente.**  
**Sí se puede** cerrar el motor web + pestaña + un exportador de laboratorio, y a la vez redactar B1–B10.

Eso es el estándar A1: no vender Cost-it con un clasificador de palabras y un volumen `HOST_VOLUME`.

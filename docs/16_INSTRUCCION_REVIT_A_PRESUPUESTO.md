# Instrucción 16 — De Revit al presupuesto MemoriaCalc

**Producto:** pestaña Revit + add-in + motor de identificación  
**Alcance:** enviar el modelo a Presupuestos, verificar cada elemento contra la plantilla de obra y anexar metrados a partidas (o crear la partida en el acto).  
**Hermana:** Instrucción 17 — **Actualizar desde Revit** (flujo tipo Presto / Cost-it: comparativo altas-bajas-modificados, recompute, códigos en el modelo).  
**Norma de metrados:** RN Metrados · catálogo vigente `EST-`, `ARQ-`, etc.  
**Estado:** instructivo de diseño e implementación. No se ha construido el código.

---

## Cómo usar este documento

Léalo como un expediente de obra: primero el criterio, después el contrato, después el motor, después la pantalla, al final las fases. Quien implemente no inventa flujos: ejecuta estas reglas. Si una regla no cubre un caso, el elemento queda en **conflicto** o **sin identificar**; no se adivina.

| Quién | Qué saca de aquí |
|---|---|
| Ingeniero de costos | Cómo se verifica y se corrige el mapeo, sin tocar Revit |
| Desarrollador web | Pestaña, estados, anexado, creación de partida de obra |
| Desarrollador del add-in | Qué extraer, cómo clasificar, qué JSON escribir |
| QA | Criterios de aceptación al final |

---

## 1. Qué es este producto (y qué no es)

El add-in **no presupuesta**. Extrae cantidades del modelo y las clasifica.

La web **no modela**. Recibe el paquete, lo compara con la **plantilla de la obra** y propone partidas del catálogo MemoriaCalc.

El ingeniero **decide**. El botón *Anexar con partidas* solo escribe metrados que él ya vio y aceptó.

```
Revit (familias, tipos, materiales, volúmenes)
        │  add-in: clasifica + agrupa + exporta
        ▼
Paquete .mcrevit.json  (contrato versionado)
        │  pestaña Revit: plantilla + verificación
        ▼
Presupuesto (líneas con origenCodigo, metrado trazable)
```

Un elemento de Revit **no es una partida**. Una columna de concreto armado son, por lo menos, tres renglones RN:

| Qué mide el modelo | Unidad | Partida de catálogo |
|---|---|---|
| Volumen de concreto | m³ | `EST-04.01.02` Concreto en columnas f'c 210 |
| Área de caras encofradas | m² | `EST-04.03.01` Encofrado y desencofrado de columnas |
| Peso de armadura (si hay Rebar) | kg | `EST-04.02.02` Acero fy 4 200 en columnas |

Eso es lo que el usuario pidió por «elementos de concreto con elementos de concreto, desglosados en columnas, vigas, todo según familia y propiedad».

### 1.1 Principios (si se rompe uno, el run es inválido)

1. **La plantilla manda el universo.** Se elige la plantilla de lo que se está trabajando (`unifamiliar`, `multifamiliar`, `colegio`, etc.). El motor solo sugiere partidas que existen en esa plantilla **o** en el capítulo estructural/arquitectónico compatible. Si el modelo trae un puente y la plantilla es vivienda, eso es conflicto, no anexo automático.
2. **No se inventa código de catálogo.** Crear partida en la pestaña Revit genera una **partida de obra** (copia con `origenCodigo` + código `EST-04.01.02-2`), igual que el presupuesto actual. El libro RN no se reescribe.
3. **No se anexan filas dudosas.** Confianza baja o sin identificar: el ingeniero asigna, crea o descarta. El botón masivo solo toma `sugerida` (alta) y `aceptada`.
4. **Reimportar actualiza, no duplica.** La clave atómica es `UniqueId + campo` (Instrucción 17). El grupo sirve para ver y anexar resumido. Segunda medición: **Actualizar** en Revit (diff + aceptar), no un export ciego.
5. **Trazabilidad didáctica.** Cada fila muestra *por qué* se identificó: categoría, familia, tipo, material, `f'c`, unidad. El usuario entiende el criterio, no un número mágico.
6. **Concreto no se mezcla con acero ni con albañilería.** El material estructural es el primer filtro, antes que el nombre de la familia.
7. **El plugin es un conector vivo, no un exportador.** En Revit existen Enviar, **Actualizar**, Añadir solo nuevos y Regenerar. El día a día es Actualizar (17).

---

## 2. Flujo didáctico (el que debe vivir en la pestaña)

Imagine una vivienda unifamiliar de 2 pisos. El ingeniero ya abrió Presupuestos y tiene (o va a tener) la plantilla **Vivienda unifamiliar**.

```
①  En Revit: cinta MemoriaCalc → Exportar a presupuesto
      El add-in recorre columnas, vigas, losas, zapatas, placas, escaleras, rebar.
      Agrupa por rol + familia + tipo + nivel + material.
      Escribe casa-los-olivos.mcrevit.json

②  En Presupuestos → pestaña Revit
      Cargar paquete (archivo o, más adelante, envío directo).
      Elegir plantilla: «Vivienda unifamiliar».
      El motor compara modelo ↔ partidas de esa plantilla.

③  Verificar (pantalla partida / pantalla elemento)
      Columna 30×50  →  EST-04.01.02  ·  4,82 m³  ·  sugerida (alta)
      Viga 25×50     →  EST-04.01.03  ·  6,10 m³  ·  sugerida (alta)
      Losa «Waffle»  →  EST-04.01.04 o 07  ·  media  → el ingeniero elige
      Muro 13 cm     →  no es concreto  →  ARQ-05.01.01 o conflicto
      Partida EST-04.01.06 Escalera en plantilla, sin elemento  →  hueco

④  Corregir en el acto
      Cambiar la partida sugerida (buscador del catálogo filtrado por plantilla).
      O crear partida de obra si el modelo trae algo que la plantilla no contempla
      (cisterna, viga de cimentación, losa maciza de azotea).

⑤  Anexar con partidas
      Solo filas aceptadas / sugeridas altas.
      Escribe o actualiza lineas[].metrado en el presupuesto.
      Queda el vínculo: UniqueIds + campo + revisión (Instrucción 17).

⑥  El modelo cambia (el estructurista engorda dos columnas, borra una zapata)
      En Revit: MemoriaCalc → Actualizar.
      Comparativo tipo Presto: nuevos / modificados / eliminados / idénticos.
      Se acepta lo seguro. Las partidas ya anexadas se recomputan. No se regenera el presupuesto.
```

La pestaña enseña en todo momento tres números:

- **Identificados** — el motor ya tiene partida y el usuario no la contradijo  
- **Por revisar** — media, baja, conflicto, o hueco de plantilla  
- **Anexados** — ya están en el presupuesto

---

## 3. Arquitectura

Tres piezas. No se mezclan responsabilidades.

| Pieza | Dónde | Hace | No hace |
|---|---|---|---|
| Add-in Revit | C# · Revit API 2022–2026 | Clasificar, medir, agrupar, exportar JSON | Elegir P.U., crear APU, tocar catálogo |
| Motor `revitMap` | `src/lib/presupuesto/revit/` | Rol + reglas + confianza + cruce con plantilla | Escribir `state.lineas` sin orden del usuario |
| Pestaña Revit | `PresupuestoModule` vista `"revit"` | Plantilla, verificación, editar, crear, anexar | Parsear geometría SAT ni abrir el RVT |

Dependencias web que ya existen y se reutilizan (no se reinventan):

- `PLANTILLAS` / `aplicarPlantilla` / `plantillaPorId` / `state.plantillaId`
- `PARTIDAS`, `partidaPorCodigo`, `partidaDeLinea`
- `clonarLineaPartida`, `siguienteCodigoPartida` (crear partida de obra)
- `LineaPresupuesto` (`codigo`, `metrado`, `origenCodigo`, `descripcion`, `und`)
- Vista de metrados Excel: la pestaña Revit es hermana, no un reemplazo

Archivos previstos cuando se implemente (no crearlos hasta la fase de código):

```
src/lib/presupuesto/revit/
  types.ts          contrato del paquete y estados de fila
  classify.ts       rol estructural a partir de categoría + familia + tipo + material
  rules.ts          diccionario Revit → códigos de catálogo
  engine.ts         cruce paquete × plantilla × presupuesto
  anexar.ts         escribe lineas[] sin duplicar
src/modules/RevitPresupuestoPanel.tsx
src/revit-addin/    (solución C# aparte, no dentro del bundle Vite)
```

---

## 4. Contrato del paquete (lo que sale de Revit)

Extensión: `.mcrevit.json`  
Schema: `memoriacalc.revit.v1`  
Codificación: UTF-8. Unidades internas siempre **metros, m², m³, kg**. El add-in convierte si el proyecto está en pies.

### 4.1 Cabecera

```json
{
  "schema": "memoriacalc.revit.v1",
  "paqueteId": "uuid",
  "exportadoEn": "2026-09-05T22:00:00-05:00",
  "revit": {
    "version": "2025",
    "archivo": "Casa Los Olivos.rvt",
    "ruta": "C:\\…\\Casa Los Olivos.rvt",
    "vistaOrigen": "3D Export Presupuesto",
    "unidadesProyecto": "meters"
  },
  "obra": {
    "nombre": "Casa Los Olivos",
    "plantillaSugerida": "unifamiliar"
  },
  "resumen": {
    "elementosLeidos": 186,
    "grupos": 24,
    "omitidos": 11
  },
  "grupos": [],
  "omitidos": [],
  "advertencias": []
}
```

`plantillaSugerida` es opcional (si el usuario la eligió en el add-in). En la web **siempre** se confirma o se cambia.

### 4.2 Grupo (unidad de trabajo del motor)

No se exporta un JSON por `ElementId`. Se agrupa. El grupo es lo que el ingeniero ve y anexa.

Clave de agrupación:

`rol + familia + tipo + materialId + fc + nivel`

Campos mínimos de cada grupo:

| Campo | Tipo | Para qué |
|---|---|---|
| `grupoId` | string estable | Reimportar sin duplicar. Hash de la clave, no un random |
| `rol` | enum §5 | Decide el capítulo RN |
| `categoriaRevit` | string | `OST_StructuralColumns`, etc. |
| `familia` | string | Nombre de familia |
| `tipo` | string | Nombre de tipo (`30x50`, `e=25 aligerada`) |
| `material` | string | Material estructural |
| `claseMaterial` | `concreto_armado` \| `concreto_simple` \| `acero` \| `albanileria` \| `madera` \| `otro` | Primer filtro |
| `fc` | number \| null | kg/cm² si se leyó (`210`) |
| `nivel` | string | NPT o `Varios` si el grupo cruza niveles (mejor no cruzar) |
| `nElementos` | int | Conteo didáctico |
| `elementIds` | string[] | UniqueId de Revit, para auditoría |
| `cantidades` | objeto §4.3 | Lo que se va a partidas distintas |
| `confianzaClasificacion` | `alta` \| `media` \| `baja` | Del add-in, antes del cruce con plantilla |
| `motivo` | string[] | Frases humanas: «Categoría StructuralColumns + material Concreto f'c 210» |

### 4.3 Cantidades de un mismo grupo

Un grupo puede alimentar varias partidas. El add-in las deja todas listas; el motor elige cuáles aplicar.

```json
"cantidades": {
  "concreto_m3": 4.82,
  "encofrado_m2": 38.4,
  "acero_kg": 412.0,
  "area_planta_m2": 0,
  "longitud_m": 0,
  "unidad_und": 0
}
```

Reglas de medición (add-in):

| Cantidad | Cómo se obtiene | Nota profesional |
|---|---|---|
| `concreto_m3` | `HOST_VOLUME` o geometría sólida, m³ | En losa aligerada: preferir volumen **neto** (sin ladrillo). Si Revit da volumen lleno, marcar `advertencias[]` y `confianzaClasificacion: media` |
| `encofrado_m2` | Suma de caras laterales (y fondo de viga/losa si aplica) | No contar juntas contra columna ya vaciada. Si no se puede restar, advertir |
| `acero_kg` | Rebar + AreaReinforcement hospedados, peso real | Si no hay armadura en el modelo, `acero_kg = 0` y la fila de acero queda **hueco de modelo**, no se inventa 80 kg/m³ |
| `area_planta_m2` | Área de losa en planta | Ladrillo hueco de techo `EST-04.04.01` |
| `longitud_m` | Longitud de eje | Vigas si se metra por metro (este catálogo metra concreto en m³) |

### 4.4 Omitidos

Todo lo que se leyó y se dejó fuera (muebles, cotas, familias in-place dudosas) va a `omitidos[]` con motivo. El ingeniero puede **recuperar** un omitido en la pestaña y reclasificarlo. No se borra del paquete.

---

## 5. Identificación del elemento (el cerebro)

Dos capas. El add-in propone un **rol**. El motor web confirma el **código de partida** contra la plantilla.

### 5.1 Roles estructurales (vocabulario único)

El nombre de familia en cada oficina es distinto. El rol no. Todo el diccionario habla en estos roles:

| `rol` | Qué es en obra | Categorías Revit típicas | Palabras que refuerzan (familia/tipo, minúsculas) |
|---|---|---|---|
| `zapata` | Zapata aislada o combinada | `OST_StructuralFoundation` | zapata, footing, isolated, combined |
| `dado` | Pedestal / cuello sobre zapata | Foundation o Column corta | dado, pedestal, stub, cuello |
| `viga_cimentacion` | Viga de amarre / de cimentación | `OST_StructuralFraming` en nivel de cimientos | cimentacion, grade beam, amarre, riostra ciment |
| `cimiento_corrido` | Cimiento corrido (simple) | Foundation / Wall | cimiento, corrido, ciclopeo |
| `sobrecimiento` | Sobrecimiento | Wall / Foundation | sobrecimiento, stem |
| `columna` | Columna de pórtico | `OST_StructuralColumns` | columna, column, pilar |
| `placa` | Muro de corte / placa | `OST_Walls` estructurales o `OST_StructuralFraming` vertical muro | placa, shear, muro corte, wall structural |
| `muro_concreto` | Muro de CA que no es placa | Walls + concreto | muro concreto, concrete wall |
| `viga` | Viga de entrepiso o techo | `OST_StructuralFraming` | viga, beam, peri, chat |
| `losa_aligerada` | Losa aligerada / nervada / vigueta | `OST_Floors` | aligerada, nervad, vigueta, waffle, rib, joist, hueco |
| `losa_maciza` | Losa maciza / azotea maciza | `OST_Floors` | maciza, solid, flat slab, azotea maciz |
| `escalera` | Losa de escalera | `OST_Stairs` / Floors de tramo | escalera, stair |
| `cisterna` | Cisterna o tanque | Floors + Walls de recinto, o familia especial | cisterna, tanque, reservorio |
| `solado` | Solado / falso piso | Floors no estructurales delgados | solado, falso piso, poor concrete |
| `albanileria` | Muro de ladrillo | `OST_Walls` + ladrillo | kk, pandereta, ladrillo, masonry |
| `acero_suelto` | Rebar sin huésped clasificable | `OST_Rebar` | — |
| `desconocido` | No se pudo clasificar | cualquiera | — |

Orden de decisión (didáctico, el add-in lo implementa igual):

```
1. claseMaterial   (concreto / acero / ladrillo / otro)
2. categoriaRevit
3. nivel (¿está en cimientos?)
4. palabras de familia + tipo
5. esbeltez (columna corta sobre zapata → dado)
6. si queda empate → rol = desconocido, confianza baja
```

**Prohibido** clasificar solo por el nombre «Concrete». Hay losas, zapatas y columnas con el mismo material.

### 5.2 Diccionario maestro Revit → partidas (edificaciones)

Este es el corazón. El motor aplica **una fila del diccionario por cantidad**, no una por grupo.

Leyenda de confianza de la regla: `A` alta, `M` media (el usuario debe mirar).

#### Concreto (m³)

| rol | `fc` leído | Código | Descripción | Conf. |
|---|---|---|---|---|
| `zapata` | ≥ 175 o null | `EST-04.01.01` | Concreto en zapatas f'c 210 | A / M si fc null |
| `dado` | ≥ 175 o null | `EST-04.01.09` | Concreto en dado de zapata | A |
| `viga_cimentacion` | ≥ 175 o null | `EST-04.01.08` | Concreto en viga de cimentación | A |
| `cimiento_corrido` | < 175 o simple | `EST-03.02.01` | Cimiento corrido f'c 100 | M |
| `sobrecimiento` | — | `EST-03.02.02` | Sobrecimiento f'c 140 | M |
| `columna` | ≥ 175 o null | `EST-04.01.02` | Concreto en columnas f'c 210 | A |
| `placa` | ≥ 175 o null | `EST-04.01.05` | Concreto en placa de corte | A |
| `muro_concreto` | ≥ 175 o null | `EST-04.05.01` | Muro de concreto armado f'c 210 | A |
| `viga` | ≥ 175 o null | `EST-04.01.03` | Concreto en vigas f'c 210 | A |
| `losa_aligerada` | ≥ 175 o null | `EST-04.01.04` | Concreto en losa aligerada | A |
| `losa_maciza` | ≥ 175 o null | `EST-04.01.07` | Concreto en losa maciza | A |
| `escalera` | ≥ 175 o null | `EST-04.01.06` | Concreto en escalera | A |
| `cisterna` | ≥ 175 o null | `EST-04.01.10` | Concreto en cisterna / tanque | A |
| `solado` | — | `EST-03.01.01` o `EST-03.01.02` | Solado 4" o falso piso 10 cm | M (elige por espesor) |

Si `fc` viene 280 o 350: **no inventar código**. Sugerir la partida 210 más cercana, marcar `conflicto_resistencia` y ofrecer *Crear partida de obra* con descripción «… f'c 280» clonando la receta 210. El P.U. lo ajusta el ingeniero en APU.

#### Encofrado (m²)

| rol | Código | Descripción |
|---|---|---|
| `columna`, `dado` | `EST-04.03.01` | Encofrado y desencofrado de columnas |
| `viga`, `viga_cimentacion` | `EST-04.03.02` | Encofrado y desencofrado de vigas |
| `losa_aligerada` | `EST-04.03.03` | Encofrado de losa aligerada |
| `losa_maciza`, `placa`, `muro_concreto`, `escalera`, `cisterna` | `EST-04.03.04` | Encofrado de losa maciza / placa |
| `zapata` | — | No hay partida de encofrado de zapata en el catálogo actual → **hueco de catálogo**: ofrecer crear partida de obra desde `EST-04.03.04` |

#### Acero (kg)

Solo si `acero_kg > 0`.

| rol huésped | Código |
|---|---|
| `zapata`, `dado` | `EST-04.02.01` |
| `columna` | `EST-04.02.02` |
| `viga`, `viga_cimentacion` | `EST-04.02.03` |
| `losa_aligerada`, `losa_maciza`, `escalera` | `EST-04.02.04` |
| `placa`, `muro_concreto`, `cisterna` | `EST-04.02.05` |
| `acero_suelto` | conflicto: el usuario asigna el huésped o crea partida |

#### Otras cantidades frecuentes

| rol | Cantidad | Código |
|---|---|---|
| `losa_aligerada` | `area_planta_m2` | `EST-04.04.01` Ladrillo hueco de techo |
| `albanileria` muro 13 | `area_planta_m2` | `ARQ-05.01.01` |
| `albanileria` muro 24 | `area_planta_m2` | `ARQ-05.01.02` |
| `albanileria` pandereta | `area_planta_m2` | `ARQ-05.02.01` |

Fase 1 del producto: **solo concreto armado + simple + encofrado + acero + ladrillo de techo**. Albañilería y arquitectura se dejan mapeadas en el diccionario pero la UI puede filtrar «solo estructuras» la primera entrega.

### 5.3 Cruce con la plantilla (lo que el usuario pidió)

La plantilla no es un adorno. Es el **filtro de verdad**.

Al elegir `unifamiliar` (o la que esté en `state.plantillaId`):

1. Se arma el conjunto **P** = códigos de `plantilla.lineas`.
2. Para cada cantidad de cada grupo se calcula el código **C** del diccionario.
3. Se pinta así:

| Situación | Estado de la fila | Qué ve el ingeniero | Acción |
|---|---|---|---|
| C está en P y confianza alta | `sugerida` | «Identificada · coincide con la plantilla» | Anexar |
| C está en P y confianza media/baja | `revisar` | «¿Es esta? · familia X» | Confirmar o cambiar |
| C no está en P pero sí en el catálogo | `fuera_de_plantilla` | «El modelo tiene cisterna; la plantilla vivienda no la trajo» | Añadir a presupuesto **o** crear / clonar |
| Hay elemento y ningún C | `sin_identificar` | «No supe qué partida es» | Asignar del catálogo o crear |
| Código de P (capítulo EST/ARQ estructural) sin ningún grupo | `hueco_plantilla` | «La plantilla pide concreto en escalera y el RVT no trajo escalera» | Dejar metrado 0, quitar de alcance, o avisar que falta modelar |
| Unidades incompatibles (m³ vs m²) | `conflicto` | «La partida es m² y el grupo solo tiene m³» | Corregir rol o partida |
| Material vs partida (acero → concreto) | `conflicto` | Bloqueado en rojo | Obligatorio cambiar |

Didáctica en pantalla, una frase por fila, ejemplos reales:

- «Columna · familia *M_Concrete-Rectangular-Column* · tipo *30x50* · concreto f'c 210 → **EST-04.01.02** porque el rol es columna y la plantilla unifamiliar incluye ese código.»
- «Losa · familia *Floor aligerado e=25* → **EST-04.01.04** (palabra *aligerado*). Si fuera maciza, sería EST-04.01.07.»
- «Viga en nivel *Cimientos* · tipo *25x40 amarre* → **EST-04.01.08** (viga de cimentación), no EST-04.01.03.»

### 5.4 Lo que el motor nunca hace

- Usar el largo total de la viga (cara externa a cara externa) como si fuera otra partida.
- Inventar acero cuando no hay Rebar.
- Sumar volumen de columna + dado + zapata en un solo concreto.
- Mapear `OST_GenericModel` in-place a concreto sin que el usuario lo reclasifique.
- Anexar a una partida de otra especialidad (IE, IS) porque el nombre se parece.

---

## 6. Pestaña Revit (interfaz)

Nueva vista en `PresupuestoModule`, al lado de Plantillas y Metrados:

```
Presupuesto | Plantillas | Metrados (Excel) | Revit | Insumos | …
```

`type Vista` suma `"revit"`.

### 6.1 Cabecera de la pestaña (siempre visible)

1. **Plantilla de trabajo** — selector agrupado igual que hoy (`edificaciones` → Vivienda unifamiliar, Multifamiliar, Colegio…).  
   - Si `state.plantillaId` existe, viene preelegida.  
   - Cambiar plantilla **recalcula** el cruce; no borra el paquete ni las correcciones manuales ya guardadas (las correcciones ganan al diccionario).
2. **Paquete** — nombre del RVT, fecha de export, n.º de grupos. Botones: *Cargar .mcrevit.json*, *Reemplazar*, *Quitar*.
3. **Semáforo** — Identificados / Por revisar / Anexados / Huecos de plantilla.
4. **Anexar con partidas** — primario, deshabilitado si no hay filas elegibles. Texto de ayuda: «Anexa solo las filas identificadas o que usted aceptó. Las rojas no se tocan.»

### 6.2 Dos modos de lectura (didácticos)

El usuario cambia con un segmented control:

**A. Por elemento del modelo** (cómo piensa el modelador)

```
CONCRETO ARMADO
  Columnas
    M_Concrete-Rectangular-Column  30×50   NPT +3.15
      Concreto     2,41 m³   EST-04.01.02   sugerida    [cambiar] [ok]
      Encofrado   19,20 m²   EST-04.03.01   sugerida    [cambiar] [ok]
      Acero         — kg     EST-04.02.02   hueco modelo (no hay Rebar)
  Vigas
    …
  Losas
    …
CONCRETO SIMPLE
ALBAÑILERÍA
SIN IDENTIFICAR
OMITIDOS
```

**B. Por partida de la plantilla** (cómo piensa el presupuestista)

```
04 Obras de concreto armado
  EST-04.01.02  Concreto en columnas     plantilla 0,00 → modelo 4,82 m³   [anexar]
  EST-04.01.03  Concreto en vigas        plantilla 0,00 → modelo 6,10 m³   [anexar]
  EST-04.01.06  Concreto en escalera     plantilla sí · modelo no          [falta en RVT]
  EST-04.01.10  Cisterna                 plantilla no · modelo 8,40 m³     [añadir a obra]
```

Este modo B es el que permite «verificar si cada elemento está con su correcta partida» y al revés: si la plantilla pide algo que el modelo no trajo.

### 6.3 Fila: qué se puede hacer ahí mismo

Cada fila (cantidad × grupo × partida) tiene:

| Control | Comportamiento |
|---|---|
| Partida (código + nombre) | Clic abre buscador. Lista: primero códigos de la **plantilla**, después el resto del catálogo de la misma especialidad y unidad. No mezcla m³ con m². |
| Metrado | Editable. Por defecto el del modelo. Si el usuario lo cambia, queda `metradoManual: true` y una nota «ajustado respecto de Revit». |
| Estado | Chip de color. Clic en *Aceptar* pasa `sugerida`/`revisar` a `aceptada`. |
| Motivo | Texto corto siempre visible. Tooltip o panel con la cadena de reglas. |
| *Crear partida* | Ver §7. |
| Origen | `n elementos` · familia · tipo · nivel. |

Nunca se edita el P.U. en esta pestaña. El APU se ve en la pestaña Presupuesto, como hoy.

### 6.4 Tonos (didáctica visual)

Usar la paleta ya de Presupuestos (no inventar una UI ajena).

- Verde: `sugerida` alta o `aceptada`  
- Ámbar: `revisar`, `fuera_de_plantilla`, `hueco_modelo` (sin acero)  
- Rojo: `conflicto`, `sin_identificar`  
- Azul gris: `anexada` (ya escrita en `state.lineas`)  
- Violeta suave: `creada_en_obra` (partida nueva desde esta pestaña)

---

## 7. Crear partida desde la pestaña Revit

Casos en los que el botón *Crear partida* aparece:

1. `sin_identificar` — el modelo tiene un elemento válido y no hay regla.  
2. `fuera_de_plantilla` — hay código de catálogo, pero la plantilla no lo trajo y el usuario prefiere una descripción de obra distinta.  
3. `conflicto_resistencia` — f'c 280 vs partida 210.  
4. Hueco de catálogo — p. ej. encofrado de zapata.

Diálogo (una columna, profesional, corto):

1. **Origen** — familia, tipo, rol, unidad, metrado propuesto (solo lectura).  
2. **Base** — partida de catálogo más cercana (obligatoria). El APU se clona; no se parte de cero.  
3. **Código de obra** — se calcula con `siguienteCodigoPartida(base, state.lineas)` → `EST-04.01.02-2`. El usuario no teclea un código libre tipo `X-01`.  
4. **Descripción de obra** — prellenada, editable: «Concreto en columnas f'c 280 kg/cm² — tipo 40×70».  
5. **Unidad** — la de la base, bloqueada salvo caso excepcional (advertencia).  
6. **Añadir a esta obra** — crea `LineaPresupuesto` con `origenCodigo`, `descripcion`, `und`, `metrado` (0 hasta que anexen, o el metrado ya).  
7. **Recordar regla** (check): guarda en el diccionario de la obra «esta familia+tipo → este código». Próxima importación ya no pregunta.

El catálogo global `PARTIDAS` **no se muta**. Igual que los insumos propios.

---

## 8. Anexar con partidas

Botón primario. Confirmación previa (modal breve):

```
Se anexarán 12 filas a este presupuesto.
  8 ya existían en la plantilla: se actualizará el metrado.
  3 se añadirán (estaban fuera de plantilla y usted las aceptó).
  1 es partida de obra creada aquí.

No se tocan 5 filas en conflicto o sin identificar.
```

Algoritmo (`anexar.ts`):

```
para cada fila en (aceptada ∪ sugerida_alta marcada):
  si existe línea con mismo origenCodigo/codigo y mismo vinculoRevit.grupoId+campo:
      lineas[i].metrado = fila.metrado
      lineas[i].vinculoRevit = { paqueteId, grupoId, campo, exportadoEn }
  si existe línea de plantilla con ese código y sin vínculo Revit:
      escribir metrado y el vínculo (primera vez)
  si no existe:
      push { id: uid(), codigo, origenCodigo, metrado, vinculoRevit }
```

Hace falta ampliar `LineaPresupuesto` (cuando se implemente):

```ts
vinculoRevit?: {
  paqueteId: string;
  grupoId: string;
  campo: "concreto_m3" | "encofrado_m2" | "acero_kg" | "area_planta_m2" | "longitud_m";
  exportadoEn: string;
  metradoModelo: number;
  metradoManual?: boolean;
};
```

Reimportar el mismo RVT: mismas `grupoId` → se actualiza. Si un grupo desapareció del modelo, la línea **no se borra**; se marca «ya no está en el último paquete» para que el ingeniero decida.

---

## 9. Add-in Revit (especificación de implementación)

Solución C# aparte (`src/revit-addin` o repositorio hermano). No va al `vite build`.

### 9.1 Cinta

Pestaña **MemoriaCalc**. El detalle de **Actualizar**, snapshot, diff y parámetros `MC_*` está en la **Instrucción 17**. Aquí solo el mapa.

| Comando | Qué hace |
|---|---|
| Conectar obra | Vincula el RVT a un presupuesto MemoriaCalc |
| Enviar a presupuesto | Primera medición (archivo y/o API) + snapshot |
| **Actualizar** | Remide, compara con el snapshot, acepta altas/bajas/modificados, recomputa partidas anexadas |
| Añadir solo nuevos | Como «Añadir» de Cost-it: no toca lo ya medido |
| Regenerar medición Revit | Reemplaza solo líneas de origen Revit (doble confirmación) |
| Panel de clasificación | Dockable: rol, partidas, localizar |
| Escribir códigos al modelo | `MC_CODIGO` en el tipo |
| Plantilla / categorías / solo visible | Alcance de la medición |

### 9.2 Lectura por categoría

| BuiltInCategory | Roles que puede producir |
|---|---|
| `OST_StructuralColumns` | `columna`, `dado` |
| `OST_StructuralFraming` | `viga`, `viga_cimentacion` |
| `OST_Floors` | `losa_aligerada`, `losa_maciza`, `solado`, a veces `escalera` |
| `OST_StructuralFoundation` | `zapata`, `cimiento_corrido` |
| `OST_Walls` | `placa`, `muro_concreto`, `albanileria`, `sobrecimiento` |
| `OST_Stairs` / `OST_StairsRuns` | `escalera` |
| `OST_Rebar` / `OST_AreaRein` | peso a su huésped; si no hay huésped → `acero_suelto` |

Parámetros a leer (en este orden, el primero que exista gana):

- Material estructural: `Structural Material`, `Material`, tipo  
- Resistencia: parámetros `f'c`, `fc`, `CONCRETE_STRENGTH`, o número en el nombre del material (`210`, `280`)  
- Dimensiones: `b`, `h`, `e`, `Width`, `Height` (solo para el motivo didáctico)  
- Nivel: `Level`, `Reference Level`, `Base Constraint`  
- Identificación: `Mark`, `Type Name`, `Family Name`, `UniqueId`

### 9.3 Clasificador del add-in (mismo diccionario que la web)

El C# y el TypeScript **comparten la tabla de palabras clave** (copiar el JSON de reglas, no reescribir a ojo). Si el add-in duda, manda `rol: desconocido` y `confianzaClasificacion: baja`. La web puede reclasificar; eso es más seguro que un falso positivo.

### 9.4 Envío y actualización

- **Primera vez:** Enviar → paquete `.mcrevit.json` y/o API + snapshot en el RVT (ExtensibleStorage).  
- **Las siguientes:** **Actualizar** (Instrucción 17). No se vuelve a «exportar la obra entera». Se envía un **delta** aceptado.  
- Sin red: el delta viaja como `.mcrevit.delta.json` a la pestaña web.  
- Contrato `vinculoRevit` ampliado: ver 17 §13 (`uniqueIds`, `revision`, `ausenteEnModelo`).

---

## 10. Diccionario de obra (aprendizaje)

Además del diccionario maestro (§5.2), cada presupuesto guarda correcciones:

```ts
revitReglasObra: {
  clave: string;   // familia|tipo|rol|campo
  codigo: string;  // partida elegida o creada
  hechaEn: string;
}[];
```

Prioridad al mapear:

1. Regla de esta obra (lo que el ingeniero corrigió)  
2. Diccionario maestro  
3. `sin_identificar`

Así la segunda exportación de la misma oficina ya sale limpia.

---

## 11. Fases de construcción (orden obligatorio)

No se salte el orden. Cada fase se cierra con los criterios de §12.

### Fase A — Contrato y motor (web, sin add-in)

- Tipos `memoriacalc.revit.v1`
- `classify` + `rules` + `engine` con un JSON de ejemplo (casa unifamiliar ficticia) en `src/lib/presupuesto/revit/fixtures/`
- Tests unitarios: columna→02, viga→03, viga en cimientos→08, losa «aligerada»→04, losa «maciza»→07, ladrillo≠concreto, f'c 280→conflicto, plantilla sin cisterna→fuera_de_plantilla

### Fase B — Pestaña Revit

- Vista `revit` en el menú  
- Cargar fixture o archivo  
- Selector de plantilla  
- Modos A y B  
- Cambiar partida, aceptar, crear partida de obra  
- *Anexar con partidas* escribiendo `state.lineas`  
- Semáforo y frases de motivo

### Fase C — Add-in mínimo

- Cinta, exportar Columns + Framing + Floors + Foundation  
- Volumen, área aproximada de encofrado, agrupación  
- JSON válido v1  
- Probar con un RVT real de pórticos

### Fase D — Acero y avisos de losa

- Rebar hospedado  
- Advertencia de losa aligerada con volumen lleno  
- Hueco de modelo cuando no hay acero

### Fase E — Conector vivo (Instrucción 17, fases C2–C5)

- **Actualizar** en Revit con ventana de comparativo  
- API delta + recompute  
- Códigos `MC_*` y localizar ida y vuelta  
- Añadir solo nuevos + Regenerar + historial  

Albañilería, IS, IE, puentes: **fuera** hasta que A–D estén firmes. El diccionario puede tener las filas, la UI no las promete.

---

## 12. Criterios de aceptación (para dar por hecha cada fase)

### Motor

- Dado un grupo `StructuralColumns` + concreto 210 + tipo 30×50, las tres cantidades proponen 04.01.02 / 04.03.01 / 04.02.02 (esta última solo si hay kg).  
- Una viga en nivel cuyo nombre contiene `ciment` o cota de cimientos **no** cae en 04.01.03.  
- Una losa cuyo tipo contiene `aliger` no cae en 04.01.07.  
- Un muro KK no propone `EST-04`.  
- Con plantilla `unifamiliar`, un grupo `cisterna` queda `fuera_de_plantilla`, no se anexa solo.  
- `Anexar` dos veces el mismo paquete no duplica líneas.

### Pestaña

- Se elige plantilla y el modo B lista **todas** las partidas estructurales de esa plantilla, con o sin modelo.  
- Se cambia una partida en el acto y el motivo se actualiza: «Asignada por el ingeniero».  
- *Crear partida* produce código `EST-….–n` y no altera `PARTIDAS`.  
- El botón masivo no mueve filas rojas.  
- El metrado anexado se ve en la pestaña Presupuesto y entra al APU / resumen.

### Add-in

- Un pórtico de 2 vanos exporta grupos de columna, viga y losa, no 80 filas sueltas.  
- Unidades en pies salen en m / m² / m³.  
- Familias no estructurales van a `omitidos` con motivo.

### Didáctica

- Un usuario que no programó puede explicar, mirando una fila, *por qué* esa columna es `EST-04.01.02` y no una viga.  
- Los huecos se leen en español de obra, no en jerga de API.

---

## 13. Ejemplo resuelto (casa de 2 pisos)

Plantilla: `unifamiliar`.

| Grupo Revit | Rol | Cantidades | Partidas | Estado inicial |
|---|---|---|---|---|
| Col 30×50 · 8 und · N1+N2 | `columna` | 3,60 m³ · 48 m² · 0 kg | 04.01.02, 04.03.01, (04.02.02 hueco) | sugerida + hueco acero |
| Viga 25×50 · entrepisos | `viga` | 5,20 m³ · 62 m² | 04.01.03, 04.03.02 | sugerida |
| Viga 25×40 · cimientos | `viga_cimentacion` | 1,10 m³ · 9 m² | 04.01.08, 04.03.02 | `fuera_de_plantilla` si la plantilla no la trajo → añadir |
| Losa e=25 aligerada | `losa_aligerada` | 8,40 m³ · 86 m² planta · 86 m² enc. | 04.01.04, 04.03.03, 04.04.01 | sugerida |
| Zapata 1,20×1,20×0,40 | `zapata` | 2,30 m³ | 04.01.01 · encofrado = crear si se desea | sugerida + hueco catálogo enc. |
| Escalera (plantilla sí, RVT no) | — | — | 04.01.06 | `hueco_plantilla` |
| Muro KK e=13 | `albanileria` | 42 m² | ARQ-05.01.01 | fase 1: opcional / revisar |

El ingeniero acepta concretos y encofrados, deja el acero en hueco (lo metra después por despiece), añade la viga de cimentación a la obra, y pulsa **Anexar con partidas**. El presupuesto muestra esas líneas con metrado Revit y el APU del catálogo.

---

## 14. Glosario

| Término | Significado aquí |
|---|---|
| Paquete | Archivo `.mcrevit.json` de una exportación |
| Grupo | Conjunto de elementos iguales (misma familia, tipo, rol, material, nivel) |
| Rol | Identidad de obra (`columna`, `viga`, `losa_aligerada`…) |
| Plantilla | Semilla MemoriaCalc (`unifamiliar`, `colegio`…) que define qué partidas se esperan |
| Partida de catálogo | Código RN en `PARTIDAS` (inmutable) |
| Partida de obra | Línea con `origenCodigo` y código `…-n`, creada en esta obra |
| Anexar | Escribir o actualizar `lineas[].metrado` con vínculo Revit |
| Actualizar | Comando en Revit (17): remide, diferencia y recomputa lo ya anexado |
| Hueco de plantilla | La plantilla pide la partida y el modelo no trajo elemento |
| Hueco de modelo | El elemento existe pero falta una cantidad (típico: acero) |
| Hueco de catálogo | Hay cantidad y no hay código RN (encofrado de zapata) |
| Conflicto | Unidad, material o f'c no cuadran; no se anexa |

---

## 15. Prohibiciones (resumen operativo)

| Prohibido | Por qué | Qué hacer |
|---|---|---|
| Inventar `EST-99` o `REV-01` | Rompe el libro y el APU | Crear partida de obra desde una base del catálogo |
| Anexar filas rojas en lote | Contamina el presupuesto | Resolver una a una |
| Usar volumen lleno de aligerado como si fuera neto, en silencio | Infla concreto y cemento | Advertir y bajar confianza |
| Inventar kg de acero | No es metrado | Hueco de modelo |
| Mezclar zapata + columna en un m³ | Distinto APU | Roles separados |
| Mutar `PARTIDAS` desde la pestaña | El catálogo es de todas las obras | Solo `state.lineas` |
| Tratar la pestaña Revit como reemplazo de Metrados Excel | Son fuentes distintas | Pueden convivir; el último anexo gana en esa línea |
| Llamar Actualizar a un export que borra y vuelve a crear | Rompe el presupuesto (17) | Delta + aceptación + recompute |

---

## 16. Cuando se pida implementar

Seguir las fases A → E. Empezar por el motor y un JSON de ejemplo, no por el add-in. La pestaña tiene que poder enseñarse y probarse sin Revit instalado. El conector **Actualizar** (tipo Presto) se implementa según la **Instrucción 17**.

Criterio de «se ve profesional»: un presupuestista abre Revit → pestaña, elige **Vivienda unifamiliar**, ve columnas con `EST-04.01.02`, vigas con `EST-04.01.03`, losas aligeradas con `EST-04.01.04`, puede corregir una losa mal leída, puede crear la partida de cisterna si el modelo la trajo, y *Anexar con partidas* deja el presupuesto cuadrado y trazable. Cuando el modelo cambia, **en el mismo Revit** pulsa Actualizar, ve el comparativo y las partidas anexadas quedan al día.

La identificación vive en este documento. La actualización viva vive en el 17. Ambos son especificación hasta que el código exista.

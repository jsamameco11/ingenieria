# Instrucción 17 — Actualizar desde Revit (flujo tipo Presto / Cost-it)

**Producto:** el add-in **dentro de Revit** no solo exporta: **actualiza** metrados y elementos ya vinculados a partidas.  
**Hermana:** Instrucción 16 (identificación, plantilla, pestaña web, diccionario RN). Esta 17 no la sustituye: define el **conector vivo**.  
**Referencia de oficio:** el uso profesional de Cost-it + Presto (exportar / añadir / comparar altas-bajas-modificados / aceptar selectivo / escribir códigos al modelo / localizar). MemoriaCalc hace lo mismo contra **nuestro** catálogo y plantillas, no contra un archivo Presto.  
**Estado:** instructivo. No se ha construido el código.

---

## Cómo usar este documento

Si la 16 dice *qué partida es una columna*, esta dice *qué pasa cuando el arquitecto mueve esa columna*. Quien implemente el add-in ejecuta estas reglas. Quien use Revit ve una cinta y un panel, no un JSON.

| Quién | Qué saca de aquí |
|---|---|
| Ingeniero de costos | Cómo pulsar Actualizar, leer el comparativo y no romper el presupuesto |
| Modelador BIM | Cómo quedan los códigos en el tipo y cómo localizar un elemento |
| Desarrollador del add-in | Cinta, panel, snapshot, diff, envío, parámetros compartidos |
| Desarrollador web | API de aplicación de un delta, no de un reemplazo ciego |

---

## 1. Qué se pide (el producto, en una frase)

En **el mismo Revit** el ingeniero tiene **Actualizar**. El modelo se vuelve a medir. El plugin compara con la última medición vinculada a la obra MemoriaCalc y muestra, como Presto:

- elementos **nuevos**
- elementos **modificados** (geometría, tipo, material, `f'c`)
- elementos **eliminados**
- elementos **reclasificados** (cambió el rol o la partida)
- elementos **idénticos** (se ocultan por defecto)

Él acepta todo o una selección. Entonces se actualizan los metrados de las partidas **ya anexadas** y quedan listos para anexar los que aún no lo estaban. No se regenera el presupuesto desde cero. No se tocan partidas que no vienen del modelo (GG, preliminares, metrados a mano).

```
Modelo Revit  ←→  Panel MemoriaCalc (dentro de Revit)
                      │
                      │  1ª vez: Enviar / Exportar
                      │  después: Actualizar
                      ▼
              Obra en Presupuestos
              (líneas con origen Revit + UniqueId)
```

---

## 2. Principios (si se rompe uno, el run es inválido)

1. **La identidad es el elemento, no el grupo.** Presto compara línea a línea. Nosotros también: clave = `UniqueId + campo` (`concreto_m3`, `encofrado_m2`, `acero_kg`…). El grupo (familia+tipo+nivel) sirve para *ver* y para *anexar resumido*; el diff se hace por ejemplar.
2. **Actualizar no es volver a exportar a ciegas.** Nunca se borra el presupuesto y se crea otro. Se produce un **delta** y el usuario lo aprueba.
3. **Lo idéntico no se reescribe.** Si el volumen no cambió, la línea anexada no se toca (ni fecha, ni historial falso).
4. **Lo manual no se pisa.** Si en la web el metrado está `metradoManual: true`, Actualizar lo marca «difiere del modelo» y **no** lo sobrescribe salvo que el usuario marque *Forzar esta fila*.
5. **Lo que no viene de Revit no se toca.** Preliminares, GG, Excel de metrados, partidas sin `vinculoRevit`.
6. **Eliminado en el modelo ≠ borrado en el presupuesto.** La línea queda `ausente_en_modelo`. El ingeniero decide: dejar metrado, poner 0, o quitar.
7. **Los códigos viven también en Revit.** Tras anexar o asignar, el plugin escribe parámetros compartidos en el tipo (o en el ejemplar). La próxima actualización lee esos códigos primero: es el «traspasar códigos al modelo» de Presto.
8. **Plantilla y diccionario de la 16 siguen mandando** para lo *nuevo*. Lo *ya asignado* no se re-adivina.
9. **Hay impacto económico visible** (Δ metrado × P.U. de la obra) antes de aceptar. Sin número en soles, no es profesional.
10. **Una obra por documento.** Un `.rvt` se vincula a un `presupuestoId`. Cambiar de obra exige *Desconectar* y confirmación.

---

## 3. Cinta MemoriaCalc (dentro de Revit)

Pestaña propia, grupos claros. Textos en español de obra.

### 3.1 Grupo Obra

| Comando | Icono (idea) | Qué hace |
|---|---|---|
| **Conectar obra** | enchufe | Login Google MemoriaCalc → lista «Mis presupuestos» + obras locales. Elige una. Queda en la barra: obra, plantilla, última actualización. |
| **Desconectar** | — | Rompe el vínculo. El snapshot se conserva en el RVT por si reconecta la misma obra. |
| **Plantilla** | libro | Combo de plantillas (ids de la 16). Solo lectura si la obra ya tiene `plantillaId`; se puede proponer cambio. |

### 3.2 Grupo Medición

| Comando | Qué hace |
|---|---|
| **Enviar a presupuesto** | Primera vez, o cuando no hay snapshot. Clasifica, mide, abre el panel de verificación y empuja el paquete. Equivale al «Exportar» de Cost-it. |
| **Actualizar** | **Comando principal de este documento.** Remide, diferencia, muestra el comparativo, aplica lo aceptado. Equivale al exportar *sobre la obra existente* de Presto. |
| **Añadir solo nuevos** | Como «Añadir» de Cost-it: no modifica ni elimina lo ya medido; solo propone altas. Útil cuando el modelo creció y no se quiere tocar lo certificado. |
| **Regenerar medición Revit** | Peligroso y explícito. Ofrece reemplazar *todas* las líneas de origen Revit. Pedir dos confirmaciones. Es el caso Presto «imposible aislar cambios»: se tira la medición BIM y se vuelve a generar; el resto del presupuesto (manual, Excel) se queda. |

### 3.3 Grupo Modelo

| Comando | Qué hace |
|---|---|
| **Panel de clasificación** | Abre/cierra el dockable (siempre disponible). |
| **Escribir códigos al modelo** | Graba `MC_CODIGO`, `MC_DESCRIPCION`, `MC_UNIDAD`, `MC_ROL` en tipos (o ejemplares). No cambia geometría. |
| **Leer códigos del modelo** | Si el RVT ya trae códigos (otra oficina, otro envío), los usa como reglas de obra. |
| **Localizar en modelo** | El tipo o la fila seleccionada en el panel: zoom + isolate temporal. |
| **Seleccionar en presupuesto** | Si hay conexión, abre/enfoca esa partida en la pestaña web (fase con API). |

### 3.4 Grupo Alcance

| Comando | Qué hace |
|---|---|
| **Categorías** | Check: Columns, Framing, Floors, Foundation, Walls, Stairs, Rebar. |
| **Solo visible / selección / todo el documento** | Tres modos, como un Cost-it serio. Por defecto: **todo el documento** de las categorías marcadas. «Solo visible» para dos edificios en un RVT. |
| **Vista 3D de medición** | Crea/usa `3D MemoriaCalc` para isolate. |

Barra de estado permanente (abajo del panel o en la cinta):

```
Obra: Casa Los Olivos   ·   Plantilla: Vivienda unifamiliar
Última medición: 05/09/2026 18:40   ·   186 elementos   ·   24 grupos
Estado: 12 anexadas al día  ·  3 pendientes  ·  0 conflictos
```

Si no hay obra conectada, **Actualizar** está deshabilitado y el tooltip dice: «Conecte una obra o envíe la primera medición.»

---

## 4. Panel dockable (el Cost-it de MemoriaCalc)

Ventana anclable a la izquierda/derecha de Revit. No es un popup que se cierra.

### 4.1 Pestañas del panel

1. **Clasificación** — árbol categoría → familia → tipo → ejemplares. Cada tipo muestra rol, partidas propuestas (concreto / encofrado / acero) y semáforo. Aquí se **asigna o corrige** la partida *antes* de enviar. Mismo diccionario que la 16.
2. **Medición** — cantidades vigentes del último snapshot (m³, m², kg) por tipo y por ejemplar.
3. **Actualización** — se llena solo después de pulsar Actualizar o Añadir. Es el comparativo.
4. **Partidas de la obra** — lista de la plantilla/presupuesto conectado (códigos, und, P.U., metrado actual, metrado modelo). Permite *Anexar selección* desde Revit, no solo desde la web.

### 4.2 Asignar partida en el tipo (didáctico)

Al seleccionar un tipo de columna:

```
Familia   M_Concrete-Rectangular-Column
Tipo      30x50
Rol       columna          (automático · alta)
Material  Concreto f'c 210
Ejemplares  8

Partidas de este tipo
  Concreto   EST-04.01.02   Concreto en columnas f'c 210      3,60 m³   [cambiar]
  Encofrado  EST-04.03.01   Encofrado y desencofrado columnas 48,00 m²  [cambiar]
  Acero      EST-04.02.02   Acero fy 4200 en columnas         —         hueco
```

*Cambiar* abre el catálogo filtrado por unidad y por plantilla (regla 16). *Recordar en esta obra* escribe la regla y, si el usuario quiere, los parámetros del tipo.

Selección cruzada: clic en un ejemplar del panel → se selecciona en Revit. Clic en Revit → el panel abre el tipo y resalta el UniqueId.

---

## 5. Identidad, snapshot y dónde se guarda

### 5.1 Línea de medición BIM (unidad atómica)

```ts
type LineaMedicionRevit = {
  uniqueId: string;          // Element.UniqueId  (estable entre sesiones)
  elementId?: number;        // solo informativo; no es clave
  campo: "concreto_m3" | "encofrado_m2" | "acero_kg" | "area_planta_m2" | "longitud_m" | "unidad_und";
  rol: string;
  categoria: string;
  familia: string;
  tipo: string;
  tipoId: string;            // UniqueId del tipo, para escribir códigos
  material: string;
  fc: number | null;
  nivel: string;
  mark: string;
  codigoPartida: string | null;
  origenCodigo?: string;
  cantidad: number;
  und: string;
  hash: string;              // hash(tipoId + material + fc + rol + cantidad redondeada a 1e-4)
  anexada: boolean;
  metradoManual?: boolean;
};
```

`grupoId` se deriva para la vista resumida: `rol|familia|tipo|nivel|material|fc`.

### 5.2 Snapshot

Tras cada Enviar o Actualizar aceptado se guarda el conjunto de `LineaMedicionRevit`.

Tres copias, misma información:

| Copia | Dónde | Para qué |
|---|---|---|
| En el RVT | ExtensibleStorage (schema `MemoriaCalcRevitV1`) | El archivo viaja con el modelo; otro PC puede Actualizar |
| En la obra | `state.revitSnapshot` + API | La pestaña web y el presupuesto conocen el último estado |
| Local | `%AppData%\MemoriaCalc\revit\<DocHash>\snapshot.json` | Respaldo si no hay red |

Cabecera del snapshot:

```ts
{
  schema: "memoriacalc.revit.snap.v1",
  presupuestoId: string,
  plantillaId: string,
  archivoRvt: string,
  medidoEn: string,          // ISO
  alcance: "documento" | "visible" | "seleccion",
  categorias: string[],
  lineas: LineaMedicionRevit[],
  revision: number           // +1 en cada actualización aceptada
}
```

Si el usuario pulsa Actualizar y **no hay snapshot**, el plugin se niega y pide *Enviar a presupuesto* (primera medición). No se inventa un «antes».

### 5.3 Parámetros compartidos (escribir al modelo)

Archivo de parámetros compartidos `MemoriaCalc.txt` (se instala con el add-in). Grupo **MemoriaCalc**. Instancia o tipo según la tabla:

| Parámetro | Tipo | Aplica a | Quién lo escribe |
|---|---|---|---|
| `MC_CODIGO` | texto | Tipo (prioridad) o ejemplar si hay override | Plugin, al asignar / anexar |
| `MC_DESCRIPCION` | texto | Tipo | Plugin |
| `MC_UNIDAD` | texto | Tipo | Plugin |
| `MC_ROL` | texto | Tipo | Plugin (clasificador) |
| `MC_CAMPO` | texto | Tipo | `concreto` / lista si hay varios |
| `MC_ORIGEN` | texto | Tipo | siempre `MemoriaCalc` |
| `MC_OBRA_ID` | texto | Información del proyecto | Al conectar |
| `MC_REVISION` | texto | Información del proyecto | Al aceptar un update |

Prioridad al clasificar en la próxima pasada (sustituye al diccionario maestro para ese tipo):

1. `MC_CODIGO` en el **ejemplar** (override raro)  
2. `MC_CODIGO` en el **tipo**  
3. Regla de obra en el snapshot  
4. Diccionario 16  

Así se cumple el consejo Presto: *antes de volver a medir, los códigos ya están en el modelo*.

---

## 6. El comando Actualizar (algoritmo)

Esto es el corazón. Se ejecuta **dentro de Revit**, con el documento abierto.

### 6.1 Antes de medir

1. ¿Hay obra conectada? Si no → salir.  
2. ¿Hay snapshot de esa obra en este RVT? Si no → «Haga primero Enviar a presupuesto».  
3. ¿El `presupuestoId` del snapshot coincide con la obra conectada? Si no → conflicto de obra; no mezclar.  
4. Advertir si el archivo RVT cambió de nombre/ruta (informativo, no bloquea).  
5. Guardar selección y vista actuales para restaurarlas al terminar.

### 6.2 Remedir

Mismo clasificador y mismas reglas de cantidad que la 16 (§4 y §5). Alcance = el guardado en el snapshot, salvo que el usuario haya cambiado Categorías / Solo visible en esta sesión (entonces el comparativo avisa: «El alcance no es el mismo; las bajas pueden ser falsas»).

Salida: `lineasNuevas[]` con UniqueId + campo + cantidad + código propuesto (respetando `MC_CODIGO`).

### 6.3 Diferenciar (elemento a elemento)

Índice A = snapshot.lineas por `(uniqueId, campo)`  
Índice B = lineasNuevas por `(uniqueId, campo)`

| Caso | Estado del diff | Criterio |
|---|---|---|
| Está en A y B, `hash` igual, mismo `codigoPartida` | `identico` | No se ofrece aceptar; no se reescribe |
| Está en A y B, cambió `cantidad` (más que 1e-4) y mismo código | `modificado` | Δ = nuevo − anterior |
| Está en A y B, cambió tipo, material, fc o rol, mismo UniqueId | `reclasificado` | Puede cambiar de partida; se muestran ambas |
| Está en A y B, mismo hash de geometría pero el usuario cambió código en el panel | `reasignado` | Metrado igual, partida distinta |
| Está en B, no en A | `nuevo` | Alta. Si el UniqueId es nuevo pero el tipo ya tenía partida, **hereda** ese código (Presto: cae bajo la misma unidad de obra) |
| Está en A, no en B | `eliminado` | El ejemplar ya no está (borrado, categoría fuera de alcance, o fase) |
| Está en B, `rol = desconocido` y sin `MC_CODIGO` | `sin_identificar` | No se anexa desde Actualizar |

Redondeo: cantidades a **4 decimales** en m, m², m³ y a **2** en kg antes del hash. Evita falsos modificados por ruido de geometría.

### 6.4 Impacto económico

Para cada fila no idéntica:

```
Δcant = cantidadNueva - cantidadAnterior   (en eliminado, nueva = 0)
impacto = Δcant × PU_obra(codigoPartida)
```

El P.U. se pide a la obra conectada (API o caché de APU). Si no hay P.U., se muestra «—» y se suma solo el Δ físico. El pie del comparativo:

```
Nuevos:        + 2,10 m³   + S/ 1 848
Modificados:   + 0,35 m³   + S/ 308
Eliminados:    − 0,80 m³   − S/ 704
Reclasificados: 1 elemento (impacto según acepte)
Neto tentativo:            + S/ 1 452
```

Sin este pie, el comando no se considera profesional.

### 6.5 Ventana Actualización (obligatoria)

No se aplica nada hasta que el usuario pulsa **Aplicar selección** o **Aplicar aceptados**.

Columnas:

| Columna | Contenido |
|---|---|
| ☐ | Check. Por defecto: marcados `nuevo` con código alto, `modificado` de geometría. Desmarcados: `eliminado`, `reclasificado`, `sin_identificar`, `metradoManual` |
| Estado | Chip: Nuevo / Modificado / Eliminado / Reclasificado / Reasignado |
| Marca | `Mark` |
| Elemento | Familia · tipo · nivel |
| Campo | Concreto / Encofrado / Acero / … |
| Partida | Código + nombre. Editable si reclasificado |
| Antes | cantidad anterior |
| Ahora | cantidad nueva (0 si eliminado) |
| Δ | con signo y color |
| Δ S/ | impacto |
| Nota | «Losa: volumen posiblemente lleno», «Metrado manual en web», etc. |

Filtros arriba: Todos · Nuevos · Modificados · Eliminados · Reclasificados · Conflictos.  
Buscar por Mark, UniqueId, código.  
Doble clic → **Localizar en modelo** (isolate).  
Clic derecho → *Aceptar este tipo entero* (todos los ejemplares del mismo tipo+campo).

Botones:

| Botón | Efecto |
|---|---|
| **Aplicar selección** | Empuja solo los checks. Cierra el ciclo. |
| **Aplicar seguros** | Solo `nuevo` con confianza alta + `modificado` de cantidad, mismo código. Nunca eliminados ni reclasificados. |
| **Marcar idénticos** | Solo consulta; no aplica. |
| **Cancelar** | No escribe snapshot nuevo. El presupuesto no cambia. |
| **Exportar comparativo** | CSV/PDF del diff (auditoría). |

Textos de ayuda fijos, didácticos:

> «Aplicar actualiza los metrados de las partidas ya anexadas y deja los nuevos listos para anexar. No borra partidas. Los eliminados quedan marcados: usted decide el metrado.»

### 6.6 Aplicar (qué se escribe)

Orden estricto:

1. **Web / estado de obra** (API `POST /api/presupuestos/:id/revit/delta` o, sin red, cola local):
   - `modificado` anexado: `lineas[i].metrado +=` no. **Sustituye** el metrado modelo de esa línea recálculando la **suma de ejemplares** del mismo `codigo + campo` que siguen vivos. No se incrementa a ciegas: se **recompute** el total del grupo/partida.
   - `nuevo` con código: entra al snapshot; si el tipo ya estaba anexado, el total de esa partida se recompute e incluye el alta. Si no estaba anexado, queda `pendiente_anexar` (el usuario anexa en el panel o en la web).
   - `eliminado`: se recompute el total sin ese UniqueId; la línea de presupuesto **no se borra**. Si el total queda 0, estado `ausente_en_modelo`.
   - `reclasificado` aceptado: se saca el UniqueId de la partida vieja (recompute) y se mete en la nueva (o pendiente).
   - `metradoManual`: se omite salvo *Forzar*.
2. **Snapshot** revision+1, con las líneas B (más las eliminadas marcadas `baja` una revisión, para historial).
3. **ExtensibleStorage + AppData + API**.
4. **Parámetros** `MC_REVISION`, y códigos de tipos que se hayan asignado en esta pasada.
5. **Historial** en la obra: entrada «Revit actualización r12 · +2,10 m³ columnas · −1 zapata · usuario Renzo · 05/09/2026 18:55».

Recompute (regla de oro):

```
metrado(partida, campo) = Σ cantidad de lineas snapshot
                          donde codigoPartida coincide
                          y estado ≠ baja
                          y campo coincide
```

Así un alta + un modificado + una baja no descuadran por sumas incrementales.

---

## 7. Los tres modos (para no confundirlos)

| Modo | Analogía Presto | Qué toca | Cuándo usarlo |
|---|---|---|---|
| **Enviar a presupuesto** | Exportar a obra nueva / primera vez | Crea snapshot y paquete. No hay delta. | Primera medición, o RVT sin historial |
| **Actualizar** | Exportar sobre la obra existente + comparar | Delta con aceptación | El día a día. El modelo cambió |
| **Añadir solo nuevos** | Añadir | Solo altas | El presupuesto ya está «cerrado» y solo entraron vanos nuevos |
| **Regenerar medición Revit** | Regenerar mediciones de origen Revit | Borra vínculos Revit y vuelve a medir | El modelo se reorganizó (tipos partidos, worksets) y el diff miente |

Regenerar **no** borra partidas manuales ni Excel. Solo líneas con `vinculoRevit`. Pide: «Se reemplazarán 18 líneas de origen Revit. El resto del presupuesto no se toca. Escriba REGENERAR.»

---

## 8. Anexar desde Revit (no solo desde la web)

En la pestaña **Partidas de la obra** del panel:

- Lista la plantilla + lo ya en `state.lineas`.
- Cada partida muestra: metrado presupuesto · metrado modelo · Δ.
- Botón **Anexar esta partida** / **Anexar pendientes seguros**.

Misma regla que la 16: no anexar conflictos. Tras anexar, *Escribir códigos al modelo* se ofrece solo.

Si el usuario anexa en la **web**, el plugin al reconectar descarga el snapshot/obra y pinta los chips `anexada`. Los dos lados son la misma verdad (`presupuestoId`).

---

## 9. Localizar (ida y vuelta)

| Desde | Hacia | Acción |
|---|---|---|
| Fila del panel | Revit | `ShowElements` + isolate temporal en `3D MemoriaCalc`. Color override suave por partida (opcional, se limpia al salir). |
| Selección en Revit | Panel | Expande familia/tipo y resalta UniqueId. Si hay varias partidas (concreto+encofrado), muestra las tres. |
| Línea en la pestaña web | Revit | Si el add-in está abierto y el RVT es el de `archivoRvt`, comando de localización por UniqueIds del grupo. Si no está abierto, la web solo lista los Mark. |
| Partida en el panel | Revit | Selecciona **todos** los ejemplares de esa partida (como «elementos de cada unidad de obra» en Cost-it). |

Si el UniqueId no existe (archivo vinculado, modelo limpio): mensaje «Este elemento no está en el documento actual» + Mark + tipo para buscarlo a mano.

---

## 10. Conexión con la obra (online / archivo)

### 10.1 Conectado (lo profesional)

1. OAuth igual que la web.  
2. `GET /api/presupuestos` → elegir.  
3. `GET /api/presupuestos/:id` trae plantilla, partidas, P.U., snapshot si existe.  
4. Deltas: `POST /api/presupuestos/:id/revit/delta` con el payload de filas aceptadas + snapshot nuevo.  
5. La pestaña Revit de la web se refresca (poll o websocket no es obligatorio en v1; basta recargar).

### 10.2 Sin red (sigue siendo usable)

1. *Enviar* escribe `.mcrevit.json` + snapshot en el RVT.  
2. *Actualizar* diferencia contra ExtensibleStorage y escribe `casa-los-olivos.mcrevit.delta.json`.  
3. En la web: *Cargar delta* (además de cargar paquete). Aplica el mismo algoritmo de aceptación si el usuario no lo aceptó en Revit, o lo aplica directo si ya viene `aceptadoEnRevit: true`.

Un delta aceptado en Revit no se «vuelve a preguntar» en la web: se registra y se muestra el historial.

---

## 11. Ejemplo didáctico (el modificado de siempre)

Snapshot r1 — 8 columnas 30×50, 3,60 m³ anexados a `EST-04.01.02`.  
El estructurista cambia 2 columnas a 40×70, borra 1 zapata, añade 1 viga 25×50, y alarga una losa.

El usuario pulsa **Actualizar**. Ve:

| Estado | Elemento | Campo | Antes | Ahora | Δ | Partida | Check default |
|---|---|---|---|---|---|---|---|
| Modificado | Col C-03 40×70 | concreto | 0,45 | 0,84 | +0,39 | EST-04.01.02 | sí |
| Modificado | Col C-03 | encofrado | 6,00 | 8,40 | +2,40 | EST-04.03.01 | sí |
| Modificado | Col C-07 40×70 | concreto | 0,45 | 0,84 | +0,39 | EST-04.01.02 | sí |
| Idéntico | Col C-01… (ocultas) | — | — | — | 0 | — | — |
| Eliminado | Zap Z-04 | concreto | 0,58 | 0 | −0,58 | EST-04.01.01 | no (decide) |
| Nuevo | Viga V-12 | concreto | — | 0,31 | +0,31 | EST-04.01.03 (heredada del tipo) | sí |
| Nuevo | Viga V-12 | encofrado | — | 3,80 | +3,80 | EST-04.03.02 | sí |
| Modificado | Losa L-2 | concreto | 8,40 | 9,05 | +0,65 | EST-04.01.04 | sí |

Pie: neto +1,16 m³ concreto · +S/ …  

Aplica seguros. Resultado:

- `EST-04.01.02` pasa a 4,38 m³ (recompute de las 8 columnas, dos más gordas).  
- `EST-04.01.03` incluye la viga nueva (si ya estaba anexada) o queda pendiente de anexar.  
- `EST-04.01.01` sigue 2,30 o baja a 1,72 **solo si** él marcó la zapata eliminada.  
- Preliminares y Excel no se enteran.

Si en vez de 40×70 el tipo se llamara `Metal-HSS`, esas dos columnas saldrían **reclasificadas** (ya no concreto): no se aplican solas.

---

## 12. Contratos de API (cuando haya red)

### `POST /api/presupuestos/:id/revit/delta`

```json
{
  "schema": "memoriacalc.revit.delta.v1",
  "presupuestoId": "…",
  "revisionBase": 11,
  "revisionNueva": 12,
  "aceptadoEnRevit": true,
  "usuario": "renzo@…",
  "aplicadoEn": "2026-09-05T18:55:00-05:00",
  "filas": [
    {
      "uniqueId": "…",
      "campo": "concreto_m3",
      "estado": "modificado",
      "codigoPartida": "EST-04.01.02",
      "cantidadAnterior": 0.45,
      "cantidadNueva": 0.84,
      "familia": "…",
      "tipo": "40x70"
    }
  ],
  "snapshot": { }
}
```

Servidor:

1. Rechaza si `revisionBase` ≠ revisión guardada (otro usuario actualizó). El plugin dice: «La obra cambió en la web. Descargue el snapshot e inténtelo otra vez.»  
2. Recompute metrados de las partidas afectadas.  
3. Guarda historial + snapshot.  
4. No toca `metradoManual` ni líneas sin `vinculoRevit`.

### `GET /api/presupuestos/:id/revit/snapshot`

Para reconectar un RVT en otro PC.

---

## 13. Ampliación de datos en la web (la 16 se apoya aquí)

`LineaPresupuesto.vinculoRevit` queda así (sustituye el boceto corto de la 16):

```ts
vinculoRevit?: {
  origen: "revit";
  paqueteId?: string;
  revision: number;
  grupoId: string;
  campo: "concreto_m3" | "encofrado_m2" | "acero_kg" | "area_planta_m2" | "longitud_m" | "unidad_und";
  uniqueIds: string[];       // ejemplares que hoy suman este metrado
  exportadoEn: string;
  actualizadoEn?: string;
  metradoModelo: number;
  metradoManual?: boolean;
  ausenteEnModelo?: boolean;
};
```

Pestaña Revit, bloque **Historial de actualizaciones**: r1 Envío · r2 Actualizar (+0,39 m³ C-03) · r3 Añadir viga V-12.

---

## 14. Fases de construcción (add-in vivo)

La 16 sigue siendo A (motor) y B (pestaña). Esta 17 entra así:

| Fase | Qué se entrega | Se puede usar sin… |
|---|---|---|
| **C1** | Cinta + panel clasificación + Enviar a archivo JSON + snapshot en ExtensibleStorage | Web online |
| **C2** | **Actualizar** local: remide, ventana diff, aplica al snapshot del RVT, escribe `.delta.json` | API |
| **C3** | Conectar obra + Enviar/Actualizar a API + recompute en presupuesto + P.U. en el pie | — |
| **C4** | Escribir/leer `MC_*`, localizar ida y vuelta | — |
| **C5** | Añadir solo nuevos + Regenerar + historial en la pestaña web | — |
| **D** | Acero Rebar en el diff (la 16 fase D) | — |

C2 es innegociable para decir «queda tipo Presto». Un exportador que no diferencia no cumple este documento.

---

## 15. Criterios de aceptación

### Actualizar

- Tras cambiar el peralte de una viga, Actualizar muestra **una** fila `modificado` de concreto y **una** de encofrado para ese UniqueId, no un grupo entero como si todas las vigas hubieran cambiado.  
- Las vigas que no se tocaron salen `identico` y no aparecen (filtro por defecto).  
- Aplicar seguros actualiza `EST-04.01.03` al recompute, no «suma el Δ dos veces» si se pulsa dos veces (segunda vez: todo idéntico).  
- Borrar una columna: sale `eliminado`, check off; el metrado de columnas **no** baja hasta que el usuario la marque.  
- Un tipo nuevo 25×50 hereda `EST-04.01.03` si ese tipo de viga ya tenía código o si el diccionario lo da; aparece `nuevo`, no `sin_identificar`.  
- Metrado manual en web: fila ámbar, no se aplica con «seguros».  
- Sin snapshot: Actualizar no corre.  
- `revisionBase` vieja: el servidor rechaza; el plugin no calla el error.

### Panel y cinta

- Conectar obra pinta nombre + plantilla + fecha.  
- Localizar aísla el ejemplar, no toda la familia, cuando la fila es de un UniqueId.  
- Escribir códigos deja `MC_CODIGO` en el tipo; un RVT enviado a otro PC clasifica igual sin internet.

### Didáctica

- Un presupuestista explica el comparativo: «Estas dos columnas engordaron, esta zapata ya no está, esta viga es nueva.»  
- El pie en soles coincide con Δ × P.U. de las filas marcadas.

---

## 16. Prohibiciones

| Prohibido | Por qué | Qué hacer |
|---|---|---|
| Actualizar = borrar presupuesto y exportar de nuevo | Pierde APU, Excel, preliminares, ajustes | Delta + recompute |
| Usar `ElementId` como clave | Cambia al copiar/vincular | `UniqueId` |
| Sumar deltas encadenados sin recompute | Descuadre | Siempre Σ de ejemplares vivos |
| Aplicar eliminados por defecto | Un workset oculto parece una demolición | Check off |
| Reclasificar acero como concreto en silencio | Contamina APU | Estado `reclasificado`, manual |
| Pisar `metradoManual` | El ingeniero ya midió en plano | Forzar explícito |
| Vincular un RVT a dos obras a la vez | Snapshot mentiroso | Una obra; Desconectar primero |
| Llamar «Actualizar» a un export que no compara | No es Presto, es un dump | Ventana de diff obligatoria |

---

## 17. Glosario propio de esta instrucción

| Término | Significado |
|---|---|
| Snapshot | Foto de todas las líneas BIM de una revisión |
| Delta | Conjunto de filas no idénticas que el usuario puede aplicar |
| Recompute | Metrado de partida = suma de ejemplares vivos de ese código y campo |
| Alta / baja / modificado | Vocabulario Presto: nuevo / eliminado / cambió la cantidad |
| Reclasificado | El mismo UniqueId ya no es la misma unidad de obra |
| Seguros | Altas bien identificadas + modificados de cantidad, mismo código |
| Escribir códigos | Grabar `MC_*` en el tipo, como traspasar unidades de obra al modelo |
| Regenerar | Tirar solo la medición de origen Revit y volver a medir |

---

## 18. Relación con la Instrucción 16

| Tema | Dónde manda |
|---|---|
| Rol, diccionario RN, plantilla, crear partida, pestaña web | 16 |
| Cinta Actualizar, diff, snapshot, UniqueId, parámetros, API delta | 17 (este documento) |
| Anexar por primera vez | 16 (web) y 17 §8 (panel Revit): mismo motor |
| Reimportar archivo a mano | 16, modo degradado. El camino profesional es **Actualizar** aquí |

Cuando se implemente, el criterio de «se ve profesional» es este:

El estructurista cambia dos columnas y una losa. El presupuestista, **sin salir de Revit**, pulsa **Actualizar**, ve el comparativo con Δ y soles, acepta lo seguro, y las partidas `EST-04.01.02` y `EST-04.01.04` ya anexadas quedan al día. La zapata que borraron sigue en el presupuesto hasta que él lo decida. Eso es el flujo tipo Presto. Este documento es su especificación.

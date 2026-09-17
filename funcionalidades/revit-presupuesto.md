# Vincular Revit → presupuesto (auditoría)

Fecha: 15 de septiembre de 2026.  
Alcance: add-in C# (`src/revit-addin/`), API (`server/revit-sync.mjs`), módulo PRE-0R (`RevitVincularModule`) y hoja PRE-01.

## Dictamen

El flujo **existe y está cableado**. No es un prototipo vacío: el plugin analiza el RVT, arma grupos JSON, la API guarda el paquete y la web cruza plantilla, permite unir/crear partidas y escribe la hoja de presupuesto.

**No cumple un metrado profesional tipo Cost-it.** En un modelo real faltan encofrado y, salvo que haya armadura modelada, acero de elementos de concreto. La clasificación por nombre es frágil. El instalador publicado no trae las DLL en el repositorio y en producción el `.exe` / `.dll` responden error al descargarse.

El modelo de ensayo de la web (`paqueteDemoVivienda`) **simula** encofrado y acero. Ese ensayo no demuestra lo que extrae Revit.

## Flujo implementado

1. Elegir plantilla RN en PRE-0R.
2. Sesión Google → código de 6 dígitos (15 min) → panel del add-in → `POST /api/v1/revit/pair/claim` → `deviceToken`.
3. Analizar / Sincronizar → `POST /api/v1/revit/sync` (o exportar `.mcrevit.json`).
4. Importar en la web → `GET /api/v1/revit/latest`.
5. Cruce rol+campo → código RN; zona de no clasificados; reasignar código; editar cantidad por UniqueId; unir a mano; crear partida copiando APU.
6. «Cargar presupuesto» → `aplicarVinculosAlPresupuesto` + `savePresupuesto` → PRE-01 y cronograma.

## Qué sí hace el plugin

- Cinta MemoriaCalc y panel acoplable (conectar, analizar, sincronizar, consultar selección, incluir vínculos).
- Recorre instancias de categoría de modelo (+ rooms/areas), UniqueId, familia, tipo, nivel, material, volumen/área/largo HOST o bounding box.
- Agrupa por rol + categoría + familia + tipo + nivel.
- Extractores: muros, losas, techos, puertas/ventanas, escaleras, barandas, rooms, columnas/vigas, zapatas, rebar, tuberías, ductos, bandejas, familias contadas (sanitarios, luminarias, etc.).
- JSON camelCase alineado con `parsePaquete`.

## Qué no hace (brechas de producto)

| Esperado | Real |
| --- | --- |
| Todos los elementos | Solo categoría Model + rooms/areas. Anotaciones y tipos fuera. Un `catch` vacío traga fallos por elemento. Vínculos off por defecto. |
| Metrado RN (concreto, encofrado, acero, ladrillo neto) | Concreto ≈ `HOST_VOLUME`. Área de muro se llama `area_planta_m2`. **No hay encofrado.** Acero solo si existe `Rebar`. No hay huecos, fases de derribo ni losa aligerada neta. |
| Clasificar familias de oficina (`C-01`, `V-02`) | Regex de nombres; si no, categoría estructural. Confianza «alta» solo si la categoría contiene «Structural». |
| Comparar plantilla ↔ modelo (huecos) | Unidireccional: modelo → código. `hueco_plantilla` / `hueco_modelo` no se generan. Al cargar, la plantilla se pone en 0 y se rellenan las unidas. |
| Acero de rebar → partida EST-04.02 | Rol `acero_suelto` no tiene mapeo en `codigoDe`; queda «sin partida». |
| Puertas, tuberías, luminarias | Salen como `unidad_und` / `longitud_m` **sin código automático**. Hay que unirlas a mano. |
| Instalador en la web | `release.json` marca `available: true`. El repo no tiene `.exe` ni DLL (salen de `build.ps1`). En producción el instalador y las DLL del bundle devolvieron HTTP 500. |
| Un modelo por obra | Un JSON por usuario en disco del VPS (`server/data/revit/users/{userId}.json`). La última sync pisa la anterior. |

## Ruido en la unión

Cada columna/viga/losa con volumen también manda `area_planta_m2` y a menudo `longitud_m`. Esos campos no mapean a partida (salvo albañilería y losa aligerada) y aparecen como elementos libres.

«Añadir partida» puede copiar el **mismo metrado** a un segundo código y duplicar cantidad en el presupuesto.

Las partidas creadas copian el APU del origen (`origenCodigo`). El recetario propio no se guarda aparte; se edita después en PRE-01.

## Hoja de presupuesto

`cargarPresupuesto` sí escribe PRE-01: plantilla + metrados del modelo en líneas con `vinculoRevit` (UniqueId, campo, `metradoModelo`). Si un elemento desaparece en un sync posterior, la línea queda en 0 con aviso `ausenteEnModelo`.

`RevitPresupuestoPanel` (carga de archivo dentro de PRE-01) **no está montado** en la app. El camino real es PRE-0R.

## Límites de verificación

No se abrió Autodesk Revit en esta auditoría. El dictamen del add-in es por código fuente. La web y la API sí están cableadas; la descarga del binario en producción no.

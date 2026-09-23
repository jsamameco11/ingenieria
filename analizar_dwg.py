#!/usr/bin/env python3
"""
Análisis profesional de DWG/DXF para estructuras
Identifica: columnas, vigas, ejes, muros de concreto, muros de albañilería (MURO X, MURO Y)
Extrae dimensiones, posiciones, áreas y exporta a Excel.
Requisitos: pip install ezdxf pandas openpyxl
Uso: python analizar_dwg.py MILAGROS.dxf
"""

import sys
import math
from pathlib import Path
from dataclasses import dataclass, asdict
from typing import Optional
import ezdxf
import pandas as pd


@dataclass
class ElementoEstructural:
    handle: str
    layer: str
    tipo: str
    subtipo: str
    x_centro: float
    y_centro: float
    z_centro: float
    ancho: float
    alto: float
    largo: float
    area: float
    perimetro: float
    rotacion: float
    elevacion_base: float
    elevacion_tope: float
    vertices: str
    observaciones: str


TARGET_LAYERS = {
    "MURO X": ("MURO_ALBANILERIA", "MURO_X", "Albañilería confinada - Dirección X"),
    "MURO Y": ("MURO_ALBANILERIA", "MURO_Y", "Albañilería confinada - Dirección Y"),
    "MCONCRETO": ("MURO_CONCRETO", "MURO_CONCRETO", "Muro/Placa de concreto armado"),
    "COLUMNA": ("COLUMNA", "COLUMNA", "Columna de concreto armado"),
    "VIGA": ("VIGA", "VIGA", "Viga de concreto armado"),
    "EJE": ("EJE", "EJE", "Eje estructural"),
}


def normalizar_layer(name: str) -> str:
    return name.strip().upper()


def obtener_tipo_desde_layer(layer: str) -> tuple[str, str, str]:
    layer_up = normalizar_layer(layer)
    for key, (tipo, subtipo, desc) in TARGET_LAYERS.items():
        if key in layer_up:
            return tipo, subtipo, desc
    return "OTRO", layer_up, "Layer no clasificado"


def bbox_entidad(entity) -> tuple[float, float, float, float, float, float]:
    """Retorna (minx, miny, minz, maxx, maxy, maxz)"""
    try:
        bbox = entity.bbox()
        if bbox:
            return (bbox.extmin.x, bbox.extmin.y, bbox.extmin.z,
                    bbox.extmax.x, bbox.extmax.y, bbox.extmax.z)
    except Exception:
        pass
    return (0.0, 0.0, 0.0, 0.0, 0.0, 0.0)


def centroide_polilinea(polyline) -> tuple[float, float, float]:
    pts = [(v.x, v.y, v.z) for v in polyline.vertices()]
    if not pts:
        return 0.0, 0.0, 0.0
    cx = sum(p[0] for p in pts) / len(pts)
    cy = sum(p[1] for p in pts) / len(pts)
    cz = sum(p[2] for p in pts) / len(pts)
    return cx, cy, cz


def area_polilinea(polyline) -> float:
    """Área por fórmula del zapato (polilínea cerrada)"""
    pts = [(v.x, v.y) for v in polyline.vertices()]
    if len(pts) < 3:
        return 0.0
    area = 0.0
    for i in range(len(pts)):
        x1, y1 = pts[i]
        x2, y2 = pts[(i + 1) % len(pts)]
        area += x1 * y2 - x2 * y1
    return abs(area) / 2.0


def perimetro_polilinea(polyline) -> float:
    pts = [(v.x, v.y, v.z) for v in polyline.vertices()]
    if len(pts) < 2:
        return 0.0
    per = 0.0
    for i in range(len(pts)):
        x1, y1, z1 = pts[i]
        x2, y2, z2 = pts[(i + 1) % len(pts)]
        per += math.hypot(x2 - x1, y2 - y1)
    return per


def vertices_str(entity) -> str:
    try:
        if entity.dxftype() in ("LWPOLYLINE", "POLYLINE"):
            pts = [(round(v.x, 3), round(v.y, 3), round(v.z, 3)) for v in entity.vertices()]
            return "; ".join(f"({x},{y},{z})" for x, y, z in pts)
        elif entity.dxftype() == "LINE":
            return f"({round(entity.dxf.start.x,3)},{round(entity.dxf.start.y,3)},{round(entity.dxf.start.z,3)}) -> ({round(entity.dxf.end.x,3)},{round(entity.dxf.end.y,3)},{round(entity.dxf.end.z,3)})"
        elif entity.dxftype() == "INSERT":
            return f"INSERT @ ({round(entity.dxf.insert.x,3)},{round(entity.dxf.insert.y,3)},{round(entity.dxf.insert.z,3)})"
    except Exception:
        pass
    return ""


def extraer_dimensiones_columna(entity) -> tuple[float, float, float]:
    """Para columnas: intenta obtener sección (ancho, alto) y altura (largo/z)"""
    dxftype = entity.dxftype()
    minx, miny, minz, maxx, maxy, maxz = bbox_entidad(entity)
    ancho = round(maxx - minx, 3)
    alto = round(maxy - miny, 3)
    largo = round(maxz - minz, 3)

    if dxftype == "INSERT":
        block = entity.block()
        if block:
            bminx, bminy, bminz, bmaxx, bmaxy, bmaxz = bbox_entidad(block)
            ancho = round((bmaxx - bminx) * abs(entity.dxf.xscale), 3)
            alto = round((bmaxy - bminy) * abs(entity.dxf.yscale), 3)
            largo = round((bmaxz - bminz) * abs(entity.dxf.zscale), 3)
    return ancho, alto, largo


def procesar_entidad(entity) -> Optional[ElementoEstructural]:
    layer = entity.dxf.layer if hasattr(entity.dxf, 'layer') else "0"
    tipo, subtipo, desc = obtener_tipo_desde_layer(layer)

    if tipo == "OTRO":
        return None

    handle = entity.dxf.handle
    dxftype = entity.dxftype()
    minx, miny, minz, maxx, maxy, maxz = bbox_entidad(entity)

    x_centro = round((minx + maxx) / 2, 3)
    y_centro = round((miny + maxy) / 2, 3)
    z_centro = round((minz + maxz) / 2, 3)

    ancho = round(maxx - minx, 3)
    alto = round(maxy - miny, 3)
    largo = round(maxz - minz, 3)
    area = 0.0
    perimetro = 0.0
    rotacion = 0.0
    elevacion_base = round(minz, 3)
    elevacion_tope = round(maxz, 3)
    vertices = vertices_str(entity)
    obs = desc

    if dxftype in ("LWPOLYLINE", "POLYLINE"):
        area = round(area_polilinea(entity), 3)
        perimetro = round(perimetro_polilinea(entity), 3)
        cx, cy, cz = centroide_polilinea(entity)
        x_centro, y_centro, z_centro = round(cx, 3), round(cy, 3), round(cz, 3)
        if hasattr(entity.dxf, 'elevation'):
            elevacion_base = round(entity.dxf.elevation, 3)

    elif dxftype == "LINE":
        largo = round(math.hypot(maxx - minx, maxy - miny), 3)
        if subtipo == "EJE":
            obs += f" | Longitud: {largo:.3f}"

    elif dxftype == "INSERT":
        rotacion = round(entity.dxf.rotation, 3) if hasattr(entity.dxf, 'rotation') else 0.0
        if subtipo == "COLUMNA":
            ancho, alto, largo = extraer_dimensiones_columna(entity)
            area = round(ancho * alto, 3)
            perimetro = round(2 * (ancho + alto), 3)
            elevacion_base = round(entity.dxf.insert.z, 3)
            elevacion_tope = round(elevacion_base + largo, 3)
            obs += f" | Bloque: {entity.dxf.name} | Escala: ({entity.dxf.xscale:.3f},{entity.dxf.yscale:.3f},{entity.dxf.zscale:.3f})"

    elif dxftype in ("CIRCLE", "ARC"):
        radio = round(entity.dxf.radius, 3)
        ancho = alto = round(2 * radio, 3)
        area = round(math.pi * radio ** 2, 3)
        perimetro = round(2 * math.pi * radio, 3)
        x_centro = round(entity.dxf.center.x, 3)
        y_centro = round(entity.dxf.center.y, 3)
        z_centro = round(entity.dxf.center.z, 3)

    return ElementoEstructural(
        handle=handle,
        layer=layer,
        tipo=tipo,
        subtipo=subtipo,
        x_centro=x_centro,
        y_centro=y_centro,
        z_centro=z_centro,
        ancho=ancho,
        alto=alto,
        largo=largo,
        area=area,
        perimetro=perimetro,
        rotacion=rotacion,
        elevacion_base=elevacion_base,
        elevacion_tope=elevacion_tope,
        vertices=vertices,
        observaciones=obs
    )


def analizar_dxf(ruta_dxf: Path, ruta_salida: Path):
    print(f"📂 Leyendo: {ruta_dxf}")
    doc = ezdxf.readfile(str(ruta_dxf))
    msp = doc.modelspace()

    elementos = []
    conteo = {k: 0 for k in ["COLUMNA", "MURO_CONCRETO", "MURO_ALBANILERIA", "VIGA", "EJE", "OTRO"]}

    for entity in msp:
        elem = procesar_entidad(entity)
        if elem:
            elementos.append(elem)
            conteo[elem.tipo] = conteo.get(elem.tipo, 0) + 1

    print(f"✅ Entidades procesadas: {len(elementos)}")
    for k, v in conteo.items():
        if v:
            print(f"   {k}: {v}")

    if not elementos:
        print("⚠️ No se encontraron elementos en layers objetivo.")
        return

    df = pd.DataFrame([asdict(e) for e in elementos])

    # Ordenar columnas lógicamente
    cols_order = [
        "handle", "layer", "tipo", "subtipo",
        "x_centro", "y_centro", "z_centro",
        "ancho", "alto", "largo",
        "area", "perimetro",
        "rotacion", "elevacion_base", "elevacion_tope",
        "vertices", "observaciones"
    ]
    df = df[cols_order]

    # Exportar a Excel con formato
    with pd.ExcelWriter(ruta_salida, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="Elementos")
        ws = writer.sheets["Elementos"]
        for col in ws.columns:
            max_len = max(len(str(col[0].value)), *(len(str(c.value)) for c in col if c.value))
            ws.column_dimensions[col[0].column_letter].width = min(max_len + 2, 50)

        # Hoja resumen
        resumen = df.groupby(["tipo", "subtipo"]).agg(
            cantidad=("handle", "count"),
            area_total=("area", "sum"),
            largo_total=("largo", "sum")
        ).reset_index()
        resumen.to_excel(writer, index=False, sheet_name="Resumen")

    print(f"📊 Exportado a: {ruta_salida}")
    print(f"   Hojas: 'Elementos' (detalle), 'Resumen' (agrupado)")


def main():
    if len(sys.argv) < 2:
        print("Uso: python analizar_dwg.py <archivo.dxf> [salida.xlsx]")
        print("\n⚠️  PRIMERO convierte tu DWG a DXF:")
        print("   1. Descarga ODA File Converter (gratis): https://www.opendesign.com/guestfiles/oda_file_converter")
        print("   2. Ejecuta: ODAFileConverter.exe \"carpeta_entrada\" \"carpeta_salida\" ACAD2018 DXF 0 1")
        print("   3. Luego: python analizar_dwg.py MILAGROS.dxf")
        sys.exit(1)

    entrada = Path(sys.argv[1])
    if not entrada.exists():
        print(f"❌ No existe: {entrada}")
        sys.exit(1)

    salida = Path(sys.argv[2]) if len(sys.argv) > 2 else entrada.with_suffix(".xlsx")
    analizar_dxf(entrada, salida)


if __name__ == "__main__":
    main()
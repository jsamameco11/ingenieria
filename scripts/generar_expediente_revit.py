# -*- coding: utf-8 -*-
"""Genera el expediente Word MC-REV-01 (Revit ↔ Presupuesto MemoriaCalc)."""

from __future__ import annotations

from pathlib import Path

from docx import Document
from docx.enum.table import WD_CELL_VERTICAL_ALIGNMENT, WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_LINE_SPACING, WD_TAB_ALIGNMENT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn, nsdecls
from docx.shared import Cm, Pt, RGBColor, Twips

NAVY = RGBColor(0x1A, 0x44, 0x73)
GOLD = RGBColor(0x8A, 0x6E, 0x2F)
INK = RGBColor(0x1C, 0x1A, 0x16)
MUTED = RGBColor(0x5C, 0x56, 0x4C)
RULE = RGBColor(0xC9, 0xBE, 0xA8)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
CREAM = "F7F1E6"
NAVY_HEX = "1A4473"
HEAD_HEX = "E8E2D4"
ROW_HEX = "FBF8F1"
WARN_HEX = "F3E6C8"

OUT = Path(__file__).resolve().parents[1] / "docs" / "MC-REV-01_Expediente_Revit_Presupuesto.docx"


def set_run(run, *, size=11, bold=False, color=INK, italic=False, font="Calibri"):
    run.font.name = font
    run._element.rPr.rFonts.set(qn("w:eastAsia"), font)
    run.font.size = Pt(size)
    run.bold = bold
    run.italic = italic
    run.font.color.rgb = color


def shade(cell, hex_color: str):
    tc = cell._tc
    tcPr = tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:fill"), hex_color)
    shd.set(qn("w:val"), "clear")
    tcPr.append(shd)


def set_cell_border(cell):
    tc = cell._tc
    tcPr = tc.get_or_add_tcPr()
    tcBorders = OxmlElement("w:tcBorders")
    for edge in ("top", "left", "bottom", "right"):
        el = OxmlElement(f"w:{edge}")
        el.set(qn("w:val"), "single")
        el.set(qn("w:sz"), "4")
        el.set(qn("w:space"), "0")
        el.set(qn("w:color"), "C9BEA8")
        tcBorders.append(el)
    tcPr.append(tcBorders)


def cell_text(cell, text, *, bold=False, size=9, color=INK, center=False):
    cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
    p = cell.paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER if center else WD_ALIGN_PARAGRAPH.LEFT
    p.paragraph_format.space_before = Pt(2)
    p.paragraph_format.space_after = Pt(2)
    p.paragraph_format.line_spacing = 1.08
    if p.runs:
        p.runs[0].text = text
        set_run(p.runs[0], size=size, bold=bold, color=color)
    else:
        r = p.add_run(text)
        set_run(r, size=size, bold=bold, color=color)


def add_table(doc, headers, rows, *, col_cm=None, header_hex=NAVY_HEX, header_color=WHITE):
    t = doc.add_table(rows=1 + len(rows), cols=len(headers))
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    t.autofit = True
    for i, h in enumerate(headers):
        cell_text(t.rows[0].cells[i], h, bold=True, size=8.5, color=header_color, center=True)
        shade(t.rows[0].cells[i], header_hex)
        set_cell_border(t.rows[0].cells[i])
    for r_i, row in enumerate(rows):
        for c_i, val in enumerate(row):
            cell_text(t.rows[r_i + 1].cells[c_i], str(val), size=8.5)
            shade(t.rows[r_i + 1].cells[c_i], ROW_HEX if r_i % 2 == 0 else "FFFFFF")
            set_cell_border(t.rows[r_i + 1].cells[c_i])
    if col_cm:
        for row in t.rows:
            for i, w in enumerate(col_cm):
                row.cells[i].width = Cm(w)
    doc.add_paragraph()
    return t


def p(doc, text, *, size=11, bold=False, color=INK, space=8, align="left", italic=False, first=0):
    para = doc.add_paragraph()
    para.alignment = {
        "left": WD_ALIGN_PARAGRAPH.LEFT,
        "center": WD_ALIGN_PARAGRAPH.CENTER,
        "justify": WD_ALIGN_PARAGRAPH.JUSTIFY,
        "right": WD_ALIGN_PARAGRAPH.RIGHT,
    }[align]
    para.paragraph_format.space_after = Pt(space)
    para.paragraph_format.space_before = Pt(0)
    para.paragraph_format.line_spacing = 1.15
    if first:
        para.paragraph_format.first_line_indent = Cm(first)
    r = para.add_run(text)
    set_run(r, size=size, bold=bold, color=color, italic=italic)
    return para


def h(doc, text, level):
    para = doc.add_heading(text, level=level)
    for run in para.runs:
        run.font.color.rgb = NAVY
        run.font.name = "Calibri"
        run._element.rPr.rFonts.set(qn("w:eastAsia"), "Calibri")
    para.paragraph_format.space_before = Pt(16 if level == 1 else 12)
    para.paragraph_format.space_after = Pt(6)
    return para


def bullet(doc, text, *, level=0):
    para = doc.add_paragraph(style="List Bullet")
    para.clear()
    para.paragraph_format.left_indent = Cm(1.0 + level * 0.6)
    para.paragraph_format.space_after = Pt(3)
    r = para.add_run(text)
    set_run(r, size=11)
    return para


def caption(doc, text):
    p(doc, text, size=9, italic=True, color=MUTED, space=10)


def page_break(doc):
    doc.add_page_break()


def add_page_number(paragraph):
    run = paragraph.add_run()
    fld1 = OxmlElement("w:fldChar")
    fld1.set(qn("w:fldCharType"), "begin")
    instr = OxmlElement("w:instrText")
    instr.set(qn("xml:space"), "preserve")
    instr.text = " PAGE "
    fld2 = OxmlElement("w:fldChar")
    fld2.set(qn("w:fldCharType"), "end")
    run._r.append(fld1)
    run._r.append(instr)
    run._r.append(fld2)


def add_num_pages(paragraph):
    run = paragraph.add_run()
    fld1 = OxmlElement("w:fldChar")
    fld1.set(qn("w:fldCharType"), "begin")
    instr = OxmlElement("w:instrText")
    instr.set(qn("xml:space"), "preserve")
    instr.text = " NUMPAGES "
    fld2 = OxmlElement("w:fldChar")
    fld2.set(qn("w:fldCharType"), "end")
    run._r.append(fld1)
    run._r.append(instr)
    run._r.append(fld2)


def prevent_widow(paragraph):
    pPr = paragraph._p.get_or_add_pPr()
    k = OxmlElement("w:keepNext")
    pPr.append(k)


def build():
    doc = Document()
    sec = doc.sections[0]
    sec.page_width = Cm(21.0)
    sec.page_height = Cm(29.7)
    sec.left_margin = Cm(2.2)
    sec.right_margin = Cm(2.0)
    sec.top_margin = Cm(2.2)
    sec.bottom_margin = Cm(2.0)
    sec.header_distance = Cm(1.0)
    sec.footer_distance = Cm(1.0)

    core = doc.core_properties
    core.author = "MemoriaCalc"
    core.title = "MC-REV-01 Expediente técnico — Conector Revit ↔ Presupuesto"
    core.subject = "Add-in Revit, pestaña Presupuestos, Actualizar tipo Cost-it, catálogo RN Metrados"
    core.category = "Expediente de producto"
    core.comments = "Pliego único para implementar el conector BIM 5D de MemoriaCalc."

    # Encabezado / pie
    header = sec.header
    header.is_linked_to_previous = False
    hp = header.paragraphs[0]
    hp.paragraph_format.space_after = Pt(2)
    r = hp.add_run("MEMORIACALC")
    set_run(r, size=8, bold=True, color=NAVY)
    r = hp.add_run("   ·   MC-REV-01   ·   Expediente Revit ↔ Presupuesto   ·   Rev. 01")
    set_run(r, size=8, color=MUTED)
    # línea
    pBdr = OxmlElement("w:pBdr")
    bottom = OxmlElement("w:bottom")
    bottom.set(qn("w:val"), "single")
    bottom.set(qn("w:sz"), "12")
    bottom.set(qn("w:space"), "4")
    bottom.set(qn("w:color"), NAVY_HEX)
    pBdr.append(bottom)
    hp._p.get_or_add_pPr().append(pBdr)

    footer = sec.footer
    footer.is_linked_to_previous = False
    fp = footer.paragraphs[0]
    fp.alignment = WD_ALIGN_PARAGRAPH.LEFT
    r = fp.add_run("Uso interno · No sustituye la RN Metrados ni la E.060   ·   Página ")
    set_run(r, size=8, color=MUTED)
    add_page_number(fp)
    r = fp.add_run(" de ")
    set_run(r, size=8, color=MUTED)
    add_num_pages(fp)

    # ───────── PORTADA ─────────
    for _ in range(2):
        doc.add_paragraph()
    p(doc, "MEMORIACALC", size=12, bold=True, color=NAVY, align="center", space=2)
    p(doc, "Ingeniería · Presupuestos · BIM 5D", size=11, color=GOLD, align="center", space=18)
    p(doc, "EXPEDIENTE TÉCNICO DE PRODUCTO", size=13, bold=True, color=NAVY, align="center", space=4)
    p(doc, "MC-REV-01", size=22, bold=True, color=NAVY, align="center", space=6)
    p(
        doc,
        "Conector Revit ↔ Presupuesto",
        size=20,
        bold=True,
        color=INK,
        align="center",
        space=4,
    )
    p(
        doc,
        "Add-in MemoriaCalc para Autodesk Revit · Pestaña Revit en Presupuestos\n"
        "Identificación de elementos · Anexar a partidas RN · Actualizar tipo Cost-it / Presto",
        size=12,
        color=MUTED,
        align="center",
        space=16,
    )

    meta = [
        ("Código", "MC-REV-01"),
        ("Revisión", "01 — 5 de septiembre de 2026"),
        ("Clase", "Pliego de diseño e implementación (aún no hay código de add-in)"),
        ("Norma de metrados", "RN Metrados · catálogo EST- / ARQ- vigente en MemoriaCalc"),
        ("Referentes de oficio", "Cost-it + Presto (RIB) · MedBIM + Arquímedes (CYPE)"),
        ("Alcance de la v1", "Edificaciones · concreto simple y armado · encofrado · acero modelado"),
        ("Fuera de v1", "IFC, habitaciones, 4D sobre el modelo, certificación en el RVT, scripts JS"),
    ]
    add_table(doc, ["Campo", "Dato"], meta, col_cm=[5.5, 11.5])

    p(
        doc,
        "Este expediente es la especificación única. Las notas 16, 17 y 18 del repositorio "
        "quedan absorbidas aquí, con el motor de medición, los vínculos, la hoja de mapeo, "
        "las interfaces y el add-in de producción que la auditoría exigió antes de programar.",
        align="justify",
        size=10,
        italic=True,
        color=MUTED,
    )

    page_break(doc)

    # ───────── CONTROL ─────────
    h(doc, "0. Control del documento", 1)
    h(doc, "0.1 Historial", 2)
    add_table(
        doc,
        ["Rev.", "Fecha", "Descripción"],
        [
            ["00", "2026-09-05", "Notas 16 y 17 (identificación + Actualizar)."],
            ["00a", "2026-09-05", "Auditoría 18 frente a Cost-it, MedBIM, CostX, Navisworks, Cubicost."],
            ["01", "2026-09-05", "Expediente único Word: pliego completo para implementar."],
            ["01a", "2026-09-05", "Pestaña web: Descargar add-in, manifiesto de releases, CDN y estados de instalación."],
        ],
        col_cm=[2.2, 3.4, 11.4],
    )
    h(doc, "0.2 Cómo se usa", 2)
    p(
        doc,
        "Léalo como un expediente de obra: primero el criterio, después los contratos, "
        "después las pantallas, al final las pruebas. Quien implemente no inventa flujos. "
        "Si una regla no cubre un caso, el elemento queda en conflicto o sin identificar; no se adivina.",
        align="justify",
    )
    add_table(
        doc,
        ["Quién", "Qué debe sacar de este pliego"],
        [
            ["Ingeniero de costos", "Cómo verificar, corregir, anexar y actualizar sin romper el APU."],
            ["Modelador BIM", "Qué debe tener el RVT y cómo quedan los códigos en el tipo."],
            ["Desarrollador del add-in", "Cinta, paneles, medición, snapshot, delta, parámetros, instalador."],
            ["Desarrollador web", "Pestaña Revit, plantilla, anexar, API de delta, vinculoRevit."],
            ["QA", "Criterios de aceptación del capítulo 18."],
        ],
        col_cm=[4.5, 12.5],
    )
    h(doc, "0.3 Índice de materias", 2)
    indice = [
        "1. Objeto, alcance y lo que no es este producto",
        "2. Principios (si se rompe uno, el run es inválido)",
        "3. Arquitectura",
        "4. Catálogo RN y diccionario Revit → partida",
        "5. Contratos de datos (paquete, snapshot, delta, mapeo)",
        "6. Plugin Revit: cinta, paneles e interfaces",
        "7. Motor de clasificación",
        "8. Motor de medición",
        "9. Alcance del modelo (vínculos, fases, worksets)",
        "10. Hoja de mapeo y códigos nativos",
        "11. Comando Actualizar (flujo tipo Cost-it / Presto)",
        "12. Conexión con la página MemoriaCalc (API + descarga del add-in)",
        "13. Pestaña Revit en Presupuestos (incluye Descargar plugin)",
        "14. Anexar con partidas y crear partida de obra",
        "15. Add-in de producción",
        "16. Requisitos BIM del modelo",
        "17. Flujos operativos didácticos",
        "18. Criterios de aceptación",
        "19. Plan de implementación",
        "A. Glosario  ·  B. Parámetros compartidos  ·  C. Prohibiciones",
    ]
    for item in indice:
        para = doc.add_paragraph()
        para.paragraph_format.space_after = Pt(2)
        para.paragraph_format.left_indent = Cm(0.4)
        r = para.add_run(item)
        set_run(r, size=11, color=NAVY)

    page_break(doc)

    # ───────── 1 ─────────
    h(doc, "1. Objeto, alcance y lo que no es este producto", 1)
    p(
        doc,
        "El add-in no presupuesta. Extrae cantidades del modelo Revit, las clasifica y las "
        "mantiene vinculadas a una obra de MemoriaCalc. La web no modela. Recibe el paquete "
        "o el delta, lo compara con la plantilla de la obra y propone partidas del catálogo RN. "
        "El ingeniero decide. El botón Anexar con partidas solo escribe metrados que él ya vio y aceptó.",
        align="justify",
    )
    p(
        doc,
        "Un elemento de Revit no es una partida. Una columna de concreto armado son, como mínimo, "
        "tres renglones RN: concreto (m³), encofrado (m²) y acero (kg) si hay Rebar. Eso es lo que "
        "Cost-it resuelve duplicando categorías y lo que MemoriaCalc deja explícito contra EST-04.",
        align="justify",
    )
    add_table(
        doc,
        ["Qué mide el modelo", "Und", "Partida de catálogo"],
        [
            ["Volumen de concreto de columna", "m³", "EST-04.01.02  Concreto en columnas f'c 210"],
            ["Área de caras encofradas", "m²", "EST-04.03.01  Encofrado y desencofrado de columnas"],
            ["Peso de armadura hospedada", "kg", "EST-04.02.02  Acero fy 4 200 en columnas"],
        ],
    )
    caption(doc, "Tabla 1. Un único tipo de columna alimenta tres partidas. El APU no se mezcla.")

    h(doc, "1.1 Alcance de la primera versión vendible", 2)
    bullet(doc, "Edificaciones (plantillas unifamiliar, multifamiliar, colegio, oficinas, etc.).")
    bullet(doc, "Categorías: columnas, vigas, losas, cimentaciones, muros estructurales, escaleras, Rebar.")
    bullet(doc, "Concreto simple y armado, encofrado, acero modelado, ladrillo hueco de techo.")
    bullet(doc, "Un RVT anfitrión y sus vínculos estructurales cargados.")
    bullet(doc, "Primera medición (Enviar) y actualizaciones sucesivas (Actualizar) desde el mismo Revit.")
    bullet(doc, "Pestaña Revit en Presupuestos: descargar el add-in, verificar, corregir, crear partida de obra, anexar.")

    h(doc, "1.2 Fuera de esta versión (no se promete)", 2)
    bullet(doc, "IFC (eso es otro conector, tipo IFCost / CostX).")
    bullet(doc, "Habitaciones, áreas útiles, acabados y pintura por material.")
    bullet(doc, "Certificación y animación 4D sobre el modelo (Cost-it + Presto planificación).")
    bullet(doc, "Scripts JavaScript de medición libres (Cost-it). La v1 usa diccionario + hoja de mapeo.")
    bullet(doc, "Instalaciones IS/IE, puentes, carreteras.")
    bullet(doc, "Medición 2D de planos DWG/PDF.")

    h(doc, "1.3 Referentes (qué se toma y qué no)", 2)
    p(
        doc,
        "Se toma de Cost-it / Presto el oficio: varias unidades de obra por elemento, exportar versus "
        "añadir versus actualizar sobre la obra existente, comparativo altas-bajas-modificados, "
        "aceptación selectiva, escribir códigos al modelo, localizar. Se toma de MedBIM el vínculo "
        "a un presupuesto ya abierto y la unidad de la partida como criterio de magnitud. "
        "No se copia convertir cada tipo Revit en unidad de obra ni regenerar el presupuesto entero.",
        align="justify",
    )

    # ───────── 2 ─────────
    h(doc, "2. Principios (si se rompe uno, el run es inválido)", 1)
    principios = [
        (
            "La plantilla manda el universo.",
            "Solo se sugieren partidas de la plantilla o del capítulo compatible. Un puente en plantilla de vivienda es conflicto, no anexo automático.",
        ),
        (
            "No se inventa código de catálogo.",
            "Crear partida genera una partida de obra (EST-04.01.02-2) con origenCodigo. El libro RN no se muta.",
        ),
        (
            "No se anexan filas dudosas.",
            "El lote solo toma sugerida alta y aceptada. Conflicto y sin identificar se resuelven a mano.",
        ),
        (
            "La identidad es el elemento.",
            "Clave atómica: UniqueId (o LinkId+UniqueId) + campo (concreto_m3, encofrado_m2, acero_kg). El grupo es solo vista. El presupuesto recibe la suma por partida, no 800 líneas de columnas.",
        ),
        (
            "Actualizar no es exportar de nuevo.",
            "Se produce un delta, el usuario lo aprueba y se recomputa el metrado. Lo idéntico no se reescribe.",
        ),
        (
            "Lo manual no se pisa.",
            "Si metradoManual es verdadero, Actualizar avisa y no sobrescribe salvo Forzar.",
        ),
        (
            "Lo que no viene de Revit no se toca.",
            "Preliminares, GG, Excel de metrados, partidas sin vinculoRevit.",
        ),
        (
            "Eliminado en el modelo no borra la partida.",
            "Queda ausente_en_modelo. El ingeniero decide metrado 0, dejar o quitar.",
        ),
        (
            "Los códigos viven también en Revit.",
            "Tras asignar o anexar se escriben MC_* y, si existe, se respeta Assembly Code / Nota clave.",
        ),
        (
            "Concreto no se mezcla con acero ni con ladrillo.",
            "El material estructural es el primer filtro, antes que el nombre de la familia.",
        ),
        (
            "Una obra por documento.",
            "Un RVT se vincula a un presupuestoId. Cambiar de obra exige Desconectar.",
        ),
        (
            "Hay impacto económico visible.",
            "Antes de aplicar un Actualizar se muestra Δ × P.U. Sin soles, el comando no se considera profesional.",
        ),
    ]
    for i, (t, d) in enumerate(principios, 1):
        p(doc, f"{i}. {t}", bold=True, space=2)
        p(doc, d, align="justify", size=10.5, space=8)

    # ───────── 3 ─────────
    h(doc, "3. Arquitectura", 1)
    p(
        doc,
        "Tres piezas. No se mezclan responsabilidades.",
        align="justify",
    )
    add_table(
        doc,
        ["Pieza", "Dónde", "Hace", "No hace"],
        [
            [
                "Add-in Revit",
                "C# · Revit API 2023–2026",
                "Clasificar, medir, agrupar, snapshot, Actualizar, escribir MC_*",
                "Elegir P.U., mutar el catálogo RN, abrir el APU",
            ],
            [
                "Motor revitMap",
                "src/lib/presupuesto/revit/",
                "Rol, reglas, confianza, cruce con plantilla, recompute",
                "Escribir state.lineas sin orden del usuario",
            ],
            [
                "Pestaña Revit",
                "PresupuestoModule vista revit",
                "Plantilla, verificación, editar, crear, anexar, historial",
                "Parsear SAT ni abrir el RVT",
            ],
        ],
    )
    p(doc, "Flujo de datos", bold=True, space=4)
    p(
        doc,
        "Revit (familias, tipos, materiales, volúmenes, UniqueId)\n"
        "        │  add-in: clasifica + mide + snapshot\n"
        "        ▼\n"
        "Paquete .mcrevit.json  /  delta .mcrevit.delta.json  /  API\n"
        "        │  pestaña Revit: plantilla + verificación\n"
        "        ▼\n"
        "Presupuesto (líneas con origenCodigo, metrado, vinculoRevit)",
        size=10,
        color=NAVY,
    )
    h(doc, "3.1 Archivos previstos al implementar", 2)
    bullet(doc, "src/lib/presupuesto/revit/types.ts, classify.ts, rules.ts, measure.ts, engine.ts, anexar.ts")
    bullet(doc, "src/lib/presupuesto/revit/fixtures/  (JSON de ejemplo, casa unifamiliar)")
    bullet(doc, "src/modules/RevitPresupuestoPanel.tsx")
    bullet(doc, "src/revit-addin/  solución C# aparte, no entra al vite build")
    bullet(doc, "Hoja portable obra.mcrevit.map.json")
    p(
        doc,
        "Se reutiliza lo existente: PLANTILLAS, aplicarPlantilla, PARTIDAS, partidaDeLinea, "
        "clonarLineaPartida, siguienteCodigoPartida, LineaPresupuesto, vista de metrados Excel "
        "(hermana, no reemplazo).",
        align="justify",
    )

    # ───────── 4 ─────────
    h(doc, "4. Catálogo RN y diccionario Revit → partida", 1)
    p(
        doc,
        "El motor aplica una fila del diccionario por cantidad, no una por grupo. "
        "Prioridad de código: (1) override de ejemplar MC_CODIGO, (2) código de tipo MC_CODIGO, "
        "(3) Assembly Code / Nota clave si mapea al catálogo, (4) regla de la hoja de mapeo de la obra, "
        "(5) diccionario maestro de este capítulo, (6) sin_identificar.",
        align="justify",
    )
    h(doc, "4.1 Roles (vocabulario único)", 2)
    add_table(
        doc,
        ["rol", "Qué es en obra", "Categoría Revit típica"],
        [
            ["zapata", "Zapata aislada o combinada", "OST_StructuralFoundation"],
            ["dado", "Pedestal / cuello sobre zapata", "Foundation o columna corta"],
            ["viga_cimentacion", "Viga de amarre / de cimentación", "OST_StructuralFraming en cimientos"],
            ["cimiento_corrido", "Cimiento corrido (simple)", "Foundation / Wall"],
            ["sobrecimiento", "Sobrecimiento", "Wall / Foundation"],
            ["columna", "Columna de pórtico", "OST_StructuralColumns"],
            ["placa", "Muro de corte / placa", "Walls estructurales"],
            ["muro_concreto", "Muro de CA que no es placa", "Walls + concreto"],
            ["viga", "Viga de entrepiso o techo", "OST_StructuralFraming"],
            ["losa_aligerada", "Losa aligerada / nervada / vigueta", "OST_Floors"],
            ["losa_maciza", "Losa maciza / azotea maciza", "OST_Floors"],
            ["escalera", "Losa de tramo", "OST_Stairs / Floors"],
            ["cisterna", "Cisterna o tanque", "Recinto o familia especial"],
            ["solado", "Solado / falso piso", "Floors delgados no estructurales"],
            ["albanileria", "Muro de ladrillo", "OST_Walls + ladrillo"],
            ["acero_suelto", "Rebar sin huésped", "OST_Rebar"],
            ["desconocido", "No se pudo clasificar", "cualquiera"],
        ],
    )
    p(
        doc,
        "Prohibido clasificar solo por el nombre «Concrete». Hay losas, zapatas y columnas con el mismo material. "
        "Las palabras de familia (aliger, column, ciment) son el tercer criterio, no el primero.",
        align="justify",
    )

    h(doc, "4.2 Concreto (m³)", 2)
    add_table(
        doc,
        ["rol", "fc", "Código", "Descripción", "Conf."],
        [
            ["zapata", "≥ 175 o nulo", "EST-04.01.01", "Concreto en zapatas f'c 210", "A / M"],
            ["dado", "≥ 175 o nulo", "EST-04.01.09", "Concreto en dado de zapata", "A"],
            ["viga_cimentacion", "≥ 175 o nulo", "EST-04.01.08", "Concreto en viga de cimentación", "A"],
            ["cimiento_corrido", "< 175 o simple", "EST-03.02.01", "Cimiento corrido f'c 100", "M"],
            ["sobrecimiento", "—", "EST-03.02.02", "Sobrecimiento f'c 140", "M"],
            ["columna", "≥ 175 o nulo", "EST-04.01.02", "Concreto en columnas f'c 210", "A"],
            ["placa", "≥ 175 o nulo", "EST-04.01.05", "Concreto en placa de corte", "A"],
            ["muro_concreto", "≥ 175 o nulo", "EST-04.05.01", "Muro de concreto armado f'c 210", "A"],
            ["viga", "≥ 175 o nulo", "EST-04.01.03", "Concreto en vigas f'c 210", "A"],
            ["losa_aligerada", "≥ 175 o nulo", "EST-04.01.04", "Concreto en losa aligerada", "A"],
            ["losa_maciza", "≥ 175 o nulo", "EST-04.01.07", "Concreto en losa maciza", "A"],
            ["escalera", "≥ 175 o nulo", "EST-04.01.06", "Concreto en escalera", "A"],
            ["cisterna", "≥ 175 o nulo", "EST-04.01.10", "Concreto en cisterna / tanque", "A"],
            ["solado", "—", "EST-03.01.01 / 02", "Solado 4\" o falso piso 10 cm", "M"],
        ],
    )
    p(
        doc,
        "Si fc es 280 o 350: no inventar código. Sugerir la partida 210, marcar conflicto_resistencia "
        "y ofrecer crear partida de obra «… f'c 280» clonando la receta. El P.U. se ajusta en el APU.",
        align="justify",
    )

    h(doc, "4.3 Encofrado (m²) y acero (kg)", 2)
    add_table(
        doc,
        ["rol", "Encofrado", "Acero (si hay kg)"],
        [
            ["columna, dado", "EST-04.03.01", "EST-04.02.02 (columna) / 04.02.01 (dado)"],
            ["viga, viga_cimentacion", "EST-04.03.02", "EST-04.02.03"],
            ["losa_aligerada", "EST-04.03.03", "EST-04.02.04"],
            ["losa_maciza, placa, muro, escalera, cisterna", "EST-04.03.04", "losas 04.02.04 · placas 04.02.05"],
            ["zapata", "Hueco de catálogo: clonar 04.03.04", "EST-04.02.01"],
        ],
    )
    p(doc, "Otras: losa aligerada área de planta → EST-04.04.01 ladrillo hueco de techo. Albañilería (fase posterior): ARQ-05.01.01 / 02 / 05.02.01 según espesor.", align="justify")

    h(doc, "4.4 Cruce con la plantilla", 2)
    add_table(
        doc,
        ["Situación", "Estado", "Qué ve el ingeniero", "Acción"],
        [
            ["Código en la plantilla, confianza alta", "sugerida", "Identificada · coincide", "Anexar"],
            ["Código en la plantilla, media/baja", "revisar", "¿Es esta? · familia X", "Confirmar o cambiar"],
            ["Código en catálogo, no en plantilla", "fuera_de_plantilla", "El modelo trajo cisterna", "Añadir o crear"],
            ["Elemento sin código", "sin_identificar", "No supe la partida", "Asignar o crear"],
            ["Partida de plantilla sin grupo", "hueco_plantilla", "Pide escalera y el RVT no la trajo", "0, quitar o avisar"],
            ["Unidad incompatible", "conflicto", "Partida m² y el grupo solo tiene m³", "Corregir"],
            ["Material vs partida", "conflicto", "Acero propuesto como concreto", "Obligatorio cambiar"],
        ],
    )

    # ───────── 5 ─────────
    h(doc, "5. Contratos de datos", 1)
    h(doc, "5.1 Paquete de primera medición — memoriacalc.revit.v1", 2)
    p(
        doc,
        "Archivo .mcrevit.json, UTF-8. Unidades internas siempre metros, m², m³, kg. "
        "El add-in convierte si el proyecto está en pies. Cabecera mínima: schema, paqueteId, "
        "exportadoEn, revit (versión, archivo, unidades), obra (nombre, plantillaSugerida), "
        "resumen, grupos[], lineas[] (por UniqueId), omitidos[], advertencias[].",
        align="justify",
    )
    p(
        doc,
        "Se miden ejemplares. Se muestran grupos. Se anexan sumas a partidas. "
        "grupoId es una clave de vista (rol|familia|tipo|nivel|material|fc), no la identidad. "
        "Si el tipo se renombra, el UniqueId no cambia y Actualizar no finge una baja masiva.",
        align="justify",
    )

    h(doc, "5.2 Línea de medición BIM", 2)
    add_table(
        doc,
        ["Campo", "Tipo", "Uso"],
        [
            ["uniqueId", "string", "Element.UniqueId. En vínculo: linkUniqueId + uniqueId"],
            ["linkUniqueId", "string | nulo", "Instancia del Revit Link"],
            ["campo", "enum", "concreto_m3 | encofrado_m2 | acero_kg | area_planta_m2 | longitud_m | unidad_und"],
            ["rol, familia, tipo, tipoId, material, fc, nivel, mark", "varios", "Clasificación y didáctica"],
            ["codigoPartida", "string | nulo", "Código RN o de obra ya asignado"],
            ["cantidad / und", "number / string", "Redondeo: 4 decimales m/m²/m³, 2 en kg"],
            ["hash", "string", "tipoId + material + fc + rol + cantidad"],
            ["anexada / metradoManual", "bool", "Estado respecto del presupuesto"],
        ],
    )

    h(doc, "5.3 Snapshot — memoriacalc.revit.snap.v1", 2)
    p(
        doc,
        "Tras cada Enviar o Actualizar aceptado. Tres copias: ExtensibleStorage en el RVT "
        "(schema MemoriaCalcRevitV1), state.revitSnapshot en la obra, y "
        "%AppData%\\MemoriaCalc\\revit\\<DocHash>\\snapshot.json. "
        "Cabecera: presupuestoId, plantillaId, archivoRvt, medidoEn, alcance, categorias[], "
        "lineas[], revision (entero +1). Si no hay snapshot, Actualizar se niega y pide Enviar.",
        align="justify",
    )

    h(doc, "5.4 Delta — memoriacalc.revit.delta.v1", 2)
    p(
        doc,
        "Payload de filas aceptadas + snapshot nuevo + revisionBase + revisionNueva + "
        "aceptadoEnRevit + usuario + aplicadoEn. El servidor rechaza si revisionBase no coincide "
        "(otro usuario actualizó). El plugin dice: «La obra cambió en la web. Descargue el snapshot.»",
        align="justify",
    )

    h(doc, "5.5 Vínculo en la línea de presupuesto", 2)
    p(
        doc,
        "vinculoRevit: origen «revit», revision, grupoId (vista), campo, uniqueIds[], "
        "exportadoEn, actualizadoEn, metradoModelo, metradoManual, ausenteEnModelo. "
        "Recompute: metrado(partida, campo) = suma de cantidades de ejemplares vivos del snapshot "
        "con ese código y campo, estado distinto de baja.",
        align="justify",
    )

    # ───────── 6 ─────────
    h(doc, "6. Plugin Revit: cinta, paneles e interfaces", 1)
    p(
        doc,
        "La interfaz vive dentro de Revit. Textos en español de obra. Paleta MemoriaCalc: "
        "azul 1A4473, crema FBF8F1, acento 8A6E2F. No se inventa una UI ajena al producto.",
        align="justify",
    )

    h(doc, "6.1 Cinta — pestaña MemoriaCalc", 2)
    p(doc, "Grupo Obra", bold=True, space=4)
    add_table(
        doc,
        ["Comando", "Tipo", "Comportamiento"],
        [
            ["Conectar obra", "grande", "Login Google MemoriaCalc → Mis presupuestos + obras locales. Barra: obra, plantilla, última medición."],
            ["Desconectar", "pequeño", "Rompe el vínculo. El snapshot del RVT se conserva."],
            ["Plantilla", "combo", "Ids de plantilla (unifamiliar, colegio…). Solo lectura si la obra ya tiene plantillaId."],
        ],
    )
    p(doc, "Grupo Medición", bold=True, space=4)
    add_table(
        doc,
        ["Comando", "Tipo", "Comportamiento"],
        [
            ["Enviar a presupuesto", "grande", "Primera medición. Clasifica, mide, abre el panel, empuja el paquete y crea snapshot r1."],
            ["Actualizar", "grande (principal)", "Remide, diferencia, muestra el comparativo, aplica lo aceptado. Deshabilitado sin obra o sin snapshot."],
            ["Añadir solo nuevos", "pequeño", "Como «Añadir» de Cost-it: no modifica ni elimina lo ya medido."],
            ["Regenerar medición Revit", "pequeño", "Reemplaza solo líneas de origen Revit. Dos confirmaciones. Escribir REGENERAR."],
        ],
    )
    p(doc, "Grupo Modelo", bold=True, space=4)
    add_table(
        doc,
        ["Comando", "Comportamiento"],
        [
            ["Panel de clasificación", "Abre/cierra el dockable (siempre disponible)."],
            ["Escribir códigos al modelo", "Graba MC_CODIGO, MC_DESCRIPCION, MC_UNIDAD, MC_ROL en el tipo."],
            ["Leer códigos del modelo", "Usa Assembly Code, Nota clave y MC_* como reglas de obra."],
            ["Localizar en modelo", "Zoom + isolate temporal del UniqueId (o de todos los de una partida)."],
            ["Ver en presupuesto", "Si hay conexión, enfoca la partida en la pestaña web."],
        ],
    )
    p(doc, "Grupo Alcance", bold=True, space=4)
    add_table(
        doc,
        ["Comando", "Comportamiento"],
        [
            ["Categorías", "Check: Columns, Framing, Floors, Foundation, Walls, Stairs, Rebar. Por defecto las seis + Rebar."],
            ["Documento / Visible / Selección", "Tres modos. Por defecto: documento de las categorías marcadas + vínculos estructurales cargados."],
            ["Incluir vínculos", "On por defecto. Off solo para pruebas."],
            ["Fase", "Usa la fase de la vista 3D activa (creación ≤ fase, sin derribo). Etiqueta visible."],
            ["Vista 3D MemoriaCalc", "Crea o usa la vista 3D de isolate."],
        ],
    )
    p(
        doc,
        "Barra de estado del panel (siempre visible): «Obra: Casa Los Olivos · Plantilla: Vivienda unifamiliar · "
        "Última medición: 05/09/2026 18:40 · 186 elementos · 24 grupos · 12 anexadas · 3 pendientes · 0 conflictos». "
        "Si no hay obra, Actualizar está apagado y el tooltip dice: «Conecte una obra o envíe la primera medición.»",
        align="justify",
    )

    h(doc, "6.2 Panel dockable — layout", 2)
    p(
        doc,
        "Ancho de diseño 420 px, anclable izquierda/derecha. Cabecera fija (obra + semáforo). "
        "Cuerpo en cuatro pestañas. Pie con acciones según la pestaña. No es un popup que se cierra.",
        align="justify",
    )
    add_table(
        doc,
        ["Pestaña", "Contenido", "Acciones del pie"],
        [
            [
                "Clasificación",
                "Árbol Categoría → Familia → Tipo → ejemplares. Cada tipo: rol, tres partidas, semáforo, motivo en una línea.",
                "Asignar partida · Recordar en la obra · Localizar",
            ],
            [
                "Medición",
                "Cantidades del último snapshot por tipo y, al expandir, por ejemplar (Mark, UniqueId, m³/m²/kg).",
                "Exportar cuadro CSV",
            ],
            [
                "Actualización",
                "Comparativo del último Actualizar. Filtros: Todos / Nuevos / Modificados / Eliminados / Reclasificados / Conflictos.",
                "Aplicar selección · Aplicar seguros · Cancelar",
            ],
            [
                "Partidas",
                "Lista de la plantilla/obra: código, und, P.U., metrado presupuesto, metrado modelo, Δ.",
                "Anexar esta · Anexar pendientes seguros",
            ],
        ],
    )

    h(doc, "6.3 Ficha de un tipo (pestaña Clasificación)", 2)
    p(
        doc,
        "Al seleccionar M_Concrete-Rectangular-Column · 30x50 el panel muestra, en este orden, "
        "sin scroll horizontal:",
        align="justify",
    )
    add_table(
        doc,
        ["Bloque", "Contenido fijo"],
        [
            ["Identidad", "Familia, tipo, n.º ejemplares, nivel(es), material, fc"],
            ["Rol", "columna · automático · confianza alta · «Categoría StructuralColumns + concreto 210»"],
            ["Concreto", "EST-04.01.02 · 3,60 m³ · [Cambiar]"],
            ["Encofrado", "EST-04.03.01 · 48,00 m² · [Cambiar]"],
            ["Acero", "EST-04.02.02 · — kg · hueco de modelo (no hay Rebar)"],
            ["Advertencias", "Ninguna, o «volumen de losa posiblemente lleno»"],
        ],
    )
    p(
        doc,
        "Cambiar abre un buscador: primero códigos de la plantilla con la misma unidad, "
        "después el resto del catálogo de esa especialidad. No se listan m² cuando el campo es m³. "
        "Clic en un ejemplar selecciona en Revit. Clic en Revit abre el tipo y resalta el UniqueId.",
        align="justify",
    )

    h(doc, "6.4 Ventana Actualización (modal obligatorio)", 2)
    p(
        doc,
        "No se aplica nada hasta Aplicar selección o Aplicar seguros. Ancho mínimo 960 px. "
        "Título: «Actualizar medición · revisión 11 → 12». Subtítulo: archivo RVT y alcance.",
        align="justify",
    )
    add_table(
        doc,
        ["Columna", "Contenido"],
        [
            ["☐", "Check. Por defecto ON: nuevo con código alto y modificado de cantidad. OFF: eliminado, reclasificado, sin identificar, metradoManual."],
            ["Estado", "Chip: Nuevo / Modificado / Eliminado / Reclasificado / Reasignado"],
            ["Marca", "Mark"],
            ["Elemento", "Familia · tipo · nivel"],
            ["Campo", "Concreto / Encofrado / Acero / Planta"],
            ["Partida", "Código + nombre. Editable si reclasificado"],
            ["Antes / Ahora / Δ", "Cantidades con signo y color"],
            ["Δ S/", "Δ × P.U. de la obra. «—» si no hay P.U."],
            ["Nota", "Volumen lleno, metrado manual, vínculo, fuera de alcance"],
        ],
    )
    p(
        doc,
        "Pie fijo: «Nuevos +… · Modificados +… · Eliminados −… · Neto tentativo S/ …». "
        "Texto de ayuda: «Aplicar actualiza los metrados ya anexados y deja los nuevos listos para anexar. "
        "No borra partidas. Los eliminados quedan marcados: usted decide el metrado.» "
        "Doble clic = Localizar. Clic derecho = aceptar este tipo entero. "
        "Botón extra: Exportar comparativo (CSV/PDF de auditoría).",
        align="justify",
    )

    h(doc, "6.5 Diálogo Conectar obra", 2)
    bullet(doc, "Paso 1: cuenta Google (mismo flujo que la web). Token en DPAPI, nunca en texto plano.")
    bullet(doc, "Paso 2: lista de obras (nombre, cliente, plantilla, fecha, n.º partidas).")
    bullet(doc, "Paso 3: confirmación — «Este RVT quedará vinculado a Casa Los Olivos. Una obra por documento.»")
    bullet(doc, "Sin red: «Trabajar con archivo» — Enviar/Actualizar escriben JSON al lado del RVT.")

    h(doc, "6.6 Diálogo Regenerar", 2)
    p(
        doc,
        "Advertencia roja: «Se reemplazarán N líneas de origen Revit. El resto del presupuesto "
        "(manual, Excel, preliminares, GG) no se toca.» Campo de texto: el usuario escribe REGENERAR. "
        "Sin esa palabra el botón permanece apagado.",
        align="justify",
    )

    h(doc, "6.7 Localizar (ida y vuelta)", 2)
    add_table(
        doc,
        ["Desde", "Hacia", "Acción"],
        [
            ["Fila del panel (UniqueId)", "Revit", "ShowElements + isolate en 3D MemoriaCalc"],
            ["Partida del panel", "Revit", "Selecciona todos los ejemplares de esa partida"],
            ["Selección en Revit", "Panel", "Expande el tipo y resalta el UniqueId"],
            ["Línea en la pestaña web", "Revit", "Si el add-in está abierto y el RVT coincide, aísla uniqueIds"],
        ],
    )
    p(doc, "Si el UniqueId no existe: «Este elemento no está en el documento actual» + Mark + tipo. No se localizan huecos de host como si fueran ejemplares independientes (límite conocido de Cost-it).", align="justify")

    # ───────── 7 ─────────
    h(doc, "7. Motor de clasificación", 1)
    p(doc, "Orden de decisión (add-in y web idénticos; la tabla de palabras se comparte en JSON, no se reescribe a ojo):", align="justify")
    bullet(doc, "1. claseMaterial (concreto_armado / concreto_simple / acero / albanileria / madera / otro).")
    bullet(doc, "2. Categoría Revit.")
    bullet(doc, "3. Fase y nivel (¿cimientos? ¿derribo?).")
    bullet(doc, "4. Códigos ya escritos (MC_*, Assembly Code, Nota clave, hoja de mapeo).")
    bullet(doc, "5. Palabras de familia y tipo (aliger, waffle, ciment, placa, shear…).")
    bullet(doc, "6. Esbeltez: columna corta sobre zapata → dado.")
    bullet(doc, "7. Empate → rol = desconocido, confianza baja. No se inventa.")
    p(
        doc,
        "El C# propone el rol. El TypeScript confirma el código contra la plantilla. "
        "Si el add-in duda, manda desconocido. Un falso positivo es peor que una fila ámbar.",
        align="justify",
    )

    # ───────── 8 ─────────
    h(doc, "8. Motor de medición", 1)
    p(
        doc,
        "Este capítulo era el hueco de la auditoría. Sin él no hay metrado profesional. "
        "Toda cantidad lleva un método, un redondeo, un fallback y una advertencia posible.",
        align="justify",
    )

    h(doc, "8.1 Unidades y redondeo", 2)
    bullet(doc, "Conversión al SI al leer (UnitUtils). Prohibido asumir pies.")
    bullet(doc, "m, m², m³: 4 decimales antes del hash. kg: 2 decimales.")
    bullet(doc, "Al anexar se muestra con 2 decimales en m³/m² y 0 en kg, sin perder el crudo en el snapshot.")
    bullet(doc, "Tolerancia de «idéntico»: |Δ| < 1e-4 en SI (1 cm³, 1 cm²).")

    h(doc, "8.2 Concreto — volumen", 2)
    p(
        doc,
        "Orden: (1) parámetro HOST_VOLUME o Volume si es sólido coherente; "
        "(2) volumen de geometría (Solid.Volume) suma de sólidos no vacíos; "
        "(3) fallo → cantidad 0, omitido con motivo «sin sólido». "
        "No se usa b×h×L del tipo cuando hay unión o recorte: miente en encuentros.",
        align="justify",
    )
    p(doc, "Losa aligerada (neto). Orden obligatorio:", bold=True, space=4)
    bullet(doc, "Si la familia tiene vacíos de ladrillo y el sólido es neto: usar ese volumen. Marcar metodo = neto_solido.")
    bullet(doc, "Si existe parámetro de obra «Volumen neto» / «MC_VOL_NETO»: usarlo. metodo = parametro.")
    bullet(doc, "Si existe espesor equivalente e_eq (cm) y área de planta A: V = A × e_eq. metodo = espesor_equivalente. Típico e=5 cm de losa + nervios según RN.")
    bullet(doc, "Si solo hay volumen lleno: V_lleno, metodo = lleno, confianza media, advertencia «aligerado posiblemente lleno — no anexar en lote». El ingeniero confirma o carga e_eq.")
    p(doc, "Prohibido aplicar un 60 % mágico en silencio. El descuento se declara o no se hace.", align="justify")

    h(doc, "8.3 Encofrado — caras", 2)
    p(
        doc,
        "Se miden caras del sólido cuya normal apunta hacia el exterior y que no están en contacto "
        "con otro concreto del mismo vaciado (junta). Cost-it resuelve esto con un segundo criterio "
        "(área L×H) y expresiones; Cubicost con motor de encuentros. MemoriaCalc v1 usa caras + "
        "clasificación de orientación, con advertencia si el contacto no se puede demostrar.",
        align="justify",
    )
    add_table(
        doc,
        ["rol", "Caras que suman", "Caras que no suman"],
        [
            ["columna / dado", "Laterales (normal horizontal ±15°)", "Tapa superior (recibe viga/losa), base sobre zapata"],
            ["viga / viga_cim.", "Laterales + fondo", "Tapa superior (recibe losa), testeros contra columna"],
            ["losa_aligerada", "Cielo (fondo visto) + fajas perimetrales", "Cara superior (piso), juntas con viga peraltada"],
            ["losa_maciza / placa / muro", "Caras vistas (laterales; fondo si queda encofrado)", "Cara superior de losa, juntas contra columna/viga"],
            ["zapata", "Laterales + fondo si se encofra", "Cara superior (recibe dado/columna). Partida de obra."],
            ["escalera", "Fondo del tramo + costados", "Huellas/contrahuellas si se vacían contra tierra: advertir"],
        ],
    )
    p(doc, "Algoritmo v1:", bold=True, space=4)
    bullet(doc, "Obtener sólidos del elemento (opciones de geometría: Fine, ComputeReferences = false, IncludeNonVisible = false).")
    bullet(doc, "Por cada Face planar: área, normal. Clasificar: lateral / fondo / tapa / otra.")
    bullet(doc, "Junta: si el centroide de la cara está a menos de 3 mm de un sólido de otro elemento de concreto del alcance, y las normales son opuestas (±15°), no sumar. Registrar junta_detectada.")
    bullet(doc, "Huecos de puerta/ventana en muro: restar el área del insert que atraviesa la cara (Host.FindInserts). Umbral: huecos < 0,10 m² no se descuentan (criterio tipo Cost-it «descontar huecos mayores de…», valor por defecto 0,10 m², editable en la hoja de mapeo).")
    bullet(doc, "Pilares circulares: cara cilíndrica completa (perímetro × altura libre). Sin tapa ni base.")
    bullet(doc, "Si Solid falla: fallback L×H del tipo (2×(b+h)×Lcolumna o 2×h×Lviga + b×L), metodo = bounding_box, confianza media, advertencia obligatoria.")
    p(doc, "No se promete encofrado de encuentro perfecto al milímetro en v1. Se promete método declarado, fallback visible y no cobrar tapa de losa como encofrado de viga.", align="justify")

    h(doc, "8.4 Acero", 2)
    p(
        doc,
        "Solo Rebar, AreaReinforcement y PathReinforcement hospedados. Peso = volumen × 7850 kg/m³ "
        "o parámetro de peso si Revit lo da. Se asigna al rol del huésped. Sin huésped: acero_suelto, conflicto. "
        "Si no hay armadura, kg = 0: hueco de modelo. Prohibido inventar 80 kg/m³. "
        "El desperdicio RN (p. ej. 5 %) no se aplica en silencio; si la receta del APU ya lleva 1,05 en MAT-FY42, no doblar.",
        align="justify",
    )

    h(doc, "8.5 Área de planta y longitud", 2)
    bullet(doc, "Área de planta de losa: HOST_AREA_COMPUTED o cara superior proyectada. Para EST-04.04.01.")
    bullet(doc, "Longitud de viga: CURVE_ELEM_LENGTH o eje. Informativa; el concreto se metra en m³.")
    bullet(doc, "Solado / falso piso: área × 1,0; el espesor elige EST-03.01.01 (4\") o 03.01.02 (10 cm).")

    h(doc, "8.6 Fallos por elemento", 2)
    p(
        doc,
        "try/catch por ejemplar. Un sólido corrupto no tumba la medición. Se registra en omitidos[] "
        "con UniqueId y excepción recortada. El progreso no se detiene. Al final: «Medidos 184 · omitidos 2».",
        align="justify",
    )

    # ───────── 9 ─────────
    h(doc, "9. Alcance del modelo (vínculos, fases, worksets)", 1)
    h(doc, "9.1 Qué se itera", 2)
    p(
        doc,
        "Documento anfitrión + instancias de RevitLink con «Incluir vínculos» activo, "
        "solo si el link está cargado. Categorías del grupo Alcance. "
        "Elementos de la fase de la vista 3D: Phase Created ≤ fase de vista y Phase Demolished vacía o posterior. "
        "Los de derribo en esa fase no entran al concreto nuevo; pueden listarse aparte (v2) como demolición.",
        align="justify",
    )
    h(doc, "9.2 Identidad en vínculos", 2)
    p(
        doc,
        "Clave = linkUniqueId + «|» + element.UniqueId. Las cantidades se transforman "
        "(Transform del link) solo para localizar; el volumen y el área son invariantes. "
        "Un link descargado no se trata como baja masiva: las líneas de ese linkUniqueId quedan "
        "«vínculo no cargado», no eliminado. Recargar el link y Actualizar las recupera.",
        align="justify",
    )
    h(doc, "9.3 Cambio de alcance entre dos Actualizar", 2)
    p(
        doc,
        "Si el alcance (categorías, visible, fase, vínculos) no es el del snapshot, "
        "el comparativo avisa: «El alcance no es el mismo; las bajas pueden ser falsas». "
        "En ese caso ningún eliminado lleva check por defecto y Aplicar seguros los ignora.",
        align="justify",
    )
    h(doc, "9.4 Worksharing y Design Options", 2)
    bullet(doc, "Se miden elementos no de grupo interno (cotas, planos). Worksets ocultos: si el modo es Documento, sí se miden; si es Visible, no.")
    bullet(doc, "Design Option: solo la opción primaria, salvo que el usuario elija una opción en el combo Alcance.")
    bullet(doc, "Grupos de modelo: se miden los ejemplares, no el tipo de grupo.")
    bullet(doc, "Familias in-place de concreto: se miden si tienen material estructural concreto; rol = desconocido hasta que el usuario asigne. Generic Model sin material: omitido.")

    # ───────── 10 ─────────
    h(doc, "10. Hoja de mapeo y códigos nativos", 1)
    p(
        doc,
        "Archivo portable obra.mcrevit.map.json (equivalente al .CostitLayout). "
        "Se aplica a muchos RVT sin modificar el modelo. Vive en la obra (nube) y se puede "
        "exportar/importar. Versionable.",
        align="justify",
    )
    add_table(
        doc,
        ["Campo de la regla", "Ejemplo", "Efecto"],
        [
            ["match.categoria", "OST_StructuralColumns", "Filtro"],
            ["match.familiaContiene", "Concrete-Rectangular", "Filtro opcional"],
            ["match.tipoContiene", "30x50", "Filtro opcional"],
            ["match.assemblyCode", "E.04.01.02", "Si el tipo ya trae Código de montaje"],
            ["match.keynote", "EST-04.01.02", "Nota clave de material o tipo"],
            ["rol", "columna", "Fija el rol (salta palabras)"],
            ["codigos.concreto_m3", "EST-04.01.02", "Partida"],
            ["codigos.encofrado_m2", "EST-04.03.01", "Partida"],
            ["codigos.acero_kg", "EST-04.02.02", "Partida"],
            ["hueco_m2", "0.10", "Umbral para descontar inserts"],
            ["espesor_equivalente_m", "0.05", "Solo losa aligerada, si se usa"],
        ],
    )
    p(
        doc,
        "Assembly Code y Nota clave se leen siempre. Si el valor es un código del catálogo MemoriaCalc, "
        "gana al diccionario maestro. Si es OmniClass u otro y no hay regla, se muestra en el motivo "
        "y no se fuerza un EST-.",
        align="justify",
    )
    p(doc, "Parámetros compartidos MC_* (anexo B): se escriben al anexar o al pulsar Escribir códigos. No son obligatorios para la primera medición (Cost-it tampoco exige parámetros propios).", align="justify")

    # ───────── 11 ─────────
    h(doc, "11. Comando Actualizar (flujo tipo Cost-it / Presto)", 1)
    p(
        doc,
        "El estructurista cambia el modelo. El presupuestista, sin salir de Revit, pulsa Actualizar. "
        "No se borra el presupuesto.",
        align="justify",
    )
    h(doc, "11.1 Los cuatro modos (no confundirlos)", 2)
    add_table(
        doc,
        ["Modo", "Analogía", "Qué toca", "Cuándo"],
        [
            ["Enviar a presupuesto", "Exportar primera vez", "Crea snapshot r1 y paquete", "Sin historial"],
            ["Actualizar", "Exportar sobre la obra + comparar", "Delta con aceptación + recompute", "Día a día"],
            ["Añadir solo nuevos", "Añadir (Cost-it)", "Solo altas", "Presupuesto «cerrado» que creció"],
            ["Regenerar", "Regenerar origen Revit", "Tira vínculos Revit y vuelve a medir", "El diff miente (tipos partidos)"],
        ],
    )

    h(doc, "11.2 Algoritmo de Actualizar", 2)
    bullet(doc, "1. ¿Obra conectada? Si no, salir.")
    bullet(doc, "2. ¿Snapshot de esa obra en este RVT? Si no, pedir Enviar.")
    bullet(doc, "3. ¿presupuestoId coincide? Si no, conflicto de obra.")
    bullet(doc, "4. Remedir con el mismo clasificador y el alcance actual.")
    bullet(doc, "5. Indexar A = snapshot y B = nuevo por (uniqueId|link, campo).")
    bullet(doc, "6. Clasificar: identico (hash y código iguales), modificado (Δ cantidad), reclasificado (cambió tipo/material/rol/código), reasignado (mismo hash, otro código), nuevo, eliminado, sin_identificar.")
    bullet(doc, "7. Alta de un tipo ya conocido: hereda el código del tipo (como Presto).")
    bullet(doc, "8. Mostrar ventana. Idénticos ocultos.")
    bullet(doc, "9. Aplicar: recompute por partida; no sumar deltas encadenados.")
    bullet(doc, "10. Snapshot revision+1, ExtensibleStorage, AppData, API o .delta.json.")
    bullet(doc, "11. Historial en la obra: «Revit r12 · +0,39 m³ C-03 · usuario · fecha».")

    h(doc, "11.3 Recompute (regla de oro)", 2)
    p(
        doc,
        "metrado(partida, campo) = Σ cantidad de líneas del snapshot donde codigoPartida coincide, "
        "campo coincide y estado ≠ baja. Un alta + un modificado + una baja no descuadran. "
        "Pulsar Actualizar dos veces sin cambios no reescribe fechas ni historial falso.",
        align="justify",
    )

    # ───────── 12 ─────────
    h(doc, "12. Conexión con la página MemoriaCalc", 1)
    h(doc, "12.1 Dos caminos, misma verdad", 2)
    add_table(
        doc,
        ["Camino", "Cómo", "Cuándo"],
        [
            ["Archivo (v1 usable ya)", "Enviar → .mcrevit.json al lado del RVT. Actualizar → .mcrevit.delta.json. La web: Cargar paquete / Cargar delta.", "Sin red, primer entregable."],
            ["Obra conectada", "OAuth Google (mismo client que la web). GET obras. POST paquete o POST delta. La pestaña se refresca al recargar.", "Cuando exista API."],
        ],
    )
    p(
        doc,
        "Un delta aceptado en Revit no se vuelve a preguntar en la web: se registra y se muestra el historial. "
        "La web y el add-in no tienen cada uno «su» metrado. La verdad es presupuestoId + revision.",
        align="justify",
    )

    h(doc, "12.2 Endpoints (por diseñar; no existen hoy)", 2)
    add_table(
        doc,
        ["Método", "Ruta", "Rol"],
        [
            ["GET", "/api/presupuestos", "Lista de obras del usuario"],
            ["GET", "/api/presupuestos/:id", "Plantilla, partidas, P.U., snapshot"],
            ["GET", "/api/presupuestos/:id/revit/snapshot", "Reconectar un RVT en otro PC"],
            ["POST", "/api/presupuestos/:id/revit/paquete", "Primera medición"],
            ["POST", "/api/presupuestos/:id/revit/delta", "Actualizar aceptado; exige revisionBase"],
            ["GET", "/api/revit/addin/releases", "Catálogo de instaladores (año Revit, versión, url, sha256)"],
            ["GET", "/api/revit/addin/download/:year", "Redirige al MSI/exe firmado de ese año (302 + log)"],
        ],
    )
    p(
        doc,
        "Auth: bearer del login Google. Tamaño máximo 25 MB. Idempotencia: cabecera Idempotency-Key = paqueteId o delta+revisionNueva. "
        "Obra compartida (Plan Pro): el segundo Actualizar con revisionBase vieja se rechaza. "
        "Hasta que estos endpoints existan, el add-in trabaja en modo archivo y la pestaña carga JSON.",
        align="justify",
    )

    h(doc, "12.3 Token y seguridad", 2)
    bullet(doc, "Token de sesión cifrado con DPAPI (CurrentUser) en %AppData%\\MemoriaCalc\\revit\\auth.bin.")
    bullet(doc, "HTTPS únicamente. Sin guardar contraseña de Google.")
    bullet(doc, "El add-in no lee obras de otro usuario. El servidor filtra por cuenta.")
    bullet(doc, "El JSON no lleva precios de insumos ajenos a la obra conectada.")

    h(doc, "12.4 Distribución del add-in (el ecosistema que ve el usuario)", 2)
    p(
        doc,
        "Cost-it y MedBIM se instalan desde un instalador propio o la App Store de Autodesk. "
        "MemoriaCalc reparte el add-in desde la misma pestaña Revit de Presupuestos: no se busca un ZIP en un correo. "
        "La web es la tienda; Revit es el instrumento; la obra es la verdad.",
        align="justify",
    )
    add_table(
        doc,
        ["Pieza", "Dónde vive", "Qué entrega"],
        [
            ["Manifiesto de releases", "GET /api/revit/addin/releases", "versión semver, años Revit, url, sha256, notas, fecha, minWeb"],
            ["Instalador firmado", "CDN (p. ej. releases.memoriacalc / R2)", "MemoriaCalc-Revit-Setup-1.2.0.exe · elige 2023–2026"],
            ["Pestaña web", "Presupuestos → Revit", "Botón Descargar add-in · año · estado (no instalado / desactualizado / al día)"],
            ["Add-in", "Cinta MemoriaCalc en Revit", "Conectar obra (misma cuenta Google) · Enviar / Actualizar"],
        ],
    )
    p(
        doc,
        "El manifiesto es público para el año y la url; la descarga no exige login (la oficina instala en varios PC). "
        "Conectar la obra sí exige la cuenta. SHA-256 se muestra en la pestaña y en un archivo .sha256 junto al exe. "
        "minWeb: si el add-in es más viejo que la pestaña, la web pide actualizar el plugin; si la web es más vieja, el add-in avisa «actualice MemoriaCalc en el navegador».",
        align="justify",
    )

    # ───────── 13 ─────────
    h(doc, "13. Pestaña Revit en Presupuestos", 1)
    p(
        doc,
        "Nueva vista en PresupuestoModule, al lado de Plantillas y Metrados (Excel):",
        align="justify",
    )
    p(doc, "Presupuesto  |  Plantillas  |  Metrados (Excel)  |  Revit  |  Insumos  |  …", size=11, bold=True, color=NAVY, align="center")

    h(doc, "13.1 Descargar el add-in (obligatorio en la pestaña)", 2)
    p(
        doc,
        "La pestaña no es solo un importador de JSON. Es la puerta del ecosistema. "
        "Arriba a la derecha de la cabecera, siempre visible, hay un bloque «Add-in Revit» con el botón primario "
        "Descargar add-in. No se esconde en un menú ni en un PDF de ayuda.",
        align="justify",
    )
    p(doc, "Estado vacío (nunca se ha cargado un paquete ni hay add-in conectado)", bold=True, space=4)
    p(
        doc,
        "Pantalla didáctica a ancho completo, no una tabla hueca. Título: «Conecte el modelo Revit a este presupuesto». "
        "Tres pasos numerados: (1) Descargue e instale el add-in. (2) Abra el RVT y, en la cinta MemoriaCalc, pulse Conectar obra. "
        "(3) Envíe la primera medición o pulse Actualizar. "
        "Bajo el paso 1: botón Descargar add-in, selector Año de Revit (2023 / 2024 / 2025 / 2026), "
        "texto «Windows · instalador firmado · cierre Revit antes de instalar». "
        "Secundario: «Ya lo tengo: cargar un archivo .mcrevit.json» para quien trabaja sin red.",
        align="justify",
    )
    p(doc, "Bloque permanente en cabecera (cuando ya hay datos)", bold=True, space=4)
    add_table(
        doc,
        ["Elemento de UI", "Comportamiento"],
        [
            ["Botón Descargar add-in", "Primario o ghost según el estado. Nunca desaparece."],
            ["Selector de año Revit", "2023–2026. Recuerda el último en localStorage. Si el usuario no sabe: «Mire Archivo → Acerca de en Revit»."],
            ["Versión publicada", "p. ej. 1.2.0 · 5 sep 2026 · 18 MB"],
            ["Notas de la versión", "Una línea: «Encofrado de vigas y vínculos estructurales» + Ver cambios"],
            ["SHA-256", "Monospace, botón Copiar. Para el informático de la oficina."],
            ["Requisitos", "Windows 10/11 · Revit del año elegido · .NET que lleve ese Revit · no hace falta Presto"],
            ["Ya lo instalé", "Enlace. Abre ayuda de 4 líneas: cerrar Revit, ejecutar el setup, reabrir, cinta MemoriaCalc, Conectar obra."],
        ],
    )
    add_table(
        doc,
        ["Estado detectado", "Cómo se sabe", "Qué se pinta"],
        [
            ["No instalado / no conectado", "No hay snapshot ni User-Agent de add-in", "CTA grande Descargar. No se finge que el plugin «falta en Windows»: el navegador no lo puede saber."],
            ["Listo por archivo", "Hay .mcrevit.json cargado", "«Medición por archivo. Para Actualizar en vivo, instale el add-in.» + Descargar"],
            ["Add-in desactualizado", "El snapshot trae addinVersion < latest", "Ámbar: «Hay una versión 1.2.0. Actualice el add-in (cierre Revit).» + Descargar"],
            ["Add-in al día", "addinVersion ≥ latest", "Verde: «Add-in 1.2.0 · al día» + Descargar como «Descargar de nuevo»"],
            ["Mac / Linux", "navigator.platform", "«El add-in es para Windows con Revit. En este equipo use Cargar archivo si un colega ya midió.» Sin botón que descargue un exe inútil."],
        ],
    )
    p(
        doc,
        "Al pulsar Descargar: se pide GET /api/revit/addin/download/{year}?v={version}. "
        "El navegador baja el exe. No se abre un tutorial de 20 páginas. "
        "Tras la descarga, un toast: «Cierre Autodesk Revit, ejecute el instalador, vuelva a abrir el modelo y pulse Conectar obra.» "
        "Si el manifiesto no está (aún no hay binario en el CDN), el botón no se inventa un enlace roto: "
        "queda deshabilitado con «El instalador se publicará con la primera versión del add-in.»",
        align="justify",
    )

    h(doc, "13.2 Cabecera (siempre visible)", 2)
    bullet(doc, "Selector de plantilla (agrupado: Edificaciones → Vivienda unifamiliar…). Si state.plantillaId existe, viene elegido. Cambiar plantilla recalcula el cruce; no borra correcciones manuales.")
    bullet(doc, "Paquete: nombre del RVT, fecha, revisión, n.º de grupos. Botones Cargar .mcrevit.json, Cargar delta, Quitar.")
    bullet(doc, "Semáforo: Identificados / Por revisar / Anexados / Huecos de plantilla.")
    bullet(doc, "Anexar con partidas (primario). Deshabilitado si no hay filas elegibles. Ayuda: «Anexa solo lo identificado o aceptado. Las rojas no se tocan.»")
    bullet(doc, "Historial de actualizaciones: r1 Envío · r2 Actualizar (+0,39 m³ C-03) · r3 Añadir V-12.")

    h(doc, "13.3 Dos modos de lectura", 2)
    p(doc, "A. Por elemento del modelo (cómo piensa el modelador)", bold=True, space=4)
    p(
        doc,
        "Árbol: CONCRETO ARMADO → Columnas / Vigas / Losas / Zapatas / Placas. "
        "Cada tipo: las tres filas (concreto, encofrado, acero) con estado, [cambiar] y [ok]. "
        "Secciones: CONCRETO SIMPLE, ALBAÑILERÍA (si se activa), SIN IDENTIFICAR, OMITIDOS.",
        align="justify",
    )
    p(doc, "B. Por partida de la plantilla (cómo piensa el presupuestista)", bold=True, space=4)
    p(
        doc,
        "Capítulo 04 Obras de concreto armado. Cada código de la plantilla: metrado plantilla → metrado modelo, "
        "estado (anexar / falta en RVT / fuera de plantilla). Este modo verifica las dos direcciones: "
        "elemento sin partida correcta y partida sin elemento.",
        align="justify",
    )

    h(doc, "13.4 Fila: controles", 2)
    add_table(
        doc,
        ["Control", "Comportamiento"],
        [
            ["Partida", "Clic: buscador filtrado por plantilla y por unidad."],
            ["Metrado", "Editable. Si se cambia, metradoManual = true y nota «ajustado respecto de Revit»."],
            ["Estado", "Chip. Aceptar pasa sugerida/revisar a aceptada."],
            ["Motivo", "Frase humana siempre visible. Ejemplo: «Columna · 30x50 · concreto 210 → EST-04.01.02 porque el rol es columna y la plantilla unifamiliar incluye ese código»."],
            ["Crear partida", "Capítulo 14."],
            ["Origen", "n elementos · familia · tipo · nivel · revisión"],
        ],
    )
    p(doc, "Tonos: verde sugerida/aceptada; ámbar revisar / fuera_de_plantilla / hueco_modelo; rojo conflicto / sin_identificar; azul gris anexada; violeta creada_en_obra. No se edita el P.U. aquí: el APU se ve en Presupuesto.", align="justify")

    h(doc, "13.5 Interfaz — disposición de pantalla", 2)
    p(
        doc,
        "Escritorio (≥ 1280 px): izquierda cabecera + semáforo (fijo); centro árbol o tabla (scroll); "
        "derecha ficha del ítem seleccionado (motivo largo, UniqueIds, botones). "
        "El croquis de la obra no se toca. Impresión: el comparativo y el cuadro anexado salen en el PDF de presupuesto como anexo «Origen Revit, revisión n», no dentro de cada APU.",
        align="justify",
    )

    # ───────── 14 ─────────
    h(doc, "14. Anexar con partidas y crear partida de obra", 1)
    h(doc, "14.1 Anexar", 2)
    p(
        doc,
        "Confirmación: «Se anexarán 12 filas. 8 actualizarán metrado. 3 se añadirán (fuera de plantilla, aceptadas). "
        "1 es partida de obra. No se tocan 5 en conflicto.» Desde la web o desde el panel Revit (mismos criterios).",
        align="justify",
    )
    bullet(doc, "Si existe línea con el mismo código y los mismos uniqueIds+campo: actualizar metrado y vinculoRevit.")
    bullet(doc, "Si existe línea de plantilla con ese código y sin vínculo: escribir metrado y el vínculo (primera vez).")
    bullet(doc, "Si no existe: push { id, codigo, origenCodigo, metrado, vinculoRevit }.")
    bullet(doc, "Reimportar el mismo RVT no duplica. Grupo desaparecido: la línea no se borra; se marca ausente_en_modelo.")

    h(doc, "14.2 Crear partida (diálogo, una columna)", 2)
    p(doc, "Aparece en sin_identificar, fuera_de_plantilla, conflicto_resistencia y hueco de catálogo (encofrado de zapata).", align="justify")
    bullet(doc, "Origen (solo lectura): familia, tipo, rol, unidad, metrado.")
    bullet(doc, "Base: partida de catálogo más cercana (obligatoria). Se clona el APU.")
    bullet(doc, "Código de obra: siguienteCodigoPartida → EST-04.01.02-2. Prohibido teclear X-01.")
    bullet(doc, "Descripción de obra editable: «Concreto en columnas f'c 280 kg/cm² — tipo 40×70».")
    bullet(doc, "Unidad bloqueada (la de la base).")
    bullet(doc, "Check Recordar regla: escribe la hoja de mapeo de la obra.")
    p(doc, "PARTIDAS global no se muta. Igual que los insumos propios.", align="justify")

    # ───────── 15 ─────────
    h(doc, "15. Add-in de producción", 1)
    h(doc, "15.1 Entrega técnica", 2)
    add_table(
        doc,
        ["Ítem", "Requisito"],
        [
            ["API Revit", "2023, 2024, 2025, 2026. Un proyecto/dll por año (el API no es binario-compatible)."],
            ["Manifiesto", "MemoriaCalc.addin en %ProgramData%\\Autodesk\\Revit\\Addins\\<año>\\"],
            ["Instalador", "MSI o exe Inno/WiX. Elige años. Instala parámetros compartidos MemoriaCalc.txt."],
            ["Firma", "Authenticode. Sin firma, SmartScreen asusta a la oficina."],
            ["Viewer", "Enviar/Actualizar/Localizar funcionan en Revit Viewer. Escribir códigos y guardar snapshot en el RVT requieren edición."],
            ["UI", "WPF para panel y ventana Actualizar. ExternalCommand + DockablePaneProvider + IUpdater no se usa para medir en cada cambio (caro). Medir es bajo demanda."],
            ["Progreso", "IProgress o barra propia. Cancelar (CancellationToken). «Elemento 1 204 de 18 440»."],
            ["Log", "%AppData%\\MemoriaCalc\\revit\\logs\\yyyyMMdd.log  Errores por elemento, no stack al usuario."],
            ["Memoria", "No retener geometría de todo el documento. Dispose de solids. Tope avisado > 80 000 elementos: «Esto tardará; filtre por categoría o selección»."],
            ["Worksharing", "ExtensibleStorage se escribe en transacción corta. Si el central está ocupado: reintentar y mensaje claro. No corromper el modelo."],
            ["Idioma", "Español de la cinta. Revit EN/ES: nombres de categoría por BuiltInCategory, no por string localizado."],
        ],
    )
    h(doc, "15.2 Solución Visual Studio", 2)
    bullet(doc, "MemoriaCalc.Revit.Core — clasificador, medición, snapshot, JSON (net48 / net8 según año).")
    bullet(doc, "MemoriaCalc.Revit.2023 … 2026 — comandos y ribbon (referencias RevitAPI, RevitAPIUI).")
    bullet(doc, "MemoriaCalc.Revit.Installer")
    bullet(doc, "Pruebas: proyecto de medición con sólidos sintéticos (NUnit) + un RVT de laboratorio (pórtico 2 vanos) no versionado si pesa.")
    h(doc, "15.3 Lo que el usuario ve cuando algo falla", 2)
    p(
        doc,
        "Diálogo único: título «MemoriaCalc no pudo terminar la medición», cuerpo en español "
        "(«2 elementos sin sólido · 1 vínculo no cargado»), botón Ver registro. Nunca un exception.ToString() en modal.",
        align="justify",
    )
    h(doc, "15.4 Publicación (para que Descargar no sea un botón muerto)", 2)
    p(
        doc,
        "Un ecosistema de producción no se improvisó con un ZIP en Drive. Cada release del add-in:",
        align="justify",
    )
    bullet(doc, "1. Compila dll 2023–2026, firma Authenticode, arma MemoriaCalc-Revit-Setup-{semver}.exe.")
    bullet(doc, "2. Calcula SHA-256 y sube exe + .sha256 al CDN (ruta inmutable /revit/{semver}/).")
    bullet(doc, "3. Actualiza GET /api/revit/addin/releases (latest, por año, notas, minWeb, fecha).")
    bullet(doc, "4. La pestaña web lee el manifiesto en cada visita. El botón Descargar apunta a esa latest.")
    bullet(doc, "5. El add-in, al Conectar, envía addinVersion en el paquete/delta. La pestaña compara y pinta «desactualizado».")
    p(
        doc,
        "Mientras no exista el primer exe firmado, la pestaña muestra el bloque de descarga en estado «próximamente» "
        "y deja Cargar archivo. No se publica un enlace 404. Eso es poco profesional.",
        align="justify",
    )

    # ───────── 16 ─────────
    h(doc, "16. Requisitos BIM del modelo (BEP corto)", 1)
    p(
        doc,
        "Una página para el estructurista. Si el modelo no cumple, el plugin no adivina: marca revisar.",
        align="justify",
    )
    add_table(
        doc,
        ["Exigencia", "Por qué"],
        [
            ["Material estructural asignado en columnas, vigas, losas y zapatas", "Primer filtro concreto/acero/ladrillo"],
            ["f'c en el nombre del material o parámetro fc / f'c", "Si no, confianza media y partida 210"],
            ["Columnas en Structural Columns, no Generic Model", "El clasificador no busca pórticos en mobiliario"],
            ["Zapatas en Structural Foundation", "Evita que una losa de cimentación mal categorizado sea losa de techo"],
            ["Losa aligerada: vacíos de ladrillo o parámetro de espesor equivalente", "Si no, volumen lleno y no se anexa en lote"],
            ["Viga de cimentación en nivel de cimientos o tipo con «ciment» / «amarre»", "Si no, cae en viga de entrepiso (revisar)"],
            ["No resolver el pórtico en in-place", "Se mide, pero nace desconocido"],
            ["Rebar hospedado si se quiere acero", "Sin Rebar el acero queda hueco; no se inventa"],
            ["Vínculo estructural cargado al medir", "Si está descargado no hay baja falsa ni metrado cero silencioso"],
            ["Fase de la vista 3D coherente con lo que se presupuesta", "Derribo no entra como concreto nuevo"],
        ],
    )

    # ───────── 17 ─────────
    h(doc, "17. Flujos operativos didácticos", 1)
    h(doc, "17.1 Primera medición — casa de 2 pisos", 2)
    bullet(doc, "1. Revit: Conectar obra «Casa Los Olivos» (plantilla Vivienda unifamiliar) o Enviar a archivo.")
    bullet(doc, "2. Alcance: documento + vínculos, fase de vista Nueva construcción, categorías estructurales.")
    bullet(doc, "3. Enviar. Panel Clasificación: columnas EST-04.01.02, vigas 04.01.03, losa aligerada 04.01.04. Viga en cimientos → 04.01.08 (fuera de plantilla o añadir). Escalera de plantilla sin modelo → hueco.")
    bullet(doc, "4. En la web o en el panel: verificar modo B, corregir una losa si hizo falta, crear cisterna si el modelo la trajo.")
    bullet(doc, "5. Anexar con partidas. El presupuesto muestra metrados Revit y el APU del catálogo. Snapshot r1.")

    h(doc, "17.2 El modelo cambia — flujo Actualizar", 2)
    p(
        doc,
        "Snapshot r1: 8 columnas 30×50, 3,60 m³ anexados a EST-04.01.02. El estructurista cambia 2 columnas a 40×70, "
        "borra 1 zapata, añade 1 viga 25×50 y alarga una losa. El presupuestista pulsa Actualizar y ve:",
        align="justify",
    )
    add_table(
        doc,
        ["Estado", "Elemento", "Campo", "Antes", "Ahora", "Partida", "Check"],
        [
            ["Modificado", "Col C-03 40×70", "concreto", "0,45", "0,84", "EST-04.01.02", "sí"],
            ["Modificado", "Col C-03", "encofrado", "6,00", "8,40", "EST-04.03.01", "sí"],
            ["Modificado", "Col C-07 40×70", "concreto", "0,45", "0,84", "EST-04.01.02", "sí"],
            ["Idéntico", "Resto de columnas", "—", "—", "—", "—", "ocultas"],
            ["Eliminado", "Zap Z-04", "concreto", "0,58", "0", "EST-04.01.01", "no (decide)"],
            ["Nuevo", "Viga V-12", "concreto", "—", "0,31", "EST-04.01.03 (heredada)", "sí"],
            ["Modificado", "Losa L-2", "concreto", "8,40", "9,05", "EST-04.01.04", "sí"],
        ],
    )
    p(
        doc,
        "Aplica seguros. EST-04.01.02 pasa a 4,38 m³ (recompute de las 8, dos más gordas). "
        "La viga nueva entra si ya estaba anexada o queda pendiente. La zapata no baja hasta que él la marque. "
        "Preliminares y Excel no se enteran. Si las columnas hubieran pasado a Metal-HSS, saldrían reclasificadas y no se aplicarían solas.",
        align="justify",
    )

    h(doc, "17.3 Sin internet", 2)
    bullet(doc, "Enviar escribe Casa.mcrevit.json y snapshot en el RVT.")
    bullet(doc, "Actualizar escribe Casa.mcrevit.delta.json con aceptadoEnRevit verdadero o falso.")
    bullet(doc, "En Presupuestos → Revit → Cargar paquete / Cargar delta. Si ya viene aceptado, solo se registra el historial.")

    # ───────── 18 ─────────
    h(doc, "18. Criterios de aceptación", 1)
    h(doc, "18.1 Motor y diccionario", 2)
    bullet(doc, "StructuralColumns + concreto 210 + 30×50 propone 04.01.02 / 04.03.01 / 04.02.02 (esta si hay kg).")
    bullet(doc, "Viga en nivel de cimientos o tipo con «ciment» no cae en 04.01.03.")
    bullet(doc, "Losa cuyo tipo contiene «aliger» no cae en 04.01.07.")
    bullet(doc, "Muro KK no propone EST-04.")
    bullet(doc, "Plantilla unifamiliar + cisterna → fuera_de_plantilla, no anexo solo.")
    bullet(doc, "Anexar dos veces el mismo paquete no duplica líneas.")
    bullet(doc, "Losa aligerada solo con volumen lleno: no entra en Aplicar seguros.")

    h(doc, "18.2 Actualizar", 2)
    bullet(doc, "Cambiar el peralte de una viga muestra una fila de concreto y una de encofrado de ese UniqueId, no el grupo entero.")
    bullet(doc, "Las no tocadas salen idéntico y no aparecen.")
    bullet(doc, "Aplicar seguros dos veces no suma el Δ otra vez.")
    bullet(doc, "Borrar una columna: eliminado, check off; el metrado no baja hasta marcarla.")
    bullet(doc, "Link descargado ≠ baja masiva.")
    bullet(doc, "Alcance distinto al snapshot: eliminados sin check.")
    bullet(doc, "Metrado manual: ámbar, fuera de seguros.")
    bullet(doc, "Sin snapshot: Actualizar no corre.")
    bullet(doc, "revisionBase vieja: rechazo visible, no silencioso.")
    bullet(doc, "Pie en soles = Σ (Δ × P.U.) de las filas marcadas.")

    h(doc, "18.3 Interfaces", 2)
    bullet(doc, "Cinta con los cuatro grupos. Actualizar apagado sin obra/snapshot y tooltip en español.")
    bullet(doc, "Panel 420 px con cuatro pestañas y barra de estado.")
    bullet(doc, "Ventana Actualizar con las columnas de 6.4 y pie económico.")
    bullet(doc, "Pestaña web: plantilla, dos modos, crear partida EST-…-n, semáforo.")
    bullet(doc, "Localizar aísla el ejemplar, no toda la familia, cuando la fila es un UniqueId.")
    bullet(doc, "Un presupuestista explica una fila: por qué esa columna es EST-04.01.02 y no una viga.")
    bullet(doc, "La pestaña Revit muestra siempre Descargar add-in, selector de año y SHA-256. Vacío: tres pasos, no una tabla hueca.")
    bullet(doc, "En Mac/Linux no se ofrece el exe. Con manifiesto ausente el botón no abre un 404.")
    bullet(doc, "Tras descargar, el toast indica cerrar Revit, instalar y Conectar obra.")

    h(doc, "18.4 Producción del add-in", 2)
    bullet(doc, "Instala y aparece en Revit 2023–2026 (dll del año).")
    bullet(doc, "Un RVT de 15 000 elementos termina con barra y se puede cancelar.")
    bullet(doc, "Un sólido corrupto omite 1 y no tumba el comando.")
    bullet(doc, "Pies convertidos a m / m² / m³.")
    bullet(doc, "Worksharing: transacción corta; mensaje si el central no deja escribir.")

    # ───────── 19 ─────────
    h(doc, "19. Plan de implementación", 1)
    p(doc, "Orden obligatorio. Cada fase se cierra con el capítulo 18. No se salta al add-in de mercado sin A–B.", align="justify")
    add_table(
        doc,
        ["Fase", "Entrega", "Se puede usar sin"],
        [
            ["A", "Tipos v1, classify, rules, measure (unidad), engine, fixtures, tests", "Revit"],
            ["B", "Pestaña Revit, plantilla, modos A/B, crear, anexar, semáforo", "Add-in"],
            ["C1", "Cinta + panel + Enviar a JSON + snapshot ExtensibleStorage", "API"],
            ["C2", "Actualizar local: remide, ventana diff, delta.json", "API"],
            ["C3", "Conectar obra + POST paquete/delta + P.U. en el pie", "—"],
            ["C4", "Escribir/leer MC_* y Assembly Code, localizar ida y vuelta", "—"],
            ["C5", "Añadir solo nuevos + Regenerar + historial web", "—"],
            ["D", "Encofrado por caras + losa neta + huecos + vínculos + fases", "IFC"],
            ["E", "Instalador firmado, CDN, manifiesto /api/revit/addin/releases, botón Descargar en la pestaña", "IFC / 4D"],
        ],
    )
    p(
        doc,
        "Criterio de «se ve profesional»: el presupuestista elige Vivienda unifamiliar, ve columnas con EST-04.01.02 "
        "y losas aligeradas con EST-04.01.04, corrige una losa, crea la cisterna si hace falta y Anexar deja el presupuesto "
        "trazable. Cuando el modelo cambia, en el mismo Revit pulsa Actualizar, ve el comparativo con soles y las partidas "
        "anexadas quedan al día. La zapata borrada no desaparece sola.",
        align="justify",
    )

    # ───────── ANEXOS ─────────
    h(doc, "Anexo A. Glosario", 1)
    add_table(
        doc,
        ["Término", "Significado en este expediente"],
        [
            ["Paquete", "Archivo .mcrevit.json de una primera medición"],
            ["Snapshot", "Foto de todas las líneas BIM de una revisión"],
            ["Delta", "Filas no idénticas que el usuario puede aplicar"],
            ["Grupo", "Vista resumida (familia+tipo+nivel). No es la identidad"],
            ["Rol", "Identidad de obra: columna, viga, losa_aligerada…"],
            ["Campo", "concreto_m3, encofrado_m2, acero_kg…"],
            ["Plantilla", "Semilla MemoriaCalc (unifamiliar, colegio…)"],
            ["Partida de catálogo", "Código RN en PARTIDAS (inmutable)"],
            ["Partida de obra", "Línea con origenCodigo y código …-n"],
            ["Anexar", "Escribir o actualizar lineas[].metrado con vinculoRevit"],
            ["Recompute", "Metrado = suma de ejemplares vivos de ese código y campo"],
            ["Hueco de plantilla", "La plantilla pide la partida y el RVT no trajo elemento"],
            ["Hueco de modelo", "El elemento existe pero falta una cantidad (típico: acero)"],
            ["Hueco de catálogo", "Hay cantidad y no hay código RN (encofrado de zapata)"],
            ["Seguros", "Altas bien identificadas + modificados de cantidad, mismo código"],
            ["Cost-it", "Add-in de RIB que conecta Revit con Presto (no «Cossit»)"],
        ],
    )

    h(doc, "Anexo B. Parámetros compartidos MemoriaCalc.txt", 1)
    add_table(
        doc,
        ["Parámetro", "Tipo", "Aplica a", "Quién lo escribe"],
        [
            ["MC_CODIGO", "texto", "Tipo (prioridad) o ejemplar", "Plugin al asignar / anexar"],
            ["MC_DESCRIPCION", "texto", "Tipo", "Plugin"],
            ["MC_UNIDAD", "texto", "Tipo", "Plugin"],
            ["MC_ROL", "texto", "Tipo", "Plugin (clasificador)"],
            ["MC_CAMPO", "texto", "Tipo", "concreto / lista"],
            ["MC_ORIGEN", "texto", "Tipo", "siempre MemoriaCalc"],
            ["MC_VOL_NETO", "número m³", "Tipo o ejemplar de losa", "Modelador, opcional"],
            ["MC_E_EQ", "número m", "Tipo de losa aligerada", "Modelador, espesor equivalente"],
            ["MC_OBRA_ID", "texto", "Información del proyecto", "Al conectar"],
            ["MC_REVISION", "texto", "Información del proyecto", "Al aceptar un update"],
        ],
    )
    p(doc, "Grupo de parámetros: MemoriaCalc. GUID estables en el archivo compartido (no regenerar GUID entre versiones). Assembly Code y Nota clave de Revit se leen; no se sobrescriben salvo que el usuario lo pida.", align="justify")

    h(doc, "Anexo C. Prohibiciones operativas", 1)
    add_table(
        doc,
        ["Prohibido", "Por qué", "Qué hacer"],
        [
            ["Inventar EST-99 o REV-01", "Rompe el libro y el APU", "Partida de obra desde una base del catálogo"],
            ["Anexar filas rojas en lote", "Contamina el presupuesto", "Resolver una a una"],
            ["Usar volumen lleno de aligerado en silencio", "Infla cemento", "Advertir; no entra en seguros"],
            ["Inventar kg de acero", "No es metrado", "Hueco de modelo"],
            ["Mezclar zapata + columna en un m³", "Distinto APU", "Roles separados"],
            ["Mutar PARTIDAS desde la pestaña", "El catálogo es de todas las obras", "Solo state.lineas"],
            ["Actualizar = borrar y exportar de nuevo", "Pierde APU, Excel, GG", "Delta + recompute"],
            ["Usar ElementId como clave", "Cambia al copiar", "UniqueId o LinkId+UniqueId"],
            ["Sumar deltas encadenados", "Descuadre", "Siempre Σ de ejemplares vivos"],
            ["Aplicar eliminados por defecto", "Un workset oculto parece demolición", "Check off"],
            ["Tratar link descargado como baja", "Borra metrados al cerrar el vínculo", "Estado vínculo no cargado"],
            ["Pisar metradoManual", "El ingeniero ya midió en plano", "Forzar explícito"],
            ["Vincular un RVT a dos obras", "Snapshot mentiroso", "Desconectar primero"],
            ["Exception.ToString() al usuario", "No es producto", "Diálogo en español + log"],
        ],
    )

    p(
        doc,
        "Fin del expediente MC-REV-01 · Revisión 01. Este documento es la especificación hasta que el código exista. "
        "No se implementa el add-in de mercado sin cerrar las fases A, B, C2 y D de medición.",
        italic=True,
        color=MUTED,
        size=10,
        space=12,
    )

    OUT.parent.mkdir(parents=True, exist_ok=True)
    doc.save(OUT)
    print(OUT)


if __name__ == "__main__":
    build()

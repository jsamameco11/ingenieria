import os, json, traceback
from pathlib import Path

try:
    import openpyxl
except Exception as e:
    print("openpyxl error", e)

try:
    import xlrd
except Exception as e:
    print("xlrd error", e)

base = Path(r"d:\Renzo\RENZO\6. EXCELS\1. ESTRUCTURAS")
out_dir = Path(r"C:\Users\Renzo\Desktop\WEB MEMORIAS DESCRIPTIVAS")
out_dir.mkdir(parents=True, exist_ok=True)

files = [
    r"3. PUENTES\11.-DISEÑO-DE-ESTRIBO-3.xlsx",
    r"3. PUENTES\ESTRIBO EN VOLADIZO COMPLETOO.xlsx",
    r"3. PUENTES\ESTRIBO-POR-GRAVEDAD-2.xls",
    r"3. PUENTES\ESTRIBO DE GRAVEDAD  - PROPIO COMPL.xlsx",
    r"3. PUENTES\DISEÑO DE ESTRIBO - VOLADIZO.xlsx",
    r"3. PUENTES\DISEÑO-DE-ESTRIBO-DE-CONCRETO-ARMADO.xlsx",
    r"3. PUENTES\DISEÑO-DE-ESTRIBO-PANTALLA.xlsx",
    r"3. PUENTES\DIS ESTRIBO CONCRETO - AVANCE.xlsx",
    r"3. PUENTES\DIS ESTRIBO PANTALLA  - AVANCE PROPIO.xlsx",
    r"3. PUENTES\DIS ESTRIBOS COMPL.xls",
    r"3. PUENTES\DIS PUENTE VEHICULAR.xlsx",
    r"3. PUENTES\DIS PUENTES LOSA - PROPIO.xlsx",
    r"3. PUENTES\DISEÑO DE LOSA DE PUENTE.xlsx",
    r"3. PUENTES\ANAL DISE LOSA PUENTE.xlsx",
    r"3. PUENTES\DIS VIGA PRESFORZADA.xlsx",
    r"3. PUENTES\DIS VIG PRESFORZADA PROPIO.xlsx",
    r"3. PUENTES\DISEÑO DE VIGA PRETENSADA.xlsx",
    r"3. PUENTES\DIS DISPOSITIVOS DE APOYO.xlsx",
    r"3. PUENTES\DISEÑ PLAC APOYO.xlsx",
    r"3. PUENTES\DIS TRAVESAÑO.xlsx",
    r"3. PUENTES\DISEÑ PUENTE CAJON.xls",
    r"1. EDIFIC\1. COLUMNAS\COL PRO.xlsx",
    r"1. EDIFIC\2. VIGAS\DIS VIGAS FLEXION.xlsx",
    r"1. EDIFIC\2. VIGAS\DISEÑO VIGA X CORTANTE.xlsx",
    r"1. EDIFIC\2. VIGAS\DISEÑO VIGA DOBLE ARMAZON.xlsx",
    r"1. EDIFIC\2. VIGAS\VIGAS DOBLEMENTE AS.xlsx",
    r"1. EDIFIC\2. VIGAS\DIS AS VIGAS.xlsx",
    r"1. EDIFIC\2. VIGAS\DISEÑO DE VIGA COMPUESTA.xls",
    r"1. EDIFIC\3. CIMENTACION\2. ZAPATAS\ZAP AIS 3.xlsx",
    r"1. EDIFIC\3. CIMENTACION\2. ZAPATAS\ZAP AISL 2.xlsx",
    r"1. EDIFIC\3. CIMENTACION\2. ZAPATAS\ZAP COMBINADA.xlsx",
    r"1. EDIFIC\3. CIMENTACION\1. VIGA DE CIMENTACION\V. CONEXION Z.CENT 2.xlsx",
    r"1. EDIFIC\3. CIMENTACION\7. PLATEA DE CIMENTACION\f314492928.xlsx",
    r"1. EDIFIC\3. CIMENTACION\DISEÑO DE CIMENTACION Y PILOTES.xls",
    r"1. EDIFIC\5.ESCALERAS\ESCALERAS - 2 TRAMOS PERFECTO.xlsx",
    r"1. EDIFIC\5.ESCALERAS\ESCALERA 1 DESCANSO.xlsx",
    r"1. EDIFIC\5.ESCALERAS\DISEÑO DE ESCALERAS.xls",
    r"1. EDIFIC\4. EDIFICACIONES COMPLETO\DISEÑO DE ESTRUCTURAS - CORRECTO.xlsx",
    r"1. EDIFIC\4. EDIFICACIONES COMPLETO\ANALISIS Y DISEÑO EDIF.xlsx",
]

def cell_str(v):
    if v is None:
        return ""
    if isinstance(v, float):
        if v == int(v):
            return str(int(v))
        return f"{v:.6g}"
    return str(v).strip()

def dump_xlsx(path, max_rows=80, max_cols=12):
    wb = openpyxl.load_workbook(path, data_only=True, read_only=True)
    sheets = []
    for name in wb.sheetnames:
        ws = wb[name]
        rows = []
        for i, row in enumerate(ws.iter_rows(max_row=max_rows, max_col=max_cols, values_only=True)):
            vals = [cell_str(c) for c in row]
            if any(vals):
                rows.append(vals)
        n_images = 0
        sheets.append({"name": name, "rows": rows, "images": n_images})
    wb.close()
    # images need regular workbook
    try:
        wb2 = openpyxl.load_workbook(path, data_only=True)
        for name in wb2.sheetnames:
            ws = wb2[name]
            n = len(getattr(ws, "_images", []) or [])
            for s in sheets:
                if s["name"] == name:
                    s["images"] = n
        wb2.close()
    except Exception:
        pass
    return sheets

def dump_xls(path, max_rows=80, max_cols=12):
    book = xlrd.open_workbook(path)
    sheets = []
    for sh in book.sheets():
        rows = []
        rmax = min(sh.nrows, max_rows)
        cmax = min(sh.ncols, max_cols)
        for r in range(rmax):
            vals = [cell_str(sh.cell_value(r, c)) for c in range(cmax)]
            if any(vals):
                rows.append(vals)
        sheets.append({"name": sh.name, "rows": rows, "images": 0})
    return sheets

report = []
for rel in files:
    p = base / rel
    item = {"file": rel, "exists": p.exists(), "size": p.stat().st_size if p.exists() else 0, "sheets": []}
    if not p.exists():
        # try glob by stem
        item["error"] = "NOT FOUND"
        report.append(item)
        continue
    try:
        if p.suffix.lower() == ".xlsx":
            item["sheets"] = dump_xlsx(p)
        else:
            item["sheets"] = dump_xls(p)
        item["sheet_names"] = [s["name"] for s in item["sheets"]]
        item["n_sheets"] = len(item["sheets"])
        item["n_images"] = sum(s["images"] for s in item["sheets"])
    except Exception as e:
        item["error"] = f"{type(e).__name__}: {e}"
    report.append(item)
    print(f"OK {rel} sheets={item.get('n_sheets')} imgs={item.get('n_images')} err={item.get('error','')}")

out = out_dir / "_excel_extract.json"
# shrink rows for json size: keep first 40 non-empty
for item in report:
    for s in item.get("sheets", []):
        s["rows"] = s["rows"][:45]
with open(out, "w", encoding="utf-8") as f:
    json.dump(report, f, ensure_ascii=False, indent=1)
print("WROTE", out, "bytes", out.stat().st_size)

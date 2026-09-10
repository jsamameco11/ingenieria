# -*- coding: utf-8 -*-
import json
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")
data = json.loads(Path(r"C:\Users\Renzo\Desktop\WEB MEMORIAS DESCRIPTIVAS\_potable_extract.json").read_text(encoding="utf-8"))

want = {
    "DOTACION DE AGUA .xlsx": ["1.Mem. Cálculo comun", "2.Mem. Cálculo Lotes dif. areas"],
    "f314812416.xls": ["sed", "pre-filtro", "filtro lento"],
    "f314856448.xls": ["Verifica Agua"],
    "f314853376.xls": ["Verifica Agua"],
    "f314858496.xls": None,
    "f314859520.xls": None,
    "f315129856.xls": None,
    "f315431936.xls": None,
    "L IMPULSION.xlsx": ["Memoria de Calculo", "Apoyado 5m3", "Apoyado 20 m3"],
    "SISTEMA DE CLORACION.xlsx": ["Hoja1"],
}

for item in data:
    fn = item.get("file")
    if fn not in want:
        continue
    print("\n" + "#" * 88)
    print("#", fn)
    sheets = want[fn]
    for s in item.get("sheets", []):
        if sheets is not None and s["name"] not in sheets:
            continue
        print(f"\n===== {s['name']} =====")
        for row in s.get("rows", []):
            j = " | ".join(x for x in row["v"] if x)[:220]
            if j:
                print(f"r{row['r']:3d}: {j}")

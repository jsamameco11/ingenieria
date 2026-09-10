# -*- coding: utf-8 -*-
import json
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")
data = json.loads(Path(r"C:\Users\Renzo\Desktop\WEB MEMORIAS DESCRIPTIVAS\_potable_extract.json").read_text(encoding="utf-8"))
for item in data:
    print("=" * 80)
    print(item.get("file"), "ERR" if "error" in item else "")
    if "error" in item:
        print(item["error"])
        continue
    for s in item.get("sheets", []):
        rows = s.get("rows", [])
        if not rows:
            continue
        print(f"\n--- SHEET {s['name']} n={len(rows)} ---")
        for row in rows[:10]:
            j = " | ".join(x for x in row["v"] if x)[:170]
            if j:
                print(f"  r{row['r']}: {j}")

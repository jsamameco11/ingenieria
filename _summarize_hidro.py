# -*- coding: utf-8 -*-
import json
from pathlib import Path

data = json.loads(Path(r"C:\Users\Renzo\Desktop\WEB MEMORIAS DESCRIPTIVAS\_hidro_extract.json").read_text(encoding="utf-8"))

out = []
for item in data:
    fname = Path(item.get("file", "")).name
    out.append("=" * 90)
    out.append(fname)
    if "error" in item:
        out.append("ERROR: " + item["error"])
        continue
    out.append(f"sheets: {[s['name'] for s in item.get('sheets', [])]} images={item.get('images_total', 0)}")
    for s in item.get("sheets", [])[:3]:
        out.append(f"\n--- SHEET: {s['name']} rows={len(s['rows'])} ---")
        for row in s["rows"][:130]:
            vals = [v for v in row["v"] if v != ""]
            if not vals:
                continue
            # keep more columns
            cells = row["v"]
            line = f"{row['r']:3d} | " + " | ".join(cells[:14])
            out.append(line.rstrip(" |"))
        # formulas sample
        fmls = [r for r in s.get("formulas", []) if any(x.startswith("=") for x in r["f"])]
        if fmls:
            out.append("\n  FORMULAS:")
            for r in fmls[:80]:
                pairs = [f"{i}:{x}" for i, x in enumerate(r["f"]) if str(x).startswith("=")]
                if pairs:
                    out.append(f"  r{r['r']} " + " ; ".join(pairs[:8]))

text = "\n".join(out)
Path(r"C:\Users\Renzo\Desktop\WEB MEMORIAS DESCRIPTIVAS\_hidro_summary.txt").write_text(text, encoding="utf-8")
print("wrote", len(text), "chars")
print(text[:8000])

# -*- coding: utf-8 -*-
import json
from pathlib import Path

data = json.loads(Path("_dump_muros_tierra.json").read_text(encoding="utf-8"))
out = Path("_extract_muros_summary.txt")
lines = []
for name in ["ESTABILIDAD CIRCULAR BISHOP", "ANCLAJES", "MUROS DE TIERRA ARMADA", "CAPACIDAD DE CARGA", "PILOTES PUNTA GRANU-FUSTE COHE"]:
    lines.append("=" * 70)
    lines.append(name)
    lines.append("=" * 70)
    for c in data[name]:
        v = c.get("v")
        f = c.get("f")
        a = c["a"]
        if isinstance(v, str) and len(v) > 1:
            lines.append(f"{a}: {v[:160]}")
        elif f:
            lines.append(f"{a} => {v} | {str(f)[:110]}")
    lines.append("")
out.write_text("\n".join(lines), encoding="utf-8")
print("wrote", out, "lines", len(lines))

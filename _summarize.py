import json
from pathlib import Path

p = Path(r"C:\Users\Renzo\Desktop\WEB MEMORIAS DESCRIPTIVAS\_excel_extract.json")
data = json.loads(p.read_text(encoding="utf-8"))
out = []
for item in data:
    out.append("=" * 80)
    out.append(
        f"{item['file']} | sheets {item.get('n_sheets')} | imgs {item.get('n_images')} | {item.get('error', '')}"
    )
    out.append("SHEETS: " + str(item.get("sheet_names")))
    for s in item.get("sheets", []):
        out.append(f"  -- {s['name']} imgs {s['images']} nrows {len(s['rows'])}")
        for row in s["rows"][:22]:
            line = " | ".join([c for c in row if c])[:220]
            if line.strip():
                out.append("     " + line)

Path(r"C:\Users\Renzo\Desktop\WEB MEMORIAS DESCRIPTIVAS\_excel_summary.txt").write_text(
    "\n".join(out), encoding="utf-8"
)
print("ok", len(out))

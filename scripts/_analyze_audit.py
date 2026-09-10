import json
from collections import Counter

d = json.load(open("scripts/_audit-cronograma-result.json", encoding="utf-8"))
print("summary", d["summary"])
warns = [r for r in d["rows"] if r["grade"] == "warn"]
print("warn count", len(warns))
c = Counter()
for r in warns:
    reasons = []
    if r["orphans"] > 3:
        reasons.append(f"orphans={r['orphans']}")
    if r["durCero"] > 2:
        reasons.append(f"dur0={r['durCero']}")
    if r["sinRend"] > 5:
        reasons.append(f"sinRend={r['sinRend']}")
    if len(r["capsSinEnlace"]) > 2:
        reasons.append(f"caps={len(r['capsSinEnlace'])}")
    if r["coveragePct"] < 98:
        reasons.append(f"cov={r['coveragePct']}")
    if r["preds"] < r["tareasPartida"] * 0.5:
        reasons.append(f"preds={r['preds']}/{r['tareasPartida']}")
    if r["issues"]:
        reasons.extend(r["issues"][:2])
    c[", ".join(reasons) or "unknown"] += 1

print("warn reasons:")
for k, v in c.most_common(15):
    print(v, k)

print("\nSample:")
for r in warns[:10]:
    print(
        r["id"],
        "orph",
        r["orphans"],
        "preds",
        r["preds"],
        "tasks",
        r["tareasPartida"],
        "days",
        r["diasObra"],
        "crit",
        r["criticas"],
        "sinRend",
        r["sinRend"],
    )

print("\nBy category:")
for cat, rows in d["byCat"].items():
    g = Counter(x["grade"] for x in rows)
    print(cat, dict(g), "n=", len(rows), "avgDays", round(sum(x["diasObra"] for x in rows) / len(rows)))

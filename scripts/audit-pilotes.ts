/** Auditoría rápida pilotes. npx --yes tsx scripts/audit-pilotes.ts */
import { MODULES } from "../src/lib/catalog";
import { pilotesPuntaFuste, pilotesPuntaGranuFuste } from "../src/lib/engines/murosTierra";

const map = {
  "pilotes-punta-fuste": pilotesPuntaFuste,
  "pilotes-punta-granu-fuste": pilotesPuntaGranuFuste,
} as const;

for (const slug of Object.keys(map) as (keyof typeof map)[]) {
  const mod = MODULES.find((m) => m.slug === slug);
  if (!mod) {
    console.log("FAIL missing module", slug);
    continue;
  }
  const r = map[slug](mod.defaults);
  console.log("\n===", slug, "===");
  console.log("fields", mod.fields.length);
  console.log("headline:", r.headline);
  console.log("adoption:", r.adoption);
  console.log("steps:", r.steps.map((s) => `${s.n} ${s.title}`).join(" | "));
  console.log("checks:", r.checks.map((c) => `${c.ok ? "OK" : "NO"} ${c.label}`).join(" · "));
  const fail = r.checks.filter((c) => !c.ok);
  if (fail.length) console.log("WARN fails:", fail.map((c) => c.label).join(", "));
}

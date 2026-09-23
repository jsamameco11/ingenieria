import { MODULES } from "../src/lib/catalog.ts";
import { ENGINES } from "../src/lib/engines/index.ts";
import { dumpBoth } from "../src/lib/engines/maestria/drawCommon.ts";
import { exampleModel } from "../src/lib/engines/maestria/types.ts";

function seed(mod: (typeof MODULES)[number]) {
  const base = { ...mod.defaults };
  if (mod.slug === "losa-2dir") return { ...base, ...dumpBoth(exampleModel("losa")) };
  if (mod.slug === "platea") return { ...base, ...dumpBoth(exampleModel("platea")) };
  if (mod.slug === "zapata-corrida" && base.tipo !== "muro") return { ...base, ...dumpBoth(exampleModel("zapata")) };
  return base;
}

for (const mod of MODULES) {
  const fn = ENGINES[mod.engine];
  if (!fn) continue;
  const o = fn(seed(mod));
  const fails = (o.checks ?? []).filter((c) => c.ok === false);
  if (fails.length) {
    console.log(mod.slug);
    for (const c of fails) console.log("  ", c.label, "|", c.value, "|", c.limit);
  }
}

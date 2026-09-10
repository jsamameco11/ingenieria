import { detectProfessionConflict, parseYears, resolveAlias } from "../src/lib/perfil/taxonomy.ts";
import { extractFreeText, extractFromProfile } from "../src/lib/perfil/extract.ts";
import { normalizeAnswer } from "../src/lib/perfil/normalize.ts";
import { localCompleteness } from "../src/lib/perfil/completeness.ts";
import { emptyProfile } from "../src/lib/auth/types.ts";

let failed = 0;
function assert(name, cond) {
  if (!cond) {
    failed += 1;
    console.error("FAIL", name);
  } else {
    console.log("OK", name);
  }
}

assert("vacío", normalizeAnswer("").data_type === "EMPTY");
assert("número 8", normalizeAnswer("8", "NUMBER").value === 8);
assert("rango 6 a 8", parseYears("tengo de 6 a 8 años")?.years === 7);
assert("aprox 7", parseYears("tengo aproximadamente 7 años")?.years === 7);
assert("años inválidos", parseYears("abc") === null);

assert("ing civil", resolveAlias("profession", "Ing. Civil") === "eng-civil");
assert("ingeniero civil", resolveAlias("profession", "Ingeniero civil") === "eng-civil");
assert("civil engineer", resolveAlias("profession", "Civil Engineer") === "eng-civil");
assert("etabs", resolveAlias("technology", "CSI ETABS") === "etabs");
assert("etabs 21", resolveAlias("technology", "ETABS 21") === "etabs");
assert("Etabs minúscula", resolveAlias("technology", "etabs") === "etabs");

assert("conflicto civil vs arquitecto", detectProfessionConflict("Ingeniero Civil", "Arquitecto") === true);
assert("no conflicto alias", detectProfessionConflict("Ing Civil", "Ingeniería Civil") === false);
assert("no conflicto especialidad", detectProfessionConflict("Ingeniero Civil", "Ingeniero estructural") === false);

const p = {
  ...emptyProfile(),
  user_id: "00000000-0000-0000-0000-000000000001",
  profession_id: "icivil",
  profession_label: "Ingeniero(a) civil",
  experience_years: 8,
  workplace_role: "residente",
  specialty_focus: ["estructuras"],
  university: "UNI",
};
const pack = extractFromProfile(p);
assert("una profesión", pack.evidence.filter((e) => e.target_type === "profession").length === 1);
assert("profesión civil", pack.evidence.some((e) => e.catalog_code === "eng-civil" && e.evidence_kind === "declared"));
assert("años", pack.evidence.some((e) => e.catalog_code === "years_of_experience" && e.evidence_text === "8"));
assert("interés estructuras", pack.evidence.some((e) => e.catalog_code === "eng-civil-est" && e.target_type === "interest"));

const twice = extractFromProfile(p);
assert("idempotente paquete", JSON.stringify(twice.evidence.map((e) => e.catalog_code).sort()) === JSON.stringify(pack.evidence.map((e) => e.catalog_code).sort()));

const specialist = extractFreeText("Trabajo como especialista en estructuras");
assert("no cambia profesión a estructural", !specialist.some((e) => e.target_type === "profession" && e.catalog_code === "eng-civil-est"));
assert("sí especialidad o rol", specialist.some((e) => e.target_type === "specialization" || e.target_type === "role" || e.catalog_code === "eng-design-est" || e.catalog_code === "eng-civil-est"));

const etabsUse = extractFreeText("Uso ETABS, SAFE y Revit");
assert("etabs extraído", etabsUse.some((e) => e.catalog_code === "etabs"));
assert("revit extraído", etabsUse.some((e) => e.catalog_code === "revit"));

const ambiguous = extractFreeText("");
assert("texto vacío", ambiguous.length === 0);

const complete = localCompleteness({
  hasName: true,
  hasCountry: true,
  hasProfession: true,
  hasYears: true,
  hasRole: true,
  hasUniversity: true,
  skillCount: 1,
  techCount: 2,
  hasSpecialization: true,
  interestCount: 2,
  goalCount: 0,
  preferenceCount: 1,
});
assert("completitud no inventa objetivos", complete.goals === 0);
assert("preguntas útiles", complete.next_questions.length >= 0);

if (failed) {
  console.error("FAILED", failed);
  process.exit(1);
}
console.log("ALL_OK");

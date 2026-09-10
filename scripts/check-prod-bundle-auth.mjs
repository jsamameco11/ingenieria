const js = await (await fetch("https://ingenieria.miacademiapreu.com/assets/main-TAqhpDfG.js")).text();
console.log("bytes", js.length);
const needles = [
  "folio",
  "Folio",
  "google",
  "Google",
  "accounts.google",
  "gsi/client",
  "qfvgksstvdrxcugbdwkv",
  "functions/v1",
  "id_token",
  "Continuar con Google",
  "autorizada",
  "MEMORIACALC",
  "plaza",
  "554728",
  "jnn9",
  "sb_publishable",
];
for (const n of needles) console.log(n, js.includes(n), js.indexOf(n));
const pubs = [...js.matchAll(/sb_publishable_[A-Za-z0-9_]+/g)].map((m) => m[0]);
console.log("publishable", [...new Set(pubs)]);
const urls = [...js.matchAll(/https:\/\/[a-z0-9.-]+\.supabase\.co/g)].map((m) => m[0]);
console.log("supabase", [...new Set(urls)]);

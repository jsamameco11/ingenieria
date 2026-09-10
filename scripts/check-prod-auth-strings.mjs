const js = await (await fetch("https://ingenieria.miacademiapreu.com/assets/main-TAqhpDfG.js")).text();
const needles = [
  "Iniciar sesi",
  "cuenta personal",
  "Seguir consultando",
  "Continuar con",
  "no est",
  "autoriz",
  "Folio PDF",
  "misma cuenta",
  "GIS",
  "credential",
  "prompt",
  "oauth",
  "OAuth",
  "accounts.google.com",
  "gsi",
  "kxiunxdjtaesswgexsij",
  "supabase.co",
  "setSession",
  "signInWith",
  "AuthProvider",
  "requestEdit",
];
for (const n of needles) {
  const i = js.indexOf(n);
  console.log(JSON.stringify(n), i);
  if (i >= 0) console.log("  ctx:", js.slice(Math.max(0, i - 40), i + n.length + 60).replace(/\s+/g, " "));
}

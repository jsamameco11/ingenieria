async function main() {
  const r = await fetch("https://ingenieria.miacademiapreu.com/api/google-session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id_token: "a.b.c" }),
  });
  console.log("public", r.status, await r.text());
  const r2 = await fetch("https://ingenieria.miacademiapreu.com/api/charges/health");
  console.log("health", r2.status, await r2.text());
  const html = await (await fetch("https://ingenieria.miacademiapreu.com/")).text();
  console.log("bundle", (html.match(/main-[^"']+/) || [])[0]);
  const styles = (html.match(/styles-[^"']+\.js/) || [])[0];
  if (styles) {
    const js = await (await fetch(`https://ingenieria.miacademiapreu.com/assets/${styles}`)).text();
    console.log("prod has jnn9", js.includes("jnn9ibrh"));
    console.log("prod has /api/google-session", js.includes("/api/google-session"));
  }
}
main();

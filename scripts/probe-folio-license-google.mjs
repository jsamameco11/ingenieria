async function main() {
  const r = await fetch("https://folio-api.miacademiapreu.com/api/auth/google", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "jrenzosamco@gmail.com",
      sub: "test-sub-not-real",
      name: "Jhony renzo",
      install_id: "diag-" + Date.now(),
    }),
  });
  console.log("license google", r.status, (await r.text()).slice(0, 300));
}
main();

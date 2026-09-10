export default function DesplieguePage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <p className="text-[11px] tracking-[0.22em] text-copper uppercase">Producción</p>
      <h1 className="font-[family-name:var(--font-display)] text-4xl text-navy">ingenieria.miacademiapreu.com</h1>
      <p className="mt-3 text-ink-2">
        MemoriaCalc vive en el subdominio <strong>ingenieria</strong> de <strong>miacademiapreu.com</strong>.
        No se usa <code>calculos</code> ni otros hosts.
      </p>
      <div className="sheet mt-6 overflow-hidden">
        <table className="w-full text-sm">
          <tbody>
            {[
              ["Tipo", "A"],
              ["Nombre", "ingenieria"],
              ["Dirección / Valor", "IP pública del VPS"],
              ["TTL", "14400"],
              ["Host", "ingenieria.miacademiapreu.com"],
            ].map(([k, v]) => (
              <tr key={k} className="border-b border-line">
                <td className="px-4 py-3 text-steel">{k}</td>
                <td className="px-4 py-3 font-[family-name:var(--font-mono)] text-navy">{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h2 className="mt-10 font-[family-name:var(--font-display)] text-2xl text-navy">VPS</h2>
      <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-ink-2">
        <li>
          En el VPS: Node 20+, copiar el proyecto,{" "}
          <code className="text-navy">npm install && npm run build</code> y servir{" "}
          <code className="text-navy">dist/</code>.
        </li>
        <li>
          Nginx: <code>server_name ingenieria.miacademiapreu.com;</code> (ver{" "}
          <code>deploy/nginx-ingenieria.conf</code>).
        </li>
        <li>
          Certificado: <code>certbot --nginx -d ingenieria.miacademiapreu.com</code>.
        </li>
        <li>
          Culqi: <code>npm run culqi</code> o el servicio{" "}
          <code>deploy/memorcalc-culqi.service</code> (proxy <code>/api/charges/</code>).
        </li>
      </ol>
      <h2 className="mt-10 font-[family-name:var(--font-display)] text-2xl text-navy">Bases</h2>
      <p className="mt-3 text-sm text-ink-2">
        Cálculos: proyecto Supabase <code>kxiunxdjtaesswgexsij</code> → <code>supabase/schema.sql</code>.
        Plan Pro, nube e invitaciones: Folio → <code>npm run supabase:usuarios</code> (o SQL Editor con{" "}
        <code>supabase/memorcalc-billing.sql</code>).
      </p>
    </main>
  );
}

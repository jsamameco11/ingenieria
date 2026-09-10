import Link from "next/link";
import { CATEGORIES, MODULES } from "@/lib/catalog";

export default function EstructurasPage() {
  return (
    <main className="mx-auto max-w-7xl px-6 py-12">
      <p className="text-[11px] tracking-[0.22em] text-copper uppercase">Especialidad</p>
      <h1 className="font-[family-name:var(--font-display)] text-4xl text-navy">Estructuras</h1>
      <p className="mt-2 max-w-2xl text-ink-2">
        Hidráulica, geotecnia y sanitarias se sumarán en la misma taxonomía.
      </p>
      {CATEGORIES.map((c) => (
        <section key={c.id} id={c.id} className="mt-12">
          <h2 className="font-[family-name:var(--font-display)] text-2xl text-navy">{c.label}</h2>
          <p className="mb-4 text-sm text-steel">{c.blurb}</p>
          <div className="grid gap-4 md:grid-cols-2">
            {MODULES.filter((m) => m.category === c.id).map((m) => (
              <Link key={m.slug} href={`/memorias/${m.slug}`} className="sheet p-5 hover:border-navy">
                <p className="text-[11px] tracking-[0.16em] text-copper uppercase">{m.norma}</p>
                <h3 className="mt-1 text-lg text-navy">{m.title}</h3>
                <p className="mt-1 text-sm text-ink-2">{m.short}</p>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}

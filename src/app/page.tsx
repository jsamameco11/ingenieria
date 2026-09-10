import Link from "next/link";
import { CATEGORIES, MODULES } from "@/lib/catalog";

export default function HomePage() {
  return (
    <main>
      <section className="mx-auto max-w-7xl px-6 pb-16 pt-14">
        <p className="text-[12px] tracking-[0.28em] text-copper uppercase">Laboratorio de ingeniería estructural</p>
        <h1 className="mt-3 max-w-3xl font-[family-name:var(--font-display)] text-5xl leading-[1.1] text-navy md:text-6xl">
          Memorias de cálculo con geometría viva y procedimiento paso a paso.
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-ink-2">
          Puentes, columnas, vigas, cimentación y escaleras. Cada módulo desarrolla el procedimiento de cálculo,
          dibuja la sección con cotas editables y emite verificaciones AASHTO / NTE E.060 / E.030.
        </p>
        <div className="mt-8 flex gap-3">
          <Link href="/especialidades/estructuras" className="rounded-sm bg-navy px-5 py-3 text-sm text-paper">
            Abrir estructuras
          </Link>
          <Link href="/despliegue" className="rounded-sm border border-navy px-5 py-3 text-sm text-navy">
            Crear subdominio
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-20">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {CATEGORIES.map((c) => {
            const count = MODULES.filter((m) => m.category === c.id).length;
            return (
              <Link key={c.id} href={`/especialidades/estructuras#${c.id}`} className="sheet p-6 transition hover:-translate-y-0.5">
                <p className="text-[11px] tracking-[0.2em] text-copper uppercase">{count} memorias</p>
                <h2 className="mt-2 font-[family-name:var(--font-display)] text-2xl text-navy">{c.label}</h2>
                <p className="mt-2 text-sm text-ink-2">{c.blurb}</p>
              </Link>
            );
          })}
        </div>
      </section>
    </main>
  );
}

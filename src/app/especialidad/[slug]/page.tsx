import Link from "next/link";
import { notFound } from "next/navigation";
import { getSpecialty, modulesBySpecialty } from "@/lib/catalog";

export default function SpecialtyPage({ params }: { params: { slug: string } }) {
  const spec = getSpecialty(params.slug);
  if (!spec) notFound();
  const mods = modulesBySpecialty(params.slug);
  return (
    <div>
      <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-brass-600">{spec.kicker}</p>
      <h1 className="mt-2 font-serif text-4xl text-navy-950">{spec.title}</h1>
      <p className="mt-3 max-w-2xl text-navy-800/80">{spec.blurb}</p>
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {mods.map((m) => (
          <Link key={m.slug} href={`/modulo/${m.slug}`} className="panel hover:border-brass-500/50">
            <p className="font-mono text-[10px] uppercase tracking-widest text-navy-700/60">{m.norma}</p>
            <h2 className="mt-1 font-serif text-2xl text-navy-900">{m.title}</h2>
            <p className="mt-2 text-sm text-navy-800/75">{m.short}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

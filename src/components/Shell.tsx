import Link from "next/link";
import { SPECIALTIES } from "@/lib/catalog";

export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-paper text-ink">
      <div className="flex min-h-screen">
        <aside className="hidden w-[240px] shrink-0 flex-col bg-navy-950 text-paper print:hidden md:flex">
          <Link href="/" className="border-b border-white/10 px-5 py-6">
            <p className="font-mono text-[10px] tracking-[0.28em] text-brass-400">INGENIERÍA CIVIL</p>
            <p className="font-serif text-2xl leading-none">Memoria<span className="text-brass-400">Calc</span></p>
          </Link>
          <nav className="flex-1 space-y-1 p-3">
            <p className="px-2 pb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">Especialidades</p>
            {SPECIALTIES.map((s) => (
              <Link key={s.slug} href={`/especialidad/${s.slug}`} className="block rounded px-3 py-2 text-[13px] text-white/80 hover:bg-white/5 hover:text-brass-400">
                {s.title}
              </Link>
            ))}
          </nav>
          <Link href="/despliegue" className="border-t border-white/10 px-5 py-4 text-[11px] text-white/50 hover:text-brass-400">
            Subdominio y VPS
          </Link>
        </aside>
        <div className="min-w-0 flex-1">
          <header className="flex items-center justify-between border-b border-navy-800/10 bg-paper/80 px-4 py-3 backdrop-blur print:hidden md:px-8">
            <Link href="/" className="font-serif text-lg md:hidden">MemoriaCalc</Link>
            <p className="hidden font-mono text-[11px] tracking-widest text-navy-700/70 md:block">MEMORIAS DE CÁLCULO · CROQUIS ACOTADO · RNE / AASHTO / ACI</p>
            <span className="font-mono text-[11px] text-navy-700/60">v1.0 profesional</span>
          </header>
          <main className="px-4 py-8 md:px-10 md:py-10">{children}</main>
        </div>
      </div>
    </div>
  );
}

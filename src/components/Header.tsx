import Link from "next/link";

export function Header() {
  return (
    <header className="no-print sticky top-0 z-40 border-b border-line/80 bg-paper/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
        <Link href="/" className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-sm bg-navy text-[11px] font-semibold tracking-[0.18em] text-copper-2">
            CA
          </span>
          <span>
            <span className="block font-[family-name:var(--font-display)] text-lg leading-none text-navy">CALIA</span>
            <span className="text-[11px] tracking-[0.18em] text-steel uppercase">Memorias de cálculo</span>
          </span>
        </Link>
        <nav className="flex items-center gap-6 text-sm text-ink-2">
          <Link href="/especialidades/estructuras" className="hover:text-navy">
            Estructuras
          </Link>
          <Link href="/proyectos" className="hover:text-navy">
            Proyectos
          </Link>
          <Link href="/despliegue" className="hover:text-navy">
            Subdominio
          </Link>
        </nav>
      </div>
    </header>
  );
}

import { useEffect, useRef, useState } from "react";
import { AuthBar } from "../ui/AuthBar";
import { PRESU_MODULOS, PRESU_TABS, type PresuTab } from "../lib/presupuestosHub";
import { CronogramaModule } from "./CronogramaModule";
import { EspecificacionesModule } from "./EspecificacionesModule";
import { ManoObraModule } from "./ManoObraModule";
import { MisPresupuestosModule } from "./MisPresupuestosModule";
import { PresupuestoModule } from "./PresupuestoModule";
import { PresupuestoPdfModule } from "./PresupuestoPdfModule";
import { RevitVincularModule } from "./RevitVincularModule";
import { ValorizacionesModule } from "./ValorizacionesModule";

function accesoClass(acceso: string) {
  if (acceso.startsWith("S/")) return "pay";
  if (acceso.includes("Pro")) return "pro";
  return "free";
}

function ModuloActivo({ tab }: { tab: PresuTab }) {
  if (tab === "pdf") return <PresupuestoPdfModule />;
  if (tab === "revit") return <RevitVincularModule />;
  if (tab === "apu") return <PresupuestoModule hojaDedicada={false} />;
  if (tab === "nube") return <MisPresupuestosModule />;
  if (tab === "formula") return <PresupuestoModule vistaInicial="formula" hojaDedicada={false} />;
  if (tab === "cronograma") return <CronogramaModule />;
  if (tab === "valorizaciones") return <ValorizacionesModule />;
  if (tab === "eett") return <EspecificacionesModule />;
  if (tab === "jornales") return <ManoObraModule />;
  return null;
}

function HubBurger({ open }: { open: boolean }) {
  return (
    <span className={`ing-pre-burger${open ? " is-open" : ""}`} aria-hidden>
      <i />
      <i />
      <i />
    </span>
  );
}

function TabsNav({
  tab,
  onTab,
}: {
  tab: PresuTab;
  onTab: (next: PresuTab) => void;
}) {
  return (
    <>
      {PRESU_TABS.map((t) => (
        <button
          key={t.id}
          type="button"
          className={tab === t.id ? "on" : ""}
          aria-current={tab === t.id ? "page" : undefined}
          onClick={() => onTab(t.id)}
        >
          {t.label}
        </button>
      ))}
    </>
  );
}

export function PresupuestosHubPage({
  tab,
  onTab,
  onBack,
}: {
  tab: PresuTab;
  onTab: (next: PresuTab) => void;
  onBack: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const barRef = useRef<HTMLElement>(null);

  useEffect(() => {
    setMenuOpen(false);
  }, [tab]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    const onDoc = (e: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDoc);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDoc);
    };
  }, [menuOpen]);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 901px)");
    const close = () => setMenuOpen(false);
    mq.addEventListener("change", close);
    return () => mq.removeEventListener("change", close);
  }, []);

  return (
    <div className={`ing-pre${menuOpen ? " is-menu" : ""}`}>
      <header className="ing-pre-bar" ref={barRef}>
        <button type="button" className="ing-pre-back" onClick={onBack}>
          <span aria-hidden="true">←</span>
          Atrás
        </button>
        <div className="ing-pre-brand">
          <div className="ing-pre-mark">MC</div>
          <div>
            <strong>Presupuestos</strong>
            <span>Expediente de obra</span>
          </div>
        </div>
        <nav className="ing-pre-tabs" aria-label="Opciones de presupuestos">
          <TabsNav tab={tab} onTab={onTab} />
        </nav>
        <span className="ing-pre-signature" aria-hidden="true">by JRSC</span>
        <div className="ing-pre-auth">
          <AuthBar />
        </div>
        <button
          type="button"
          className={`ing-pre-menu-btn${menuOpen ? " is-open" : ""}`}
          aria-label={menuOpen ? "Cerrar menú de presupuestos" : "Abrir menú de presupuestos"}
          aria-expanded={menuOpen}
          aria-controls="ing-pre-drop"
          onClick={() => setMenuOpen((v) => !v)}
        >
          <HubBurger open={menuOpen} />
        </button>
        {menuOpen ? (
          <div className="ing-pre-drop" id="ing-pre-drop" role="menu">
            <nav className="ing-pre-drop-tabs" aria-label="Opciones de presupuestos">
              <TabsNav tab={tab} onTab={onTab} />
            </nav>
            <div className="ing-pre-drop-auth">
              <AuthBar />
            </div>
          </div>
        ) : null}
      </header>

      <main className={`ing-pre-work${tab === "resumen" ? " is-resumen" : ""}`}>
        {tab === "resumen" ? (
          <div className="ing-pre-body">
            <div className="ing-pre-hero">
              <p className="ing-pre-kicker">Familia PRE</p>
              <h1>Ocho herramientas del expediente</h1>
              <p>Trabaje aquí mismo: hoja de presupuesto, PDF, Revit, fórmula, cronograma, EETT y jornales.</p>
            </div>
            <div className="ing-pre-grid">
              {PRESU_MODULOS.map((m) => (
                <button key={m.id} type="button" className="ing-pre-card" onClick={() => onTab(m.id)}>
                  <header>
                    <small>{m.code}</small>
                    <span className={`ing-pre-pill ${accesoClass(m.acceso)}`}>{m.acceso}</span>
                  </header>
                  <h2>{m.title}</h2>
                  <p>{m.blurb}</p>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <ModuloActivo tab={tab} />
        )}
      </main>
    </div>
  );
}

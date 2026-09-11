import { Component, StrictMode, type ErrorInfo, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { isControlSurface } from "./lib/auth/deviceLock";
import { AuthProvider } from "./ui/AuthProvider";
import "./styles.css";
import "katex/dist/katex.min.css";

class AppErrorBoundary extends Component<{ children: ReactNode }, { err: string }> {
  state = { err: "" };
  static getDerivedStateFromError(e: Error) {
    return { err: e.message || "La aplicación se detuvo." };
  }
  componentDidCatch(e: Error, info: ErrorInfo) {
    console.warn("MemoriaCalc", e, info.componentStack);
  }
  render() {
    if (!this.state.err) return this.props.children;
    return (
      <div className="plaza-inbox-fallback" style={{ minHeight: "100dvh", padding: 40 }}>
        <p className="plaza-kicker">MemoriaCalc</p>
        <h2 style={{ fontFamily: "Georgia, serif", color: "#0b1f33" }}>No se pudo mostrar la pantalla</h2>
        <p style={{ color: "#6b6458", maxWidth: 420 }}>Recargue la página. Si estaba en Mensajes, vuelva a entrar con Google: la bandeja es la misma de Folio PDF.</p>
        <button type="button" className="btn primary" onClick={() => window.location.reload()}>
          Recargar
        </button>
      </div>
    );
  }
}

if (isControlSurface()) {
  window.location.replace("/control.html");
} else {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <AppErrorBoundary>
        <AuthProvider>
          <App />
        </AuthProvider>
      </AppErrorBoundary>
    </StrictMode>,
  );
}

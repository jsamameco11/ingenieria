import { roleLabel } from "../lib/auth/engine";
import { useAuth } from "./AuthProvider";

function GoogleMark() {
  return (
    <svg viewBox="0 0 18 18" width="16" height="16" aria-hidden>
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.71H.96v2.33A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.97 10.71A5.41 5.41 0 0 1 3.68 9c0-.59.1-1.17.26-1.71V4.96H.96A9 9 0 0 0 0 9c0 1.45.35 2.82.96 4.04l3.01-2.33z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.96l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
    </svg>
  );
}

export function AuthBar() {
  const { ready, user, profile, canEdit, isPro, plansLive, openGoogle, signOut, requestEdit } = useAuth();
  if (!ready) {
    return (
      <div className="auth-foot auth-ui">
        <span className="auth-foot-hint">Sesión…</span>
      </div>
    );
  }
  if (!user) {
    return (
      <div className="auth-foot auth-ui">
        <button type="button" className="auth-foot-btn" onClick={openGoogle}>
          <GoogleMark />
          Iniciar sesión
        </button>
        <span className="auth-foot-hint">Consulta libre. Para editar un casillero, inicie sesión.</span>
      </div>
    );
  }
  const name = profile?.full_name || user.email || "Cuenta";
  return (
    <div className="auth-foot auth-ui signed">
      <div className="auth-foot-who">
        {profile?.avatar_url ? <img src={profile.avatar_url} alt="" /> : <span className="auth-avatar sm">{name[0]}</span>}
        <div>
          <strong>{name}</strong>
          <small>
            {profile?.profession_label || (canEdit ? "Cuenta" : "Ficha pendiente")}
            {plansLive && isPro ? " · Pro" : ""}
            {profile?.workplace_role ? ` · ${roleLabel(profile.workplace_role)}` : ""}
          </small>
        </div>
      </div>
      <div className="auth-foot-actions">
        {!canEdit ? (
          <button type="button" className="auth-foot-link" onClick={requestEdit}>
            Completar ficha
          </button>
        ) : null}
        <button type="button" className="auth-foot-link" onClick={() => void signOut()}>
          Salir
        </button>
      </div>
    </div>
  );
}

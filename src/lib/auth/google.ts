import { FOLIO_GOOGLE_WEB_CLIENT_ID, folio, folioHeaders } from "../folio";

type GisId = {
  initialize: (cfg: Record<string, unknown>) => void;
  prompt: (cb?: (n: { isNotDisplayed: () => boolean; isSkippedMoment: () => boolean; getNotDisplayedReason: () => string }) => void) => void;
  renderButton: (el: HTMLElement, opts: Record<string, unknown>) => void;
  cancel: () => void;
  disableAutoSelect?: () => void;
};

declare global {
  interface Window {
    google?: { accounts?: { id?: GisId } };
  }
}

export type GoogleIdentity = {
  idToken: string;
  email: string;
  name: string;
  picture: string;
  sub: string;
};

let gisReady: Promise<void> | null = null;

export function loadGoogleIdentity(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (gisReady) return gisReady;
  gisReady = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-gis="1"]');
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("No se pudo cargar Google Identity.")));
      return;
    }
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.defer = true;
    s.dataset.gis = "1";
    s.onload = () => resolve();
    s.onerror = () => {
      gisReady = null;
      reject(new Error("No se pudo cargar el selector de cuentas de Google."));
    };
    document.head.appendChild(s);
  });
  return gisReady;
}

function decodeJwt(token: string): Record<string, string> {
  const part = token.split(".")[1];
  if (!part) return {};
  try {
    const b64 = part.replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    const bin = atob(pad);
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    const json = new TextDecoder().decode(bytes);
    return JSON.parse(json) as Record<string, string>;
  } catch {
    return {};
  }
}

export function identityFromCredential(credential: string): GoogleIdentity {
  const claims = decodeJwt(credential);
  return {
    idToken: credential,
    email: String(claims.email || ""),
    name: String(claims.name || claims.email || ""),
    picture: String(claims.picture || ""),
    sub: String(claims.sub || ""),
  };
}

export function initGooglePicker(opts: {
  onCredential: (id: GoogleIdentity) => void;
  onError: (message: string) => void;
}): void {
  const id = window.google?.accounts?.id;
  if (!id) {
    opts.onError("El selector de Google no está disponible en este navegador.");
    return;
  }
  id.cancel?.();
  id.disableAutoSelect?.();
  id.initialize({
    client_id: FOLIO_GOOGLE_WEB_CLIENT_ID,
    auto_select: false,
    cancel_on_tap_outside: true,
    context: "signin",
    ux_mode: "popup",
    itp_support: true,
    use_fedcm_for_prompt: false,
    callback: (resp: { credential?: string }) => {
      if (!resp.credential) {
        opts.onError("Google no entregó una cuenta. Elija otra e inténtelo de nuevo.");
        return;
      }
      opts.onCredential(identityFromCredential(resp.credential));
    },
  });
  id.disableAutoSelect?.();
}

export function promptGoogleAccounts(): void {
  /* One Tap dispara «origin no registrado» en este dominio. El botón GIS basta. */
}

export function startGoogleOAuthRedirect() {
  const nonce = crypto.randomUUID();
  sessionStorage.setItem("mcd-g-nonce", nonce);
  const u = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  u.searchParams.set("client_id", FOLIO_GOOGLE_WEB_CLIENT_ID);
  u.searchParams.set("redirect_uri", `${window.location.origin}/`);
  u.searchParams.set("response_type", "id_token");
  u.searchParams.set("scope", "openid email profile");
  u.searchParams.set("nonce", nonce);
  u.searchParams.set("prompt", "select_account");
  window.location.assign(u.toString());
}

export function renderGoogleButton(el: HTMLElement): void {
  window.google?.accounts?.id?.renderButton(el, {
    theme: "outline",
    size: "large",
    type: "standard",
    text: "continue_with",
    shape: "rectangular",
    logo_alignment: "left",
    width: Math.min(360, el.clientWidth || 320),
    locale: "es",
  });
}

function publicSessionError(raw: string): string {
  const text = raw.trim();
  if (!text) return "No se pudo abrir la sesión con Google.";
  if (/autorizada para esa cuenta|cliente Google|No se pudo validar|aún no abrió la sesión|Folio aún no|session_not_found|Refresh Token/i.test(text)) {
    return "Google entregó la cuenta, pero aún no se pudo abrir la sesión. Pulse «Iniciar sesión» de nuevo.";
  }
  return text.replace(/\bFolio\b/gi, "MemoriaCalc");
}

async function applySession(access: string, refresh: string) {
  const { error } = await folio.auth.setSession({
    access_token: access,
    refresh_token: refresh,
  });
  if (error) throw new Error(error.message);
  const { data } = await folio.auth.getSession();
  const user = data.session?.user;
  if (!user) throw new Error("Google aceptó la cuenta, pero la sesión no quedó registrada. Vuelva a intentar.");
  return { userId: user.id, email: user.email || "" };
}

type SessionPayload = {
  ok?: boolean;
  message?: string;
  session?: { access_token?: string; refresh_token?: string; user?: { id?: string; email?: string } };
  user?: { id?: string; email?: string };
  userId?: string;
  email?: string;
};

async function exchangeAt(endpoint: string, payload: Record<string, string>) {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: folioHeaders(),
    body: JSON.stringify(payload),
  });
  const data = (await res.json().catch(() => ({}))) as SessionPayload;
  const access = String(data.session?.access_token || "").trim();
  const refresh = String(data.session?.refresh_token || "").trim();
  if (!res.ok || !access || !refresh) {
    const err = new Error(
      publicSessionError(
        data.message || (res.ok ? "No se entregó una sesión completa. Intente de nuevo." : "No se pudo abrir la sesión con Google."),
      ),
    );
    (err as Error & { http?: number }).http = res.status;
    throw err;
  }
  const applied = await applySession(access, refresh);
  return {
    userId: data.userId || data.user?.id || applied.userId,
    email: data.email || data.user?.email || applied.email,
  };
}

export async function exchangeGoogleSession(identity: GoogleIdentity, installId: string) {
  try {
    const native = await folio.auth.signInWithIdToken({
      provider: "google",
      token: identity.idToken,
    });
    if (!native.error && native.data.session?.user) {
      return {
        userId: native.data.user?.id || native.data.session.user.id,
        email: native.data.user?.email || identity.email,
      };
    }
  } catch {
    /* El proveedor Google en cliente puede faltar; el servidor emite la sesión. */
  }

  const payload = {
    id_token: identity.idToken,
    email: identity.email,
    sub: identity.sub,
    name: identity.name,
    install_id: installId,
    app: "memorcalc",
  };
  const sameOrigin =
    typeof window !== "undefined" && window.location?.origin
      ? `${window.location.origin}/api/google-session`
      : "https://ingenieria.miacademiapreu.com/api/google-session";

  try {
    return await exchangeAt(sameOrigin, payload);
  } catch (err) {
    throw new Error(err instanceof Error ? publicSessionError(err.message) : "No se pudo abrir la sesión con Google.");
  }
}

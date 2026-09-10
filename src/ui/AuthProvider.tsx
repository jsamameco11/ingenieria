import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { folio } from "../lib/folio";
import { installPlazaLiveWatch } from "../lib/plazaLive";
import { exchangeGoogleSession, identityFromCredential, type GoogleIdentity } from "../lib/auth/google";
import { currentInsight, fetchCloudProfile, fetchCloudQuotaUses, flushEvents, installId, mergeUserProfile, pushLocalEvent, readLocalEvents, readLocalProfile, readLocalQuotaUses, saveCloudProfile, saveCloudQuotaUse, writeLocalProfile, writeLocalQuotaUses } from "../lib/auth/store";
import { anchorIngenieriaPlatform } from "../lib/auth/masterIdentity";
import { actionLabelOf, isEditAttempt } from "../lib/auth/editGate";
import { OPEN_EDIT_WITHOUT_LOGIN } from "../lib/auth/access";
import { currentPageSlug, currentSpecialtySlug, isQuotaAction, quotaEngineFromPage } from "../lib/auth/quotas";
import { emptyProfile, profileComplete, type UsageEvent, type UserInsight, type UserProfile } from "../lib/auth/types";
import { fetchPlan, isProNow, type PlanInfo } from "../lib/billing";
import { COURTESY_LAUNCH, fetchBillingLaunch, isOwnerEmail, type BillingLaunch } from "../lib/billingLaunch";
import { claimThisDevice, isControlSurface, isDeviceLockMissing, thisDeviceIsActive } from "../lib/auth/deviceLock";
import { MSG_EQUIPO_OCUPADO, MSG_SESION_CERRADA } from "../lib/support";
import { ingestObservedEvent } from "../lib/perfil/pipeline";

type Modal = "none" | "google" | "profile" | "paywall";

export type QuotaPeek = { ok: boolean; used: number; limit: number; remaining: number; engine: string };

type AuthApi = {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  insight: UserInsight;
  ready: boolean;
  canEdit: boolean;
  modal: Modal;
  busy: boolean;
  error: string;
  requestEdit: () => void;
  openGoogle: () => void;
  closeModal: () => void;
  completeGoogle: (identity: GoogleIdentity) => Promise<void>;
  saveProfile: (next: UserProfile) => Promise<void>;
  signOut: () => Promise<void>;
  track: (ev: UsageEvent) => void;
  setError: (msg: string) => void;
  plan: PlanInfo | null;
  isPro: boolean;
  plansLive: boolean;
  isOwner: boolean;
  launch: BillingLaunch;
  refreshPlan: () => Promise<void>;
  refreshLaunch: () => Promise<void>;
  paywallEngine: string;
  peekQuota: (engineId?: string) => QuotaPeek;
  tryConsumeQuota: (engineId?: string) => QuotaPeek;
  openPaywall: (engineId?: string) => void;
};

const Ctx = createContext<AuthApi | null>(null);

export function useAuth(): AuthApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth requiere AuthProvider");
  return ctx;
}

function pageMeta(): { module_slug: string; specialty: string } {
  return { module_slug: currentPageSlug(), specialty: currentSpecialtySlug() };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [ready, setReady] = useState(false);
  const [modal, setModal] = useState<Modal>("none");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [tick, setTick] = useState(0);
  const [plan, setPlan] = useState<PlanInfo | null>(null);
  const [launch, setLaunch] = useState<BillingLaunch>(COURTESY_LAUNCH);
  const [quotaUses, setQuotaUses] = useState<Record<string, number>>(() => readLocalQuotaUses());
  const [paywallEngine, setPaywallEngine] = useState("");
  const pendingEdit = useRef(false);
  const sessionStartSent = useRef(false);

  const hydrate = useCallback(async (user: User | null) => {
    if (!user) {
      setProfile(null);
      setPlan(null);
      return;
    }
    await anchorIngenieriaPlatform().catch(() => undefined);
    const extras = {
      email: user.email || "",
      full_name: String(user.user_metadata?.full_name || user.user_metadata?.name || ""),
      avatar_url: String(user.user_metadata?.avatar_url || ""),
      google_sub: String(user.user_metadata?.google_sub || ""),
    };
    const cloud = await fetchCloudProfile(user.id).catch(() => null);
    const applyMerged = () => {
      const merged = mergeUserProfile(user.id, readLocalProfile(), cloud, extras);
      setProfile(merged);
      writeLocalProfile(merged);
      return merged;
    };
    applyMerged();
    const nextPlan = await fetchPlan(user.id, extras.email).catch(() => null);
    setPlan(nextPlan);
    const cloudUses = await fetchCloudQuotaUses(user.id).catch(() => ({}));
    const localUses = readLocalQuotaUses();
    const uses: Record<string, number> = { ...localUses };
    for (const [k, v] of Object.entries(cloudUses)) uses[k] = Math.max(uses[k] || 0, v);
    setQuotaUses(uses);
    writeLocalQuotaUses(uses);
    if (isControlSurface()) {
      pendingEdit.current = false;
      setModal("none");
      return;
    }
    try {
      await claimThisDevice();
    } catch (err) {
      if (!isDeviceLockMissing(err)) {
        await folio.auth.signOut();
        setProfile(null);
        setPlan(null);
        setError(err instanceof Error ? err.message : MSG_EQUIPO_OCUPADO);
        setModal("google");
        return;
      }
    }
    pendingEdit.current = false;
    const merged = applyMerged();
    if (!profileComplete(merged)) setModal("profile");
    else setModal((m) => (m === "google" || m === "profile" ? "none" : m));
  }, []);

  useEffect(() => {
    let alive = true;
    folio.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setSession(data.session);
      void hydrate(data.session?.user ?? null).finally(() => {
        if (alive) setReady(true);
      });
    });
    const { data: sub } = folio.auth.onAuthStateChange((event, next) => {
      setSession(next);
      if (event === "TOKEN_REFRESHED" || event === "USER_UPDATED") return;
      void hydrate(next?.user ?? null);
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, [hydrate]);

  useEffect(() => installPlazaLiveWatch(), []);

  const canEdit = OPEN_EDIT_WITHOUT_LOGIN || Boolean(session?.user && profileComplete(profile));
  const plansLive = launch.live;
  const isOwner = isOwnerEmail(session?.user?.email || profile?.email);
  const isPro = !plansLive || isProNow(plan) || isOwner;
  const insight = useMemo(() => currentInsight(profile), [profile, tick]);

  useEffect(() => {
    let alive = true;
    void fetchBillingLaunch().then((next) => {
      if (alive) setLaunch(next);
    });
    return () => {
      alive = false;
    };
  }, []);

  const refreshLaunch = useCallback(async () => {
    setLaunch(await fetchBillingLaunch());
  }, []);

  const refreshPlan = useCallback(async () => {
    const uid = session?.user?.id;
    if (!uid) {
      setPlan(null);
      return;
    }
    const next = await fetchPlan(uid, session.user.email || profile?.email || "");
    setPlan(next);
  }, [session, profile?.email]);

  const requestEdit = useCallback(() => {
    if (OPEN_EDIT_WITHOUT_LOGIN) {
      setModal("none");
      setError("");
      return;
    }
    pendingEdit.current = true;
    setError("");
    if (!session?.user) {
      setModal("google");
      return;
    }
    if (!profileComplete(profile)) {
      setModal("profile");
      return;
    }
    setModal("none");
  }, [session, profile]);

  const completeGoogle = useCallback(async (identity: GoogleIdentity) => {
    setBusy(true);
    setError("");
    try {
      const { userId, email } = await exchangeGoogleSession(identity, installId());
      const { data } = await folio.auth.getSession();
      const user = data.session?.user;
      if (!user) throw new Error("Google aceptó la cuenta, pero la sesión no quedó registrada. Vuelva a intentar.");
      setSession(data.session);
      const next = {
        ...(readLocalProfile() ?? emptyProfile()),
        user_id: user.id || userId,
        email: user.email || email,
        full_name: identity.name,
        avatar_url: identity.picture,
        google_sub: identity.sub,
      };
      writeLocalProfile(next);
      await hydrate(user);
    } catch (err) {
      const raw = err instanceof Error ? err.message : "No se pudo entrar con Google.";
      setError(raw.replace(/\bFolio\b/gi, "MemoriaCalc"));
      setModal("google");
    } finally {
      setBusy(false);
    }
  }, [hydrate]);

  useEffect(() => {
    const raw = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "";
    if (!raw.includes("id_token=")) return;
    const idToken = new URLSearchParams(raw).get("id_token");
    if (!idToken) return;
    history.replaceState(null, "", window.location.pathname + window.location.search);
    void completeGoogle(identityFromCredential(idToken));
  }, [completeGoogle]);

  const saveProfile = useCallback(
    async (next: UserProfile) => {
      if (!session?.user) {
        setModal("google");
        throw new Error("Debe entrar con Google.");
      }
      setBusy(true);
      setError("");
      try {
        const filled: UserProfile = {
          ...next,
          user_id: session.user.id,
          email: session.user.email || next.email,
          onboarding_done: true,
        };
        writeLocalProfile(filled);
        setProfile(filled);
        pendingEdit.current = false;
        setModal("none");
        const insightNext = await saveCloudProfile(filled, readLocalEvents());
        setProfile({
          ...filled,
          inferred_role: insightNext.role_guess,
          inferred_rubros: Object.keys(insightNext.rubros),
          inferred_confidence: insightNext.confidence,
        });
        void flushEvents(session.user.id, readLocalEvents());
      } catch (err) {
        writeLocalProfile({ ...next, onboarding_done: true, user_id: session.user.id });
        setProfile({ ...next, onboarding_done: true, user_id: session.user.id });
        setModal("none");
        setError("");
        if (err instanceof Error && /schema cache|does not exist|42P01|PGRST/i.test(err.message)) {
          /* tablas aún no aplicadas: el perfil queda local y se sincroniza luego */
        }
      } finally {
        setBusy(false);
      }
    },
    [session],
  );

  const signOut = useCallback(async () => {
    await folio.auth.signOut();
    setProfile(null);
    setPlan(null);
    setModal("none");
    pendingEdit.current = false;
    sessionStartSent.current = false;
  }, []);

  useEffect(() => {
    if (!session?.user || isControlSurface()) return;
    let alive = true;
    const tickLock = async () => {
      try {
        const ok = await thisDeviceIsActive();
        if (!alive || ok) return;
        await folio.auth.signOut();
        if (!alive) return;
        setProfile(null);
        setPlan(null);
        setError(MSG_SESION_CERRADA);
        setModal("google");
      } catch {
        /* red o tabla aún no aplicada */
      }
    };
    const id = window.setInterval(() => void tickLock(), 20000);
    void tickLock();
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [session?.user?.id]);

  const track = useCallback(
    (ev: UsageEvent) => {
      const next = { ...pageMeta(), ...ev, at: ev.at || new Date().toISOString() };
      pushLocalEvent(next);
      setTick((n) => n + 1);
      if (ev.event_type === "view_module" && ev.module_slug) {
        setProfile((p) => {
          if (!p) return p;
          const updated = { ...p, last_module: ev.module_slug };
          writeLocalProfile(updated);
          return updated;
        });
      }
      const uid = session?.user?.id;
      if (uid) {
        void flushEvents(uid, [next]);
        void ingestObservedEvent(next).catch(() => undefined);
      }
    },
    [session?.user?.id],
  );

  const peekQuota = useCallback(
    (engineId?: string): QuotaPeek => {
      const engine = engineId || quotaEngineFromPage(currentPageSlug());
      if (!plansLive || isPro) {
        return { ok: true, used: 0, limit: 99, remaining: 99, engine };
      }
      const limit = launch.quotas[engine] ?? 1;
      const used = quotaUses[engine] || 0;
      const remaining = Math.max(0, limit - used);
      return { ok: remaining > 0, used, limit, remaining, engine };
    },
    [plansLive, isPro, launch.quotas, quotaUses],
  );

  const openPaywall = useCallback((engineId?: string) => {
    setPaywallEngine(engineId || quotaEngineFromPage(currentPageSlug()));
    setModal("paywall");
  }, []);

  const tryConsumeQuota = useCallback(
    (engineId?: string): QuotaPeek => {
      const peek = peekQuota(engineId);
      if (!plansLive || isPro) return peek;
      if (!session?.user) {
        setModal("google");
        return { ...peek, ok: false };
      }
      if (!profileComplete(profile)) {
        setModal("profile");
        return { ...peek, ok: false };
      }
      if (!peek.ok) {
        openPaywall(peek.engine);
        return peek;
      }
      const used = peek.used + 1;
      const next = { ...quotaUses, [peek.engine]: used };
      setQuotaUses(next);
      writeLocalQuotaUses(next);
      void saveCloudQuotaUse(session.user.id, peek.engine, used).catch(() => undefined);
      track({
        event_type: "quota_use",
        module_slug: currentPageSlug(),
        specialty: currentSpecialtySlug(),
        meta: { engine: peek.engine, used, limit: peek.limit },
      });
      return { ...peek, ok: true, used, remaining: peek.limit - used };
    },
    [peekQuota, plansLive, isPro, session, profile, quotaUses, openPaywall, track],
  );

  useEffect(() => {
    if (canEdit || isControlSurface()) return;
    const halt = (e: Event) => {
      if (!isEditAttempt(e)) return;
      e.preventDefault();
      e.stopPropagation();
      requestEdit();
    };
    document.addEventListener("pointerdown", halt, true);
    document.addEventListener("keydown", halt, true);
    document.addEventListener("beforeinput", halt, true);
    document.addEventListener("paste", halt, true);
    document.addEventListener("change", halt, true);
    return () => {
      document.removeEventListener("pointerdown", halt, true);
      document.removeEventListener("keydown", halt, true);
      document.removeEventListener("beforeinput", halt, true);
      document.removeEventListener("paste", halt, true);
      document.removeEventListener("change", halt, true);
    };
  }, [canEdit, requestEdit]);

  useEffect(() => {
    if (isControlSurface() || !plansLive || isPro) return;
    const halt = (e: Event) => {
      if (!(e.target instanceof Element)) return;
      if (!session?.user || !canEdit) return;
      const btn = e.target.closest("button, [role='menuitem']");
      if (!btn || btn.closest(".auth-ui, .auth-modal, [data-guest-ok], .nav-btn, .sidebar, .home, .card")) return;
      if (!isQuotaAction(actionLabelOf(btn))) return;
      const peek = peekQuota();
      if (peek.ok) {
        tryConsumeQuota(peek.engine);
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      openPaywall(peek.engine);
    };
    document.addEventListener("click", halt, true);
    return () => document.removeEventListener("click", halt, true);
  }, [plansLive, isPro, peekQuota, tryConsumeQuota, session, canEdit, openPaywall]);

  useEffect(() => {
    if (isControlSurface()) return;
    const onClick = (e: MouseEvent) => {
      const el = e.target instanceof Element ? e.target.closest(".nav-btn, .card, .btn, .btn-calc, a, .auth-chip, .planes-card") : null;
      if (!el || el.closest(".auth-modal, .ctl-app")) return;
      track({
        event_type: "click",
        ...pageMeta(),
        meta: {
          label: actionLabelOf(el),
          href: el instanceof HTMLAnchorElement ? el.getAttribute("href") || "" : "",
        },
      });
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [track]);

  useEffect(() => {
    if (isControlSurface()) return;
    if (!sessionStartSent.current) {
      sessionStartSent.current = true;
      track({ event_type: "session_start", ...pageMeta(), meta: { install: installId() } });
    }
    const id = window.setInterval(() => {
      if (document.hidden) return;
      track({ event_type: "heartbeat", ...pageMeta(), meta: { sec: 30 } });
    }, 30000);
    return () => window.clearInterval(id);
  }, [track]);

  const value: AuthApi = {
    session,
    user: session?.user ?? null,
    profile,
    insight,
    ready,
    canEdit,
    modal,
    busy,
    error,
    requestEdit,
    openGoogle: () => {
      setError("");
      setModal("google");
    },
    closeModal: () => {
      if (modal === "profile" && session?.user && !profileComplete(profile)) return;
      if (modal === "paywall") setPaywallEngine("");
      setModal("none");
    },
    completeGoogle,
    saveProfile,
    signOut,
    track,
    setError,
    plan,
    isPro,
    plansLive,
    isOwner,
    launch,
    refreshPlan,
    refreshLaunch,
    paywallEngine,
    peekQuota,
    tryConsumeQuota,
    openPaywall,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

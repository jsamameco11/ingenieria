import { useEffect, useMemo, useRef, useState } from "react";
import { COUNTRIES, countryName, departmentsOf, districtsOf, provincesOf, ubigeoCode } from "../lib/auth/places";
import {
  CRAFT_FAMILIES,
  INTEREST_RUBROS,
  PRACTICE_MODES,
  WORKPLACE_ROLES,
  professionById,
  professionsForFamily,
} from "../lib/auth/professions";
import { quotaEngineById } from "../lib/auth/quotas";
import { emptyProfile, profileComplete, type CraftFamily, type UserProfile } from "../lib/auth/types";
import {
  loadGoogleIdentity,
  initGooglePicker,
  renderGoogleButton,
  startGoogleOAuthRedirect,
  type GoogleIdentity,
} from "../lib/auth/google";
import { roleLabel } from "../lib/auth/engine";
import { SOPORTE_LABEL, SOPORTE_WA } from "../lib/support";
import { useAuth } from "./AuthProvider";

function GoogleMark() {
  return (
    <svg viewBox="0 0 18 18" width="18" height="18" aria-hidden>
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.71H.96v2.33A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.97 10.71A5.41 5.41 0 0 1 3.68 9c0-.59.1-1.17.26-1.71V4.96H.96A9 9 0 0 0 0 9c0 1.45.35 2.82.96 4.04l3.01-2.33z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.96l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
    </svg>
  );
}

function GoogleModal() {
  const { completeGoogle, closeModal, busy, error, session, setError, plansLive } = useAuth();
  const btnRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [pending, setPending] = useState<GoogleIdentity | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await loadGoogleIdentity();
        if (cancelled) return;
        initGooglePicker({
          onCredential: (id) => {
            setPending(id);
            setError("");
          },
          onError: (msg) => setError(msg),
        });
        if (btnRef.current) renderGoogleButton(btnRef.current);
        setReady(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Google no está disponible.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [setError]);

  const chooseOther = () => {
    setPending(null);
    setError("");
    startGoogleOAuthRedirect();
  };

  return (
    <div className="auth-modal-back auth-ui" role="presentation" onClick={() => !busy && !session && closeModal()}>
      <div className="auth-modal" role="dialog" aria-labelledby="auth-google-title" onClick={(e) => e.stopPropagation()}>
        <header>
          <p className="auth-kicker">MemoriaCalc</p>
          <h3 id="auth-google-title">Iniciar sesión</h3>
          <p>
            Puede consultar las plantillas sin cuenta. Para modificar las plantillas debe iniciar sesión. Luego obtendrá
            las plantillas{plansLive ? " gratuitamente" : ""}.
          </p>
        </header>
        <div className="auth-google-box">
          {pending ? (
            <div className="auth-who auth-google-pending">
              {pending.picture ? (
                <img src={pending.picture} alt="" />
              ) : (
                <span className="auth-avatar">{(pending.name || pending.email || "?")[0]}</span>
              )}
              <div>
                <strong>{pending.name || "Cuenta Google"}</strong>
                <small>{pending.email}</small>
              </div>
            </div>
          ) : (
            <>
              <div ref={btnRef} className="auth-gis" />
              {!ready ? (
                <button type="button" className="auth-google-btn" disabled>
                  <GoogleMark /> Cargando Google…
                </button>
              ) : null}
            </>
          )}
          {pending ? (
            <button
              type="button"
              className="auth-google-btn auth-google-start"
              disabled={busy}
              onClick={() => void completeGoogle(pending)}
            >
              <GoogleMark /> {busy ? "Abriendo sesión…" : "Iniciar sesión"}
            </button>
          ) : null}
          <button type="button" className="auth-google-switch" disabled={busy} onClick={chooseOther}>
            Elegir otra cuenta de Google
          </button>
        </div>
        {error ? <p className="auth-error">{error}</p> : null}
        {error && /977|otro equipo|sesiones/i.test(error) ? (
          <p className="auth-fine">
            <a href={SOPORTE_WA} target="_blank" rel="noreferrer">
              WhatsApp soporte {SOPORTE_LABEL}
            </a>
          </p>
        ) : null}
        <p className="auth-fine">
          El inicio de sesión habilita la edición y la nube{plansLive ? ", y Plan Pro" : ""}. Una cuenta, un solo equipo.
          Soporte WhatsApp 977 747 979.
        </p>
        <div className="auth-modal-actions">
          <button type="button" className="btn secondary" disabled={busy} onClick={closeModal}>
            Seguir consultando
          </button>
        </div>
      </div>
    </div>
  );
}

const STEPS = ["Oficio", "Persona", "Ejercicio", "Territorio", "Intereses"];

function ProfileModal() {
  const { profile, user, saveProfile, busy, error, signOut, insight } = useAuth();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<UserProfile>(() => ({
    ...emptyProfile(),
    ...profile,
    email: user?.email || profile?.email || "",
    full_name: profile?.full_name || "",
    country: profile?.country || "Perú",
    country_code: profile?.country_code || "PE",
  }));
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!profile && !user) return;
    setForm((s) => {
      const incoming = profile;
      const keepDraft = Boolean(s.craft_family || s.profession_id || s.workplace_role);
      const incomingComplete = profileComplete(incoming);
      return {
        ...s,
        ...(incomingComplete || !keepDraft ? incoming : {}),
        email: user?.email || incoming?.email || s.email,
        user_id: user?.id || incoming?.user_id || s.user_id,
        full_name: incoming?.full_name || s.full_name,
        avatar_url: incoming?.avatar_url || s.avatar_url,
      };
    });
  }, [profile, user]);

  const deps = departmentsOf(form.country_code);
  const provs = provincesOf(form.country_code, form.department);
  const dists = districtsOf(form.country_code, form.department, form.province);
  const professionOptions = useMemo(() => professionsForFamily(form.craft_family), [form.craft_family]);

  const patch = (partial: Partial<UserProfile>) => setForm((s) => ({ ...s, ...partial }));

  const setFamily = (family: CraftFamily) => {
    const items = professionsForFamily(family);
    const keep = items.some((p) => p.id === form.profession_id);
    const first = family === "interiores" ? items[0] : keep ? professionById(form.profession_id) : undefined;
    patch({
      craft_family: family,
      profession_id: first?.id || (keep ? form.profession_id : ""),
      profession_label: first?.label || (keep ? form.profession_label : ""),
      professional_title: first?.title || (keep ? form.professional_title : ""),
    });
  };

  const validateStep = (n: number): string => {
    if (n === 0 && !form.craft_family) return "Elija si es ingeniero, arquitecto, diseñador de interiores u otro.";
    if (n === 1) {
      if (!form.profession_id) return "Indique su profesión específica.";
      if (!form.age || form.age < 16 || form.age > 99) return "Indique una edad entre 16 y 99 años.";
    }
    if (n === 2) {
      if (!form.workplace_role) return "Indique su rol (proyectista, contratista, residente, etc.).";
      if (!form.practice_mode) return "Indique la modalidad de ejercicio.";
    }
    if (n === 3) {
      if (!form.country_code) return "Indique el país.";
      if (form.country_code === "PE" && (!form.department || !form.province || !form.district)) {
        return "Complete departamento, provincia y distrito.";
      }
    }
    if (n === 4 && form.specialty_focus.length === 0) return "Elija al menos un rubro de interés. Sirve para avisos pertinentes.";
    return "";
  };

  const next = () => {
    const err = validateStep(step);
    if (err) {
      setMsg(err);
      return;
    }
    setMsg("");
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  };

  const submit = async () => {
    for (let i = 0; i < STEPS.length; i++) {
      const err = validateStep(i);
      if (err) {
        setStep(i);
        setMsg(err);
        return;
      }
    }
    const prof = professionById(form.profession_id);
    const nextProfile: UserProfile = {
      ...form,
      profession_label: prof?.label || form.profession_label,
      professional_title: prof?.title || form.professional_title,
      country: countryName(form.country_code),
      city: form.district || form.city,
      ubigeo: form.country_code === "PE" ? ubigeoCode(form.department, form.province, form.district) : "",
      birth_year: form.age ? new Date().getFullYear() - form.age : null,
      onboarding_done: true,
    };
    try {
      await saveProfile(nextProfile);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "No se pudo guardar el perfil.");
    }
  };

  return (
    <div className="auth-modal-back auth-ui" role="presentation">
      <div className="auth-modal auth-modal-wide" role="dialog" aria-labelledby="auth-profile-title">
        <header>
          <p className="auth-kicker">Ficha profesional · paso {step + 1} de {STEPS.length}</p>
          <h3 id="auth-profile-title">Categorización de cuenta</h3>
          <p>
            Estos datos habilitan la edición y permiten enviar avisos acordes a su oficio, edad, territorio y rubros.
            No se puede omitir: sin ficha no se modifican plantillas ni cálculos.
          </p>
          {user?.email ? (
            <div className="auth-who">
              {form.avatar_url ? <img src={form.avatar_url} alt="" /> : <span className="auth-avatar">{(form.full_name || user.email)[0]}</span>}
              <div>
                <strong>{form.full_name || "Cuenta Google"}</strong>
                <small>{user.email}</small>
              </div>
            </div>
          ) : null}
          <ol className="auth-steps" aria-label="Pasos de la ficha">
            {STEPS.map((label, i) => (
              <li key={label} className={i === step ? "on" : i < step ? "done" : ""}>
                {label}
              </li>
            ))}
          </ol>
        </header>

        {step === 0 ? (
          <div className="auth-family-grid">
            {CRAFT_FAMILIES.map((f) => (
              <button
                key={f.id}
                type="button"
                className={`auth-family${form.craft_family === f.id ? " on" : ""}`}
                onClick={() => setFamily(f.id)}
              >
                <strong>{f.label}</strong>
                <span>{f.hint}</span>
              </button>
            ))}
          </div>
        ) : null}

        {step === 1 ? (
          <div className="auth-grid">
            <label className="auth-field wide">
              <span>Profesión específica</span>
              <select
                value={form.profession_id}
                onChange={(e) => {
                  const p = professionById(e.target.value);
                  patch({ profession_id: e.target.value, profession_label: p?.label || "", professional_title: p?.title || "" });
                }}
              >
                <option value="">Seleccione…</option>
                {professionOptions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="auth-field">
              <span>Edad</span>
              <input
                type="number"
                min={16}
                max={99}
                value={form.age ?? ""}
                onChange={(e) => patch({ age: Number(e.target.value) || null })}
              />
            </label>
            <label className="auth-field">
              <span>Sexo</span>
              <select value={form.sex} onChange={(e) => patch({ sex: e.target.value })}>
                <option value="">Prefiero no decir</option>
                <option value="F">Mujer</option>
                <option value="M">Hombre</option>
                <option value="X">Otro</option>
              </select>
            </label>
            <label className="auth-field">
              <span>Años de ejercicio</span>
              <input
                type="number"
                min={0}
                max={60}
                value={form.experience_years ?? ""}
                onChange={(e) => patch({ experience_years: Number(e.target.value) || 0 })}
              />
            </label>
            <label className="auth-field">
              <span>Teléfono</span>
              <input value={form.phone} onChange={(e) => patch({ phone: e.target.value })} placeholder="Opcional" />
            </label>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="auth-grid">
            <label className="auth-field">
              <span>Rol en el que trabaja</span>
              <select value={form.workplace_role} onChange={(e) => patch({ workplace_role: e.target.value as UserProfile["workplace_role"] })}>
                <option value="">Seleccione…</option>
                {WORKPLACE_ROLES.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="auth-field">
              <span>Modalidad</span>
              <select value={form.practice_mode} onChange={(e) => patch({ practice_mode: e.target.value as UserProfile["practice_mode"] })}>
                <option value="">Seleccione…</option>
                {PRACTICE_MODES.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="auth-field">
              <span>CIP / colegiatura</span>
              <input value={form.cip} onChange={(e) => patch({ cip: e.target.value })} placeholder="Opcional" />
            </label>
            <label className="auth-field">
              <span>Empresa / institución</span>
              <input value={form.organization} onChange={(e) => patch({ organization: e.target.value })} />
            </label>
            <label className="auth-field wide">
              <span>Universidad o instituto</span>
              <input value={form.university} onChange={(e) => patch({ university: e.target.value })} />
            </label>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="auth-grid">
            <label className="auth-field">
              <span>País</span>
              <select
                value={form.country_code}
                onChange={(e) =>
                  patch({
                    country_code: e.target.value,
                    country: countryName(e.target.value),
                    department: "",
                    province: "",
                    district: "",
                  })
                }
              >
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            {form.country_code === "PE" ? (
              <>
                <label className="auth-field">
                  <span>Departamento</span>
                  <select value={form.department} onChange={(e) => patch({ department: e.target.value, province: "", district: "" })}>
                    <option value="">Seleccione…</option>
                    {deps.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="auth-field">
                  <span>Provincia</span>
                  <select value={form.province} onChange={(e) => patch({ province: e.target.value, district: "" })} disabled={!form.department}>
                    <option value="">Seleccione…</option>
                    {provs.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="auth-field">
                  <span>Distrito</span>
                  <select value={form.district} onChange={(e) => patch({ district: e.target.value, city: e.target.value })} disabled={!form.province}>
                    <option value="">Seleccione…</option>
                    {dists.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            ) : (
              <>
                <label className="auth-field">
                  <span>Departamento / estado</span>
                  <input value={form.department} onChange={(e) => patch({ department: e.target.value })} />
                </label>
                <label className="auth-field">
                  <span>Provincia / ciudad</span>
                  <input value={form.province} onChange={(e) => patch({ province: e.target.value })} />
                </label>
                <label className="auth-field">
                  <span>Distrito / localidad</span>
                  <input value={form.district} onChange={(e) => patch({ district: e.target.value, city: e.target.value })} />
                </label>
              </>
            )}
          </div>
        ) : null}

        {step === 4 ? (
          <div className="auth-field wide">
            <span>Rubros en los que trabaja o le interesa</span>
            <p className="auth-fine">Marque los que correspondan. Con ellos se eligen campañas y avisos para su perfil.</p>
            <div className="auth-chips">
              {INTEREST_RUBROS.map((r) => {
                const on = form.specialty_focus.includes(r.id);
                return (
                  <button
                    key={r.id}
                    type="button"
                    className={`auth-chip${on ? " on" : ""}`}
                    onClick={() =>
                      patch({
                        specialty_focus: on
                          ? form.specialty_focus.filter((x) => x !== r.id)
                          : [...form.specialty_focus, r.id],
                      })
                    }
                  >
                    {r.label}
                  </button>
                );
              })}
            </div>
            <p className="auth-engine">
              Lectura de uso: {insight.summary || "aún sin señales de navegación."} Confianza {(insight.confidence * 100).toFixed(0)} %.
              {insight.role_guess ? ` Rol inferido: ${roleLabel(insight.role_guess)}.` : ""}
            </p>
          </div>
        ) : null}

        {msg || error ? <p className="auth-error">{msg || error}</p> : null}
        <div className="auth-modal-actions">
          <button type="button" className="btn secondary" disabled={busy} onClick={() => void signOut()}>
            Usar otra cuenta
          </button>
          {step > 0 ? (
            <button type="button" className="btn secondary" disabled={busy} onClick={() => { setMsg(""); setStep((s) => s - 1); }}>
              Atrás
            </button>
          ) : null}
          {step < STEPS.length - 1 ? (
            <button type="button" className="btn" disabled={busy} onClick={next}>
              Continuar
            </button>
          ) : (
            <button type="button" className="btn" disabled={busy} onClick={() => void submit()}>
              {busy ? "Guardando…" : "Guardar y habilitar edición"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function PaywallModal() {
  const { paywallEngine, closeModal, peekQuota } = useAuth();
  const engine = quotaEngineById(paywallEngine);
  const peek = peekQuota(paywallEngine);
  const goPlanes = () => {
    closeModal();
    window.dispatchEvent(new CustomEvent("mcd-go", { detail: { page: "planes" } }));
  };
  return (
    <div className="auth-modal-back auth-ui" role="presentation" onClick={closeModal}>
      <div className="auth-modal" role="dialog" aria-labelledby="auth-paywall-title" onClick={(e) => e.stopPropagation()}>
        <header>
          <p className="auth-kicker">Cupo gratuito agotado</p>
          <h3 id="auth-paywall-title">Pase a Plan Pro</h3>
          <p>
            Ya usó el cupo de cortesía de {engine?.label || "este motor"} ({peek.used} de {peek.limit}).
            El informe de ejemplo sigue visible. Para calcular de nuevo, importar o elaborar otro expediente, active
            mensual, trimestral o anual.
          </p>
        </header>
        <p className="auth-fine">{engine?.hint}</p>
        <div className="auth-modal-actions">
          <button type="button" className="btn secondary" onClick={closeModal}>
            Seguir consultando
          </button>
          <button type="button" className="btn" onClick={goPlanes}>
            Ver planes
          </button>
        </div>
      </div>
    </div>
  );
}

export function AuthModals() {
  const { modal } = useAuth();
  if (modal === "google") return <GoogleModal />;
  if (modal === "profile") return <ProfileModal />;
  if (modal === "paywall") return <PaywallModal />;
  return null;
}

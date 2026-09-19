"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { emailKeywordsFrom, organizationHintFromEmail } from "./emailKeywords";
import { questionnaireOf, type OnboardingField, type SiteQuestionnaire } from "./questionnaires";

type Answers = Record<string, unknown>;

const FOLIO_URL = "https://qfvgksstvdrxcugbdwkv.supabase.co";
const FOLIO_ANON = "sb_publishable_CrjVMkqm4pXDsec2lQ6yAg_R2BukVAe";

export type OnboardingTheme = {
  overlay: string;
  paper: string;
  ink: string;
  muted: string;
  accent: string;
  line: string;
  wash: string;
  control: string;
  action: string;
  actionText: string;
  error: string;
  errorBg: string;
  radius: number;
  pill: number;
  shadow: string;
};

const THEMES: Record<string, OnboardingTheme> = {
  CASA_PALABRA: {
    overlay: "rgba(16, 28, 24, 0.72)",
    paper: "#fffaf1",
    ink: "#12201b",
    muted: "#3f4c46",
    accent: "#8d6a24",
    line: "#d9ccb4",
    wash: "#f3ebe0",
    control: "#ffffff",
    action: "#1a2c26",
    actionText: "#fffaf1",
    error: "#8a1f1f",
    errorBg: "#fdecec",
    radius: 20,
    pill: 999,
    shadow: "0 28px 70px rgba(8, 16, 14, 0.45)",
  },
  CONTRATACIONES: {
    overlay: "rgba(7, 7, 18, 0.78)",
    paper: "#12102c",
    ink: "#f4f7fb",
    muted: "#b7c3d1",
    accent: "#87eaf2",
    line: "rgba(255,255,255,0.14)",
    wash: "#1a1840",
    control: "#16142a",
    action: "#87eaf2",
    actionText: "#12102c",
    error: "#ffb4b4",
    errorBg: "#3a1820",
    radius: 18,
    pill: 12,
    shadow: "0 28px 80px rgba(0, 0, 0, 0.45)",
  },
  MERCAGO: {
    overlay: "rgba(22, 24, 29, 0.58)",
    paper: "#ffffff",
    ink: "#16181d",
    muted: "#5c6370",
    accent: "#ff5a36",
    line: "#e2e4e8",
    wash: "#f7f7f5",
    control: "#ffffff",
    action: "#1f2430",
    actionText: "#f7f7f5",
    error: "#8a1f1f",
    errorBg: "#fdecec",
    radius: 16,
    pill: 999,
    shadow: "0 24px 60px rgba(22, 24, 29, 0.22)",
  },
  LINKEDIN_JOB: {
    overlay: "rgba(7, 20, 34, 0.72)",
    paper: "#fbf8f3",
    ink: "#12151a",
    muted: "#3a3f47",
    accent: "#b08a2d",
    line: "#d8d0c4",
    wash: "#f3eee6",
    control: "#ffffff",
    action: "#071422",
    actionText: "#fbf8f3",
    error: "#8a1f1f",
    errorBg: "#fdecec",
    radius: 8,
    pill: 4,
    shadow: "0 24px 60px rgba(7, 20, 34, 0.35)",
  },
  INGENIERIA: {
    overlay: "rgba(11, 31, 51, 0.72)",
    paper: "#f4efe4",
    ink: "#0b1f33",
    muted: "#5c564c",
    accent: "#8a6a32",
    line: "#d4cbb8",
    wash: "#ebe4d4",
    control: "#ffffff",
    action: "#0b1f33",
    actionText: "#f4efe4",
    error: "#8a1f1f",
    errorBg: "#fdecec",
    radius: 8,
    pill: 4,
    shadow: "0 24px 60px rgba(11, 31, 51, 0.32)",
  },
  FOLIO_PDF: {
    overlay: "rgba(14, 20, 28, 0.7)",
    paper: "#f7f9fc",
    ink: "#15202b",
    muted: "#536274",
    accent: "#3b82f6",
    line: "rgba(21, 32, 43, 0.14)",
    wash: "#eef3f8",
    control: "#ffffff",
    action: "#3b82f6",
    actionText: "#ffffff",
    error: "#8a1f1f",
    errorBg: "#fdecec",
    radius: 12,
    pill: 10,
    shadow: "0 24px 50px rgba(21, 32, 43, 0.22)",
  },
  ODONTOMEDIC: {
    overlay: "rgba(12, 40, 38, 0.7)",
    paper: "#f4fbfa",
    ink: "#12302c",
    muted: "#3d5c58",
    accent: "#0f766e",
    line: "#cde3df",
    wash: "#e7f4f2",
    control: "#ffffff",
    action: "#0f766e",
    actionText: "#f4fbfa",
    error: "#8a1f1f",
    errorBg: "#fdecec",
    radius: 16,
    pill: 999,
    shadow: "0 24px 60px rgba(12, 40, 38, 0.28)",
  },
};

const FALLBACK_THEME = THEMES.CASA_PALABRA;

export function themeOf(platform: string): OnboardingTheme {
  return THEMES[platform] || FALLBACK_THEME;
}

function controlStyle(theme: OnboardingTheme): CSSProperties {
  return {
    width: "100%",
    boxSizing: "border-box",
    borderRadius: Math.max(8, theme.radius - 6),
    border: `1.5px solid ${theme.line}`,
    background: theme.control,
    color: theme.ink,
    fontSize: 16,
    lineHeight: 1.45,
    padding: "12px 14px",
    outline: "none",
    appearance: "auto",
    WebkitAppearance: "menulist",
    fontFamily: "inherit",
  };
}

async function rest(path: string, token: string, init?: RequestInit) {
  const res = await fetch(`${FOLIO_URL}${path}`, {
    ...init,
    headers: {
      apikey: FOLIO_ANON,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(init?.headers || {}),
    },
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error((data && (data.message || data.error)) || `HTTP ${res.status}`);
  return data;
}

export async function saveOnboardingRest(token: string, platform: string, answers: Answers, email?: string) {
  const keywords = emailKeywordsFrom(email || "");
  return rest("/rest/v1/rpc/save_site_onboarding", token, {
    method: "POST",
    body: JSON.stringify({
      p_platform_code: platform,
      p_answers: { ...answers, email_keywords: keywords, organization: answers.organization || organizationHintFromEmail(email || "") },
      p_email_keywords: keywords,
    }),
  });
}

export async function loadOnboardingRest(token: string, platform: string): Promise<{ completed: boolean; answers: Answers }> {
  const rows = await rest(
    `/rest/v1/site_onboarding?platform_code=eq.${encodeURIComponent(platform)}&select=answers,completed_at&limit=1`,
    token,
  );
  const row = Array.isArray(rows) ? rows[0] : rows;
  return { completed: Boolean(row?.completed_at), answers: (row?.answers as Answers) || {} };
}

export async function recordBehaviorRest(
  token: string,
  platform: string,
  input: { kind: string; category?: string; query?: string; target?: string },
) {
  await rest("/rest/v1/rpc/record_site_behavior", token, {
    method: "POST",
    body: JSON.stringify({
      p_platform_code: platform,
      p_kind: input.kind,
      p_category: input.category || null,
      p_query: input.query || null,
      p_target: input.target || null,
      p_weight: 1,
    }),
  }).catch(() => undefined);
}

export function FieldControl({
  field,
  value,
  onChange,
  theme,
}: {
  field: OnboardingField;
  value: unknown;
  onChange: (v: unknown) => void;
  theme: OnboardingTheme;
}) {
  const fieldStyle = controlStyle(theme);
  if (field.kind === "select") {
    return (
      <select value={String(value || "")} onChange={(e) => onChange(e.target.value)} style={fieldStyle}>
        <option value="" style={{ color: theme.muted, background: theme.control }}>
          Seleccione una respuesta
        </option>
        {(field.options || []).map((o) => (
          <option key={o.id} value={o.id} style={{ color: theme.ink, background: theme.control }}>
            {o.label}
          </option>
        ))}
      </select>
    );
  }
  if (field.kind === "multi") {
    const current = Array.isArray(value) ? (value as string[]) : [];
    return (
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {(field.options || []).map((o) => {
          const on = current.includes(o.id);
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => onChange(on ? current.filter((x) => x !== o.id) : [...current, o.id])}
              style={{
                border: on ? `1.5px solid ${theme.action}` : `1.5px solid ${theme.line}`,
                background: on ? theme.action : theme.control,
                color: on ? theme.actionText : theme.ink,
                borderRadius: theme.pill,
                padding: "10px 14px",
                cursor: "pointer",
                fontSize: 14,
                fontWeight: 600,
                lineHeight: 1.3,
              }}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    );
  }
  if (field.kind === "number") {
    return (
      <input
        type="number"
        min={16}
        max={99}
        value={value == null ? "" : String(value)}
        onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
        style={fieldStyle}
      />
    );
  }
  return (
    <input
      value={String(value || "")}
      placeholder={field.placeholder || ""}
      onChange={(e) => onChange(e.target.value)}
      style={fieldStyle}
    />
  );
}

export function OnboardingSheet({
  spec,
  theme,
  answers,
  onChange,
  err,
  busy,
  onSubmit,
}: {
  spec: SiteQuestionnaire;
  theme: OnboardingTheme;
  answers: Answers;
  onChange: (id: string, value: unknown) => void;
  err: string;
  busy: boolean;
  onSubmit: () => void;
}) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 80,
        background: theme.overlay,
        display: "grid",
        placeItems: "center",
        padding: 16,
        color: theme.ink,
      }}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
        style={{
          width: "min(640px, 100%)",
          maxHeight: "92vh",
          overflow: "auto",
          background: theme.paper,
          color: theme.ink,
          borderRadius: theme.radius,
          padding: "28px 24px 22px",
          boxShadow: theme.shadow,
          border: `1px solid ${theme.line}`,
        }}
      >
        <p
          style={{
            margin: 0,
            letterSpacing: "0.18em",
            fontSize: 11,
            fontWeight: 700,
            textTransform: "uppercase",
            color: theme.accent,
          }}
        >
          {spec.brand}
        </p>
        <h2 style={{ margin: "8px 0 10px", fontSize: 28, lineHeight: 1.2, color: theme.ink, fontWeight: 600 }}>
          {spec.title}
        </h2>
        <p style={{ margin: "0 0 8px", color: theme.ink, lineHeight: 1.55, fontSize: 16 }}>{spec.lead}</p>
        <p style={{ margin: "0 0 20px", color: theme.muted, fontSize: 14, lineHeight: 1.55 }}>{spec.why}</p>
        <div style={{ display: "grid", gap: 12 }}>
          {spec.fields.map((f, index) => (
            <label
              key={f.id}
              style={{
                display: "grid",
                gap: 8,
                background: theme.wash,
                border: `1px solid ${theme.line}`,
                borderRadius: Math.max(8, theme.radius - 4),
                padding: "16px 16px 14px",
                color: theme.ink,
              }}
            >
              <span style={{ fontSize: 16, fontWeight: 700, color: theme.ink, lineHeight: 1.35 }}>
                <span style={{ color: theme.accent, marginRight: 8, fontSize: 12, letterSpacing: "0.12em" }}>
                  {String(index + 1).padStart(2, "0")}
                </span>
                {f.label}
                {f.required ? " *" : ""}
              </span>
              <FieldControl field={f} value={answers[f.id]} theme={theme} onChange={(v) => onChange(f.id, v)} />
              {f.hint ? <small style={{ color: theme.muted, fontSize: 13 }}>{f.hint}</small> : null}
            </label>
          ))}
        </div>
        {err ? (
          <p
            style={{
              color: theme.error,
              marginTop: 14,
              fontWeight: 600,
              background: theme.errorBg,
              padding: "10px 12px",
              borderRadius: 10,
            }}
          >
            {err}
          </p>
        ) : null}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20 }}>
          <button
            type="submit"
            disabled={busy}
            style={{
              background: theme.action,
              color: theme.actionText,
              border: 0,
              borderRadius: theme.pill,
              padding: "12px 22px",
              cursor: busy ? "wait" : "pointer",
              fontSize: 15,
              fontWeight: 700,
            }}
          >
            {busy ? "Guardando…" : "Guardar ficha"}
          </button>
        </div>
      </form>
    </div>
  );
}

export function SiteOnboardingGate({
  platform,
  email,
  getToken,
}: {
  platform: string;
  email?: string;
  getToken: () => Promise<string | null>;
}) {
  const spec = questionnaireOf(platform);
  const theme = themeOf(platform);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [answers, setAnswers] = useState<Answers>({});

  useEffect(() => {
    let alive = true;
    void (async () => {
      const token = await getToken();
      if (!token || !spec) return;
      try {
        const row = await loadOnboardingRest(token, platform);
        if (!alive) return;
        if (!row.completed) {
          setAnswers({
            organization: organizationHintFromEmail(email || ""),
            ...row.answers,
          });
          setOpen(true);
        }
      } catch {
        if (alive) setOpen(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [platform, email, getToken, spec]);

  const missing = useMemo(() => {
    if (!spec) return "";
    for (const f of spec.fields) {
      if (!f.required) continue;
      const v = answers[f.id];
      if (f.kind === "multi" && (!Array.isArray(v) || v.length === 0)) return f.label;
      if (f.kind === "number" && (v == null || Number(v) < 16)) return f.label;
      if (!v && v !== 0) return f.label;
    }
    return "";
  }, [answers, spec]);

  if (!open || !spec) return null;

  const submit = async () => {
    if (missing) {
      setErr(`Complete: ${missing}.`);
      return;
    }
    setBusy(true);
    setErr("");
    try {
      const token = await getToken();
      if (!token) throw new Error("La sesión expiró. Vuelva a entrar.");
      await saveOnboardingRest(token, platform, answers, email);
      setOpen(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "No se pudo guardar la ficha.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <OnboardingSheet
      spec={spec}
      theme={theme}
      answers={answers}
      err={err}
      busy={busy}
      onSubmit={() => void submit()}
      onChange={(id, value) => setAnswers((s) => ({ ...s, [id]: value }))}
    />
  );
}


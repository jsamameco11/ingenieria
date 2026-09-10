/**
 * Cargo Culqi de MemoriaCalc. La sk_ vive en el entorno del VPS, nunca en el bundle.
 */
import { createServer } from "node:http";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { handleRevitApi } from "./revit-sync.mjs";

const root = dirname(fileURLToPath(import.meta.url));
loadEnv(join(root, ".env"));
loadEnv("/etc/memorcalc-culqi.env");

const PORT = Number(process.env.PORT || 8788);
const SECRET = (process.env.CULQI_SECRET_KEY || "").trim();
const SUPABASE_URL = (process.env.SUPABASE_URL || "https://qfvgksstvdrxcugbdwkv.supabase.co").replace(/\/$/, "");
const SUPABASE_ANON = (process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_FOLIO_SUPABASE_ANON_KEY || "").trim();
const SUPABASE_SECRET = (process.env.SUPABASE_SECRET_KEY || "").trim();

const PLANS = {
  "mc-monthly": { title: "MemoriaCalc Pro mensual", soles: 20, days: 31 },
  "mc-quarterly": { title: "MemoriaCalc Pro trimestral", soles: 54, days: 93 },
  "mc-annual": { title: "MemoriaCalc Pro anual", soles: 192, days: 365 },
};
const NOTICE_FILES = ["/var/lib/memorcalc/notices.json", join(root, "data", "notices.json")];

const PDF_SOLES = 4;
const CONTROL_ID = String(process.env.CONTROL_ADMIN_EMAIL || "jrenzosamco@gmail.com")
  .trim()
  .toLowerCase();
const CONTROL_PASSWORD = String(process.env.CONTROL_ADMIN_PASSWORD || "").trim();
const PDF_PASS_FILES = ["/var/lib/memorcalc/pdf-passes.json", join(root, "data", "pdf-passes.json")];

function sameSecret(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function issueControlToken() {
  const exp = Date.now() + 12 * 3600 * 1000;
  const payload = Buffer.from(JSON.stringify({ sub: CONTROL_ID, exp })).toString("base64url");
  const sig = createHmac("sha256", `${CONTROL_PASSWORD}|mc-control`).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

function readControlToken(header) {
  const raw = String(header || "").replace(/^Bearer\s+/i, "").trim();
  const at = raw.lastIndexOf(".");
  if (at < 8) return null;
  const payload = raw.slice(0, at);
  const sig = raw.slice(at + 1);
  const expect = createHmac("sha256", `${CONTROL_PASSWORD}|mc-control`).update(payload).digest("base64url");
  if (!sameSecret(sig, expect)) return null;
  try {
    const o = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!o?.exp || Number(o.exp) < Date.now()) return null;
    return o;
  } catch {
    return null;
  }
}

function requireControl(req, res) {
  if (readControlToken(req.headers.authorization)) return true;
  send(req, res, 401, { message: "Sesión de control vencida. Vuelva a entrar." });
  return false;
}

const OWNER_EMAILS = new Set(
  String(process.env.OWNER_EMAILS || "jrenzosamco@gmail.com,miacademiapreu.pe@gmail.com")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean),
);
const LAUNCH_FILES = ["/var/lib/memorcalc/billing-launch.json", join(root, "data", "billing-launch.json")];
const PRINT_POLICY_FILES = ["/var/lib/memorcalc/print-policy.json", join(root, "data", "print-policy.json")];

function defaultLaunch() {
  return { live: false, liveAt: null, updatedAt: null, updatedBy: null, quotas: {} };
}

function clampQuota(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return 1;
  return Math.max(0, Math.min(6, Math.round(v)));
}

function asQuotas(raw) {
  const out = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [k, v] of Object.entries(raw)) out[String(k)] = clampQuota(v);
  return out;
}

function readLaunch() {
  for (const file of LAUNCH_FILES) {
    try {
      if (!existsSync(file)) continue;
      const o = JSON.parse(readFileSync(file, "utf8"));
      return {
        live: Boolean(o.live),
        liveAt: o.liveAt || null,
        updatedAt: o.updatedAt || null,
        updatedBy: o.updatedBy || null,
        quotas: asQuotas(o.quotas),
      };
    } catch {
      /* siguiente */
    }
  }
  return defaultLaunch();
}

function writeLaunch(info) {
  let last = null;
  for (const file of LAUNCH_FILES) {
    try {
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, JSON.stringify(info, null, 2));
      return info;
    } catch (e) {
      last = e;
    }
  }
  throw last || new Error("No se pudo guardar la venia de planes.");
}

function defaultPrintPolicy() {
  return { cleanPaid: false, soles: 0, updatedAt: null, updatedBy: null };
}

function asPrintSoles(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(999, Math.round(v * 100) / 100));
}

function readPrintPolicy() {
  for (const file of PRINT_POLICY_FILES) {
    try {
      if (!existsSync(file)) continue;
      const o = JSON.parse(readFileSync(file, "utf8"));
      return {
        cleanPaid: Boolean(o.cleanPaid),
        soles: asPrintSoles(o.soles),
        updatedAt: o.updatedAt || null,
        updatedBy: o.updatedBy || null,
      };
    } catch {
      /* siguiente */
    }
  }
  return defaultPrintPolicy();
}

function writePrintPolicy(info) {
  let last = null;
  for (const file of PRINT_POLICY_FILES) {
    try {
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, JSON.stringify(info, null, 2));
      return info;
    } catch (e) {
      last = e;
    }
  }
  throw last || new Error("No se pudo guardar la política de impresión.");
}
const ALLOW = new Set([
  "https://ingenieria.miacademiapreu.com",
  "https://control-ingenieria.miacademiapreu.com",
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5175",
  "http://localhost:5176",
  "http://localhost:5177",
  "http://127.0.0.1:5173",
]);

function loadEnv(file) {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#") || !t.includes("=")) continue;
    const at = t.indexOf("=");
    const k = t.slice(0, at).trim();
    const v = t.slice(at + 1).trim();
    if (!process.env[k]) process.env[k] = v;
  }
}

function cors(req, res) {
  const origin = String(req.headers.origin || "");
  if (ALLOW.has(origin)) res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
}

function send(req, res, status, body) {
  cors(req, res);
  const json = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(json),
  });
  res.end(json);
}

function readBody(req, maxBytes = 24_000) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (c) => {
      size += c.length;
      if (size > maxBytes) {
        reject(new Error("Cuerpo demasiado grande"));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error("JSON inválido"));
      }
    });
    req.on("error", reject);
  });
}

function expectedCents(planId, pdfCount) {
  if (planId === "mc-pdf") {
    const n = Math.round(Number(pdfCount) || 0);
    if (n < 1 || n > 80) return null;
    return n * PDF_SOLES * 100;
  }
  const p = PLANS[planId];
  return p ? p.soles * 100 : null;
}

async function culqiCharge({ tokenId, amountCents, email, description, metadata }) {
  if (!SECRET.startsWith("sk_")) throw new Error("Falta CULQI_SECRET_KEY en el servidor.");
  const res = await fetch("https://api.culqi.com/v2/charges", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SECRET}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: amountCents,
      currency_code: "PEN",
      email,
      source_id: tokenId,
      description,
      metadata: { product: "memorcalc", ...metadata },
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.user_message || data?.merchant_message || data?.message || "Culqi rechazó el cargo");
  }
  return data;
}

function readPdfPasses() {
  for (const file of PDF_PASS_FILES) {
    try {
      if (!existsSync(file)) continue;
      const o = JSON.parse(readFileSync(file, "utf8"));
      return o && typeof o === "object" ? o : {};
    } catch {
      /* siguiente */
    }
  }
  return {};
}

function writePdfPasses(map) {
  const now = Date.now();
  const clean = {};
  for (const [id, row] of Object.entries(map || {})) {
    if (!row || Number(row.expires) < now) continue;
    clean[id] = row;
  }
  let last = null;
  for (const file of PDF_PASS_FILES) {
    try {
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, JSON.stringify(clean, null, 2));
      return clean;
    } catch (e) {
      last = e;
    }
  }
  throw last || new Error("No se pudo guardar el pase PDF.");
}

function grantPdfPass(chargeId, userId, pdfCount) {
  const n = Math.max(1, Math.min(80, Math.round(Number(pdfCount) || 1)));
  const map = readPdfPasses();
  map[chargeId] = {
    userId,
    pdfCount: n,
    pagesUsed: 0,
    uses: 0,
    maxUses: Math.min(40, Math.max(n * 3, 3)),
    expires: Date.now() + 2 * 3600 * 1000,
  };
  writePdfPasses(map);
  return map[chargeId];
}

function takePdfPass(chargeId, userId, pageN = 1) {
  const map = readPdfPasses();
  const row = map[chargeId];
  if (!row) return { ok: false, message: `Pague la lectura de planos (S/ ${PDF_SOLES} por hoja) antes de generar.` };
  if (String(row.userId) !== String(userId)) {
    return { ok: false, message: "Ese cargo Culqi no corresponde a su sesión." };
  }
  if (Number(row.expires) < Date.now()) {
    delete map[chargeId];
    writePdfPasses(map);
    return { ok: false, message: "El pago PDF venció. Vuelva a pagar para leer los planos." };
  }
  const paid = Math.max(1, Number(row.pdfCount) || 1);
  const used = Math.max(0, Number(row.pagesUsed) || 0);
  if (used >= paid) {
    return { ok: false, message: "Este pago ya cubrió todas las láminas cobradas. Adjunte de nuevo y pague otra lectura." };
  }
  if (Number(row.uses) >= Number(row.maxUses)) {
    return { ok: false, message: "Este pago PDF ya se usó. Adjunte de nuevo y pague otra lectura." };
  }
  const want = Math.max(1, Math.min(40, Math.round(Number(pageN) || 1)));
  const take = Math.min(want, paid - used);
  row.pagesUsed = used + take;
  row.uses = Number(row.uses || 0) + 1;
  map[chargeId] = row;
  writePdfPasses(map);
  return { ok: true, remaining: paid - row.pagesUsed, allowedPages: take };
}

async function logPaymentRow({ userId, email, kind, amountSoles, pdfCount, voucher, meta }) {
  if (!SUPABASE_SECRET.startsWith("sb_secret_") && !SUPABASE_SECRET.startsWith("eyJ")) return;
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/memorcalc_payments`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_SECRET,
        Authorization: `Bearer ${SUPABASE_SECRET}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        user_id: userId,
        email,
        kind,
        amount: amountSoles,
        pdf_count: pdfCount || 0,
        voucher,
        status: "paid",
        meta: meta || {},
      }),
    });
  } catch {
    /* no bloquear el cargo */
  }
}

async function userFromJwt(jwt) {
  if (!jwt || !SUPABASE_ANON) return null;
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${jwt.replace(/^Bearer\s+/i, "")}` },
  });
  if (!res.ok) return null;
  return res.json();
}

async function extendCloudPlan({ userId, email, days, voucher }) {
  if (!SUPABASE_SECRET.startsWith("sb_secret_") && !SUPABASE_SECRET.startsWith("eyJ")) return null;
  const headers = {
    apikey: SUPABASE_SECRET,
    Authorization: `Bearer ${SUPABASE_SECRET}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  };
  let until = new Date(Date.now() + days * 86400000);
  try {
    const look = await fetch(
      `${SUPABASE_URL}/rest/v1/memorcalc_plans?user_id=eq.${encodeURIComponent(userId)}&select=paid_until`,
      { headers },
    );
    if (look.ok) {
      const rows = await look.json();
      const prev = rows?.[0]?.paid_until ? new Date(rows[0].paid_until) : null;
      if (prev && prev.getTime() > Date.now()) until = new Date(prev.getTime() + days * 86400000);
    }
  } catch {
    /* tabla aún no creada */
  }
  const iso = until.toISOString();
  const body = {
    user_id: userId,
    email,
    plan: "pro",
    paid_until: iso,
    last_voucher: voucher,
    updated_at: new Date().toISOString(),
  };
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/memorcalc_plans?on_conflict=user_id`, {
      method: "POST",
      headers: { ...headers, Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify(body),
    });
    if (!res.ok) return iso;
  } catch {
    /* ok */
  }
  return iso;
}

function textoModelo(data) {
  if (typeof data.output_text === "string" && data.output_text.trim()) return data.output_text;
  const parts = [];
  const output = Array.isArray(data.output) ? data.output : [];
  for (const item of output) {
    for (const c of item.content ?? []) {
      if (c.text) parts.push(c.text);
    }
  }
  if (data.choices?.[0]?.message?.content) return data.choices[0].message.content;
  return parts.join("\n");
}

function extraerJson(text) {
  const fence = text.match(/```json\s*([\s\S]*?)```/i);
  const raw = fence ? fence[1] : text;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("La lectura con IA no devolvió JSON de metrados.");
  return JSON.parse(raw.slice(start, end + 1));
}

let promptMod = null;
async function loadPrompt() {
  if (promptMod) return promptMod;
  promptMod = await import(new URL("./prompt.mjs", import.meta.url));
  return promptMod;
}

async function handleGrok(req, res) {
  const apiKey = (process.env.XAI_API_KEY || "").trim();
  const model = (process.env.XAI_MODEL || "grok-4.6").trim();
  if (req.method !== "POST") {
    send(req, res, 405, { error: "Use POST." });
    return;
  }
  if (!apiKey.startsWith("xai-")) {
    send(req, res, 503, { error: "Falta XAI_API_KEY en el servidor. No se puede leer planos." });
    return;
  }
  const auth = await userFromJwt(String(req.headers.authorization || ""));
  if (!auth?.id) {
    send(req, res, 401, { error: "Inicie sesión para leer planos con IA." });
    return;
  }
  const payload = await readBody(req, 48 * 1024 * 1024);
  const chargeId = String(payload.charge_id || payload.chargeId || "").trim();
  if (!chargeId.startsWith("chr_")) {
    send(req, res, 402, { error: `Pague S/ ${PDF_SOLES} por hoja con Culqi antes de leer los planos.` });
    return;
  }
  const rawPages = (payload.pages ?? [])
    .filter((p) => typeof p.dataUrl === "string" && p.dataUrl.startsWith("data:image"))
    .slice(0, 40);
  if (!rawPages.length) {
    send(req, res, 400, { error: "No hay láminas rasterizadas para la lectura con IA." });
    return;
  }
  const pass = takePdfPass(chargeId, auth.id, rawPages.length);
  if (!pass.ok) {
    send(req, res, 402, { error: pass.message });
    return;
  }
  const pages = rawPages.slice(0, Math.max(1, Number(pass.allowedPages) || rawPages.length));
  if (!pages.length) {
    send(req, res, 400, { error: "No hay láminas rasterizadas para la lectura con IA." });
    return;
  }
  const { SYSTEM_METRADOS, userPrompt } = await loadPrompt();
  const content = [
    {
      type: "input_text",
      text: userPrompt({
        obra: payload.obra ?? "",
        cliente: payload.cliente ?? "",
        lugar: payload.lugar ?? "",
        files: payload.files ?? pages.map((p) => p.file || "plano.pdf"),
        catalogo: payload.catalogo || "",
        catalogo_n: Number(payload.catalogo_n) || 0,
        especialidad: payload.especialidad || "",
        especialidad_label: payload.especialidad_label || "",
      }),
    },
  ];
  for (const p of pages) {
    content.push({ type: "input_image", image_url: p.dataUrl, detail: "high" });
  }
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 480000);
  try {
    const r = await fetch("https://api.x.ai/v1/responses", {
      method: "POST",
      signal: ac.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        store: false,
        prompt_cache_key: "memorcalc-leer-planos-v2",
        reasoning: { effort: "medium" },
        input: [
          { role: "system", content: SYSTEM_METRADOS },
          { role: "user", content },
        ],
      }),
    });
    const data = await r.json();
    if (!r.ok) {
      send(req, res, 502, { error: data?.error?.message || `La lectura con IA no respondió (${r.status}).` });
      return;
    }
    send(req, res, 200, extraerJson(textoModelo(data)));
  } catch (e) {
    const msg =
      e instanceof Error && e.name === "AbortError"
        ? "La lectura con IA tardó demasiado en leer los planos."
        : e instanceof Error
          ? e.message
          : "Fallo al consultar el agente de IA.";
    send(req, res, 502, { error: msg });
  } finally {
    clearTimeout(timer);
  }
}

const GOOGLE_CLIENT_IDS = new Set([
  "554728885093-5f9q8een65smi1bfg5hnchvl433v1c4t.apps.googleusercontent.com",
  "554728885093-2hovflq9cs9cdk30o1s5i3tk437pmg2l.apps.googleusercontent.com",
  "554728885093-jnn9ibrh5jl7f5nfth67cabipo4i4bd6.apps.googleusercontent.com",
  ...String(process.env.GOOGLE_CLIENT_IDS || "")
    .split(/[\s,]+/)
    .filter(Boolean),
]);
const GOOGLE_PROJECT_PREFIX = "554728885093-";

function googleClientAllowed(id) {
  const value = String(id || "").trim();
  if (!value) return false;
  if (GOOGLE_CLIENT_IDS.has(value)) return true;
  return value.startsWith(GOOGLE_PROJECT_PREFIX) && value.endsWith(".apps.googleusercontent.com");
}

function audienceList(...vals) {
  const out = [];
  for (const v of vals) {
    if (Array.isArray(v)) out.push(...v.map((x) => String(x || "").trim()).filter(Boolean));
    else if (v != null && String(v).trim()) out.push(String(v).trim());
  }
  return out;
}

async function verifyGoogleIdToken(idToken) {
  if (!idToken || String(idToken).split(".").length !== 3) {
    return { ok: false, message: "Google no entregó un identificador válido." };
  }
  const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`, {
    signal: AbortSignal.timeout(8000),
  });
  const claims = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, message: "Google no reconoció el acceso. Vuelva a entrar." };
  const iss = String(claims.iss || "");
  if (iss !== "https://accounts.google.com" && iss !== "accounts.google.com") {
    return { ok: false, message: "El token no proviene de Google." };
  }
  const exp = Number(claims.exp || 0);
  if (!Number.isFinite(exp) || exp * 1000 < Date.now() - 60_000) {
    return { ok: false, message: "La sesión de Google caducó. Vuelva a entrar." };
  }
  if (!claims.email || !claims.sub) {
    return { ok: false, message: "Google no compartió el correo de la cuenta." };
  }
  if (String(claims.email_verified) === "false") {
    return { ok: false, message: "Ese correo de Google no está verificado." };
  }
  // tokeninfo ya validó la firma. Aceptamos clientes del proyecto Folio;
  // si Google emite un aud nuevo del mismo proyecto, no bloqueamos el login.
  const audiences = audienceList(claims.aud, claims.azp);
  const known = audiences.some(googleClientAllowed);
  const folioFamily = audiences.some(
    (id) => id.startsWith(GOOGLE_PROJECT_PREFIX) && id.endsWith(".apps.googleusercontent.com"),
  );
  if (audiences.length && !known && !folioFamily) {
    console.warn("google-session: aud fuera de lista (se acepta tras tokeninfo)", audiences.join(","));
  }
  return { ok: true, claims };
}

async function mintViaFolioLicense(body, claims) {
  // Misma máquina: evita Cloudflare 1010 al salir por el dominio público.
  const endpoints = [
    "http://127.0.0.1:8787/api/auth/google",
    "https://folio-api.miacademiapreu.com/api/auth/google",
  ];
  const payload = JSON.stringify({
    email: String(claims.email || "").toLowerCase(),
    sub: String(claims.sub || ""),
    name: String(body.name || claims.name || claims.email || ""),
    id_token: String(body.id_token || ""),
    install_id: String(body.install_id || ""),
    app: String(body.app || "memorcalc"),
  });
  let lastMessage = "No se pudo emitir sesión auxiliar.";
  for (const endpoint of endpoints) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: payload,
        signal: AbortSignal.timeout(20000),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.session?.access_token || !data?.session?.refresh_token) {
        lastMessage = String(data.message || `Licencias ${res.status}`);
        continue;
      }
      // Folio a veces rota la clave tras emitir el JWT y lo invalida; comprobar vivo.
      const alive = await sessionStillValid(data.session.access_token);
      if (!alive) {
        lastMessage = "La sesión auxiliar nació inválida.";
        continue;
      }
      return {
        ok: true,
        session: data.session,
        userId: data.userId || data.session?.user?.id || null,
        email: data.email || claims.email,
        message: "",
      };
    } catch (err) {
      lastMessage = err instanceof Error ? err.message : lastMessage;
    }
  }
  return { ok: false, message: lastMessage, session: null, userId: null, email: null };
}

async function sessionStillValid(accessToken) {
  if (!accessToken) return false;
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        apikey: SUPABASE_ANON || SUPABASE_SECRET,
        Authorization: `Bearer ${accessToken}`,
      },
      signal: AbortSignal.timeout(10000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function adminFetch(path, init = {}) {
  if (!SUPABASE_SECRET) throw new Error("Falta SUPABASE_SECRET_KEY en el servidor.");
  const res = await fetch(`${SUPABASE_URL}${path}`, {
    ...init,
    headers: {
      apikey: SUPABASE_SECRET,
      Authorization: `Bearer ${SUPABASE_SECRET}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
    signal: AbortSignal.timeout(15000),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

async function adminRpc(name, args = {}) {
  return adminFetch(`/rest/v1/rpc/${name}`, {
    method: "POST",
    body: JSON.stringify(args),
  });
}

async function userRpc(jwt, name, args = {}) {
  const token = String(jwt || "").replace(/^Bearer\s+/i, "");
  if (!token || !SUPABASE_ANON) return { ok: false, status: 401, data: { message: "Se requiere sesión." } };
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
    signal: AbortSignal.timeout(20000),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

async function profileBundleFor(userId) {
  const uid = String(userId || "").trim();
  if (!uid) throw new Error("Falta user_id.");
  const [bundle, evidence, signals] = await Promise.all([
    adminRpc("get_user_360_bundle", { p_user: uid }),
    adminRpc("get_profile_evidence", { p_user: uid, p_limit: 80 }),
    tableRows(`/rest/v1/extraction_signals?user_id=eq.${encodeURIComponent(uid)}&select=id,evidence_id,raw_weight,decayed_weight,validated,rejection_reason,created_at&order=created_at.desc&limit=80`),
  ]);
  return {
    ok: true,
    profile: bundle.data,
    evidence: evidence.data,
    signals,
  };
}

async function tableRows(path) {
  try {
    const { ok, data } = await adminFetch(path);
    return ok && Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function byKey(rows, key) {
  const m = new Map();
  for (const row of rows) {
    const id = String(row[key] || "");
    if (id) m.set(id, row);
  }
  return m;
}

function rubrosOf(profile, insight) {
  const fromProfile = Array.isArray(profile.inferred_rubros) ? profile.inferred_rubros.map(String) : [];
  const raw = insight?.rubros;
  const fromInsight = Array.isArray(raw)
    ? raw.map((x) => (typeof x === "string" ? x : x?.label || x?.id || "")).filter(Boolean)
    : raw && typeof raw === "object"
      ? Object.keys(raw)
      : [];
  return [...new Set([...fromProfile, ...fromInsight])].filter(Boolean);
}

function tastesOf(identity) {
  const rows = identity?.user_tastes || identity?.tastes || [];
  return (Array.isArray(rows) ? rows : []).map((t) => ({
    id: t.id || t.taste_id || "",
    label: t.label || t.taste_id || t.id || "Gusto",
    family: t.family || t.family_id || "",
    score: Number(t.score || 0),
  }));
}

function platformOfApp(app, os) {
  const id = String(app || "").toLowerCase();
  const o = String(os || "").toLowerCase();
  if (id === "memorcalc" || id === "ingenieria" || id === "memoriacalc") return "ingenieria";
  if (id === "folio-android" || id.includes("android") || o.includes("android")) return "android";
  return "folio";
}

function emptyBuckets() {
  return {
    folio: { id: "folio", label: "Folio PC", count: 0, hosts: [], lastSeen: "", present: false },
    android: { id: "android", label: "Folio Android", count: 0, hosts: [], lastSeen: "", present: false },
    ingenieria: { id: "ingenieria", label: "Ingeniería", count: 0, hosts: [], lastSeen: "", present: false },
  };
}

function ageBandFromAge(age) {
  const n = Number(age);
  if (!n) return "";
  if (n < 25) return "18-24";
  if (n < 35) return "25-34";
  if (n < 45) return "35-44";
  if (n < 55) return "45-54";
  if (n < 65) return "55-64";
  return "65+";
}

function topKeys(map, n = 6) {
  return Object.entries(map || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([k]) => k);
}

function mergeCensus({
  profilesMc,
  plans,
  locks,
  listings,
  budgets,
  folioProfiles,
  installs,
  authUsers,
  insights,
  identities,
  threads,
  payments,
  events,
  masterUsers,
  masterProfiles,
  userPlatforms,
}) {
  const ids = new Set();
  for (const row of profilesMc) if (row.user_id) ids.add(String(row.user_id));
  for (const row of plans) if (row.user_id) ids.add(String(row.user_id));
  for (const row of locks) if (row.user_id) ids.add(String(row.user_id));
  for (const row of folioProfiles) if (row.id) ids.add(String(row.id));
  for (const row of masterUsers || []) if (row.id) ids.add(String(row.id));
  for (const row of masterProfiles || []) if (row.user_id) ids.add(String(row.user_id));
  for (const row of installs) if (row.user_id) ids.add(String(row.user_id));
  for (const row of authUsers) if (row.id) ids.add(String(row.id));
  const mc = byKey(profilesMc, "user_id");
  const pl = byKey(plans, "user_id");
  const lk = byKey(locks, "user_id");
  const fp = byKey(folioProfiles, "id");
  const mu = byKey(masterUsers || [], "id");
  const mp = byKey(masterProfiles || [], "user_id");
  const ins = byKey(insights, "user_id");
  const idn = byKey(identities, "user_id");
  const auth = byKey(authUsers, "id");
  const seen = new Map();
  const installN = new Map();
  for (const row of installs) {
    const id = String(row.user_id || "");
    if (!id) continue;
    installN.set(id, (installN.get(id) || 0) + 1);
    const prev = seen.get(id);
    const t = row.last_seen_at ? new Date(row.last_seen_at).getTime() : 0;
    const pt = prev?.last_seen_at ? new Date(prev.last_seen_at).getTime() : 0;
    if (!prev || t > pt) seen.set(id, row);
  }
  const listN = new Map();
  const adN = new Map();
  for (const row of listings) {
    const id = String(row.user_id || "");
    if (!id) continue;
    if (row.kind === "ad") adN.set(id, (adN.get(id) || 0) + 1);
    else listN.set(id, (listN.get(id) || 0) + 1);
  }
  const budN = new Map();
  for (const row of budgets) {
    const id = String(row.owner_id || "");
    if (id) budN.set(id, (budN.get(id) || 0) + 1);
  }
  const thrN = new Map();
  for (const row of threads || []) {
    for (const key of ["buyer_id", "seller_id"]) {
      const id = String(row[key] || "");
      if (id) thrN.set(id, (thrN.get(id) || 0) + 1);
    }
  }
  const payN = new Map();
  for (const row of payments || []) {
    const id = String(row.user_id || "");
    if (id) payN.set(id, (payN.get(id) || 0) + 1);
  }
  const masterPlats = new Map();
  for (const row of userPlatforms || []) {
    const id = String(row.user_id || "");
    if (!id || row.is_active === false) continue;
    const raw = String(row.platforms?.platform_code || row.platform_code || "").toUpperCase();
    const code = raw === "INGENIERIA" ? "ingenieria" : raw === "FOLIO_PDF" ? "folio" : raw.toLowerCase();
    if (!code) continue;
    const set = masterPlats.get(id) || new Set();
    set.add(code);
    masterPlats.set(id, set);
  }
  const activity = new Map();
  for (const row of events || []) {
    const id = String(row.user_id || "");
    if (!id) continue;
    const a = activity.get(id) || { clicks: 0, seconds: 0, labels: {}, modules: {}, last: null };
    const type = String(row.event_type || "");
    if (type === "click") {
      a.clicks += 1;
      const lab = String(row.meta?.label || row.module_slug || "clic").replace(/\s+/g, " ").trim().slice(0, 60);
      if (lab) a.labels[lab] = (a.labels[lab] || 0) + 1;
    }
    if (type === "heartbeat" || type === "dwell") {
      a.seconds += Number(row.meta?.sec || 30) || 30;
    }
    const slug = String(row.module_slug || "");
    if (slug && slug !== "home") a.modules[slug] = (a.modules[slug] || 0) + 1;
    if (!a.last || String(row.created_at || "") > String(a.last)) a.last = row.created_at || a.last;
    activity.set(id, a);
  }
  const byUserInstalls = new Map();
  for (const row of installs) {
    const id = String(row.user_id || "");
    if (!id) continue;
    const list = byUserInstalls.get(id) || [];
    list.push(row);
    byUserInstalls.set(id, list);
  }
  return [...ids].map((user_id) => {
    const p = mc.get(user_id) || {};
    const plan = pl.get(user_id) || {};
    const lock = lk.get(user_id) || {};
    const folio = fp.get(user_id) || {};
    const masterU = mu.get(user_id) || {};
    const masterP = mp.get(user_id) || {};
    const inst = seen.get(user_id) || {};
    const au = auth.get(user_id) || {};
    const insight = ins.get(user_id) || {};
    const identity = idn.get(user_id) || {};
    const until = plan.paid_until || folio.expiration_at || null;
    const status = String(folio.status || "active");
    const wantsPro = plan.plan === "pro" || folio.plan === "pro" || folio.plan === "business";
    const live = status !== "revoked" && wantsPro && (!until || new Date(until).getTime() > Date.now());
    const sku = String(plan.last_voucher || folio.plan_id || (live ? "mc-monthly" : "free"));
    const rubros = rubrosOf(p, insight);
    const tastes = tastesOf(identity);
    const occupation = p.profession_label || p.inferred_role || insight.role_guess || identity.occupation || "";
    const buckets = emptyBuckets();
    const userInstalls = byUserInstalls.get(user_id) || [];
    for (const item of userInstalls) {
      const key = platformOfApp(item.app, item.os);
      const bucket = buckets[key] || buckets.folio;
      bucket.present = true;
      bucket.count += 1;
      const host = String(item.hostname || item.install_id || "").trim();
      if (host && !bucket.hosts.includes(host)) bucket.hosts.push(host);
      if (!bucket.lastSeen || String(item.last_seen_at || "") > String(bucket.lastSeen)) {
        bucket.lastSeen = item.last_seen_at || "";
      }
    }
    const usedIngenieria = Boolean(p.email || p.full_name || p.last_module || budN.get(user_id) || lock.device_id || activity.get(user_id) || (masterPlats.get(user_id) || new Set()).has("ingenieria"));
    if (usedIngenieria) {
      buckets.ingenieria.present = true;
      if (!buckets.ingenieria.count) buckets.ingenieria.count = 1;
      if (lock.device_label && !buckets.ingenieria.hosts.includes(lock.device_label)) {
        buckets.ingenieria.hosts.push(lock.device_label);
      }
      if (!buckets.ingenieria.lastSeen || String(lock.updated_at || "") > String(buckets.ingenieria.lastSeen)) {
        buckets.ingenieria.lastSeen = lock.updated_at || buckets.ingenieria.lastSeen;
      }
    }
    for (const code of masterPlats.get(user_id) || []) {
      if (code === "ingenieria") {
        buckets.ingenieria.present = true;
        if (!buckets.ingenieria.count) buckets.ingenieria.count = 1;
      }
      if (code === "folio") {
        buckets.folio.present = true;
        if (!buckets.folio.count) buckets.folio.count = 1;
      }
    }
    const platforms = Object.values(buckets).filter((b) => b.present).map((b) => b.id);
    if (!platforms.length && (folio.email || folio.plan || au.email)) {
      buckets.folio.present = true;
      platforms.push("folio");
    }
    const coverage = occupation || rubros.length || tastes.length || p.last_module ? 80 : identity.id ? 55 : 0;
    return {
      user_id,
      public_user_code: masterU.public_user_code || "",
      email: p.email || plan.email || folio.email || inst.email || au.email || "",
      full_name: masterP.display_name || [masterP.first_name, masterP.last_name].filter(Boolean).join(" ") || p.full_name || folio.full_name || "",
      profession_label: occupation,
      organization: p.organization || "",
      district: p.district || folio.city || inst.city || "",
      department: p.department || folio.department || inst.department || "",
      country: p.country || folio.country || inst.country || "Perú",
      city: p.city || folio.city || inst.city || p.district || "",
      workplace_role: p.workplace_role || folio.role || insight.role_guess || "",
      plan: live ? "pro" : "free",
      paying: Boolean(live),
      paid_until: until,
      sku: sku.startsWith("mc-") || sku.startsWith("pro") ? sku : live ? "mc-monthly" : "free",
      status,
      device_limit: Number(folio.device_limit || 1) || 1,
      phone: masterP.phone || p.phone || folio.phone || "",
      device_id: lock.device_id || "",
      device_label: lock.device_label || inst.hostname || inst.install_id || "",
      device_updated_at: lock.updated_at || null,
      listings: listN.get(user_id) || 0,
      ads: adN.get(user_id) || 0,
      budgets: budN.get(user_id) || 0,
      threads: thrN.get(user_id) || 0,
      payments: payN.get(user_id) || 0,
      profile_at: p.created_at || folio.created_at || au.created_at || null,
      last_seen_at: inst.last_seen_at || lock.updated_at || masterU.last_active_at || p.updated_at || folio.updated_at || au.last_sign_in_at || null,
      last_sign_in_at: au.last_sign_in_at || inst.last_seen_at || null,
      folio_plan: folio.plan || folio.plan_id || "",
      folio_status: status,
      platforms,
      platformBreakdown: buckets,
      platformCount: platforms.length,
      google_email: inst.google_email || inst.email || au.email || "",
      google_sub: inst.google_sub || p.google_sub || "",
      last_module: p.last_module || topKeys(activity.get(user_id)?.modules, 1)[0] || "",
      rubros,
      tastes,
      tasteCount: tastes.length,
      coverage,
      installCount: userInstalls.length || (lock.device_id ? 1 : 0),
      documentType: identity.document_type || identity.documentType || "",
      summary: insight.summary || "",
      career_path: identity.career_path_label || "",
      age_band: identity.age_band || ageBandFromAge(p.age),
      ubigeo: identity.ubigeo || p.ubigeo || "",
      craft_family: p.craft_family || "",
      age: p.age == null || p.age === "" ? null : Number(p.age),
      ad_segment: p.ad_segment || "",
      dwell_seconds: activity.get(user_id)?.seconds || 0,
      click_count: activity.get(user_id)?.clicks || 0,
      click_top: topKeys(activity.get(user_id)?.labels, 6),
      modules_used: topKeys(activity.get(user_id)?.modules, 8),
    };
  }).sort((a, b) => String(a.email || a.full_name).localeCompare(String(b.email || b.full_name), "es"));
}

async function listAuthUsersAll() {
  const users = [];
  for (let page = 1; page <= 10; page++) {
    try {
      const { ok, data } = await adminFetch(`/auth/v1/admin/users?page=${page}&per_page=200`);
      const rows = ok && Array.isArray(data?.users) ? data.users : [];
      users.push(...rows);
      if (rows.length < 200) break;
    } catch {
      break;
    }
  }
  return users;
}

function mapInstall(row) {
  const app = String(row.app || (row.version === "MemoriaCalc" ? "memorcalc" : "folio-pdf"));
  return {
    user_id: String(row.user_id || ""),
    email: String(row.email || row.google_email || ""),
    google_email: String(row.google_email || row.email || ""),
    install_id: String(row.install_id || row.id || ""),
    hostname: String(row.hostname || row.device_label || ""),
    os: String(row.os || ""),
    ip: String(row.ip || ""),
    city: String(row.city || ""),
    department: String(row.department || ""),
    province: String(row.province || ""),
    district: String(row.district || ""),
    country: String(row.country || ""),
    last_seen_at: row.last_seen_at || row.updated_at || null,
    first_seen_at: row.first_seen_at || row.created_at || null,
    license_tier: String(row.license_tier || row.plan || ""),
    version: String(row.version || ""),
    app,
    platform: platformOfApp(app, row.os),
    locale: String(row.locale || ""),
    location_source: String(row.location_source || ""),
    machine_key: String(row.machine_key || "").slice(0, 16),
  };
}

function mapIdentity(row, user) {
  const tastes = tastesOf(row);
  return {
    user_id: String(row.user_id || user?.user_id || ""),
    email: user?.email || "",
    occupation: row.occupation || row.career_path_label || user?.profession_label || "",
    city: row.city || user?.city || "",
    coverage: Number(row.coverage || user?.coverage || 0),
    age_band: row.age_band || user?.age_band || "",
    degree_id: row.degree_id || "",
    specialty_label: row.specialty_label || row.specialty_id || "",
    role: row.role_label || row.role || user?.workplace_role || "",
    document_type: row.document_type || row.documentType || "",
    department: row.department || user?.department || "",
    province: row.province || "",
    district: row.district || "",
    country: row.country || user?.country || "",
    ubigeo: row.ubigeo || user?.ubigeo || "",
    settlement: row.settlement || "",
    career_path: row.career_path_label || user?.career_path || "",
    closeness: Number(row.closeness || 0),
    tastes,
    professions: Array.isArray(row.user_profession_scores)
      ? row.user_profession_scores.map((p) => ({
          label: p.label || p.profession_id || p.id,
          closeness: Number(p.closeness || p.score || 0),
        }))
      : [],
    rubros: user?.rubros || [],
    last_module: user?.last_module || "",
  };
}

function mapThread(row) {
  return {
    id: String(row.id || ""),
    listing_id: String(row.listing_id || ""),
    listing_name: String(row.listing_name || ""),
    listing_price: String(row.listing_price || ""),
    listing_kind: String(row.listing_kind || "product"),
    seller_id: String(row.seller_id || ""),
    seller_name: String(row.seller_name || ""),
    buyer_id: String(row.buyer_id || ""),
    buyer_name: String(row.buyer_name || ""),
    buyer_email: String(row.buyer_email || ""),
    last_body: String(row.last_body || ""),
    last_at: row.last_at || row.created_at || null,
    buyer_unread: Number(row.buyer_unread || 0),
    seller_unread: Number(row.seller_unread || 0),
  };
}

function mapAccount(row) {
  return {
    install_id: String(row.install_id || ""),
    user_id: String(row.user_id || ""),
    email: String(row.email || ""),
    google_sub: String(row.google_sub || ""),
    first_seen_at: row.first_seen_at || null,
    last_seen_at: row.last_seen_at || null,
  };
}

function readNotices() {
  for (const file of NOTICE_FILES) {
    try {
      if (!existsSync(file)) continue;
      const data = JSON.parse(readFileSync(file, "utf8"));
      const items = Array.isArray(data) ? data : data.items;
      if (Array.isArray(items)) return items;
    } catch {
      /* siguiente */
    }
  }
  return [];
}

function writeNotices(items) {
  const payload = JSON.stringify({ items }, null, 2);
  for (const file of NOTICE_FILES) {
    try {
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, payload);
      return items;
    } catch {
      /* siguiente */
    }
  }
  throw new Error("No se pudieron guardar los avisos.");
}

async function controlSnapshot() {
  if (!SUPABASE_SECRET) throw new Error("Falta SUPABASE_SECRET_KEY en el servidor. El panel no puede leer Supabase.");
  const [
    profilesMc,
    plans,
    locks,
    listingsMini,
    budgets,
    folioProfiles,
    installs,
    listings,
    insights,
    identities,
    authUsers,
    accounts,
    threads,
    payments,
    events,
    masterUsers,
    masterProfiles,
    userPlatforms,
  ] = await Promise.all([
    tableRows("/rest/v1/memorcalc_profiles?select=*&limit=3000"),
    tableRows("/rest/v1/memorcalc_plans?select=*&limit=3000"),
    tableRows("/rest/v1/memorcalc_device_lock?select=*&limit=3000"),
    tableRows("/rest/v1/listings?select=id,user_id,kind,paid_soles&limit=5000"),
    tableRows("/rest/v1/memorcalc_budgets?select=id,owner_id&limit=5000"),
    tableRows("/rest/v1/profiles?select=id,email,full_name,plan,plan_id,status,city,role,phone,device_limit,expiration_at,department,country,updated_at,created_at&limit=3000"),
    tableRows("/rest/v1/installs?select=*&limit=5000"),
    tableRows("/rest/v1/listings?select=*&order=created_at.desc&limit=800"),
    tableRows("/rest/v1/memorcalc_insights?select=*&limit=3000"),
    tableRows("/rest/v1/user_identities?select=*,user_tastes(*),user_profession_scores(*)&order=updated_at.desc&limit=800"),
    listAuthUsersAll(),
    tableRows("/rest/v1/install_accounts?select=*&limit=5000"),
    tableRows("/rest/v1/listing_threads?select=*&order=last_at.desc&limit=800"),
    tableRows("/rest/v1/memorcalc_payments?select=id,user_id,email,kind,amount,status,created_at&limit=3000"),
    tableRows("/rest/v1/memorcalc_events?select=user_id,event_type,module_slug,specialty,meta,created_at&order=created_at.desc&limit=8000"),
    tableRows("/rest/v1/users?select=id,public_user_code,account_status,is_active,onboarding_completed,last_login_at,last_active_at,created_at,updated_at&limit=5000"),
    tableRows("/rest/v1/user_profiles?select=user_id,display_name,first_name,last_name,phone,profile_photo_url&limit=5000"),
    tableRows("/rest/v1/user_platforms?select=user_id,is_active,last_login_at,platforms(platform_code)&limit=8000"),
  ]);
  const users = mergeCensus({
    profilesMc,
    plans,
    locks,
    listings: listingsMini,
    budgets,
    folioProfiles,
    installs,
    authUsers,
    insights,
    identities,
    threads,
    payments,
    events,
    masterUsers,
    masterProfiles,
    userPlatforms,
  });
  const countries = {};
  for (const u of users) {
    const name = u.country || "Perú";
    countries[name] = (countries[name] || 0) + 1;
  }
  const byUser = byKey(users, "user_id");
  const tables = [
    { family: "cuenta", name: "auth.users", count: authUsers.length },
    { family: "cuenta", name: "users (maestra)", count: masterUsers.length },
    { family: "cuenta", name: "user_profiles", count: masterProfiles.length },
    { family: "cuenta", name: "user_platforms", count: userPlatforms.length },
    { family: "cuenta", name: "profiles (Folio legado)", count: folioProfiles.length },
    { family: "cuenta", name: "memorcalc_profiles", count: profilesMc.length },
    { family: "cuenta", name: "memorcalc_plans", count: plans.length },
    { family: "parque", name: "installs", count: installs.length },
    { family: "parque", name: "install_accounts", count: accounts.length },
    { family: "parque", name: "memorcalc_device_lock", count: locks.length },
    { family: "identidad", name: "user_identities", count: identities.length },
    { family: "identidad", name: "user_tastes", count: identities.reduce((n, r) => n + (Array.isArray(r.user_tastes) ? r.user_tastes.length : 0), 0) },
    { family: "comercio", name: "listings", count: listings.length },
    { family: "comercio", name: "listing_threads", count: threads.length },
    { family: "ingenieria", name: "memorcalc_budgets", count: budgets.length },
    { family: "ingenieria", name: "memorcalc_payments", count: payments.length },
    { family: "ingenieria", name: "memorcalc_insights", count: insights.length },
    { family: "ingenieria", name: "memorcalc_events", count: events.length },
    { family: "ingenieria", name: "memorcalc_quota_uses", count: events.filter((e) => e.event_type === "quota_use").length },
  ];
  return {
    connected: true,
    source: "supabase",
    supabase: "ok",
    users,
    listings,
    installs: [
      ...installs.map(mapInstall),
      ...locks
        .filter((row) => row.device_id)
        .map((row) => ({
          user_id: String(row.user_id || ""),
          email: String(byUser.get(String(row.user_id || ""))?.email || ""),
          google_email: String(byUser.get(String(row.user_id || ""))?.email || ""),
          install_id: String(row.device_id || ""),
          hostname: String(row.device_label || "PC anclado"),
          os: "",
          ip: "",
          city: byUser.get(String(row.user_id || ""))?.city || "",
          department: byUser.get(String(row.user_id || ""))?.department || "",
          province: "",
          district: "",
          country: byUser.get(String(row.user_id || ""))?.country || "",
          last_seen_at: row.updated_at || null,
          first_seen_at: row.updated_at || null,
          license_tier: byUser.get(String(row.user_id || ""))?.plan || "",
          version: "MemoriaCalc",
          app: "memorcalc",
          platform: "ingenieria",
          locale: "",
          location_source: "ancla",
          machine_key: "",
        })),
    ],
    identities: identities.length
      ? identities.map((row) => mapIdentity(row, byUser.get(String(row.user_id || ""))))
      : users.filter((u) => u.coverage > 0).map((u) => mapIdentity({}, u)),
    accounts: accounts.map(mapAccount),
    threads: threads.map(mapThread),
    tables,
    notices: readNotices(),
    countries,
    message: `Base maestra de usuarios · ${masterUsers.length} en public.users · ${authUsers.length} Auth · ${installs.length} equipos`,
  };
}

async function controlSaveUser(userId, patch) {
  const email = String(patch.email || "").trim().toLowerCase();
  const plan = patch.plan === "pro" || patch.plan === "business" ? "pro" : "free";
  const sku = String(patch.plan_id || patch.sku || (plan === "pro" ? "mc-monthly" : "free"));
  const status = String(patch.status || "active");
  let until = patch.expiration_at ? new Date(patch.expiration_at).toISOString() : null;
  if (plan === "free" || status === "revoked") until = null;
  const phone = String(patch.phone || "").slice(0, 40);
  const deviceLimit = Math.max(1, Math.round(Number(patch.device_limit) || 1));

  const planBody = {
    user_id: userId,
    email,
    plan: status === "revoked" ? "free" : plan,
    paid_until: until,
    last_voucher: sku,
    updated_at: new Date().toISOString(),
  };
  const saved = await adminFetch("/rest/v1/memorcalc_plans?on_conflict=user_id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify(planBody),
  });
  if (!saved.ok) throw new Error(saved.data?.message || "No se pudo guardar el plan.");

  if (phone) {
    await adminFetch(`/rest/v1/memorcalc_profiles?user_id=eq.${encodeURIComponent(userId)}`, {
      method: "PATCH",
      body: JSON.stringify({ phone, updated_at: new Date().toISOString() }),
    });
    await adminFetch("/rest/v1/user_profiles?on_conflict=user_id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({ user_id: userId, phone }),
    });
  }
  await adminFetch(`/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}`, {
    method: "PATCH",
    body: JSON.stringify({
      plan: status === "revoked" ? "free" : plan,
      plan_id: sku,
      status,
      device_limit: deviceLimit,
      expiration_at: until,
      phone,
    }),
  });
  if (status === "revoked") {
    const prev = await tableRows(`/rest/v1/memorcalc_device_lock?user_id=eq.${encodeURIComponent(userId)}&select=session_epoch`);
    const epoch = Number(prev[0]?.session_epoch || 0) + 1;
    await adminFetch("/rest/v1/memorcalc_device_lock?on_conflict=user_id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify({
        user_id: userId,
        device_id: "",
        session_epoch: epoch,
        device_label: "",
        updated_at: new Date().toISOString(),
      }),
    });
  }
  return { ok: true, plan: planBody.plan, paid_until: until, status, sku };
}

async function controlInvite(email) {
  const { ok, data, status } = await adminFetch("/auth/v1/invite", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
  if (!ok) throw new Error(data?.message || data?.msg || `No se pudo invitar (${status}).`);
  return data;
}

async function findAuthUserId(email) {
  const mail = email.toLowerCase();
  for (const path of [
    `/auth/v1/admin/users?email=${encodeURIComponent(mail)}`,
    `/auth/v1/admin/users?filter=${encodeURIComponent(mail)}`,
  ]) {
    const { data } = await adminFetch(path);
    const rows = data.users || (data.user ? [data.user] : []);
    const hit = rows.find((row) => String(row.email || "").toLowerCase() === mail);
    if (hit?.id) return hit.id;
  }
  for (let page = 1; page <= 8; page++) {
    const { data } = await adminFetch(`/auth/v1/admin/users?page=${page}&per_page=200`);
    const rows = data.users || [];
    const hit = rows.find((row) => String(row.email || "").toLowerCase() === mail);
    if (hit?.id) return hit.id;
    if (rows.length < 200) break;
  }
  return null;
}

async function signInWithPassword(email, password, anon) {
  const signed = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: anon,
      Authorization: `Bearer ${anon}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
    signal: AbortSignal.timeout(15000),
  });
  const session = await signed.json().catch(() => ({}));
  return { ok: signed.ok && session?.access_token && session?.refresh_token, session };
}

async function signInWithMagicLink(email, anon) {
  const link = await adminFetch("/auth/v1/admin/generate_link", {
    method: "POST",
    body: JSON.stringify({ type: "magiclink", email }),
  });
  const hashed = String(link.data?.properties?.hashed_token || link.data?.hashed_token || "").trim();
  const otp = String(link.data?.properties?.email_otp || link.data?.email_otp || "").trim();
  if (!hashed && !otp) return { ok: false, session: {} };
  // GoTrue reciente: con token_hash NO enviar email (si no → validation_failed).
  const attempts = [
    hashed ? { type: "magiclink", token_hash: hashed } : null,
    hashed ? { type: "email", token_hash: hashed } : null,
    otp ? { type: "magiclink", email, token: otp } : null,
    otp ? { type: "email", email, token: otp } : null,
  ].filter(Boolean);
  for (const body of attempts) {
    const verify = await fetch(`${SUPABASE_URL}/auth/v1/verify`, {
      method: "POST",
      headers: {
        apikey: anon,
        Authorization: `Bearer ${anon}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
    const session = await verify.json().catch(() => ({}));
    if (verify.ok && session?.access_token && session?.refresh_token) {
      return { ok: true, session };
    }
  }
  return { ok: false, session: {} };
}

async function mintGoogleSession(body) {
  const verified = await verifyGoogleIdToken(String(body.id_token || ""));
  if (!verified.ok) return { status: 401, payload: { message: verified.message } };
  const claims = verified.claims;
  const email = String(claims.email).trim().toLowerCase();
  const name = String(body.name || claims.name || email);
  const sub = String(claims.sub);
  const password = `${crypto.randomUUID().replace(/-/g, "")}Aa1!`;
  const anon = SUPABASE_ANON || SUPABASE_SECRET;

  let userId = await findAuthUserId(email);
  if (!userId) {
    const created = await adminFetch("/auth/v1/admin/users", {
      method: "POST",
      body: JSON.stringify({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: name, name, avatar_url: claims.picture || "", google_sub: sub },
        app_metadata: { provider: "google", providers: ["google"], google_sub: sub, role: "customer", plan: "free" },
      }),
    });
    userId = created.data?.id || created.data?.user?.id || null;
    if (!userId) userId = await findAuthUserId(email);
  }
  if (userId) {
    await adminFetch(`/auth/v1/admin/users/${userId}`, {
      method: "PUT",
      body: JSON.stringify({
        password,
        email_confirm: true,
        user_metadata: { full_name: name, name, avatar_url: claims.picture || "", google_sub: sub },
      }),
    });
  }
  if (!userId) return { status: 500, payload: { message: "No se pudo crear la cuenta." } };

  await adminFetch("/rest/v1/profiles", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({
      id: userId,
      email,
      role: "customer",
      plan: "free",
      plan_id: "free",
      status: "active",
      device_limit: 1,
    }),
  }).catch(() => undefined);

  // Password primero (estable). Magic link como respaldo.
  // NUNCA rotar la contraseña después: invalida el session_id del JWT.
  let minted = await signInWithPassword(email, password, anon);
  if (!minted.ok) minted = await signInWithMagicLink(email, anon);
  let session = minted.session || {};
  let outUserId = userId;
  let outEmail = email;

  if (minted.ok && session?.access_token) {
    const alive = await sessionStillValid(session.access_token);
    if (!alive) minted = { ok: false, session: {} };
  }

  if (!minted.ok || !session?.access_token || !session?.refresh_token) {
    // Reintentar password local (no depender de sesión Folio que rota clave).
    minted = await signInWithPassword(email, password, anon);
    session = minted.session || {};
    if (!minted.ok || !session?.access_token || !session?.refresh_token) {
      const viaLicense = await mintViaFolioLicense(body, claims);
      if (viaLicense.ok) {
        session = viaLicense.session;
        outUserId = viaLicense.userId || userId;
        outEmail = viaLicense.email || email;
        minted = { ok: true, session };
      } else {
        console.error("google-session: no se pudo emitir JWT", {
          email,
          local: session?.error_description || session?.msg || session?.error || "",
          license: viaLicense.message,
        });
        return {
          status: 400,
          payload: {
            message:
              viaLicense.message ||
              "Google aceptó la cuenta, pero no se pudo abrir la sesión. Vuelva a intentar.",
          },
        };
      }
    }
  }

  if (body.install_id) {
    await adminFetch("/rest/v1/installs", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({
        install_id: String(body.install_id),
        user_id: outUserId,
        email: outEmail,
        last_seen_at: new Date().toISOString(),
        app: String(body.app || "memorcalc"),
      }),
    }).catch(() => undefined);
  }

  const alive = await sessionStillValid(session.access_token);
  if (!alive) {
    console.error("google-session: JWT emitido pero /auth/v1/user falló", { email });
    return {
      status: 400,
      payload: { message: "Google aceptó la cuenta, pero no se pudo abrir la sesión. Vuelva a intentar." },
    };
  }

  return {
    status: 200,
    payload: {
      ok: true,
      session,
      user: session.user || { id: outUserId, email: outEmail },
      userId: outUserId,
      email: outEmail,
    },
  };
}

async function handleGoogleSession(req, res) {
  if (req.method !== "POST") {
    send(req, res, 405, { message: "Método no permitido" });
    return;
  }
  const body = await readBody(req, 64_000);

  if (SUPABASE_SECRET) {
    try {
      const minted = await mintGoogleSession(body);
      send(req, res, minted.status, minted.payload);
      return;
    } catch (e) {
      /* cae al Edge Function Folio */
      console.error("google-session local:", e instanceof Error ? e.message : e);
    }
  }

  const edge = `${SUPABASE_URL}/functions/v1/google-session`;
  const upstream = await fetch(edge, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON || "anon",
      Authorization: `Bearer ${SUPABASE_ANON || "anon"}`,
    },
    body: JSON.stringify(body),
  });
  const data = await upstream.json().catch(() => ({}));
  send(req, res, upstream.status, data);
}

const used = new Set();

function freshToken(id) {
  if (!id || used.has(id)) return false;
  used.add(id);
  if (used.size > 4000) used.delete(used.values().next().value);
  return true;
}

const server = createServer(async (req, res) => {
  cors(req, res);
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }
  const url = new URL(req.url || "/", "http://127.0.0.1");
  try {
    if (req.method === "GET" && (url.pathname === "/health" || url.pathname === "/api/health" || url.pathname === "/api/charges/health")) {
      send(req, res, 200, {
        ok: true,
        culqi: SECRET.startsWith("sk_"),
        grok: (process.env.XAI_API_KEY || "").startsWith("xai-"),
        plans_live: readLaunch().live,
        service: "memorcalc-culqi",
      });
      return;
    }
    if (url.pathname === "/api/google-session" || url.pathname === "/google-session") {
      await handleGoogleSession(req, res);
      return;
    }
    if (url.pathname === "/api/grok/leer-planos") {
      await handleGrok(req, res);
      return;
    }
    if (req.method === "POST" && (url.pathname === "/api/billing/control-login" || url.pathname === "/billing/control-login")) {
      const body = await readBody(req);
      const id = String(body.id || body.email || "").trim().toLowerCase();
      const password = String(body.password || body.clave || "");
      if (!CONTROL_PASSWORD || !sameSecret(id, CONTROL_ID) || !sameSecret(password, CONTROL_PASSWORD)) {
        send(req, res, 401, { ok: false, message: "Identificador o clave incorrectos." });
        return;
      }
      send(req, res, 200, { ok: true, token: issueControlToken() });
      return;
    }
    if (url.pathname === "/api/control/health" || url.pathname === "/control/health") {
      if (!requireControl(req, res)) return;
      send(req, res, 200, {
        ok: true,
        supabase: Boolean(SUPABASE_SECRET),
        url: SUPABASE_URL,
      });
      return;
    }
    if ((url.pathname === "/api/control/snapshot" || url.pathname === "/control/snapshot") && req.method === "GET") {
      if (!requireControl(req, res)) return;
      const snap = await controlSnapshot();
      send(req, res, 200, snap);
      return;
    }
    if ((url.pathname === "/api/control/plan" || url.pathname === "/control/plan") && req.method === "POST") {
      if (!requireControl(req, res)) return;
      const body = await readBody(req);
      const userId = String(body.user_id || "").trim();
      const email = String(body.email || "").trim().toLowerCase();
      const plan = String(body.plan || "free");
      const days = Math.max(1, Math.min(800, Number(body.days || 31)));
      if (!userId) throw new Error("Falta el usuario.");
      const until = plan === "pro" ? new Date(Date.now() + days * 86400000).toISOString() : null;
      const { ok, data } = await adminFetch("/rest/v1/memorcalc_plans?on_conflict=user_id", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=representation" },
        body: JSON.stringify({
          user_id: userId,
          email,
          plan: plan === "pro" ? "pro" : "free",
          paid_until: until,
          last_voucher: "manual-owner",
          updated_at: new Date().toISOString(),
        }),
      });
      if (!ok) throw new Error(data?.message || "No se pudo guardar el plan.");
      send(req, res, 200, { ok: true, plan: plan === "pro" ? "pro" : "free", paid_until: until });
      return;
    }
    if ((url.pathname === "/api/control/listing" || url.pathname === "/control/listing") && req.method === "POST") {
      if (!requireControl(req, res)) return;
      const body = await readBody(req);
      const id = String(body.id || "").trim();
      if (!id) throw new Error("Falta el aviso.");
      const patch = body.patch || {};
      const q = new URLSearchParams({ id: `eq.${id}` });
      const { ok, data } = await adminFetch(`/rest/v1/listings?${q}`, {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(patch),
      });
      if (!ok) throw new Error(data?.message || "No se pudo guardar el aviso.");
      send(req, res, 200, { ok: true, listing: Array.isArray(data) ? data[0] : data });
      return;
    }
    if ((url.pathname === "/api/control/listing" || url.pathname === "/control/listing") && req.method === "DELETE") {
      if (!requireControl(req, res)) return;
      const body = await readBody(req);
      const id = String(body.id || url.searchParams.get("id") || "").trim();
      if (!id) throw new Error("Falta el aviso.");
      const { ok, data } = await adminFetch(`/rest/v1/listings?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!ok) throw new Error(data?.message || "No se pudo eliminar el aviso.");
      send(req, res, 200, { ok: true });
      return;
    }
    if ((url.pathname === "/api/control/revoke" || url.pathname === "/control/revoke") && req.method === "POST") {
      if (!requireControl(req, res)) return;
      const body = await readBody(req);
      const userId = String(body.user_id || "").trim();
      if (!userId) throw new Error("Falta el usuario.");
      const prev = await tableRows(`/rest/v1/memorcalc_device_lock?user_id=eq.${encodeURIComponent(userId)}&select=session_epoch`);
      const epoch = Number(prev[0]?.session_epoch || 0) + 1;
      const { ok, data } = await adminFetch("/rest/v1/memorcalc_device_lock?on_conflict=user_id", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=representation" },
        body: JSON.stringify({
          user_id: userId,
          device_id: "",
          session_epoch: epoch,
          device_label: "",
          updated_at: new Date().toISOString(),
        }),
      });
      if (!ok) throw new Error(data?.message || "No se pudieron cerrar las sesiones.");
      send(req, res, 200, { ok: true });
      return;
    }
    if ((url.pathname === "/api/control/user" || url.pathname === "/control/user") && req.method === "POST") {
      if (!requireControl(req, res)) return;
      const body = await readBody(req);
      const userId = String(body.user_id || "").trim();
      if (!userId) throw new Error("Falta el usuario.");
      const saved = await controlSaveUser(userId, body);
      send(req, res, 200, saved);
      return;
    }
    if ((url.pathname === "/api/control/invite" || url.pathname === "/control/invite") && req.method === "POST") {
      if (!requireControl(req, res)) return;
      const body = await readBody(req);
      const email = String(body.email || "").trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Correo inválido.");
      const invited = await controlInvite(email);
      send(req, res, 200, { ok: true, user: invited });
      return;
    }
    if ((url.pathname === "/api/control/restore" || url.pathname === "/control/restore") && req.method === "POST") {
      if (!requireControl(req, res)) return;
      const body = await readBody(req);
      const userId = String(body.user_id || "").trim();
      if (!userId) throw new Error("Falta el usuario.");
      const saved = await controlSaveUser(userId, { ...body, status: "active", plan: body.plan || "free" });
      send(req, res, 200, saved);
      return;
    }
    if ((url.pathname === "/api/control/listing" || url.pathname === "/control/listing") && req.method === "PUT") {
      if (!requireControl(req, res)) return;
      const body = await readBody(req);
      const owner = await findAuthUserId(CONTROL_ID);
      const row = {
        name: String(body.name || "").trim() || "Aviso",
        description: String(body.description || ""),
        price_label: String(body.price_label || "Consultar"),
        category: String(body.category || "Servicios"),
        city: String(body.city || ""),
        department: String(body.department || ""),
        phone: String(body.phone || ""),
        kind: body.kind === "ad" ? "ad" : "product",
        active: body.active !== false,
        hidden: Boolean(body.hidden),
        seller_email: CONTROL_ID,
        seller_name: "MemoriaCalc",
        user_id: owner || null,
        origin_app: "ingenieria",
      };
      const { ok, data } = await adminFetch("/rest/v1/listings", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(row),
      });
      if (!ok) throw new Error(data?.message || "No se pudo publicar el aviso.");
      send(req, res, 200, { ok: true, listing: Array.isArray(data) ? data[0] : data });
      return;
    }
    if ((url.pathname === "/api/control/notices" || url.pathname === "/control/notices") && req.method === "GET") {
      if (!requireControl(req, res)) return;
      send(req, res, 200, { items: readNotices() });
      return;
    }
    if ((url.pathname === "/api/control/notices" || url.pathname === "/control/notices") && req.method === "POST") {
      if (!requireControl(req, res)) return;
      const body = await readBody(req);
      const items = readNotices();
      const next = {
        id: String(body.id || randomUUID()),
        title: String(body.title || "").trim() || "Aviso",
        body: String(body.body || body.text || ""),
        active: body.active !== false,
        created_at: new Date().toISOString(),
      };
      items.unshift(next);
      writeNotices(items);
      send(req, res, 200, { ok: true, item: next });
      return;
    }
    if ((url.pathname === "/api/control/notices" || url.pathname === "/control/notices") && req.method === "DELETE") {
      if (!requireControl(req, res)) return;
      const body = await readBody(req);
      const id = String(body.id || "").trim();
      writeNotices(readNotices().filter((n) => n.id !== id));
      send(req, res, 200, { ok: true });
      return;
    }
    if ((url.pathname === "/api/control/profile" || url.pathname === "/control/profile") && req.method === "GET") {
      if (!requireControl(req, res)) return;
      const pack = await profileBundleFor(url.searchParams.get("user_id"));
      send(req, res, 200, pack);
      return;
    }
    if ((url.pathname === "/api/control/profile/recalculate" || url.pathname === "/control/profile/recalculate") && req.method === "POST") {
      if (!requireControl(req, res)) return;
      const body = await readBody(req);
      const uid = String(body.user_id || "").trim();
      const agg = await adminRpc("aggregate_user_profile_from_evidence", { p_user: uid });
      const complete = await adminRpc("recalculate_profile_completeness", { p_user: uid });
      send(req, res, 200, { ok: true, aggregate: agg.data, completeness: complete.data });
      return;
    }
    if (url.pathname === "/api/profile/extract" || url.pathname === "/api/profile/answer") {
      const auth = await userFromJwt(String(req.headers.authorization || ""));
      if (!auth?.id) {
        send(req, res, 401, { ok: false, message: "Se requiere sesión." });
        return;
      }
      if (req.method !== "POST") {
        send(req, res, 405, { ok: false, message: "Método no permitido." });
        return;
      }
      const body = await readBody(req, 120_000);
      const rpc = await userRpc(req.headers.authorization, "submit_platform_extraction", {
        p_platform_code: body.platform_code || body.source_platform || "INGENIERIA",
        p_source_type: body.source_type || "QUESTION",
        p_module_id: body.module_id || body.source_module || null,
        p_answers: body.answers || (body.question_id ? [{ question_id: body.question_id, raw_answer: body.raw_answer || body.answer || "" }] : []),
        p_evidence: body.evidence || [],
        p_extractor_version: body.extractor_version || "INGENIERIA-EXTRACTOR-1.0.0",
        p_debug: body.debug || {},
      });
      send(req, res, rpc.ok ? 200 : rpc.status || 400, rpc.data);
      return;
    }
    if (url.pathname.startsWith("/api/profile") && req.method === "GET") {
      const auth = await userFromJwt(String(req.headers.authorization || ""));
      if (!auth?.id) {
        send(req, res, 401, { ok: false, message: "Se requiere sesión." });
        return;
      }
      const uid = auth.id;
      if (url.pathname === "/api/profile" || url.pathname === "/api/profile/") {
        const pack = await profileBundleFor(uid);
        send(req, res, 200, pack.profile);
        return;
      }
      if (url.pathname === "/api/profile/evidence") {
        const ev = await adminRpc("get_profile_evidence", { p_user: uid, p_limit: 80 });
        send(req, res, 200, ev.data);
        return;
      }
      if (url.pathname === "/api/profile/signals") {
        const rows = await tableRows(`/rest/v1/extraction_signals?user_id=eq.${encodeURIComponent(uid)}&select=*&order=created_at.desc&limit=80`);
        send(req, res, 200, rows);
        return;
      }
      if (url.pathname === "/api/profile/scores") {
        const rows = await tableRows(`/rest/v1/user_interests?user_id=eq.${encodeURIComponent(uid)}&select=interest_id,interest_score,declared_score,observed_score,inferred_score,confidence_score,score_version,interest_categories(code,name)`);
        send(req, res, 200, rows);
        return;
      }
      if (url.pathname === "/api/profile/history") {
        const rows = await tableRows(`/rest/v1/user_attribute_history?user_id=eq.${encodeURIComponent(uid)}&select=*&order=created_at.desc&limit=80`);
        send(req, res, 200, rows);
        return;
      }
      if (url.pathname === "/api/profile/completeness") {
        const row = await adminRpc("recalculate_profile_completeness", { p_user: uid });
        send(req, res, 200, row.data);
        return;
      }
    }
    if (url.pathname === "/api/profile/recalculate" && req.method === "POST") {
      const auth = await userFromJwt(String(req.headers.authorization || ""));
      if (!auth?.id) {
        send(req, res, 401, { ok: false, message: "Se requiere sesión." });
        return;
      }
      const agg = await userRpc(req.headers.authorization, "aggregate_user_profile_from_evidence", {});
      const complete = await userRpc(req.headers.authorization, "recalculate_profile_completeness", {});
      send(req, res, 200, { ok: true, aggregate: agg.data, completeness: complete.data });
      return;
    }
    if (url.pathname === "/api/billing/launch" || url.pathname === "/billing/launch") {
      if (req.method === "GET") {
        send(req, res, 200, readLaunch());
        return;
      }
      if (req.method === "POST") {
        const body = await readBody(req);
        const header = String(req.headers.authorization || "");
        const control = readControlToken(header);
        const auth = control ? null : await userFromJwt(header);
        const email = String((control ? CONTROL_ID : auth?.email) || "").trim().toLowerCase();
        if (!control && (!auth?.id || !OWNER_EMAILS.has(email))) {
          send(req, res, 403, { message: "Solo el titular puede poner los planes en operación." });
          return;
        }
        const live = Boolean(body.live);
        const prev = readLaunch();
        const now = new Date().toISOString();
        const next = {
          live,
          liveAt: live ? prev.liveAt || now : null,
          updatedAt: now,
          updatedBy: email,
          quotas: body.quotas && typeof body.quotas === "object" ? asQuotas(body.quotas) : prev.quotas || {},
        };
        send(req, res, 200, writeLaunch(next));
        return;
      }
    }
    if (url.pathname === "/api/billing/print-policy" || url.pathname === "/billing/print-policy") {
      if (req.method === "GET") {
        send(req, res, 200, readPrintPolicy());
        return;
      }
      if (req.method === "POST") {
        const body = await readBody(req);
        const header = String(req.headers.authorization || "");
        const control = readControlToken(header);
        const auth = control ? null : await userFromJwt(header);
        const email = String((control ? CONTROL_ID : auth?.email) || "").trim().toLowerCase();
        if (!control && (!auth?.id || !OWNER_EMAILS.has(email))) {
          send(req, res, 403, { message: "Solo el titular puede tarifar la marca de agua." });
          return;
        }
        const cleanPaid = Boolean(body.cleanPaid);
        const soles = asPrintSoles(body.soles);
        if (cleanPaid && soles <= 0) {
          send(req, res, 400, { message: "Indique el monto en soles por cada hoja de cálculo." });
          return;
        }
        send(req, res, 200, writePrintPolicy({
          cleanPaid,
          soles: cleanPaid ? soles : asPrintSoles(body.soles),
          updatedAt: new Date().toISOString(),
          updatedBy: email,
        }));
        return;
      }
    }
    if (req.method === "POST" && (url.pathname === "/api/charges/confirm" || url.pathname === "/charges/confirm")) {
      const body = await readBody(req);
      const planId = String(body.plan_id || "");
      if (planId !== "mc-pdf" && !readLaunch().live) {
        send(req, res, 403, { message: "Los planes Pro aún no están en operación. El titular debe dar la venia." });
        return;
      }
      const pdfCount = Number(body.pdf_count || 0);
      const expected = expectedCents(planId, pdfCount);
      const amount = Number(body.amount_cents);
      const email = String(body.email || "").trim().toLowerCase();
      if (!expected || expected !== amount) throw new Error("El monto no coincide con el catálogo.");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Correo inválido.");
      if (!body.token_id || String(body.token_id).length < 10) throw new Error("Token Culqi inválido.");
      const auth = await userFromJwt(String(req.headers.authorization || ""));
      if (!auth?.id) throw new Error("Inicie sesión para pagar.");
      if (String(auth.email || "").toLowerCase() !== email) throw new Error("El correo Culqi debe ser el de su sesión.");
      if (!freshToken(String(body.token_id))) throw new Error("Ese pago ya fue procesado.");
      const title = planId === "mc-pdf" ? `Presupuesto desde PDF · ${pdfCount} lámina(s)` : PLANS[planId].title;
      const charge = await culqiCharge({
        tokenId: String(body.token_id),
        amountCents: amount,
        email,
        description: String(body.description || title),
        metadata: { plan_id: planId, pdf_count: String(pdfCount || 0), user_id: auth.id },
      });
      let paidUntil = null;
      if (planId === "mc-pdf") {
        try {
          grantPdfPass(charge.id, auth.id, pdfCount);
        } catch {
          /* el cargo ya se cobró; Grok pedirá reintento de soporte si no hay pase */
        }
      } else {
        paidUntil = await extendCloudPlan({
          userId: auth.id,
          email,
          days: PLANS[planId].days,
          voucher: charge.id,
        });
        if (!paidUntil) paidUntil = new Date(Date.now() + PLANS[planId].days * 86400000).toISOString();
        await logPaymentRow({
          userId: auth.id,
          email,
          kind: "pro",
          amountSoles: amount / 100,
          pdfCount: 0,
          voucher: charge.id,
          meta: { plan_id: planId, days: PLANS[planId].days, description: title },
        });
      }
      send(req, res, 200, {
        ok: true,
        charge_id: charge.id,
        plan_id: planId,
        paid_until: paidUntil,
        days: planId === "mc-pdf" ? 0 : PLANS[planId].days,
        message: planId === "mc-pdf" ? "Pago confirmado. Generando el presupuesto." : "Pago Culqi confirmado. Plan Pro activo.",
      });
      return;
    }
    if (await handleRevitApi(req, res, url, {
      send,
      readBody,
      userFromJwt,
      readLaunch,
      planActivo: async (userId) => {
        try {
          const look = await fetch(
            `${SUPABASE_URL}/rest/v1/memorcalc_plans?user_id=eq.${encodeURIComponent(userId)}&select=plan,paid_until`,
            {
              headers: {
                apikey: SUPABASE_SECRET,
                Authorization: `Bearer ${SUPABASE_SECRET}`,
              },
            },
          );
          if (!look.ok) return true;
          const rows = await look.json();
          const row = rows?.[0];
          if (!row) return false;
          const until = row.paid_until ? new Date(row.paid_until).getTime() : 0;
          return row.plan === "pro" && (!until || until > Date.now());
        } catch {
          return true;
        }
      },
    })) return;
    send(req, res, 404, { message: "No encontrado" });
  } catch (error) {
    send(req, res, 400, { message: error instanceof Error ? error.message : "No se pudo cobrar." });
  }
});

server.requestTimeout = 400000;
server.headersTimeout = 410000;
server.timeout = 400000;
server.listen(PORT, "127.0.0.1", () => {
  console.log(`MemoriaCalc API en 127.0.0.1:${PORT}`);
  if (!SECRET.startsWith("sk_")) console.warn("Falta CULQI_SECRET_KEY");
  if (!(process.env.XAI_API_KEY || "").startsWith("xai-")) console.warn("Falta XAI_API_KEY");
});

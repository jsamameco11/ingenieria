/**
 * Sets the password for an existing Supabase Auth user (Folio project) via
 * the Admin REST API — never touches auth.users directly with raw SQL.
 * Reads SUPABASE_URL/SUPABASE_SECRET_KEY from Folio's own license-server/.env
 * (never copied elsewhere), same convention as the other scripts here.
 */
import { readFileSync } from "node:fs";

const FOLIO_ENV = "C:/Users/Renzo/Desktop/APP TIPO NITRO PDF/folio-pdf/license-server/.env";
const EMAIL = "jrenzosamco@gmail.com";
const NEW_PASSWORD = "Renzoybechi1106!";

function loadEnv(file) {
  const env = {};
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 1) continue;
    env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
  }
  return env;
}

const env = loadEnv(FOLIO_ENV);
const url = String(env.SUPABASE_URL || "").replace(/\/$/, "");
const secret = String(env.SUPABASE_SECRET_KEY || "");
if (!url || !secret) {
  console.error("Falta SUPABASE_URL o SUPABASE_SECRET_KEY en Folio license-server/.env");
  process.exit(1);
}

const headers = { apikey: secret, Authorization: `Bearer ${secret}`, "Content-Type": "application/json" };

async function findUserByEmail(email) {
  for (let page = 1; page <= 10; page++) {
    const res = await fetch(`${url}/auth/v1/admin/users?page=${page}&per_page=200`, { headers });
    if (!res.ok) throw new Error(`listUsers ${res.status}: ${await res.text()}`);
    const data = await res.json();
    const users = data.users || [];
    const hit = users.find((u) => String(u.email || "").toLowerCase() === email.toLowerCase());
    if (hit) return hit;
    if (users.length < 200) break;
  }
  return null;
}

const user = await findUserByEmail(EMAIL);
if (!user) {
  console.error(`No existe ningún usuario con email ${EMAIL} en este proyecto.`);
  process.exit(1);
}
console.log("Usuario encontrado:", user.id, user.email, "provider:", user.app_metadata?.provider);

const res = await fetch(`${url}/auth/v1/admin/users/${user.id}`, {
  method: "PUT",
  headers,
  body: JSON.stringify({ password: NEW_PASSWORD, email_confirm: true }),
});
const body = await res.json().catch(() => ({}));
if (!res.ok) {
  console.error("ERROR al actualizar contraseña:", res.status, body);
  process.exit(1);
}
console.log("Contraseña actualizada correctamente para", body.email || EMAIL);

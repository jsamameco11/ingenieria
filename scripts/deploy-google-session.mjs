/**
 * Despliega Edge Function google-session vía Management API / CLI.
 * Requiere SUPABASE_ACCESS_TOKEN (Dashboard → Account → Access Tokens).
 * Si no hay token, imprime instrucciones.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const FOLIO = "C:/Users/Renzo/Desktop/APP TIPO NITRO PDF/folio-pdf";
const REF = "qfvgksstvdrxcugbdwkv";
const FN = join(FOLIO, "supabase/functions/google-session");

let token = (process.env.SUPABASE_ACCESS_TOKEN || "").trim();
const envFile = join(FOLIO, "license-server/.env");
if (!token && existsSync(envFile)) {
  for (const line of readFileSync(envFile, "utf8").split(/\r?\n/)) {
    if (line.startsWith("SUPABASE_ACCESS_TOKEN=")) token = line.slice(22).trim();
  }
}

if (!token) {
  console.error("Falta SUPABASE_ACCESS_TOKEN para redesplegar la Edge Function.");
  console.error("Cree uno en https://supabase.com/dashboard/account/tokens y ejecute:");
  console.error(`  $env:SUPABASE_ACCESS_TOKEN='sbp_…'; node scripts/deploy-google-session.mjs`);
  process.exit(2);
}

const r = spawnSync(
  "npx",
  ["supabase", "functions", "deploy", "google-session", "--project-ref", REF, "--no-verify-jwt"],
  {
    cwd: FOLIO,
    env: { ...process.env, SUPABASE_ACCESS_TOKEN: token },
    encoding: "utf8",
    shell: true,
  },
);
process.stdout.write(r.stdout || "");
process.stderr.write(r.stderr || "");
if (!existsSync(FN)) console.error("No existe", FN);
process.exit(r.status ?? 1);

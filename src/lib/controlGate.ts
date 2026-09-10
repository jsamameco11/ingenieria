const KEY = "memorcalc-control-gate-v1";
const TOKEN = "memorcalc-control-token-v1";

export function readControlGate() {
  try {
    return localStorage.getItem(KEY) === "ok";
  } catch {
    return false;
  }
}

export function readControlToken() {
  try {
    return localStorage.getItem(TOKEN) || "";
  } catch {
    return "";
  }
}

export function writeControlGate(token = "") {
  localStorage.setItem(KEY, "ok");
  if (token) localStorage.setItem(TOKEN, token);
}

export function clearControlGate() {
  localStorage.removeItem(KEY);
  localStorage.removeItem(TOKEN);
}

export async function loginControl(id: string, password: string) {
  const res = await fetch("/api/billing/control-login", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ id: id.trim(), password }),
  });
  const data = (await res.json().catch(() => ({}))) as { message?: string; ok?: boolean; token?: string };
  if (!res.ok || !data.ok) {
    throw new Error(data.message || "Identificador o clave incorrectos.");
  }
  writeControlGate(data.token || "");
}

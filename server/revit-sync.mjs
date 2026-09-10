import { createHash, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "data", "revit");
const CODES = join(ROOT, "codes.json");
const DEVICES = join(ROOT, "devices.json");
const LINKS = join(ROOT, "links.json");

function ensure() {
  mkdirSync(ROOT, { recursive: true });
  mkdirSync(join(ROOT, "users"), { recursive: true });
}

function readJson(file, fallback) {
  try {
    if (!existsSync(file)) return fallback;
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(file, data) {
  ensure();
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(data));
}

function bearer(req) {
  return String(req.headers.authorization || "").replace(/^Bearer\s+/i, "").trim();
}

function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

function deviceOf(token) {
  const devices = readJson(DEVICES, {});
  return devices[hashToken(token)] || null;
}

export async function handleRevitApi(req, res, url, ctx) {
  const { send, readBody, userFromJwt, readLaunch } = ctx;
  if (!url.pathname.startsWith("/api/v1/revit")) return false;

  if (req.method === "POST" && url.pathname === "/api/v1/revit/pair") {
    const auth = await userFromJwt(String(req.headers.authorization || ""));
    if (!auth?.id) {
      send(req, res, 401, { message: "Inicie sesión para generar el código." });
      return true;
    }
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const email = String(auth.email || "").toLowerCase();
    const codes = readJson(CODES, {});
    codes[code] = {
      userId: auth.id,
      email,
      exp: Date.now() + 15 * 60 * 1000,
    };
    writeJson(CODES, codes);
    const links = readJson(LINKS, {});
    links[auth.id] = {
      ...(links[auth.id] || {}),
      userId: auth.id,
      email,
      code,
      exp: Date.now() + 15 * 60 * 1000,
      esperando: true,
    };
    writeJson(LINKS, links);
    send(req, res, 200, { ok: true, code, expiresIn: 900, email });
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/v1/revit/pair/claim") {
    const body = await readBody(req, 8_000);
    const code = String(body.code || "").trim();
    const codes = readJson(CODES, {});
    const row = codes[code];
    if (!row || row.exp < Date.now()) {
      send(req, res, 400, { message: "Código inválido o vencido. Genere otro en Vincular con Revit." });
      return true;
    }
    delete codes[code];
    writeJson(CODES, codes);
    const token = randomBytes(24).toString("hex");
    const devices = readJson(DEVICES, {});
    devices[hashToken(token)] = { userId: row.userId, email: row.email, created: Date.now() };
    writeJson(DEVICES, devices);
    const links = readJson(LINKS, {});
    links[row.userId] = {
      ...(links[row.userId] || {}),
      userId: row.userId,
      email: row.email,
      claimed: true,
      claimedAt: Date.now(),
      esperando: false,
      code: "",
    };
    writeJson(LINKS, links);
    send(req, res, 200, { ok: true, deviceToken: token, userId: row.userId, email: row.email });
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/v1/revit/sync") {
    const token = bearer(req);
    const dev = deviceOf(token);
    if (!dev) {
      send(req, res, 401, { message: "Dispositivo no conectado. Use un código nuevo." });
      return true;
    }
    const body = await readBody(req, 32_000_000);
    if (!body || typeof body !== "object" || !Array.isArray(body.grupos)) {
      send(req, res, 400, { message: "El paquete no trae grupos de elementos." });
      return true;
    }
    const rec = {
      recibidoEn: new Date().toISOString(),
      userId: dev.userId,
      email: dev.email,
      paquete: body,
    };
    writeJson(join(ROOT, "users", `${dev.userId}.json`), rec);
    const links = readJson(LINKS, {});
    links[dev.userId] = {
      ...(links[dev.userId] || {}),
      claimed: true,
      esperando: false,
      lastSync: rec.recibidoEn,
      elementos: Array.isArray(body.elementos) ? body.elementos.length : 0,
      grupos: body.grupos.length,
      archivo: body.revit?.archivo || "",
    };
    writeJson(LINKS, links);
    send(req, res, 200, {
      ok: true,
      elementos: Array.isArray(body.elementos) ? body.elementos.length : 0,
      grupos: body.grupos.length,
    });
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/v1/revit/latest") {
    let userId = "";
    const token = bearer(req);
    const dev = deviceOf(token);
    if (dev) userId = dev.userId;
    if (!userId) {
      const auth = await userFromJwt(String(req.headers.authorization || ""));
      if (auth?.id) userId = auth.id;
    }
    if (!userId) {
      send(req, res, 401, { message: "Inicie sesión o conecte el add-in." });
      return true;
    }
    const launchLatest = readLaunch();
    if (launchLatest.live && ctx.planActivo) {
      const ok = await ctx.planActivo(userId, dev?.email);
      if (!ok) {
        send(req, res, 403, { message: "Se requiere Plan Pro activo para importar elementos." });
        return true;
      }
    }
    const rec = readJson(join(ROOT, "users", `${userId}.json`), null);
    if (!rec?.paquete) {
      send(req, res, 404, { message: "Aún no hay un modelo sincronizado." });
      return true;
    }
    send(req, res, 200, { ok: true, recibidoEn: rec.recibidoEn, paquete: rec.paquete });
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/v1/revit/link") {
    const auth = await userFromJwt(String(req.headers.authorization || ""));
    if (!auth?.id) {
      send(req, res, 401, { message: "Inicie sesión para ver el estado de la cuenta." });
      return true;
    }
    const links = readJson(LINKS, {});
    const link = links[auth.id] || {};
    const devices = readJson(DEVICES, {});
    const hayPlugin = Object.values(devices).some((d) => d && d.userId === auth.id);
    const rec = readJson(join(ROOT, "users", `${auth.id}.json`), null);
    const codeVigente = link.code && link.exp > Date.now() ? link.code : "";
    let plugin = "desconectado";
    if (link.claimed || hayPlugin) plugin = "conectado";
    else if (codeVigente || link.esperando) plugin = "esperando";
    send(req, res, 200, {
      ok: true,
      cuenta: String(auth.email || link.email || "").toLowerCase(),
      plugin,
      code: plugin === "esperando" ? codeVigente : "",
      conectadoEn: link.claimedAt ? new Date(link.claimedAt).toISOString() : null,
      sincronizadoEn: rec?.recibidoEn || link.lastSync || null,
      elementos: rec?.paquete?.elementos?.length || link.elementos || 0,
      archivo: rec?.paquete?.revit?.archivo || link.archivo || "",
    });
    return true;
  }

  send(req, res, 404, { message: "Ruta Revit no encontrada." });
  return true;
}

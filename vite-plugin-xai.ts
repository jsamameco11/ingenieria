import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";
import { loadEnv } from "vite";
import { SYSTEM_METRADOS, userPrompt } from "./src/lib/planos/prompt";

const MAX_BODY = 20 * 1024 * 1024;

function readBody(req: IncomingMessage) {
  return new Promise<string>((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (c: Buffer) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(new Error("El expediente supera 20 MB rasterizados. Envíe menos láminas."));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function json(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

function textoModelo(data: Record<string, unknown>): string {
  if (typeof data.output_text === "string" && data.output_text.trim()) return data.output_text;
  const parts: string[] = [];
  const output = Array.isArray(data.output) ? data.output : [];
  for (const item of output as { content?: { type?: string; text?: string }[] }[]) {
    for (const c of item.content ?? []) {
      if (c.text) parts.push(c.text);
    }
  }
  const choices = data.choices as { message?: { content?: string } }[] | undefined;
  if (choices?.[0]?.message?.content) return choices[0].message.content;
  return parts.join("\n");
}

function extraerJson(text: string) {
  const fence = text.match(/```json\s*([\s\S]*?)```/i);
  const raw = fence ? fence[1] : text;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("La lectura con IA no devolvió JSON de metrados.");
  return JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
}

async function handleLeer(req: IncomingMessage, res: ServerResponse, apiKey: string, model: string) {
  if (req.method !== "POST") {
    json(res, 405, { error: "Use POST." });
    return;
  }
  if (!apiKey) {
    json(res, 503, { error: "Falta XAI_API_KEY en el servidor. No se puede leer planos." });
    return;
  }
  let payload: {
    obra?: string;
    cliente?: string;
    lugar?: string;
    files?: string[];
    catalogo?: string;
    catalogo_n?: number;
    especialidad?: string;
    especialidad_label?: string;
    categoria_minsa?: string;
    categoria_minsa_texto?: string;
    pages?: { file?: string; page?: number; dataUrl?: string }[];
  };
  try {
    payload = JSON.parse(await readBody(req)) as typeof payload;
  } catch (e) {
    json(res, 400, { error: e instanceof Error ? e.message : "Cuerpo inválido." });
    return;
  }
  const pages = (payload.pages ?? [])
    .filter((p) => typeof p.dataUrl === "string" && p.dataUrl.startsWith("data:image"))
    .slice(0, 40);
  if (!pages.length) {
    json(res, 400, { error: "No hay láminas rasterizadas para la lectura con IA." });
    return;
  }

  const content: { type: string; text?: string; image_url?: string; detail?: string }[] = [
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
        categoria_minsa: payload.categoria_minsa || "",
        categoria_minsa_texto: payload.categoria_minsa_texto || "",
      }),
    },
  ];
  for (const p of pages) {
    content.push({
      type: "input_image",
      image_url: p.dataUrl,
      detail: "high",
    });
  }

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 360000);
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
    const data = (await r.json()) as Record<string, unknown> & { error?: { message?: string } };
    if (!r.ok) {
      json(res, 502, { error: data.error?.message || `La lectura con IA no respondió (${r.status}).` });
      return;
    }
    const parsed = extraerJson(textoModelo(data));
    json(res, 200, parsed);
  } catch (e) {
    const msg = e instanceof Error && e.name === "AbortError" ? "La lectura con IA tardó demasiado en leer los planos." : e instanceof Error ? e.message : "Fallo al consultar el agente de IA.";
    json(res, 502, { error: msg });
  } finally {
    clearTimeout(timer);
  }
}

export function xaiPlugin(mode: string): Plugin {
  const env = loadEnv(mode, process.cwd(), "");
  const apiKey = env.XAI_API_KEY || process.env.XAI_API_KEY || "";
  const model = env.XAI_MODEL || process.env.XAI_MODEL || "grok-4.6";

  const attach = (middlewares: { use: (fn: (req: IncomingMessage, res: ServerResponse, next: () => void) => void) => void }) => {
    middlewares.use((req, res, next) => {
      const url = req.url?.split("?")[0] || "";
      if (url !== "/api/grok/leer-planos") {
        next();
        return;
      }
      if (req.method === "OPTIONS") {
        res.statusCode = 204;
        res.end();
        return;
      }
      void handleLeer(req, res, apiKey, model).catch((err) => {
        if (!res.headersSent) json(res, 500, { error: err instanceof Error ? err.message : "Error interno." });
      });
    });
  };

  return {
    name: "xai-leer-planos",
    configureServer(server) {
      attach(server.middlewares);
    },
    configurePreviewServer(server) {
      attach(server.middlewares);
    },
  };
}

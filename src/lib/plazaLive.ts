import { FOLIO_ANON_KEY, FOLIO_URL, folio } from "./folio";
import type { ChatMsg } from "./mercado";

export type PlazaLiveStatus = "off" | "connecting" | "live" | "reconnecting";
export type PlazaLiveHint = { threadId?: string; message?: ChatMsg };
type HintFn = (hint?: PlazaLiveHint) => void;
type StatusFn = (status: PlazaLiveStatus, code: string) => void;

/** Mismo topic que Folio PDF: el socket entra con el canal ya autorizado. */
const TOPIC = "realtime:folio-messages";
const HEARTBEAT_MS = 15_000;
const JOIN_TIMEOUT_MS = 4_000;

let socket: WebSocket | null = null;
let heartbeat: number | null = null;
let reconnectTimer: number | null = null;
let joinTimer: number | null = null;
let refSeq = 0;
let joinRef = "";
let userId = "";
let token = "";
let status: PlazaLiveStatus = "off";
let backoff = 400;
let code = "";
let generation = 0;

const hints = new Set<HintFn>();
const statuses = new Set<StatusFn>();

function nextRef() {
  refSeq += 1;
  return String(refSeq);
}

export function plazaLiveCode(id = userId) {
  if (!id) return "MC-0000";
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return `MC-${(h >>> 0).toString(16).slice(-4).toUpperCase()}`;
}

export function plazaLiveStatus() {
  return status;
}

function broadcastStatus() {
  const shown = code || plazaLiveCode();
  for (const fn of statuses) fn(status, shown);
}

function setStatus(next: PlazaLiveStatus) {
  if (status === next) return;
  status = next;
  broadcastStatus();
}

function emit(hint?: PlazaLiveHint) {
  for (const fn of hints) fn(hint);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function recordFromPayload(payload: unknown): Record<string, unknown> | null {
  const root = asRecord(payload);
  if (!root) return null;
  const data = asRecord(root.data);
  return asRecord(root.record) || asRecord(data?.record) || asRecord(data) || root;
}

function encode(join: string, ref: string, topic: string, event: string, payload: unknown) {
  return JSON.stringify([join, ref, topic, event, payload]);
}

function send(event: string, payload: unknown, join = joinRef, topic = TOPIC) {
  if (!socket || socket.readyState !== WebSocket.OPEN) return;
  socket.send(encode(join, nextRef(), topic, event, payload));
}

function emitInsert(row: Record<string, unknown>) {
  const id = String(row.id || "");
  const threadId = String(row.thread_id || "");
  const body = String(row.body || "").trim();
  if (!id || !threadId) return;
  emit({
    threadId,
    message: {
      id,
      thread_id: threadId,
      sender_id: String(row.sender_id || ""),
      body,
      created_at: String(row.created_at || new Date().toISOString()),
    },
  });
}

function handleFrame(raw: string) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return;
  }
  const frame = Array.isArray(parsed) ? parsed : null;
  if (!frame || frame.length < 4) return;
  const frameJoin = String(frame[0] ?? "");
  const frameTopic = String(frame[2] || "");
  const event = String(frame[3] || "");
  const payload = frame[4];

  if (event === "phx_reply") {
    const ok = String(asRecord(payload)?.status || "") === "ok";
    const isJoin = frameTopic === TOPIC && frameJoin === joinRef;
    if (!isJoin) return;
    if (ok) {
      backoff = 400;
      if (joinTimer) window.clearTimeout(joinTimer);
      joinTimer = null;
      setStatus("live");
    } else if (status !== "live") {
      setStatus("reconnecting");
      scheduleReconnect();
    }
    return;
  }

  if (event === "phx_error" || event === "phx_close") {
    if (frameTopic === TOPIC && status === "live") setStatus("reconnecting");
    if (token) scheduleReconnect();
    return;
  }

  if (event === "system") {
    const msg = String(asRecord(payload)?.message || asRecord(payload)?.status || "").toLowerCase();
    if (msg.includes("token") || msg.includes("unauthorized") || msg.includes("expired")) {
      token = "";
      void ensurePlazaLive();
    }
    return;
  }

  if (event === "postgres_changes") {
    const row = recordFromPayload(payload);
    const table = String(asRecord(payload)?.table || asRecord(asRecord(payload)?.data)?.table || "");
    const type = String(asRecord(payload)?.type || asRecord(asRecord(payload)?.data)?.type || "").toUpperCase();
    if (table === "listing_messages" && (type === "INSERT" || !type) && row) emitInsert(row);
    else if (table === "listing_threads") emit();
    else if (!table && row?.thread_id) emitInsert(row);
  }
}

function joinChannel() {
  if (!socket || socket.readyState !== WebSocket.OPEN || !token) return;
  joinRef = nextRef();
  socket.send(
    encode(joinRef, joinRef, TOPIC, "phx_join", {
      config: {
        broadcast: { ack: false, self: false },
        presence: { key: "" },
        postgres_changes: [
          { event: "INSERT", schema: "public", table: "listing_messages" },
          { event: "*", schema: "public", table: "listing_threads" },
        ],
      },
      access_token: token,
    }),
  );
  if (joinTimer) window.clearTimeout(joinTimer);
  joinTimer = window.setTimeout(() => {
    if (status !== "live") {
      setStatus("reconnecting");
      scheduleReconnect();
    }
  }, JOIN_TIMEOUT_MS);
}

function stopHeartbeat() {
  if (heartbeat) window.clearInterval(heartbeat);
  heartbeat = null;
}

function stopSocket() {
  stopHeartbeat();
  if (joinTimer) window.clearTimeout(joinTimer);
  joinTimer = null;
  const current = socket;
  socket = null;
  if (current && current.readyState < 2) {
    try {
      current.close();
    } catch {
      /* ignore */
    }
  }
}

function scheduleReconnect() {
  if (!token || reconnectTimer) return;
  const wait = backoff;
  backoff = Math.min(8_000, Math.max(400, backoff * 1.7));
  setStatus(status === "off" ? "connecting" : "reconnecting");
  reconnectTimer = window.setTimeout(() => {
    reconnectTimer = null;
    void ensurePlazaLive();
  }, wait);
}

function connect() {
  const ready = socket && socket.readyState === WebSocket.OPEN && status === "live";
  const opening = socket && socket.readyState === WebSocket.CONNECTING;
  if (ready || opening) return;

  stopSocket();
  if (!token) return;
  const gen = ++generation;
  setStatus(status === "off" ? "connecting" : "reconnecting");
  const base = FOLIO_URL.replace(/^http/i, "ws").replace(/\/$/, "");
  const url =
    `${base}/realtime/v1/websocket?apikey=${encodeURIComponent(FOLIO_ANON_KEY)}` +
    `&vsn=1.0.0&access_token=${encodeURIComponent(token)}`;
  const ws = new WebSocket(url);
  socket = ws;
  ws.addEventListener("open", () => {
    if (socket !== ws || gen !== generation) return;
    joinChannel();
    heartbeat = window.setInterval(() => send("heartbeat", {}, "", "phoenix"), HEARTBEAT_MS);
    send("heartbeat", {}, "", "phoenix");
  });
  ws.addEventListener("message", (ev) => {
    if (socket !== ws || gen !== generation) return;
    if (typeof ev.data === "string") handleFrame(ev.data);
  });
  ws.addEventListener("close", () => {
    if (socket !== ws || gen !== generation) return;
    if (status === "live") setStatus("reconnecting");
    stopHeartbeat();
    if (token) scheduleReconnect();
  });
  ws.addEventListener("error", () => {
    if (socket !== ws || gen !== generation) return;
    if (status !== "live") setStatus("reconnecting");
  });
}

export function stopPlazaLive() {
  token = "";
  userId = "";
  code = "";
  generation += 1;
  if (reconnectTimer) window.clearTimeout(reconnectTimer);
  reconnectTimer = null;
  backoff = 400;
  stopSocket();
  setStatus("off");
}

export async function ensurePlazaLive(forced?: { userId: string; accessToken: string }) {
  const session = forced
    ? { user: { id: forced.userId }, access_token: forced.accessToken }
    : (await folio.auth.getSession()).data.session;
  if (!session?.access_token || !session.user?.id) {
    stopPlazaLive();
    return;
  }
  const same =
    socket &&
    socket.readyState === WebSocket.OPEN &&
    status === "live" &&
    userId === session.user.id &&
    token === session.access_token;
  if (same) return;
  const openingSame =
    socket &&
    socket.readyState === WebSocket.CONNECTING &&
    userId === session.user.id &&
    token === session.access_token;
  if (openingSame) return;

  userId = session.user.id;
  token = session.access_token;
  code = plazaLiveCode(userId);
  broadcastStatus();
  try {
    folio.realtime.setAuth(token);
  } catch {
    /* setAuth es apoyo; el socket propio es la vía principal */
  }
  backoff = 400;
  if (reconnectTimer) {
    window.clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  connect();
}

export function subscribePlazaStatus(fn: StatusFn): () => void {
  statuses.add(fn);
  fn(status, code || plazaLiveCode());
  return () => {
    statuses.delete(fn);
  };
}

/** Un solo socket compartido (nav + bandeja). Enlace seguro con JWT de Google. */
export function subscribePlazaInbox(onChange: HintFn): () => void {
  hints.add(onChange);
  void ensurePlazaLive();
  return () => {
    hints.delete(onChange);
  };
}

export function installPlazaLiveWatch() {
  const onAuth = () => {
    void folio.auth.getSession().then(({ data }) => {
      if (data.session?.access_token) void ensurePlazaLive({ userId: data.session.user.id, accessToken: data.session.access_token });
      else stopPlazaLive();
    });
  };
  const { data } = folio.auth.onAuthStateChange(onAuth);
  const onVis = () => {
    if (document.visibilityState === "visible" && token && status !== "live") void ensurePlazaLive();
  };
  const onOnline = () => {
    if (token) {
      backoff = 400;
      void ensurePlazaLive();
    }
  };
  document.addEventListener("visibilitychange", onVis);
  window.addEventListener("online", onOnline);
  void ensurePlazaLive();
  return () => {
    data.subscription.unsubscribe();
    document.removeEventListener("visibilitychange", onVis);
    window.removeEventListener("online", onOnline);
  };
}

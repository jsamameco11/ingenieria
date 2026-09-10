import { useEffect, useRef } from "react";
import type { AnalysisResult, BuildingProject, DrawTool, Frame, NavMode, Selection, SelItem, ViewLayout } from "../lib/edificio3d";
import { snapXY, storyZ } from "../lib/edificio3d";

export type ViewMode = ViewLayout;

const FOCAL = 520;
const PITCH_MIN = 0.1;
const PITCH_MAX = 1.45;
const DIST_MIN = 5;
const DIST_MAX = 160;
const ORBIT_YAW = 0.0048;
const ORBIT_PITCH = 0.0042;
const INERTIA = 0.9;
const DRAG_PX = 3;

function isSelected(sels: SelItem[], kind: string, id: string) {
  return sels.some((s) => s.kind === kind && s.id === id);
}

type Cam = {
  yaw: number;
  pitch: number;
  dist: number;
  tx: number;
  ty: number;
  tz: number;
  lastX: number;
  lastY: number;
  dragged: boolean;
  mode: "none" | "orbit" | "pan";
  yawV: number;
  pitchV: number;
};

type V3 = { x: number; y: number; z: number };

type Face = {
  pts: V3[];
  fill: string;
  stroke: string;
  sel?: boolean;
};

type Props = {
  project: BuildingProject;
  storyId: string;
  tool: DrawTool;
  view: ViewLayout;
  sels: SelItem[];
  draft: { x: number; y: number }[];
  result: AnalysisResult | null;
  comboId: string;
  showDef: boolean;
  showSolid: boolean;
  navMode: NavMode;
  onPick: (x: number, y: number, hit: Selection, opts?: { additive?: boolean }) => void;
  onBoxSelect?: (hits: SelItem[], additive: boolean) => void;
  onHover?: (msg: string) => void;
};

const PAL = {
  col: { fill: "#c9b896", stroke: "#6e6148" },
  beam: { fill: "#4d82b0", stroke: "#234e72" },
  wall: { fill: "#b15a3a", stroke: "#6a2e1a" },
  slab: { fill: "#c4a860", stroke: "#8a6a32" },
  stair: { fill: "#d4a84b", stroke: "#8a6a32" },
  brace: { fill: "#6a8f6a", stroke: "#3a553a" },
  footM: { fill: "#3d8a55", stroke: "#1f5a34" },
  footE: { fill: "#8b1e1e", stroke: "#5a1010" },
  ground: { fill: "#1a3348", stroke: "rgba(196,160,86,0.35)" },
};

export function EdificioViewport(props: Props) {
  if (props.view === "ambas") {
    return (
      <div className="ed3-split">
        <EdificioCanvas {...props} view="planta" />
        <EdificioCanvas {...props} view="3d" />
      </div>
    );
  }
  return <EdificioCanvas {...props} />;
}

function EdificioCanvas({
  project: p,
  storyId,
  tool,
  view,
  sels,
  draft,
  result,
  comboId,
  showDef,
  showSolid,
  navMode,
  onPick,
  onBoxSelect,
  onHover,
}: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const box = useRef<{ x0: number; y0: number; x1: number; y1: number; shift: boolean } | null>(null);
  const cam = useRef<Cam>({
    yaw: 0.85,
    pitch: 0.58,
    dist: 26,
    tx: 4,
    ty: 2,
    tz: 2.4,
    lastX: 0,
    lastY: 0,
    dragged: false,
    mode: "none",
    yawV: 0,
    pitchV: 0,
  });
  const plan = useRef({ ox: 0, oy: 0, s: 42, lastX: 0, lastY: 0, dragged: false });
  const paint = useRef<() => void>(() => {});

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const draw = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = c.clientWidth;
      const h = c.clientHeight;
      if (c.width !== Math.floor(w * dpr) || c.height !== Math.floor(h * dpr)) {
        c.width = Math.floor(w * dpr);
        c.height = Math.floor(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      if (view === "planta") drawPlan(ctx, w, h, p, storyId, sels, draft, plan.current, result, comboId, showDef);
      else draw3d(ctx, w, h, p, storyId, sels, cam.current, result, comboId, showDef, showSolid, navMode);
      if (box.current) drawMarquee(ctx, box.current);
    };
    paint.current = draw;
    draw();
  }, [p, storyId, view, sels, draft, result, comboId, showDef, showSolid, navMode]);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const toWorld = (cx: number, cy: number) => {
      const r = c.getBoundingClientRect();
      const x = cx - r.left;
      const y = cy - r.top;
      const pl = plan.current;
      return { x: (x - r.width * 0.18 - pl.ox) / pl.s, y: (r.height * 0.78 - y - pl.oy) / pl.s, sx: x, sy: y, w: r.width, h: r.height };
    };
    const hitPlan = (wx: number, wy: number): Selection => {
      const z = storyZ(p, storyId);
      const nodes = p.nodes.filter((n) => Math.abs(n.z - z) < 0.04);
      for (const n of nodes) {
        if (Math.hypot(n.x - wx, n.y - wy) < 0.22) return { kind: "node", id: n.id };
      }
      for (const f of p.frames.filter((x) => (x.storyId === storyId || storyId === "BASE") && x.kind === "beam" && !x.sectionId.startsWith("__RIGID__"))) {
        const a = p.nodes.find((n) => n.id === f.nI);
        const b = p.nodes.find((n) => n.id === f.nJ);
        if (!a || !b) continue;
        if (distSeg(wx, wy, a.x, a.y, b.x, b.y) < 0.18) return { kind: "frame", id: f.id };
      }
      for (const w of p.walls.filter((x) => x.storyId === storyId)) {
        const a = p.nodes.find((n) => n.id === w.nI);
        const b = p.nodes.find((n) => n.id === w.nJ);
        if (!a || !b) continue;
        if (distSeg(wx, wy, a.x, a.y, b.x, b.y) < 0.22) return { kind: "wall", id: w.id };
      }
      for (const s of p.slabs.filter((x) => x.storyId === storyId)) {
        const pts = s.nodeIds.map((id) => p.nodes.find((n) => n.id === id)).filter((n): n is NonNullable<typeof n> => !!n);
        if (pts.length >= 3 && inside(wx, wy, pts)) return { kind: "slab", id: s.id };
      }
      for (const f of p.frames.filter((x) => x.kind === "column")) {
        const b = p.nodes.find((n) => n.id === (storyId === "BASE" ? f.nI : f.nJ));
        if (b && Math.abs(b.z - z) < 0.04 && Math.hypot(b.x - wx, b.y - wy) < 0.22) return { kind: "frame", id: f.id };
      }
      return { kind: "none" };
    };
    const hit3d = (sx: number, sy: number, w: number, h: number) => pick3d(cam.current, p, sx, sy, w, h);
    const cursorFor = (orbiting: boolean) => {
      if (orbiting || cam.current.mode === "orbit") return cam.current.mode === "orbit" ? "grabbing" : "grab";
      if (navMode === "pan" || cam.current.mode === "pan") return cam.current.mode === "pan" ? "grabbing" : "grab";
      if (navMode === "orbit") return "grab";
      if (tool !== "select") return "crosshair";
      return "crosshair";
    };
    const pickAt = (e: { clientX: number; clientY: number }, additive: boolean) => {
      const raw = toWorld(e.clientX, e.clientY);
      if (view === "3d") {
        const hit = hit3d(raw.sx, raw.sy, raw.w, raw.h);
        onPick(hit.point.x, hit.point.y, hit.sel, { additive });
        return;
      }
      const sn = snapXY(p, raw.x, raw.y, draft);
      onPick(sn.x, sn.y, hitPlan(sn.x, sn.y), { additive });
    };
    const finishBox = (additive: boolean) => {
      const b = box.current;
      box.current = null;
      if (!b) return false;
      const dx = b.x1 - b.x0;
      const dy = b.y1 - b.y0;
      if (Math.hypot(dx, dy) < 6) return false;
      const crossing = b.x1 < b.x0;
      const hits =
        view === "3d"
          ? boxHits3d(cam.current, p, b, crossing, canvasSize())
          : boxHitsPlan(p, storyId, b, crossing, plan.current, canvasSize());
      onBoxSelect?.(hits, additive || b.shift);
      paint.current();
      return true;
    };
    const canvasSize = () => {
      const r = c.getBoundingClientRect();
      return { w: r.width, h: r.height };
    };
    const screenOf = (e: { clientX: number; clientY: number }) => {
      const r = c.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const onClick = (e: MouseEvent) => {
      if (cam.current.dragged || plan.current.dragged) {
        cam.current.dragged = false;
        plan.current.dragged = false;
        return;
      }
      if (navMode === "pan" || navMode === "orbit") return;
      if (tool === "select") return;
      pickAt(e, e.shiftKey);
    };
    const onMove = (e: PointerEvent) => {
      const k = cam.current;
      const orbitHint = navMode === "orbit" || e.ctrlKey || e.altKey || e.metaKey;
      c.style.cursor = k.mode === "orbit" ? "grabbing" : k.mode === "pan" ? "grabbing" : cursorFor(orbitHint);
      if (box.current && e.buttons === 1) {
        const s = screenOf(e);
        box.current.x1 = s.x;
        box.current.y1 = s.y;
        if (Math.hypot(s.x - box.current.x0, s.y - box.current.y0) > DRAG_PX) {
          if (view === "3d") k.dragged = true;
          else plan.current.dragged = true;
        }
        paint.current();
        return;
      }
      if (view === "3d") {
        if (k.mode === "none" || e.buttons === 0) return;
        const dx = e.clientX - k.lastX;
        const dy = e.clientY - k.lastY;
        if (Math.hypot(dx, dy) > DRAG_PX) k.dragged = true;
        k.lastX = e.clientX;
        k.lastY = e.clientY;
        if (k.mode === "orbit") {
          orbitCam(k, dx, dy);
          paint.current();
          return;
        }
        if (k.mode === "pan") {
          panCam(k, dx, dy);
          paint.current();
        }
        return;
      }
      if ((navMode === "pan" && e.buttons === 1) || e.buttons === 2 || e.buttons === 4) {
        const dx = e.clientX - plan.current.lastX;
        const dy = e.clientY - plan.current.lastY;
        if (Math.hypot(dx, dy) > DRAG_PX) plan.current.dragged = true;
        plan.current.lastX = e.clientX;
        plan.current.lastY = e.clientY;
        plan.current.ox += dx;
        plan.current.oy -= dy;
        paint.current();
        return;
      }
      const raw = toWorld(e.clientX, e.clientY);
      const sn = snapXY(p, raw.x, raw.y, draft);
      onHover?.(`${sn.x.toFixed(2)}, ${sn.y.toFixed(2)} m`);
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = c.getBoundingClientRect();
      const sx = e.clientX - r.left;
      const sy = e.clientY - r.top;
      const dy = Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : 0;
      if (!dy) return;
      if (view === "planta") {
        const pl = plan.current;
        const wx = (sx - r.width * 0.18 - pl.ox) / pl.s;
        const wy = (r.height * 0.78 - sy - pl.oy) / pl.s;
        const next = Math.max(12, Math.min(140, pl.s * (dy > 0 ? 0.92 : 1.08)));
        pl.ox += wx * (pl.s - next);
        pl.oy += wy * (pl.s - next);
        pl.s = next;
      } else {
        zoomToward(cam.current, p, sx, sy, r.width, r.height, dy);
      }
      paint.current();
    };
    const onDown = (e: PointerEvent) => {
      if (e.button === 1) e.preventDefault();
      cam.current.lastX = e.clientX;
      cam.current.lastY = e.clientY;
      cam.current.dragged = false;
      cam.current.yawV = 0;
      cam.current.pitchV = 0;
      plan.current.lastX = e.clientX;
      plan.current.lastY = e.clientY;
      plan.current.dragged = false;
      const drawing = tool !== "select";
      const selecting = tool === "select" && navMode === "select" && e.button === 0 && !e.ctrlKey && !e.altKey && !e.metaKey;
      const panBtn = e.button === 1 || e.button === 2 || (navMode === "pan" && e.button === 0 && !drawing);
      const orbitBtn =
        view === "3d" &&
        e.button === 0 &&
        !panBtn &&
        !drawing &&
        !selecting &&
        (navMode === "orbit" || e.ctrlKey || e.altKey || e.metaKey);
      cam.current.mode = view === "3d" ? (panBtn ? "pan" : orbitBtn ? "orbit" : "none") : "none";
      if (selecting) {
        const s = screenOf(e);
        box.current = { x0: s.x, y0: s.y, x1: s.x, y1: s.y, shift: e.shiftKey };
      }
      c.style.cursor = cam.current.mode === "orbit" || cam.current.mode === "pan" ? "grabbing" : cursorFor(false);
      try {
        c.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    };
    const onUp = (e: PointerEvent) => {
      cam.current.mode = "none";
      c.style.cursor = cursorFor(false);
      if (tool === "select" && navMode === "select" && e.button === 0) {
        const boxed = finishBox(e.shiftKey);
        if (!boxed && !cam.current.dragged && !plan.current.dragged) {
          pickAt(e, true);
        }
      }
      try {
        if (c.hasPointerCapture(e.pointerId)) c.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        box.current = null;
        paint.current();
        onBoxSelect?.([], false);
        return;
      }
      if (e.key === "Control" || e.key === "Meta" || e.key === "Alt") c.style.cursor = cursorFor(e.type === "keydown");
    };
    const onCtx = (e: Event) => e.preventDefault();
    let raf = 0;
    const tick = () => {
      const k = cam.current;
      if (k.mode === "none" && (Math.abs(k.yawV) > 0.00012 || Math.abs(k.pitchV) > 0.00012)) {
        k.yaw -= k.yawV;
        k.pitch = Math.max(PITCH_MIN, Math.min(PITCH_MAX, k.pitch + k.pitchV));
        k.yawV *= INERTIA;
        k.pitchV *= INERTIA;
        paint.current();
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    c.style.cursor = cursorFor(false);
    c.addEventListener("click", onClick);
    c.addEventListener("pointermove", onMove);
    c.addEventListener("wheel", onWheel, { passive: false });
    c.addEventListener("pointerdown", onDown);
    c.addEventListener("pointerup", onUp);
    c.addEventListener("pointercancel", onUp);
    c.addEventListener("contextmenu", onCtx);
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);
    return () => {
      cancelAnimationFrame(raf);
      c.removeEventListener("click", onClick);
      c.removeEventListener("pointermove", onMove);
      c.removeEventListener("wheel", onWheel);
      c.removeEventListener("pointerdown", onDown);
      c.removeEventListener("pointerup", onUp);
      c.removeEventListener("pointercancel", onUp);
      c.removeEventListener("contextmenu", onCtx);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
    };
  }, [p, storyId, view, tool, navMode, draft, onPick, onBoxSelect, onHover]);

  return <canvas ref={ref} className="ed3-canvas" style={{ touchAction: "none" }} />;
}

function add(a: V3, b: V3): V3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}
function sub(a: V3, b: V3): V3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}
function mul(a: V3, s: number): V3 {
  return { x: a.x * s, y: a.y * s, z: a.z * s };
}
function dot(a: V3, b: V3) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}
function cross(a: V3, b: V3): V3 {
  return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x };
}
function len(a: V3) {
  return Math.hypot(a.x, a.y, a.z);
}
function norm(a: V3): V3 {
  const L = len(a) || 1;
  return mul(a, 1 / L);
}

function camBasis(cam: Cam) {
  const cp = Math.cos(cam.pitch);
  const sp = Math.sin(cam.pitch);
  const cy = Math.cos(cam.yaw);
  const sy = Math.sin(cam.yaw);
  const eye = {
    x: cam.tx + cam.dist * cp * sy,
    y: cam.ty + cam.dist * cp * cy,
    z: cam.tz + cam.dist * sp,
  };
  const look = { x: -cp * sy, y: -cp * cy, z: -sp };
  const right = { x: cy, y: -sy, z: 0 };
  const up = { x: -sp * sy, y: -sp * cy, z: cp };
  return { eye, look, right, up };
}

function orbitCam(cam: Cam, dx: number, dy: number) {
  cam.yaw -= dx * ORBIT_YAW;
  cam.pitch = Math.max(PITCH_MIN, Math.min(PITCH_MAX, cam.pitch + dy * ORBIT_PITCH));
  cam.yawV = dx * ORBIT_YAW;
  cam.pitchV = dy * ORBIT_PITCH;
}

function viewRay(cam: Cam, sx: number, sy: number, w: number, h: number) {
  const { eye, look, right, up } = camBasis(cam);
  const zc = Math.max(cam.dist, 0.45);
  const f = FOCAL / zc;
  const x1 = (sx - w * 0.5) / f;
  const y2 = (h * 0.58 - sy) / f;
  const through = {
    x: eye.x + look.x * zc + right.x * x1 + up.x * y2,
    y: eye.y + look.y * zc + right.y * x1 + up.y * y2,
    z: eye.z + look.z * zc + right.z * x1 + up.z * y2,
  };
  return { origin: eye, dir: norm(sub(through, eye)) };
}

function rayPlane(origin: V3, dir: V3, point: V3, normal: V3) {
  const den = dot(dir, normal);
  if (Math.abs(den) < 1e-7) return null;
  const t = dot(sub(point, origin), normal) / den;
  if (t < 0.02) return null;
  return { p: add(origin, mul(dir, t)), t };
}

function slabNodes(p: BuildingProject, s: BuildingProject["slabs"][number]) {
  return s.nodeIds.map((id) => p.nodes.find((n) => n.id === id)).filter((n): n is NonNullable<typeof n> => !!n);
}

function polyHit(cam: Cam, pts: V3[], sx: number, sy: number, w: number, h: number) {
  if (pts.length < 3) return null;
  const qs = pts.map((q) => project(cam, q.x, q.y, q.z, w, h));
  if (qs.some((q) => q.z < 0.2)) return null;
  if (!inside(sx, sy, qs)) return null;
  const depth = qs.reduce((acc, q) => acc + q.z, 0) / qs.length;
  const ray = viewRay(cam, sx, sy, w, h);
  const nrm = norm(cross(sub(pts[1], pts[0]), sub(pts[2], pts[0])));
  const hit = rayPlane(ray.origin, ray.dir, pts[0], nrm);
  const point = hit?.p ?? {
    x: pts.reduce((acc, q) => acc + q.x, 0) / pts.length,
    y: pts.reduce((acc, q) => acc + q.y, 0) / pts.length,
    z: pts.reduce((acc, q) => acc + q.z, 0) / pts.length,
  };
  return { depth, point };
}

function pick3d(cam: Cam, p: BuildingProject, sx: number, sy: number, w: number, h: number) {
  type Cand = { sel: Selection; depth: number; pixel: number; point: V3; rank: number };
  const cands: Cand[] = [];

  for (const n of p.nodes) {
    const q = project(cam, n.x, n.y, n.z, w, h);
    if (q.z < 0.2) continue;
    const d = Math.hypot(q.x - sx, q.y - sy);
    if (d < 11) cands.push({ sel: { kind: "node", id: n.id }, depth: q.z, pixel: d, point: { x: n.x, y: n.y, z: n.z }, rank: 0 });
  }
  for (const f of p.frames) {
    if (hiddenFrame(f)) continue;
    const a = p.nodes.find((n) => n.id === f.nI);
    const b = p.nodes.find((n) => n.id === f.nJ);
    if (!a || !b) continue;
    const pa = project(cam, a.x, a.y, a.z, w, h);
    const pb = project(cam, b.x, b.y, b.z, w, h);
    if (pa.z < 0.2 && pb.z < 0.2) continue;
    const d = distSeg(sx, sy, pa.x, pa.y, pb.x, pb.y);
    if (d < 9) {
      const L2 = (pb.x - pa.x) ** 2 + (pb.y - pa.y) ** 2;
      const t = L2 < 1e-9 ? 0.5 : Math.max(0, Math.min(1, ((sx - pa.x) * (pb.x - pa.x) + (sy - pa.y) * (pb.y - pa.y)) / L2));
      cands.push({
        sel: { kind: "frame", id: f.id },
        depth: pa.z + (pb.z - pa.z) * t,
        pixel: d,
        point: { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t },
        rank: 1,
      });
    }
  }
  for (const wall of p.walls) {
    const a = p.nodes.find((n) => n.id === wall.nI);
    const b = p.nodes.find((n) => n.id === wall.nJ);
    if (!a || !b) continue;
    const st = p.stories.find((x) => x.id === wall.storyId);
    const zTop = a.z;
    const zBot = zTop - (st?.height ?? 2.8);
    const hit = polyHit(
      cam,
      [
        { x: a.x, y: a.y, z: zBot },
        { x: b.x, y: b.y, z: zBot },
        { x: b.x, y: b.y, z: zTop },
        { x: a.x, y: a.y, z: zTop },
      ],
      sx,
      sy,
      w,
      h
    );
    if (hit) cands.push({ sel: { kind: "wall", id: wall.id }, depth: hit.depth, pixel: 0, point: hit.point, rank: 2 });
  }
  for (const s of p.slabs) {
    const pts = slabNodes(p, s);
    const hit = polyHit(cam, pts, sx, sy, w, h);
    if (hit) cands.push({ sel: { kind: "slab", id: s.id }, depth: hit.depth, pixel: 0, point: hit.point, rank: 3 });
  }

  const tight = cands.filter((c) => c.rank <= 1 && c.pixel < 7);
  const pool = tight.length ? tight : cands;
  if (!pool.length) return { sel: { kind: "none" } as Selection, point: { x: cam.tx, y: cam.ty, z: cam.tz } };
  pool.sort((a, b) => a.depth - b.depth || a.pixel - b.pixel || a.rank - b.rank);
  const best = pool[0];
  return { sel: best.sel, point: best.point };
}

function normBox(b: { x0: number; y0: number; x1: number; y1: number }) {
  return {
    x: Math.min(b.x0, b.x1),
    y: Math.min(b.y0, b.y1),
    w: Math.abs(b.x1 - b.x0),
    h: Math.abs(b.y1 - b.y0),
  };
}

function ptInBox(x: number, y: number, r: { x: number; y: number; w: number; h: number }, pad = 0) {
  return x >= r.x - pad && x <= r.x + r.w + pad && y >= r.y - pad && y <= r.y + r.h + pad;
}

function segHitsBox(x1: number, y1: number, x2: number, y2: number, r: { x: number; y: number; w: number; h: number }) {
  if (ptInBox(x1, y1, r) || ptInBox(x2, y2, r)) return true;
  const edges: [number, number, number, number][] = [
    [r.x, r.y, r.x + r.w, r.y],
    [r.x + r.w, r.y, r.x + r.w, r.y + r.h],
    [r.x + r.w, r.y + r.h, r.x, r.y + r.h],
    [r.x, r.y + r.h, r.x, r.y],
  ];
  for (const [ax, ay, bx, by] of edges) {
    if (segIntersect(x1, y1, x2, y2, ax, ay, bx, by)) return true;
  }
  return false;
}

function segIntersect(a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number) {
  const den = (a - c) * (f - h) - (b - d) * (e - g);
  if (Math.abs(den) < 1e-9) return false;
  const t = ((a - e) * (f - h) - (b - f) * (e - g)) / den;
  const u = ((a - e) * (b - d) - (b - f) * (a - c)) / den;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}

function ptsWindow(qs: { x: number; y: number; z?: number }[], r: { x: number; y: number; w: number; h: number }, crossing: boolean) {
  const vis = qs.filter((q) => (q.z ?? 1) > 0.2);
  if (!vis.length) return false;
  if (crossing) {
    if (vis.some((q) => ptInBox(q.x, q.y, r))) return true;
    for (let i = 0; i < vis.length; i++) {
      const a = vis[i];
      const b = vis[(i + 1) % vis.length];
      if (segHitsBox(a.x, a.y, b.x, b.y, r)) return true;
    }
    return false;
  }
  return vis.length === qs.length && vis.every((q) => ptInBox(q.x, q.y, r));
}

function pushUnique(out: SelItem[], item: SelItem) {
  if (!out.some((s) => s.kind === item.kind && s.id === item.id)) out.push(item);
}

function boxHits3d(
  cam: Cam,
  p: BuildingProject,
  b: { x0: number; y0: number; x1: number; y1: number },
  crossing: boolean,
  size: { w: number; h: number }
) {
  const r = normBox(b);
  const out: SelItem[] = [];
  for (const n of p.nodes) {
    const q = project(cam, n.x, n.y, n.z, size.w, size.h);
    if (q.z > 0.2 && ptInBox(q.x, q.y, r)) pushUnique(out, { kind: "node", id: n.id });
  }
  for (const f of p.frames) {
    if (hiddenFrame(f)) continue;
    const a = p.nodes.find((n) => n.id === f.nI);
    const c = p.nodes.find((n) => n.id === f.nJ);
    if (!a || !c) continue;
    const pa = project(cam, a.x, a.y, a.z, size.w, size.h);
    const pb = project(cam, c.x, c.y, c.z, size.w, size.h);
    if (ptsWindow([pa, pb], r, crossing)) pushUnique(out, { kind: "frame", id: f.id });
  }
  for (const wall of p.walls) {
    const a = p.nodes.find((n) => n.id === wall.nI);
    const c = p.nodes.find((n) => n.id === wall.nJ);
    if (!a || !c) continue;
    const st = p.stories.find((x) => x.id === wall.storyId);
    const zTop = a.z;
    const zBot = zTop - (st?.height ?? 2.8);
    const qs = [
      project(cam, a.x, a.y, zBot, size.w, size.h),
      project(cam, c.x, c.y, zBot, size.w, size.h),
      project(cam, c.x, c.y, zTop, size.w, size.h),
      project(cam, a.x, a.y, zTop, size.w, size.h),
    ];
    if (ptsWindow(qs, r, crossing)) pushUnique(out, { kind: "wall", id: wall.id });
  }
  for (const s of p.slabs) {
    const qs = slabNodes(p, s).map((n) => project(cam, n.x, n.y, n.z, size.w, size.h));
    if (ptsWindow(qs, r, crossing)) pushUnique(out, { kind: "slab", id: s.id });
  }
  return out;
}

function boxHitsPlan(
  p: BuildingProject,
  storyId: string,
  b: { x0: number; y0: number; x1: number; y1: number },
  crossing: boolean,
  cam: { ox: number; oy: number; s: number },
  size: { w: number; h: number }
) {
  const r = normBox(b);
  const toScr = (x: number, y: number) => ({ x: size.w * 0.18 + cam.ox + x * cam.s, y: size.h * 0.78 - cam.oy - y * cam.s, z: 1 });
  const z = storyZ(p, storyId);
  const out: SelItem[] = [];
  for (const n of p.nodes.filter((nd) => Math.abs(nd.z - z) < 0.04)) {
    const q = toScr(n.x, n.y);
    if (ptInBox(q.x, q.y, r)) pushUnique(out, { kind: "node", id: n.id });
  }
  for (const f of p.frames.filter((x) => !hiddenFrame(x))) {
    const a = p.nodes.find((n) => n.id === f.nI);
    const c = p.nodes.find((n) => n.id === f.nJ);
    if (!a || !c) continue;
    const onStory =
      f.kind === "column"
        ? Math.abs((storyId === "BASE" ? a.z : c.z) - z) < 0.04
        : f.storyId === storyId || storyId === "BASE";
    if (!onStory) continue;
    if (ptsWindow([toScr(a.x, a.y), toScr(c.x, c.y)], r, crossing)) pushUnique(out, { kind: "frame", id: f.id });
  }
  for (const wall of p.walls.filter((x) => x.storyId === storyId)) {
    const a = p.nodes.find((n) => n.id === wall.nI);
    const c = p.nodes.find((n) => n.id === wall.nJ);
    if (!a || !c) continue;
    if (ptsWindow([toScr(a.x, a.y), toScr(c.x, c.y)], r, crossing)) pushUnique(out, { kind: "wall", id: wall.id });
  }
  for (const s of p.slabs.filter((x) => x.storyId === storyId)) {
    const qs = slabNodes(p, s).map((n) => toScr(n.x, n.y));
    if (ptsWindow(qs, r, crossing)) pushUnique(out, { kind: "slab", id: s.id });
  }
  return out;
}

function drawMarquee(ctx: CanvasRenderingContext2D, b: { x0: number; y0: number; x1: number; y1: number }) {
  const r = normBox(b);
  const crossing = b.x1 < b.x0;
  ctx.save();
  ctx.fillStyle = crossing ? "rgba(139,30,30,0.12)" : "rgba(26,68,115,0.12)";
  ctx.strokeStyle = crossing ? "#8b1e1e" : "#1a4473";
  ctx.lineWidth = 1.2;
  ctx.setLineDash(crossing ? [5, 4] : []);
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.strokeRect(r.x, r.y, r.w, r.h);
  ctx.setLineDash([]);
  ctx.font = "10px IBM Plex Sans";
  ctx.fillStyle = crossing ? "#8b1e1e" : "#1a4473";
  ctx.fillText(crossing ? "Cruce (parcial)" : "Ventana (contenido)", r.x + 6, r.y + 14);
  ctx.restore();
}

function zoomToward(cam: Cam, p: BuildingProject, sx: number, sy: number, w: number, h: number, deltaY: number) {
  const hit = pick3d(cam, p, sx, sy, w, h);
  const ray = viewRay(cam, sx, sy, w, h);
  const plane =
    hit.sel.kind !== "none"
      ? hit.point
      : rayPlane(ray.origin, ray.dir, { x: cam.tx, y: cam.ty, z: cam.tz }, { x: 0, y: 0, z: 1 })?.p ??
        rayPlane(ray.origin, ray.dir, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 })?.p ?? { x: cam.tx, y: cam.ty, z: cam.tz };
  const old = cam.dist;
  const factor = deltaY > 0 ? 1.07 : 1 / 1.07;
  cam.dist = Math.max(DIST_MIN, Math.min(DIST_MAX, cam.dist * factor));
  const t = 1 - cam.dist / old;
  cam.tx += (plane.x - cam.tx) * t;
  cam.ty += (plane.y - cam.ty) * t;
  cam.tz += (plane.z - cam.tz) * t;
}

/** Pan tipo SketchUp/Revit: el modelo sigue la mano. */
function panCam(cam: Cam, dx: number, dy: number) {
  const { right, up } = camBasis(cam);
  const s = cam.dist / FOCAL;
  cam.tx += -dx * s * right.x + dy * s * up.x;
  cam.ty += -dx * s * right.y + dy * s * up.y;
  cam.tz += -dx * s * right.z + dy * s * up.z;
}

function distSeg(x: number, y: number, x1: number, y1: number, x2: number, y2: number) {
  const L2 = (x2 - x1) ** 2 + (y2 - y1) ** 2;
  if (L2 < 1e-9) return Math.hypot(x - x1, y - y1);
  const t = Math.max(0, Math.min(1, ((x - x1) * (x2 - x1) + (y - y1) * (y2 - y1)) / L2));
  return Math.hypot(x - (x1 + t * (x2 - x1)), y - (y1 + t * (y2 - y1)));
}

function inside(x: number, y: number, pts: { x: number; y: number }[]) {
  let n = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i];
    const b = pts[j];
    if ((a.y > y) !== (b.y > y) && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) n++;
  }
  return n % 2 === 1;
}

function hiddenFrame(f: Frame) {
  return f.sectionId.startsWith("__RIGID__") || f.sectionId.startsWith("__WALL__") || f.kind === "pierStrip";
}

function drawPlan(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  p: BuildingProject,
  storyId: string,
  sels: SelItem[],
  draft: { x: number; y: number }[],
  cam: { ox: number; oy: number; s: number },
  result: AnalysisResult | null,
  comboId: string,
  showDef: boolean
) {
  ctx.fillStyle = "#e8e0d0";
  ctx.fillRect(0, 0, w, h);
  const X = (x: number) => w * 0.18 + cam.ox + x * cam.s;
  const Y = (y: number) => h * 0.78 - cam.oy - y * cam.s;
  ctx.strokeStyle = "#c9bea6";
  ctx.lineWidth = 1;
  const xmin = Math.min(...p.gridsX.map((g) => g.coord), 0) - 1;
  const xmax = Math.max(...p.gridsX.map((g) => g.coord), 8) + 1;
  const ymin = Math.min(...p.gridsY.map((g) => g.coord), 0) - 1;
  const ymax = Math.max(...p.gridsY.map((g) => g.coord), 6) + 1;
  for (let x = Math.floor(xmin); x <= xmax; x++) {
    ctx.beginPath();
    ctx.moveTo(X(x), Y(ymin));
    ctx.lineTo(X(x), Y(ymax));
    ctx.stroke();
  }
  for (let y = Math.floor(ymin); y <= ymax; y++) {
    ctx.beginPath();
    ctx.moveTo(X(xmin), Y(y));
    ctx.lineTo(X(xmax), Y(y));
    ctx.stroke();
  }
  ctx.strokeStyle = "#8a6a32";
  ctx.setLineDash([6, 4]);
  ctx.lineWidth = 1.2;
  for (const g of p.gridsX) {
    ctx.beginPath();
    ctx.moveTo(X(g.coord), Y(ymin));
    ctx.lineTo(X(g.coord), Y(ymax));
    ctx.stroke();
    ctx.fillStyle = "#8a6a32";
    ctx.font = "600 12px IBM Plex Sans";
    ctx.fillText(g.name, X(g.coord) - 4, Y(ymax) - 8);
  }
  for (const g of p.gridsY) {
    ctx.beginPath();
    ctx.moveTo(X(xmin), Y(g.coord));
    ctx.lineTo(X(xmax), Y(g.coord));
    ctx.stroke();
    ctx.fillStyle = "#8a6a32";
    ctx.fillText(g.name, X(xmin) - 18, Y(g.coord) + 4);
  }
  ctx.setLineDash([]);
  const z = storyZ(p, storyId);
  const combo = result?.combos.find((c) => c.comboId === comboId);
  const def = (id: string) => combo?.nodes.find((n) => n.id === id);
  const sc = showDef ? 25 : 0;

  for (const s of p.slabs.filter((x) => x.storyId === storyId)) {
    const pts = s.nodeIds.map((id) => p.nodes.find((n) => n.id === id)).filter((n): n is NonNullable<typeof n> => !!n);
    if (pts.length < 3) continue;
    ctx.beginPath();
    pts.forEach((n, i) => {
      const d = def(n.id);
      const x = X(n.x + (d?.ux ?? 0) * sc);
      const y = Y(n.y + (d?.uy ?? 0) * sc);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.fillStyle = isSelected(sels, "slab", s.id) ? "rgba(138,106,50,0.28)" : "rgba(47,90,122,0.14)";
    ctx.fill();
    ctx.strokeStyle = "#2f5a7a";
    ctx.stroke();
  }
  for (const wall of p.walls.filter((x) => x.storyId === storyId)) {
    const a = p.nodes.find((n) => n.id === wall.nI);
    const b = p.nodes.find((n) => n.id === wall.nJ);
    if (!a || !b) continue;
    ctx.strokeStyle = isSelected(sels, "wall", wall.id) ? "#8b1e1e" : "#5a2a12";
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(X(a.x), Y(a.y));
    ctx.lineTo(X(b.x), Y(b.y));
    ctx.stroke();
  }
  for (const f of p.frames.filter((x) => x.storyId === storyId && x.kind === "beam" && !x.sectionId.startsWith("__RIGID__"))) {
    const a = p.nodes.find((n) => n.id === f.nI);
    const b = p.nodes.find((n) => n.id === f.nJ);
    if (!a || !b) continue;
    const da = def(a.id);
    const db = def(b.id);
    ctx.strokeStyle = isSelected(sels, "frame", f.id) ? "#c4a056" : "#0b1f33";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(X(a.x + (da?.ux ?? 0) * sc), Y(a.y + (da?.uy ?? 0) * sc));
    ctx.lineTo(X(b.x + (db?.ux ?? 0) * sc), Y(b.y + (db?.uy ?? 0) * sc));
    ctx.stroke();
  }
  for (const f of p.frames.filter((x) => x.storyId === storyId && x.kind === "column")) {
    const b = p.nodes.find((n) => n.id === f.nJ);
    if (!b) continue;
    const on = isSelected(sels, "frame", f.id);
    ctx.fillStyle = on ? "#c4a056" : "#0b1f33";
    ctx.fillRect(X(b.x) - 6, Y(b.y) - 6, 12, 12);
  }
  for (const n of p.nodes.filter((x) => Math.abs(x.z - z) < 0.04)) {
    ctx.beginPath();
    ctx.arc(X(n.x), Y(n.y), n.reference ? 4 : 3, 0, Math.PI * 2);
    ctx.fillStyle = n.reference ? "#8a6a32" : isSelected(sels, "node", n.id) ? "#c4a056" : "#16324c";
    ctx.fill();
    if (p.supports.some((s) => s.nodeId === n.id)) {
      ctx.strokeStyle = "#1f6b3a";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(X(n.x) - 8, Y(n.y) - 8, 16, 16);
    }
  }
  if (draft.length) {
    ctx.strokeStyle = "#8a6a32";
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    draft.forEach((q, i) => (i === 0 ? ctx.moveTo(X(q.x), Y(q.y)) : ctx.lineTo(X(q.x), Y(q.y))));
    ctx.stroke();
    ctx.setLineDash([]);
    for (const q of draft) {
      ctx.fillStyle = "#8a6a32";
      ctx.beginPath();
      ctx.arc(X(q.x), Y(q.y), 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.fillStyle = "#6b6458";
  ctx.font = "12px IBM Plex Sans";
  ctx.fillText(`2D · ${storyId === "BASE" ? "BASE / cimentación" : `Planta ${storyId}`} · z = ${z.toFixed(2)} m · arrastre: ventana · clic: sumar/quitar · Esc: limpiar`, 16, 22);
}

function project(cam: Cam, x: number, y: number, z: number, w: number, h: number) {
  const { eye, look, right, up } = camBasis(cam);
  const rx = x - eye.x;
  const ry = y - eye.y;
  const rz = z - eye.z;
  const x1 = rx * right.x + ry * right.y + rz * right.z;
  const y2 = rx * up.x + ry * up.y + rz * up.z;
  const zc = rx * look.x + ry * look.y + rz * look.z;
  const f = FOCAL / Math.max(zc, 0.45);
  return { x: w * 0.5 + x1 * f, y: h * 0.58 - y2 * f, z: zc };
}

function shade(hex: string, k: number, alpha = 1) {
  const n = parseInt(hex.replace("#", ""), 16);
  const r = Math.round(Math.max(0, Math.min(255, ((n >> 16) & 255) * k)));
  const g = Math.round(Math.max(0, Math.min(255, ((n >> 8) & 255) * k)));
  const b = Math.round(Math.max(0, Math.min(255, (n & 255) * k)));
  return alpha < 1 ? `rgba(${r},${g},${b},${alpha})` : `rgb(${r},${g},${b})`;
}

function prismFaces(a: V3, b: V3, bw: number, bh: number, angle = 0): V3[][] {
  const axis = sub(b, a);
  const L = len(axis);
  if (L < 1e-5) return [];
  const t = mul(axis, 1 / L);
  let u: V3;
  if (Math.abs(t.z) > 0.92) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    u = { x: c, y: s, z: 0 };
  } else {
    u = norm(cross(cross(t, { x: 0, y: 0, z: 1 }), t));
    if (len(u) < 0.15) u = { x: 1, y: 0, z: 0 };
  }
  const r = norm(cross(u, t));
  const hx = mul(r, bw / 2);
  const hy = mul(u, bh / 2);
  const c0 = [
    add(add(a, mul(hx, -1)), mul(hy, -1)),
    add(add(a, hx), mul(hy, -1)),
    add(add(a, hx), hy),
    add(add(a, mul(hx, -1)), hy),
  ];
  const c1 = c0.map((p) => add(p, axis));
  return [
    [c0[0], c0[1], c0[2], c0[3]],
    [c1[0], c1[3], c1[2], c1[1]],
    [c0[0], c1[0], c1[1], c0[1]],
    [c0[1], c1[1], c1[2], c0[2]],
    [c0[2], c1[2], c1[3], c0[3]],
    [c0[3], c1[3], c1[0], c0[0]],
  ];
}

function slabFaces(pts: V3[], t: number): V3[][] {
  const top = pts;
  const bot = pts.map((q) => ({ x: q.x, y: q.y, z: q.z - t }));
  const faces: V3[][] = [top, [...bot].reverse()];
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    faces.push([bot[i], bot[j], top[j], top[i]]);
  }
  return faces;
}

function pushFaces(out: Face[], quads: V3[][], fill: string, stroke: string, sel = false) {
  for (const pts of quads) out.push({ pts, fill, stroke, sel });
}

function draw3d(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  p: BuildingProject,
  storyId: string,
  sels: SelItem[],
  cam: Cam,
  result: AnalysisResult | null,
  comboId: string,
  showDef: boolean,
  showSolid: boolean,
  navMode: NavMode
) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, "#16324c");
  g.addColorStop(1, "#0b1f33");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  const P = (x: number, y: number, z: number) => project(cam, x, y, z, w, h);
  const combo = result?.combos.find((c) => c.comboId === comboId);
  const def = (id: string) => combo?.nodes.find((n) => n.id === id);
  const sc = showDef ? 25 : 0;
  const nodeAt = (n: { x: number; y: number; z: number; id: string }) => {
    const d = def(n.id);
    return { x: n.x + (d?.ux ?? 0) * sc, y: n.y + (d?.uy ?? 0) * sc, z: n.z + (d?.uz ?? 0) * sc };
  };

  const xmin = Math.min(...p.gridsX.map((g) => g.coord), 0);
  const xmax = Math.max(...p.gridsX.map((g) => g.coord), 8);
  const ymin = Math.min(...p.gridsY.map((g) => g.coord), 0);
  const ymax = Math.max(...p.gridsY.map((g) => g.coord), 4);
  const pad = 1.2;

  const faces: Face[] = [];
  pushFaces(
    faces,
    slabFaces(
      [
        { x: xmin - pad, y: ymin - pad, z: 0 },
        { x: xmax + pad, y: ymin - pad, z: 0 },
        { x: xmax + pad, y: ymax + pad, z: 0 },
        { x: xmin - pad, y: ymax + pad, z: 0 },
      ],
      0.04
    ),
    PAL.ground.fill,
    PAL.ground.stroke
  );

  for (const s of p.slabs) {
    const pts = s.nodeIds.map((id) => p.nodes.find((n) => n.id === id)).filter((n): n is NonNullable<typeof n> => !!n);
    if (pts.length < 3) continue;
    const sec = p.slabSections.find((x) => x.id === s.sectionId);
    const t = sec?.t ?? 0.15;
    const on = isSelected(sels, "slab", s.id);
    const active = s.storyId === storyId;
    pushFaces(faces, slabFaces(pts.map(nodeAt), t), active || on ? PAL.slab.fill : "#8a7548", on ? "#f0d48a" : PAL.slab.stroke, on);
  }

  for (const wall of p.walls) {
    const a = p.nodes.find((n) => n.id === wall.nI);
    const b = p.nodes.find((n) => n.id === wall.nJ);
    if (!a || !b) continue;
    const st = p.stories.find((x) => x.id === wall.storyId);
    const zTop = a.z;
    const zBot = zTop - (st?.height ?? 2.8);
    const t = p.wallSections.find((x) => x.id === wall.sectionId)?.t ?? 0.2;
    const on = isSelected(sels, "wall", wall.id);
    const A = { x: a.x, y: a.y, z: zBot };
    const B = { x: b.x, y: b.y, z: zBot };
    const C = { x: b.x, y: b.y, z: zTop };
    const D = { x: a.x, y: a.y, z: zTop };
    const dir = norm({ x: b.x - a.x, y: b.y - a.y, z: 0 });
    const nrm = mul({ x: -dir.y, y: dir.x, z: 0 }, t / 2);
    const q = (pt: V3, s: number) => add(pt, mul(nrm, s));
    pushFaces(
      faces,
      [
        [q(A, 1), q(B, 1), q(C, 1), q(D, 1)],
        [q(A, -1), q(D, -1), q(C, -1), q(B, -1)],
        [q(A, 1), q(D, 1), q(D, -1), q(A, -1)],
        [q(B, 1), q(B, -1), q(C, -1), q(C, 1)],
        [q(D, 1), q(C, 1), q(C, -1), q(D, -1)],
        [q(A, 1), q(A, -1), q(B, -1), q(B, 1)],
      ],
      PAL.wall.fill,
      on ? "#f0d48a" : PAL.wall.stroke,
      on
    );
  }

  const colLabels: { x: number; y: number; z: number; text: string }[] = [];

  for (const f of p.frames) {
    if (hiddenFrame(f) || f.kind === "stair") continue;
    const a0 = p.nodes.find((n) => n.id === f.nI);
    const b0 = p.nodes.find((n) => n.id === f.nJ);
    if (!a0 || !b0) continue;
    const a = nodeAt(a0);
    const b = nodeAt(b0);
    const on = isSelected(sels, "frame", f.id);
    const sec = p.frameSections.find((x) => x.id === f.sectionId);
    const pal = f.kind === "column" ? PAL.col : f.kind === "brace" ? PAL.brace : PAL.beam;
    const bw = sec?.b ?? (f.kind === "column" ? 0.3 : 0.25);
    const bh = sec?.h ?? (f.kind === "column" ? 0.3 : 0.5);
    if (showSolid) {
      pushFaces(faces, prismFaces(a, b, bw, bh, f.angle), pal.fill, on ? "#f0d48a" : pal.stroke, on);
      if (f.kind === "column" && (f.storyId === storyId || storyId === "BASE")) {
        const L = len(sub(b, a));
        const V = sec?.kind === "circ" ? Math.PI * (bw / 2) ** 2 * L : bw * bh * L;
        colLabels.push({
          x: (a.x + b.x) / 2,
          y: (a.y + b.y) / 2,
          z: (a.z + b.z) / 2,
          text: `${(bw * 100).toFixed(0)}×${(bh * 100).toFixed(0)}  V=${V.toFixed(2)} m³`,
        });
      }
    }
  }

  for (const st of p.stairs) {
    const a0 = p.nodes.find((n) => n.id === st.nI);
    const b0 = p.nodes.find((n) => n.id === st.nJ);
    if (!a0 || !b0) continue;
    if (showSolid) pushFaces(faces, prismFaces(nodeAt(a0), nodeAt(b0), st.width, st.t || 0.15), PAL.stair.fill, PAL.stair.stroke);
  }

  for (const s of p.supports) {
    const n = p.nodes.find((x) => x.id === s.nodeId);
    if (!n) continue;
    const pal = s.kind === "empotrado" ? PAL.footE : PAL.footM;
    const x = n.x;
    const y = n.y;
    pushFaces(faces, prismFaces({ x, y, z: -0.22 }, { x, y, z: 0 }, 0.55, 0.55), pal.fill, pal.stroke);
  }

  const light = norm({ x: 0.35, y: 0.55, z: 0.76 });
  const ranked = faces
    .map((face) => {
      const qs = face.pts.map((q) => P(q.x, q.y, q.z));
      const z = qs.reduce((acc, q) => acc + q.z, 0) / qs.length;
      const nrm = face.pts.length >= 3 ? norm(cross(sub(face.pts[1], face.pts[0]), sub(face.pts[2], face.pts[0]))) : { x: 0, y: 0, z: 1 };
      const k = 0.42 + 0.58 * Math.max(0, Math.abs(dot(nrm, light)));
      const alpha = face.fill === PAL.slab.fill || face.fill === "#8a7548" ? 0.38 : face.fill === PAL.ground.fill ? 0.88 : 1;
      return { face, qs, z, fill: shade(face.fill, k, alpha), stroke: face.sel ? "#f0d48a" : face.stroke };
    })
    .sort((a, b) => b.z - a.z);

  if (showSolid) {
    for (const item of ranked) {
      if (item.qs.length < 3) continue;
      ctx.beginPath();
      item.qs.forEach((q, i) => (i === 0 ? ctx.moveTo(q.x, q.y) : ctx.lineTo(q.x, q.y)));
      ctx.closePath();
      ctx.fillStyle = item.fill;
      ctx.fill();
      ctx.strokeStyle = item.stroke;
      ctx.lineWidth = item.face.sel ? 2.2 : 0.8;
      ctx.stroke();
    }
    for (const lab of colLabels) {
      const q = P(lab.x, lab.y, lab.z);
      ctx.font = "600 10px IBM Plex Sans";
      const tw = ctx.measureText(lab.text).width;
      ctx.fillStyle = "rgba(11,31,51,0.72)";
      ctx.fillRect(q.x - tw / 2 - 4, q.y - 12, tw + 8, 16);
      ctx.fillStyle = "#f4ead4";
      ctx.textAlign = "center";
      ctx.fillText(lab.text, q.x, q.y);
      ctx.textAlign = "start";
    }
  } else {
    for (const gx of p.gridsX) {
      const a = P(gx.coord, ymin, 0);
      const b = P(gx.coord, ymax, 0);
      ctx.strokeStyle = "rgba(196,160,86,0.28)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    for (const gy of p.gridsY) {
      const a = P(xmin, gy.coord, 0);
      const b = P(xmax, gy.coord, 0);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    const segs: { z: number; draw: () => void }[] = [];
    for (const s of p.slabs) {
      const pts = s.nodeIds.map((id) => p.nodes.find((n) => n.id === id)).filter((n): n is NonNullable<typeof n> => !!n);
      if (pts.length < 3) continue;
      const qs = pts.map((n) => P(nodeAt(n).x, nodeAt(n).y, nodeAt(n).z));
      const on = isSelected(sels, "slab", s.id);
      const z = qs.reduce((acc, q) => acc + q.z, 0) / qs.length;
      segs.push({
        z,
        draw: () => {
          ctx.beginPath();
          qs.forEach((q, i) => (i === 0 ? ctx.moveTo(q.x, q.y) : ctx.lineTo(q.x, q.y)));
          ctx.closePath();
          ctx.fillStyle = on ? "rgba(240,212,138,0.32)" : "rgba(196,168,96,0.22)";
          ctx.fill();
          ctx.strokeStyle = on ? "#f0d48a" : PAL.slab.stroke;
          ctx.lineWidth = on ? 2.2 : 1.4;
          ctx.stroke();
        },
      });
    }
    for (const f of p.frames) {
      if (hiddenFrame(f)) continue;
      const a = p.nodes.find((n) => n.id === f.nI);
      const b = p.nodes.find((n) => n.id === f.nJ);
      if (!a || !b) continue;
      const pa = P(nodeAt(a).x, nodeAt(a).y, nodeAt(a).z);
      const pb = P(nodeAt(b).x, nodeAt(b).y, nodeAt(b).z);
      const on = isSelected(sels, "frame", f.id);
      const pal = f.kind === "column" ? PAL.col : f.kind === "stair" ? PAL.stair : f.kind === "brace" ? PAL.brace : f.kind === "pierStrip" ? PAL.wall : PAL.beam;
      segs.push({
        z: (pa.z + pb.z) / 2,
        draw: () => {
          ctx.strokeStyle = on ? "#f0d48a" : pal.fill;
          ctx.lineWidth = f.kind === "column" ? 5 : 2.6;
          ctx.beginPath();
          ctx.moveTo(pa.x, pa.y);
          ctx.lineTo(pb.x, pb.y);
          ctx.stroke();
        },
      });
    }
    for (const wall of p.walls) {
      const a = p.nodes.find((n) => n.id === wall.nI);
      const b = p.nodes.find((n) => n.id === wall.nJ);
      if (!a || !b) continue;
      const pa = P(a.x, a.y, a.z);
      const pb = P(b.x, b.y, b.z);
      segs.push({
        z: (pa.z + pb.z) / 2,
        draw: () => {
          ctx.strokeStyle = PAL.wall.fill;
          ctx.lineWidth = 7;
          ctx.beginPath();
          ctx.moveTo(pa.x, pa.y);
          ctx.lineTo(pb.x, pb.y);
          ctx.stroke();
        },
      });
    }
    segs.sort((a, b) => b.z - a.z);
    for (const s of segs) s.draw();
    for (const s of p.supports) {
      const n = p.nodes.find((x) => x.id === s.nodeId);
      if (!n) continue;
      const q = P(n.x, n.y, 0);
      ctx.fillStyle = s.kind === "empotrado" ? PAL.footE.fill : PAL.footM.fill;
      ctx.beginPath();
      ctx.moveTo(q.x, q.y);
      ctx.lineTo(q.x - 8, q.y + 13);
      ctx.lineTo(q.x + 8, q.y + 13);
      ctx.closePath();
      ctx.fill();
    }
  }

  drawHud(ctx, w, h, showSolid, navMode);
}

function drawHud(ctx: CanvasRenderingContext2D, w: number, h: number, showSolid: boolean, navMode: NavMode) {
  ctx.fillStyle = "rgba(11,31,51,0.55)";
  ctx.fillRect(10, 8, Math.min(560, w - 20), 28);
  ctx.fillStyle = "#e8dcc6";
  ctx.font = "12px IBM Plex Sans";
  const modeHint =
    navMode === "select"
      ? "seleccionar · arrastre: ventana (→ contenido, ← cruce) · clic: sumar/quitar · Esc: limpiar"
      : navMode === "orbit"
        ? "modo órbita · arrastre: girar · clic der.: pan · rueda: zoom"
        : "modo pan · arrastre: desplazar · rueda: zoom";
  ctx.fillText(
    `${showSolid ? "3D sólido" : "3D alambre"} · ${modeHint}`,
    18,
    27
  );

  const items = [
    { c: PAL.col.fill, t: "Columna" },
    { c: PAL.beam.fill, t: "Viga" },
    { c: PAL.wall.fill, t: "Muro" },
    { c: PAL.slab.fill, t: "Losa" },
    { c: PAL.stair.fill, t: "Escalera" },
    { c: PAL.footM.fill, t: "Apoyo z=0" },
  ];
  const lw = 16 + items.reduce((acc, it) => acc + 18 + ctx.measureText(it.t).width, 0) + items.length * 14;
  ctx.fillStyle = "rgba(11,31,51,0.62)";
  ctx.fillRect(12, h - 36, Math.min(lw, w - 24), 24);
  let x = 20;
  ctx.font = "11px IBM Plex Sans";
  for (const it of items) {
    ctx.fillStyle = it.c;
    ctx.fillRect(x, h - 28, 10, 10);
    ctx.fillStyle = "#e8dcc6";
    ctx.fillText(it.t, x + 14, h - 19);
    x += 18 + ctx.measureText(it.t).width + 12;
  }

  const nx = w - 42;
  const ny = 52;
  ctx.fillStyle = "rgba(11,31,51,0.55)";
  ctx.beginPath();
  ctx.arc(nx, ny, 22, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#c4a056";
  ctx.beginPath();
  ctx.moveTo(nx, ny - 16);
  ctx.lineTo(nx + 6, ny + 4);
  ctx.lineTo(nx, ny);
  ctx.lineTo(nx - 6, ny + 4);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#e8dcc6";
  ctx.font = "700 10px IBM Plex Sans";
  ctx.textAlign = "center";
  ctx.fillText("N", nx, ny + 16);
  ctx.textAlign = "start";
}

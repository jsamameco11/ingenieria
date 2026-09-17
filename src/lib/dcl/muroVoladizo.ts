/** Motor de diagrama de cuerpo libre 2D — muro en voladizo (elevación, franja 1.00 m). */

export type DclMuroModel = {
  H: number;
  Hs: number;
  D: number;
  A: number;
  C: number;
  F: number;
  Bp: number;
  esp: number;
  B: number;
  beta: number;
  hSat: number;
  hCuna: number;
  Pa: number;
  Pw: number;
  Pq: number;
  dPae: number;
  PaV: number;
  PIR: number;
  Wtot: number;
  Walma: number;
  Wbase: number;
  Wrelleno: number;
  Wpunta: number;
  xBar: number;
  qToe: number;
  qHeel: number;
  yPa: number;
  yPw: number;
  yPae: number;
  yW: number;
  Ka: number;
  FSd: number;
  FSv: number;
  hk: number;
  bk: number;
};

function nv(v: Record<string, string>, k: string, fb = 0) {
  const x = Number(String(v[k] ?? "").replace(",", "."));
  return Number.isFinite(x) ? x : fb;
}

export function modeloDclMuro(values: Record<string, string>): DclMuroModel {
  const H = Math.max(0.8, nv(values, "H", 4));
  const D = Math.max(0.15, nv(values, "D", 0.8));
  const A = Math.max(0.25, nv(values, "A", 2));
  const C = Math.max(0.25, nv(values, "C", 1.2));
  const F = Math.max(0.2, nv(values, "F", 0.4));
  const Bp = Math.min(F, Math.max(0.12, nv(values, "Bp", 0.2)));
  const esp = Math.max(0.15, nv(values, "esp", 0.4));
  const B = nv(values, "B", A + C + F);
  const Hs = nv(values, "Hs", Math.max(0.05, H - esp));
  return {
    H,
    Hs,
    D,
    A,
    C,
    F,
    Bp,
    esp,
    B: B > 0.4 ? B : A + C + F,
    beta: nv(values, "beta", 10),
    hSat: Math.max(0, nv(values, "hSat", 2)),
    hCuna: nv(values, "hCuna", 0),
    Pa: nv(values, "Pa"),
    Pw: nv(values, "Pw"),
    Pq: nv(values, "Pq"),
    dPae: nv(values, "dPae"),
    PaV: nv(values, "PaV"),
    PIR: nv(values, "PIR"),
    Wtot: nv(values, "Wtot"),
    Walma: nv(values, "Walma"),
    Wbase: nv(values, "Wbase"),
    Wrelleno: nv(values, "Wrelleno"),
    Wpunta: nv(values, "Wpunta"),
    xBar: nv(values, "xBar", (A + C + F) / 2),
    qToe: nv(values, "qToe"),
    qHeel: nv(values, "qHeel"),
    yPa: nv(values, "yPa", H / 3),
    yPw: nv(values, "yPw", nv(values, "hSat", 2) / 3),
    yPae: nv(values, "yPae", 0.6 * H),
    yW: nv(values, "yW", H / 2),
    Ka: nv(values, "Ka"),
    FSd: nv(values, "FSd"),
    FSv: nv(values, "FSv"),
    hk: Math.max(0, nv(values, "hk", 0)),
    bk: Math.max(0, nv(values, "bk", nv(values, "F", 0.4))),
  };
}

export function zeros(n: number, m = n) {
  return Array.from({ length: n }, () => new Float64Array(m));
}

export function vec(n: number) {
  return new Float64Array(n);
}

export function clamp(x: number, a: number, b: number) {
  return Math.max(a, Math.min(b, x));
}

export function hypot3(x: number, y: number, z: number) {
  return Math.hypot(x, y, z);
}

export function norm3(x: number, y: number, z: number) {
  const L = hypot3(x, y, z);
  return L < 1e-12 ? { x: 0, y: 0, z: 0, L: 0 } : { x: x / L, y: y / L, z: z / L, L };
}

export function cross(ax: number, ay: number, az: number, bx: number, by: number, bz: number) {
  return { x: ay * bz - az * by, y: az * bx - ax * bz, z: ax * by - ay * bx };
}

export function addMat(A: Float64Array[], B: Float64Array[], s = 1) {
  for (let i = 0; i < A.length; i++) {
    for (let j = 0; j < A[i].length; j++) A[i][j] += s * B[i][j];
  }
}

/** Gauss-Jordan con pivoteo parcial. Resuelve A x = b. A se destruye. */
export function solveDense(A: Float64Array[], b: Float64Array): Float64Array | null {
  const n = b.length;
  if (n === 0) return vec(0);
  const M = A.map((row, i) => {
    const r = new Float64Array(n + 1);
    r.set(row);
    r[n] = b[i];
    return r;
  });
  for (let k = 0; k < n; k++) {
    let piv = k;
    let best = Math.abs(M[k][k]);
    for (let i = k + 1; i < n; i++) {
      const v = Math.abs(M[i][k]);
      if (v > best) {
        best = v;
        piv = i;
      }
    }
    if (best < 1e-14) return null;
    if (piv !== k) {
      const tmp = M[k];
      M[k] = M[piv];
      M[piv] = tmp;
    }
    const akk = M[k][k];
    for (let j = k; j <= n; j++) M[k][j] /= akk;
    for (let i = 0; i < n; i++) {
      if (i === k) continue;
      const f = M[i][k];
      if (Math.abs(f) < 1e-18) continue;
      for (let j = k; j <= n; j++) M[i][j] -= f * M[k][j];
    }
  }
  const x = vec(n);
  for (let i = 0; i < n; i++) x[i] = M[i][n];
  return x;
}

export function mul12(A: number[][], u: number[]) {
  const r = new Array(12).fill(0);
  for (let i = 0; i < 12; i++) {
    let s = 0;
    for (let j = 0; j < 12; j++) s += A[i][j] * u[j];
    r[i] = s;
  }
  return r;
}

export function mat12() {
  return Array.from({ length: 12 }, () => new Array(12).fill(0));
}

export function add12(K: number[][], a: number, b: number, v: number) {
  K[a][b] += v;
  if (a !== b) K[b][a] += v;
}

export function rotateLocalAxes(ex: { x: number; y: number; z: number }, angle: number) {
  const up = Math.abs(ex.z) < 0.99 ? { x: 0, y: 0, z: 1 } : { x: 1, y: 0, z: 0 };
  let y = cross(up.x, up.y, up.z, ex.x, ex.y, ex.z);
  let yn = norm3(y.x, y.y, y.z);
  if (yn.L < 1e-12) {
    y = cross(1, 0, 0, ex.x, ex.y, ex.z);
    yn = norm3(y.x, y.y, y.z);
  }
  let ey = { x: yn.x, y: yn.y, z: yn.z };
  let ez = cross(ex.x, ex.y, ex.z, ey.x, ey.y, ey.z);
  const ezN = norm3(ez.x, ez.y, ez.z);
  ez = { x: ezN.x, y: ezN.y, z: ezN.z };
  if (Math.abs(angle) > 1e-12) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const ey2 = {
      x: c * ey.x + s * ez.x,
      y: c * ey.y + s * ez.y,
      z: c * ey.z + s * ez.z,
    };
    ez = cross(ex.x, ex.y, ex.z, ey2.x, ey2.y, ey2.z);
    const ez2 = norm3(ez.x, ez.y, ez.z);
    ey = ey2;
    ez = { x: ez2.x, y: ez2.y, z: ez2.z };
  }
  return { ex, ey, ez };
}

export function R3(ex: { x: number; y: number; z: number }, ey: { x: number; y: number; z: number }, ez: { x: number; y: number; z: number }) {
  return [
    [ex.x, ey.x, ez.x],
    [ex.y, ey.y, ez.y],
    [ex.z, ey.z, ez.z],
  ];
}

export function nextId(prefix: string, used: string[]) {
  let n = 1;
  while (used.includes(`${prefix}${n}`)) n++;
  return `${prefix}${n}`;
}

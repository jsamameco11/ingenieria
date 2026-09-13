/**
 * Solver genérico del método de Cross (distribución de momentos) para una viga continua
 * de N tramos con extremos lejanos empotrados. Usado tanto por el motor de cálculo
 * (memoria, tabla de Cross) como por el croquis 2D, para que ambos muestren siempre
 * los mismos números.
 *
 * Convención de signos: los FEM y los momentos de extremo se suman algebraicamente en
 * cada nudo (como en la hoja Excel de origen). El momento desequilibrado de un nudo es
 * U = -ΣM(extremos que llegan al nudo); se reparte proporcional a DF=k/Σk y la mitad del
 * reparto se transporta (carry-over) al extremo lejano del mismo tramo. Los nudos
 * extremos (1 y N+1) están empotrados: reciben transporte pero no se equilibran.
 */

export type CrossSpan = { L: number; I: number; femL: number; femR: number };

export type CrossMemberDF = { span: number; end: "L" | "R"; k: number; df: number };
export type CrossJoint = { joint: number; members: CrossMemberDF[] };

export type CrossCycle = {
  n: number;
  /** incremento repartido en este ciclo, por clave `${span}${end}` */
  distribute: Record<string, number>;
  /** transporte (carry-over) aplicado en este ciclo, por clave `${span}${end}` */
  carry: Record<string, number>;
  /** momento acumulado en cada extremo tras aplicar este ciclo */
  after: { L: number; R: number }[];
  maxDelta: number;
};

export type CrossResult = {
  nSpans: number;
  spans: CrossSpan[];
  k: number[];
  joints: CrossJoint[];
  cycles: CrossCycle[];
  /** momento final en cada extremo de cada tramo */
  final: { L: number; R: number }[];
  /** verificación de equilibrio ΣM en cada nudo interior */
  jointCheck: { joint: number; sum: number }[];
};

function key(span: number, end: "L" | "R") {
  return `${span}${end}`;
}

export function solveCross(spans: CrossSpan[], opts?: { maxCycles?: number; tol?: number }): CrossResult {
  const nSpans = spans.length;
  const maxCycles = opts?.maxCycles ?? 8;
  const tol = opts?.tol ?? 0.005;
  const k = spans.map((s) => (s.L > 0 ? s.I / s.L : 0));

  const joints: CrossJoint[] = [];
  for (let j = 2; j <= nSpans; j++) {
    const left = { span: j - 1, end: "R" as const, k: k[j - 2] };
    const right = { span: j, end: "L" as const, k: k[j - 1] };
    const sumK = left.k + right.k || 1;
    joints.push({
      joint: j,
      members: [
        { ...left, df: left.k / sumK },
        { ...right, df: right.k / sumK },
      ],
    });
  }

  // Estado vivo de momentos por extremo de tramo.
  const M = spans.map((s) => ({ L: s.femL, R: s.femR }));
  const cycles: CrossCycle[] = [];

  for (let c = 1; c <= maxCycles; c++) {
    const distribute: Record<string, number> = {};
    const carry: Record<string, number> = {};
    let maxDelta = 0;

    for (const jt of joints) {
      const unbalanced = -jt.members.reduce((sum, m) => sum + M[m.span - 1][m.end], 0);
      for (const m of jt.members) {
        const inc = m.df * unbalanced;
        distribute[key(m.span, m.end)] = (distribute[key(m.span, m.end)] ?? 0) + inc;
        maxDelta = Math.max(maxDelta, Math.abs(inc));
        const farEnd = m.end === "L" ? "R" : "L";
        carry[key(m.span, farEnd)] = (carry[key(m.span, farEnd)] ?? 0) + inc / 2;
      }
    }

    for (const k2 in distribute) {
      const span = Number(k2.slice(0, -1));
      const end = k2.slice(-1) as "L" | "R";
      M[span - 1][end] += distribute[k2];
    }
    for (const k2 in carry) {
      const span = Number(k2.slice(0, -1));
      const end = k2.slice(-1) as "L" | "R";
      M[span - 1][end] += carry[k2];
    }

    cycles.push({ n: c, distribute, carry, after: M.map((x) => ({ ...x })), maxDelta });
    if (maxDelta < tol) break;
  }

  const jointCheck = joints.map((jt) => ({
    joint: jt.joint,
    sum: jt.members.reduce((sum, m) => sum + M[m.span - 1][m.end], 0),
  }));

  return { nSpans, spans, k, joints, cycles, final: M, jointCheck };
}

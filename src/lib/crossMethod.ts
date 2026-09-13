/**
 * Solver genérico del método de Cross (distribución de momentos), sobre un grafo arbitrario de
 * nudos y barras (vigas y columnas). Úsalo para cualquier topología: viga continua (cadena lineal
 * de nudos) o pórtico de varios niveles y nudos (grilla de vigas y columnas). El motor de cálculo
 * (memoria, tabla de Cross) y el croquis 2D consumen el mismo resultado, para que ambos muestren
 * siempre los mismos números.
 *
 * Convención de signos: los FEM y los momentos de extremo se suman algebraicamente en cada nudo
 * (como en la hoja Excel de origen). El momento desequilibrado de un nudo es U=-ΣM(extremos que
 * llegan al nudo); se reparte proporcional a DF=k/Σk entre las barras que concurren a ese nudo, y
 * la mitad del reparto se transporta (carry-over) al extremo lejano de la MISMA barra. Los nudos
 * marcados como empotrados (apoyos) reciben transporte pero no se equilibran (no reparten).
 *
 * Nota de alcance: este solver NO incluye la corrección por desplazamiento lateral (sway) de
 * pórticos no arriostrados — resuelve pórticos donde los nudos no se trasladan lateralmente entre
 * sí (cargas de gravedad sobre las vigas, columnas sin carga transversal propia).
 */

export type FrameMember = {
  id: string;
  jointA: number;
  jointB: number;
  L: number;
  I: number;
  femA: number;
  femB: number;
};

export type FrameJointDef = { id: number; fixed: boolean };

export type FrameMemberEndDF = { memberId: string; end: "A" | "B"; k: number; df: number };
export type FrameJointDF = { joint: number; members: FrameMemberEndDF[] };

export type FrameCycle = {
  n: number;
  /** incremento repartido en este ciclo, por clave `${memberId}#${end}` */
  distribute: Record<string, number>;
  /** transporte (carry-over) aplicado en este ciclo, por clave `${memberId}#${end}` */
  carry: Record<string, number>;
  maxDelta: number;
};

export type FrameResult = {
  members: FrameMember[];
  joints: FrameJointDef[];
  k: Record<string, number>;
  jointDF: FrameJointDF[];
  cycles: FrameCycle[];
  /** momento final en cada extremo de cada barra, por id de barra */
  final: Record<string, { A: number; B: number }>;
  /** verificación de equilibrio ΣM en cada nudo libre */
  jointCheck: { joint: number; sum: number }[];
};

function endKey(memberId: string, end: "A" | "B") {
  return `${memberId}#${end}`;
}

export function solveCrossFrame(
  members: FrameMember[],
  joints: FrameJointDef[],
  opts?: { maxCycles?: number; tol?: number }
): FrameResult {
  const maxCycles = opts?.maxCycles ?? 10;
  const tol = opts?.tol ?? 0.005;

  const k: Record<string, number> = {};
  members.forEach((m) => {
    k[m.id] = m.L > 0 ? m.I / m.L : 0;
  });

  const membersAt = new Map<number, { memberId: string; end: "A" | "B"; k: number }[]>();
  members.forEach((m) => {
    if (!membersAt.has(m.jointA)) membersAt.set(m.jointA, []);
    if (!membersAt.has(m.jointB)) membersAt.set(m.jointB, []);
    membersAt.get(m.jointA)!.push({ memberId: m.id, end: "A", k: k[m.id] });
    membersAt.get(m.jointB)!.push({ memberId: m.id, end: "B", k: k[m.id] });
  });

  const jointDF: FrameJointDF[] = [];
  for (const jt of joints) {
    if (jt.fixed) continue;
    const ms = membersAt.get(jt.id) ?? [];
    const sumK = ms.reduce((s, m) => s + m.k, 0) || 1;
    jointDF.push({
      joint: jt.id,
      members: ms.map((m) => ({ memberId: m.memberId, end: m.end, k: m.k, df: m.k / sumK })),
    });
  }

  // Estado vivo de momentos por extremo de barra.
  const M = new Map<string, { A: number; B: number }>();
  members.forEach((m) => M.set(m.id, { A: m.femA, B: m.femB }));

  const cycles: FrameCycle[] = [];
  for (let c = 1; c <= maxCycles; c++) {
    const distribute: Record<string, number> = {};
    const carry: Record<string, number> = {};
    let maxDelta = 0;

    for (const jt of jointDF) {
      const unbalanced = -jt.members.reduce((sum, m) => sum + M.get(m.memberId)![m.end], 0);
      for (const m of jt.members) {
        const inc = m.df * unbalanced;
        distribute[endKey(m.memberId, m.end)] = (distribute[endKey(m.memberId, m.end)] ?? 0) + inc;
        maxDelta = Math.max(maxDelta, Math.abs(inc));
        const farEnd = m.end === "A" ? "B" : "A";
        carry[endKey(m.memberId, farEnd)] = (carry[endKey(m.memberId, farEnd)] ?? 0) + inc / 2;
      }
    }

    for (const key2 in distribute) {
      const [memberId, end] = key2.split("#") as [string, "A" | "B"];
      M.get(memberId)![end] += distribute[key2];
    }
    for (const key2 in carry) {
      const [memberId, end] = key2.split("#") as [string, "A" | "B"];
      M.get(memberId)![end] += carry[key2];
    }

    cycles.push({ n: c, distribute, carry, maxDelta });
    if (maxDelta < tol) break;
  }

  const final: Record<string, { A: number; B: number }> = {};
  M.forEach((v, id) => (final[id] = { ...v }));

  const jointCheck = jointDF.map((jt) => ({
    joint: jt.joint,
    sum: jt.members.reduce((sum, m) => sum + M.get(m.memberId)![m.end], 0),
  }));

  return { members, joints, k, jointDF, cycles, final, jointCheck };
}

/* ---------------------------------------------------------------------- *
 * Viga continua — caso particular de la grilla: una cadena lineal de     *
 * nudos, con los dos extremos empotrados. Se mantiene esta forma de      *
 * entrada/salida (spans indexados) para no romper el motor y el croquis  *
 * de "Distribución de momentos (Cross)" ya existentes.                   *
 * ---------------------------------------------------------------------- */

export type CrossSpan = { L: number; I: number; femL: number; femR: number };
export type CrossMemberDF = { span: number; end: "L" | "R"; k: number; df: number };
export type CrossJoint = { joint: number; members: CrossMemberDF[] };
export type CrossCycle = {
  n: number;
  distribute: Record<string, number>;
  carry: Record<string, number>;
  maxDelta: number;
};
export type CrossResult = {
  nSpans: number;
  spans: CrossSpan[];
  k: number[];
  joints: CrossJoint[];
  cycles: CrossCycle[];
  final: { L: number; R: number }[];
  jointCheck: { joint: number; sum: number }[];
};

export function solveCross(spans: CrossSpan[], opts?: { maxCycles?: number; tol?: number }): CrossResult {
  const nSpans = spans.length;
  const members: FrameMember[] = spans.map((s, idx) => ({
    id: String(idx + 1),
    jointA: idx + 1,
    jointB: idx + 2,
    L: s.L,
    I: s.I,
    femA: s.femL,
    femB: s.femR,
  }));
  const joints: FrameJointDef[] = [];
  for (let j = 1; j <= nSpans + 1; j++) joints.push({ id: j, fixed: j === 1 || j === nSpans + 1 });

  const res = solveCrossFrame(members, joints, opts);

  const k = spans.map((s) => (s.L > 0 ? s.I / s.L : 0));
  const joints2: CrossJoint[] = res.jointDF.map((jt) => ({
    joint: jt.joint,
    members: jt.members.map((m) => ({
      span: Number(m.memberId),
      end: m.end === "A" ? "L" : "R",
      k: m.k,
      df: m.df,
    })),
  }));
  const cycles: CrossCycle[] = res.cycles.map((cy) => {
    const remap = (rec: Record<string, number>) => {
      const out: Record<string, number> = {};
      for (const key2 in rec) {
        const [memberId, end] = key2.split("#");
        out[`${memberId}${end === "A" ? "L" : "R"}`] = rec[key2];
      }
      return out;
    };
    return { n: cy.n, distribute: remap(cy.distribute), carry: remap(cy.carry), maxDelta: cy.maxDelta };
  });
  const final: { L: number; R: number }[] = spans.map((_, idx) => {
    const f = res.final[String(idx + 1)];
    return { L: f.A, R: f.B };
  });
  const jointCheck = res.jointCheck;

  return { nSpans, spans, k, joints: joints2, cycles, final, jointCheck };
}

export type HeadlossMethod = "hazen-williams" | "darcy-weisbach" | "manning";
export type NodeKind = "junction" | "reservoir" | "tank" | "hydrant";
export type ValveKind = "prv" | "psv" | "fcv" | "tcv" | "check" | "iso";
export type AlertLevel = "OK" | "WARNING" | "CRITICAL" | "ERROR";
export type RdapScenario = "qp" | "qmd" | "qmh" | "incendio" | "custom";

export type DesignCriteria = {
  id: string;
  name: string;
  norma: string;
  pMinMca: number;
  pMaxMca: number;
  vMinMs: number;
  vMaxMs: number;
  hfMaxMkm: number;
  dnMinMm: number;
  dnMaxMm: number;
};

export type SolverOptions = {
  maxIter: number;
  tolHeadM: number;
  tolFlowM3s: number;
};

export type RdapNode = {
  id: string;
  name: string;
  kind: NodeKind;
  x: number;
  y: number;
  ground: number;
  cover: number | null;
  invert: number | null;
  depthManual: number | null;
  demandLs: number;
  patternId: string;
  description: string;
  reservoirHgl: number | null;
  tankBottom: number | null;
  tankMin: number | null;
  tankMax: number | null;
  tankDiameter: number | null;
  tankLevel: number | null;
};

export type RdapPipe = {
  id: string;
  name: string;
  start: string;
  end: string;
  lengthM: number | null;
  use3d: boolean;
  dnMm: number;
  idMm: number | null;
  materialId: string;
  cHw: number | null;
  roughnessMm: number | null;
  manningN: number | null;
  minorK: number;
  status: "open" | "closed";
};

export type RdapPump = {
  id: string;
  name: string;
  start: string;
  end: string;
  curve: { qLs: number; hM: number }[];
  status: "on" | "off";
};

export type ValveCommand = "auto" | "open" | "closed";
export type ValveMode = "ACTIVE" | "OPEN" | "CLOSED";

export type RdapValve = {
  id: string;
  name: string;
  start: string;
  end: string;
  kind: ValveKind;
  setting: number;
  dnMm: number;
  status: ValveCommand;
};

export type RdapPattern = {
  id: string;
  name: string;
  multipliers: number[];
};

export type RdapMaterial = {
  id: string;
  name: string;
  cHw: number;
  roughnessMm: number;
  manningN: number;
  pnBar: number;
  norma: string;
  sizes: { dnMm: number; odMm: number; thkMm: number; idMm: number }[];
};

export type RdapMeta = {
  proyecto: string;
  cliente: string;
  ubicacion: string;
  profesional: string;
  revisor: string;
  fecha: string;
  version: string;
  datum: string;
  utmZone: string;
  units: "m";
  alcance: string;
  tipoSistema: "gravedad" | "bombeo" | "mixto";
  tipoRed: "rural" | "urbano" | "condominial" | "industrial";
  notas: string;
};

export type QualityOptions = {
  sourceClMgL: number;
  kbPerDay: number;
  clMinMgL: number;
  clMaxMgL: number;
  ageMaxH: number;
};

export type HammerOptions = {
  tCloseS: number;
};

export type RdapProject = {
  meta: RdapMeta;
  method: HeadlossMethod;
  viscosityM2s: number;
  solver: SolverOptions;
  criteria: DesignCriteria;
  quality: QualityOptions;
  hammer: HammerOptions;
  qmdFactor: number;
  qmhFactor: number;
  fireNodeId: string;
  fireLs: number;
  nodes: RdapNode[];
  pipes: RdapPipe[];
  pumps: RdapPump[];
  valves: RdapValve[];
  patterns: RdapPattern[];
  topoPoints: { id: string; x: number; y: number; z: number; desc: string }[];
};

export type NodeResult = {
  id: string;
  demandLs: number;
  hgl: number;
  pressureMca: number;
  status: AlertLevel;
  note: string;
};

export type PipeResult = {
  id: string;
  qLs: number;
  velocity: number;
  hf: number;
  hfMkm: number;
  direction: "start-end" | "end-start" | "null";
  status: AlertLevel;
  note: string;
};

export type Convergence = {
  ok: boolean;
  iterations: number;
  maxContErrLs: number;
  maxHeadErrM: number;
  toleranceHead: number;
  toleranceFlow: number;
  message: string;
  causes: string[];
};

export type ValidationIssue = {
  code: string;
  level: "ERROR" | "WARNING";
  message: string;
};

export type RunResult = {
  method: HeadlossMethod;
  methodLabel: string;
  g: number;
  viscosityM2s: number;
  convergence: Convergence;
  nodes: NodeResult[];
  pipes: PipeResult[];
  pumps: { id: string; qLs: number; headM: number }[];
  valves: { id: string; qLs: number; headlossM: number; mode: ValveMode; setting: number; note: string }[];
  alerts: ValidationIssue[];
  dashboard: {
    nNodes: number;
    nPipes: number;
    nRes: number;
    nTanks: number;
    nPumps: number;
    nValves: number;
    critical: number;
    warnings: number;
    pMin: number;
    pMax: number;
    vMax: number;
    hfMax: number;
    demandLs: number;
    sourceLs: number;
    balanceLs: number;
    ageMaxH: number;
    clMin: number;
    hammerMaxM: number;
  };
  quality: {
    nodes: { id: string; ageH: number; clMgL: number; status: AlertLevel; note: string }[];
    pipes: { id: string; travelMin: number; clOut: number }[];
  };
  hammer: {
    pipes: {
      id: string;
      aMs: number;
      tCritS: number;
      dHM: number;
      method: "joukowsky" | "michaud";
      pStatMca: number;
      pTransMca: number;
      pnMca: number;
      ok: boolean;
      note: string;
    }[];
    worstId: string;
    maxDH: number;
  };
  prvAudit: ValidationIssue[];
  scale: number;
  hour: number | null;
  scenario: RdapScenario;
  fire: boolean;
};

export type EpsStep = {
  hour: number;
  multiplier: number;
  result: RunResult;
};

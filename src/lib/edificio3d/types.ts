/** Unidades internas: m, t, t·m, t/m². f'c y E de material se ingresan en kg/cm². */

export const MAX_STORIES = 12;

export type Vec3 = { x: number; y: number; z: number };

export type SupportKind = "movil" | "empotrado" | "nudo" | "rodilloX" | "rodilloY" | "rodilloZ";

export type SlabKind = "membrane" | "shellThin" | "shellThick";

export type DiaphragmKind = "rigido" | "flexible";

export type FrameKind = "column" | "beam" | "brace" | "stair" | "pierStrip";

export type LoadKind =
  | "puntual"
  | "lineal"
  | "triangular"
  | "trapezoidal"
  | "area"
  | "asimetrico";

export type LoadDir = "GX" | "GY" | "GZ" | "LX" | "LY" | "LZ";

export type Material = {
  id: string;
  name: string;
  fc: number;
  E: number;
  nu: number;
  gamma: number;
  fy: number;
};

export type FrameSection = {
  id: string;
  name: string;
  kind: "rect" | "circ";
  b: number;
  h: number;
  materialId: string;
};

export type WallSection = {
  id: string;
  name: string;
  t: number;
  materialId: string;
};

export type SlabSection = {
  id: string;
  name: string;
  t: number;
  kind: SlabKind;
  materialId: string;
};

export type Story = {
  id: string;
  name: string;
  height: number;
  elevation: number;
  diaphragm: DiaphragmKind;
};

export type GridLine = {
  id: string;
  name: string;
  axis: "X" | "Y";
  coord: number;
};

export type Node = {
  id: string;
  x: number;
  y: number;
  z: number;
  storyId: string;
  label?: string;
  reference?: boolean;
};

export type Release = {
  i: { P?: boolean; V2?: boolean; V3?: boolean; T?: boolean; M2?: boolean; M3?: boolean };
  j: { P?: boolean; V2?: boolean; V3?: boolean; T?: boolean; M2?: boolean; M3?: boolean };
};

export type EndOffset = { i: number; j: number };

export type Frame = {
  id: string;
  kind: FrameKind;
  nI: string;
  nJ: string;
  sectionId: string;
  storyId: string;
  angle: number;
  release: Release;
  offset: EndOffset;
  pierId?: string;
  label?: string;
};

export type Wall = {
  id: string;
  nI: string;
  nJ: string;
  storyId: string;
  sectionId: string;
  pierId: string;
  nDiv: number;
  label?: string;
};

export type Slab = {
  id: string;
  nodeIds: string[];
  storyId: string;
  sectionId: string;
  diaphragm: DiaphragmKind;
  label?: string;
};

export type StairKind = "recta" | "ele" | "u" | "caracol" | "tresTramos";

export type Stair = {
  id: string;
  kind: StairKind;
  nI: string;
  nJ: string;
  storyFrom: string;
  storyTo: string;
  width: number;
  t: number;
  sectionId: string;
  materialId: string;
  label?: string;
};

export type Support = {
  id: string;
  nodeId: string;
  kind: SupportKind;
  ux: boolean;
  uy: boolean;
  uz: boolean;
  rx: boolean;
  ry: boolean;
  rz: boolean;
};

export type LoadPattern = {
  id: string;
  name: string;
  selfWeight: boolean;
  gammaX: number;
  gammaY: number;
  gammaZ: number;
};

export type Load = {
  id: string;
  patternId: string;
  kind: LoadKind;
  target: "frame" | "slab" | "node" | "wall";
  targetId: string;
  dir: LoadDir;
  w1: number;
  w2: number;
  a: number;
  b: number;
  P: number;
  label?: string;
};

export type Combination = {
  id: string;
  name: string;
  factors: Record<string, number>;
};

export type Pier = {
  id: string;
  name: string;
  storyId: string;
};

export type SeismicCode = "e030" | "asce7" | "nsr10" | "nec" | "nch433" | "euro8";

export type SpectrumId = "e030-2025" | "asce7" | "nsr10" | "nec" | "nch433" | "euro8-1" | "euro8-2";

export type SeismicParams = {
  code: SeismicCode;
  zona: 1 | 2 | 3 | 4;
  Z: number;
  suelo: string;
  S: number;
  Tp: number;
  Tl: number;
  U: number;
  R0: number;
  Ia: number;
  Ip: number;
  Ct: number;
  liveFrac: number;
  SDS: number;
  Ie: number;
  staticFx: number;
  staticFy: number;
  dynFx: number;
  dynFy: number;
  spectrumId: SpectrumId;
};

export type BuildingProject = {
  name: string;
  materials: Material[];
  frameSections: FrameSection[];
  wallSections: WallSection[];
  slabSections: SlabSection[];
  stories: Story[];
  gridsX: GridLine[];
  gridsY: GridLine[];
  nodes: Node[];
  frames: Frame[];
  walls: Wall[];
  slabs: Slab[];
  stairs: Stair[];
  supports: Support[];
  piers: Pier[];
  patterns: LoadPattern[];
  loads: Load[];
  combinations: Combination[];
  qAdm: number;
  soilGamma: number;
  seismic: SeismicParams;
  selfWeight: SelfWeightOpts;
};

export type SelfWeightOpts = {
  enabled: boolean;
  multiplier: number;
  columns: boolean;
  beams: boolean;
  walls: boolean;
  slabs: boolean;
  stairs: boolean;
};

export type EndForces = {
  P: number;
  V2: number;
  V3: number;
  T: number;
  M2: number;
  M3: number;
};

export type MemberResult = {
  id: string;
  kind: FrameKind;
  storyId: string;
  pierId?: string;
  i: EndForces;
  j: EndForces;
  Pmax: number;
  V2max: number;
  V3max: number;
  M2max: number;
  M3max: number;
};

export type NodeDisp = {
  id: string;
  ux: number;
  uy: number;
  uz: number;
  rx: number;
  ry: number;
  rz: number;
};

export type Reaction = {
  nodeId: string;
  fx: number;
  fy: number;
  fz: number;
  mx: number;
  my: number;
  mz: number;
};

export type PierResultant = {
  pierId: string;
  storyId: string;
  name: string;
  P: number;
  V2: number;
  V3: number;
  T: number;
  M2: number;
  M3: number;
};

export type FootingResult = {
  nodeId: string;
  kind: "aislada" | "corrida";
  P: number;
  Mx: number;
  My: number;
  B: number;
  L: number;
  qmax: number;
  qmin: number;
  qAdm: number;
  eX: number;
  eY: number;
  ok: boolean;
  note: string;
};

export type ComboResult = {
  comboId: string;
  name: string;
  nodes: NodeDisp[];
  members: MemberResult[];
  reactions: Reaction[];
  piers: PierResultant[];
  footings: FootingResult[];
  periodNote: string;
  nDof: number;
  nNodes: number;
  elapsedMs: number;
};

export type AnalysisResult = {
  ok: boolean;
  message: string;
  combos: ComboResult[];
};

export type Selection =
  | { kind: "none" }
  | { kind: "node"; id: string }
  | { kind: "frame"; id: string }
  | { kind: "wall"; id: string }
  | { kind: "slab"; id: string }
  | { kind: "stair"; id: string }
  | { kind: "support"; id: string }
  | { kind: "load"; id: string }
  | { kind: "grid"; id: string };

export type DrawTool =
  | "select"
  | "column"
  | "beam"
  | "wall"
  | "slab"
  | "stair"
  | "support"
  | "ref"
  | "loadPoint"
  | "loadLine"
  | "loadTri"
  | "loadTrap"
  | "loadArea";

export type ViewLayout = "planta" | "3d" | "ambas";

/** Modo de navegación del viewport (exclusivo respecto al arrastre). */
export type NavMode = "select" | "orbit" | "pan";

export type SelItem = Exclude<Selection, { kind: "none" }>;

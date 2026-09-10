import type { FieldDef } from "../types";
import { num, str } from "../types";
import distritos from "./distritos.json";
import {
  CATEGORIAS,
  IA_OPTS,
  IP_OPTS,
  SISTEMAS,
  SUELOS,
  ZONA_DESC,
  Z_FACTOR,
  paramsSitio,
  type SueloId,
} from "./tablas";

export type DeptNode = { n: string; p: { n: string; d: { n: string; z: number }[] }[] };

const TREE = distritos as DeptNode[];

export function depts(): DeptNode[] {
  return [...TREE].sort((a, b) => a.n.localeCompare(b.n, "es"));
}

export function findDept(name: string) {
  return depts().find((d) => d.n === name) ?? depts()[0];
}

export function findProv(dept: DeptNode, name: string) {
  return dept.p.find((p) => p.n === name) ?? dept.p[0];
}

export function findDist(prov: DeptNode["p"][0], name: string) {
  return prov.d.find((d) => d.n === name) ?? prov.d[0];
}

export type E030Resolved = {
  dept: string;
  prov: string;
  dist: string;
  zona: 1 | 2 | 3 | 4;
  Z: number;
  zonaDesc: string;
  suelo: SueloId;
  sueloLabel: string;
  sueloDesc: string;
  S: number;
  Tp: number;
  Tl: number;
  sitioNote: string;
  sitio: boolean;
  categoria: string;
  catLabel: string;
  catDesc: string;
  U: number;
  sistema: string;
  sisLabel: string;
  R0: number;
  CtAuto: number;
  ia: string;
  iaLabel: string;
  iaDesc: string;
  Ia: number;
  ip: string;
  ipLabel: string;
  ipDesc: string;
  Ip: number;
  H: number;
  Ct: number;
  R: number;
  ubicacion: string;
};

export function resolveE030(raw: Record<string, string>): E030Resolved {
  const deptN = findDept(str(raw, "dept", "Lima"));
  const provN = findProv(deptN, str(raw, "prov", "Lima"));
  const distN = findDist(provN, str(raw, "dist", "Lima"));
  const zona = (distN.z === 1 || distN.z === 2 || distN.z === 3 || distN.z === 4 ? distN.z : 4) as 1 | 2 | 3 | 4;
  const suelo = (SUELOS.some((s) => s.value === raw.suelo) ? raw.suelo : "S2") as SueloId;
  const sueloDef = SUELOS.find((s) => s.value === suelo)!;
  const site = paramsSitio(zona, suelo);
  const cat = CATEGORIAS.find((c) => c.value === raw.categoria) ?? CATEGORIAS.find((c) => c.value === "C")!;
  const sis = SISTEMAS.find((s) => s.value === raw.sistema) ?? SISTEMAS.find((s) => s.value === "ca-porticos")!;
  const ia = IA_OPTS.find((x) => x.value === raw.ia) ?? IA_OPTS[0];
  const ip = IP_OPTS.find((x) => x.value === raw.ip) ?? IP_OPTS[0];
  const H = num(raw, "H", 15.8);
  const Ct = num(raw, "Ct", sis.Ct) || sis.Ct;
  const R0 = sis.R0;
  const Ia = ia.Ia;
  const Ip = ip.Ip;
  const R = Math.max(R0 * Ia * Ip, 1e-6);
  return {
    dept: deptN.n,
    prov: provN.n,
    dist: distN.n,
    zona,
    Z: Z_FACTOR[zona],
    zonaDesc: ZONA_DESC[zona],
    suelo,
    sueloLabel: sueloDef.label,
    sueloDesc: sueloDef.desc,
    S: site.S,
    Tp: site.Tp,
    Tl: site.Tl,
    sitioNote: site.note,
    sitio: site.sitio,
    categoria: cat.value,
    catLabel: cat.label,
    catDesc: cat.desc,
    U: cat.U,
    sistema: sis.value,
    sisLabel: sis.label,
    R0,
    CtAuto: sis.Ct,
    ia: ia.value,
    iaLabel: ia.label,
    iaDesc: ia.desc,
    Ia,
    ip: ip.value,
    ipLabel: ip.label,
    ipDesc: ip.desc,
    Ip,
    H,
    Ct,
    R,
    ubicacion: `${distN.n}, ${provN.n}, ${deptN.n}`,
  };
}

export function syncE030(raw: Record<string, string>, changed?: string): Record<string, string> {
  const next = { ...raw };
  const deptN = findDept(str(next, "dept", "Lima"));
  if (changed === "dept" || !deptN.p.some((p) => p.n === next.prov)) {
    next.prov = deptN.p[0]?.n ?? "";
  }
  const provN = findProv(deptN, str(next, "prov", ""));
  if (changed === "dept" || changed === "prov" || !provN.d.some((d) => d.n === next.dist)) {
    next.dist = provN.d[0]?.n ?? "";
  }
  next.dept = deptN.n;
  next.prov = provN.n;
  const r = resolveE030(next);
  next.dept = r.dept;
  next.prov = r.prov;
  next.dist = r.dist;
  next.zona = String(r.zona);
  next.Z = String(r.Z);
  next.suelo = r.suelo;
  next.S = String(r.S);
  next.Tp = String(r.Tp);
  next.Tl = String(r.Tl);
  next.categoria = r.categoria;
  next.U = String(r.U);
  next.sistema = r.sistema;
  next.R0 = String(r.R0);
  next.ia = r.ia;
  next.Ia = String(r.Ia);
  next.ip = r.ip;
  next.Ip = String(r.Ip);
  if (changed === "sistema" || next.Ct === undefined || next.Ct === "") {
    next.Ct = String(r.CtAuto);
  }
  return next;
}

export function e030EnrichField(f: FieldDef, values: Record<string, string>): FieldDef {
  if (f.key === "dept") {
    return { ...f, options: depts().map((d) => ({ value: d.n, label: d.n })) };
  }
  if (f.key === "prov") {
    const dept = findDept(values.dept ?? "Lima");
    return { ...f, options: dept.p.map((p) => ({ value: p.n, label: p.n })) };
  }
  if (f.key === "dist") {
    const dept = findDept(values.dept ?? "Lima");
    const prov = findProv(dept, values.prov ?? "");
    return {
      ...f,
      options: prov.d.map((d) => ({
        value: d.n,
        label: `${d.n}  ·  zona ${d.z}`,
        desc: ZONA_DESC[(d.z === 1 || d.z === 2 || d.z === 3 || d.z === 4 ? d.z : 4) as 1 | 2 | 3 | 4],
      })),
    };
  }
  return f;
}

export function e030FieldNote(key: string, values: Record<string, string>): string | undefined {
  const r = resolveE030(values);
  if (key === "dist") return `${r.zonaDesc} Distrito: ${r.ubicacion}.`;
  if (key === "suelo") return `${r.sueloDesc} ${r.sitioNote}`;
  if (key === "categoria") return `${r.catDesc} Factor U = ${String(r.U).replace(".", ",")}.`;
  if (key === "sistema") return `R0 = ${String(r.R0).replace(".", ",")} (Tabla N° 10). Ct sugerido = ${r.CtAuto} (art. 36).`;
  if (key === "ia") return r.iaDesc;
  if (key === "ip") return r.ipDesc;
  if (key === "Ct") {
    return `Art. 36: Ct = 35 pórticos CA o acero a momento; 45 acero arriostrado; 60 dual, muros, EMDL y albañilería. Sugerido para este sistema: ${r.CtAuto}.`;
  }
  return undefined;
}

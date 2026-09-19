const SKIP_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "hotmail.com",
  "outlook.com",
  "outlook.es",
  "live.com",
  "yahoo.com",
  "yahoo.es",
  "icloud.com",
  "proton.me",
  "protonmail.com",
  "miacademiapreu.com",
]);

const DOMAIN_MAP: { re: RegExp; keys: string[] }[] = [
  { re: /constru|edifica|civil|ingenier|estruct|geotec|sanit/i, keys: ["construcción", "ingeniería"] },
  { re: /arqui|urban|studio|taller/i, keys: ["arquitectura"] },
  { re: /odonto|dental|clinic|medico|salud/i, keys: ["salud", "odontología"] },
  { re: /iglesia|ministerio|biblia|evangel|catolic|pastor/i, keys: ["fe", "iglesia"] },
  { re: /licit|contrat|osce|oece|consultor/i, keys: ["contrataciones"] },
  { re: /abogad|legal|notaria|estudiojurid/i, keys: ["legal"] },
  { re: /educa|colegio|universidad|instituto|academia/i, keys: ["educación"] },
  { re: /minera|minas|petrole|energia/i, keys: ["minería", "energía"] },
  { re: /comercio|market|shop|store|venta/i, keys: ["comercio"] },
  { re: /software|tech|sistemas|data/i, keys: ["tecnología"] },
];

function splitDomain(email: string) {
  const at = email.trim().toLowerCase().split("@");
  if (at.length !== 2) return { local: "", domain: "", org: "" };
  const domain = at[1];
  const org = domain.split(".")[0] || "";
  return { local: at[0], domain, org };
}

export function emailKeywordsFrom(email: string): string[] {
  const { local, domain, org } = splitDomain(email);
  if (!domain || SKIP_DOMAINS.has(domain)) return [];
  const keys = new Set<string>();
  if (org && org.length >= 3) keys.add(org.replace(/[-_]/g, " "));
  for (const row of DOMAIN_MAP) {
    if (row.re.test(domain) || row.re.test(local)) row.keys.forEach((k) => keys.add(k));
  }
  const tokens = `${org} ${local}`.split(/[^a-záéíóúñ0-9]+/i).filter((t) => t.length >= 4);
  for (const t of tokens.slice(0, 6)) keys.add(t);
  return [...keys].slice(0, 8);
}

export function organizationHintFromEmail(email: string): string {
  const { domain, org } = splitDomain(email);
  if (!domain || SKIP_DOMAINS.has(domain)) return "";
  return org.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

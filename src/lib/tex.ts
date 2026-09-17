/** Apila ecuaciones unidas por \qquad en un bloque aligned profesional. */
export function stackDisplayTex(tex: string): string {
  const t = tex.trim();
  if (!t) return t;
  if (/\\begin\{(gathered|aligned|align\*?|cases|array|matrix|pmatrix|bmatrix)/.test(t)) return t;
  const parts = t.split(/\\qquad/).map((s) => s.trim()).filter(Boolean);
  if (parts.length <= 1) return t;
  return `\\begin{aligned}${parts.map(alignRow).join("\\\\[10pt]")}\\end{aligned}`;
}

function alignRow(p: string): string {
  const i = topLevelEquals(p);
  if (i > 0) return `${p.slice(0, i).trim()} &= ${p.slice(i + 1).trim()}`;
  const approx = p.search(/\\approx/);
  if (approx > 0) return `${p.slice(0, approx).trim()} &\\approx ${p.slice(approx + 7).trim()}`;
  return `& ${p}`;
}

function topLevelEquals(s: string): number {
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === "{") depth++;
    else if (ch === "}") depth = Math.max(0, depth - 1);
    else if (ch === "=" && depth === 0 && s[i - 1] !== "\\" && s.slice(Math.max(0, i - 1), i + 1) !== "&=") return i;
  }
  return -1;
}

/** La línea es una ecuación (no un párrafo explicativo). */
export function looksLikeMathLine(raw: string): boolean {
  const t = String(raw || "").trim();
  if (!t) return false;
  if (/\\[a-zA-Z]|\\begin\{/.test(t)) return true;
  const spanish = (t.match(/[A-Za-záéíóúñÁÉÍÓÚÑ]{4,}/g) || []).filter(
    (w) => !/^(máximo|mínimo|máx|mín|sen|cos|tan|arctan|log|min|max|prov|temp|zona)$/i.test(w)
  );
  if (spanish.length >= 3) return false;
  if (/^(?:[A-Za-z][A-Za-z0-9_,'′]{0,14}|[ρφαγβδεωπθσℓØΔ][A-Za-z0-9_,'′]{0,12}|φ[A-Za-z]+)\s*[=≈≤≥]/.test(t)) return true;
  if (/^[=√∫]/.test(t)) return true;
  if (t.includes(" · ") && /[=√²³ρφ]/.test(t) && t.length < 240 && spanish.length < 2) return true;
  return false;
}

/**
 * Convierte la fórmula ASCII/Unicode de los motores (sin formulaTex) a LaTeX
 * para renderizarla con KaTeX en pantalla e impresión.
 */
export function asciiFormulaToTex(raw: string): string | undefined {
  const src = String(raw || "").trim();
  if (!src) return undefined;
  if (/\\[a-zA-Z]|\\begin\{|\\dfrac|\\frac/.test(src)) return stackDisplayTex(src);
  const lines = src
    .split(/\s+·\s+/)
    .map((ln) => ln.trim())
    .filter(Boolean)
    .map(asciiLineToTex)
    .filter(Boolean);
  if (!lines.length) return undefined;
  if (lines.length === 1) return lines[0];
  return `\\begin{aligned}${lines.map(alignRow).join("\\\\[10pt]")}\\end{aligned}`;
}

function asciiLineToTex(line: string): string {
  let s = line.trim();
  const named: [RegExp, string][] = [
    [/φMn/g, "\\phi M_n"],
    [/φVc/g, "\\phi V_c"],
    [/φv\b/g, "\\phi_v"],
    [/ρmín/g, "\\rho_{\\min}"],
    [/ρmáx/g, "\\rho_{\\max}"],
    [/ρreq/g, "\\rho_{\\mathrm{req}}"],
    [/ρusar/g, "\\rho_{\\mathrm{usar}}"],
    [/ρb\b/g, "\\rho_b"],
    [/ρg/g, "\\rho_g"],
    [/ρst/g, "\\rho_{st}"],
    [/ρ/g, "\\rho"],
    [/As,mín/g, "A_{s,\\min}"],
    [/As,temp/g, "A_{s,\\mathrm{temp}}"],
    [/As,prov/g, "A_{s,\\mathrm{prov}}"],
    [/Av\/s/g, "A_v/s"],
    [/\bAs\b/g, "A_s"],
    [/\bAv\b/g, "A_v"],
    [/\bAsh\b/g, "A_{sh}"],
    [/\bf'c\b/g, "f'_c"],
    [/f'c/g, "f'_c"],
    [/\bfy\b/g, "f_y"],
    [/\bwu\b/g, "w_u"],
    [/\bMu\b/g, "M_u"],
    [/\bVu\b/g, "V_u"],
    [/\bVc\b/g, "V_c"],
    [/\bVs\b/g, "V_s"],
    [/\bRn\b/g, "R_n"],
    [/(\d)Rn/g, "$1R_n"],
    [/\brec\b/g, "\\mathrm{rec}"],
    [/\bVA\b/g, "V_A"],
    [/\bAg\b/g, "A_g"],
    [/\bIg\b/g, "I_g"],
    [/\bIe\b/g, "I_e"],
    [/\bIcr\b/g, "I_{cr}"],
    [/\bMcr\b/g, "M_{cr}"],
    [/\bMa\b/g, "M_a"],
    [/\bMr\b/g, "M_r"],
    [/\bPa\b/g, "P_a"],
    [/\bPw\b/g, "P_w"],
    [/\bPp\b/g, "P_p"],
    [/\bKa\b/g, "K_a"],
    [/\bKp\b/g, "K_p"],
    [/\bKae\b/g, "K_{ae}"],
    [/\bHs\b/g, "H_s"],
    [/\bdb\b/g, "d_b"],
    [/qmáx/g, "q_{\\max}"],
    [/δmáx/g, "\\delta_{\\max}"],
    [/δadm/g, "\\delta_{\\mathrm{adm}}"],
    [/Øest/g, "\\varnothing_{\\mathrm{est}}"],
    [/ℓo/g, "\\ell_o"],
    [/ℓd/g, "\\ell_d"],
    [/ℓzona/g, "\\ell_{\\mathrm{zona}}"],
    [/ℓc\b/g, "\\ell_c"],
    [/n_apoyo/g, "n_{\\mathrm{apoyo}}"],
    [/n_centro/g, "n_{\\mathrm{centro}}"],
    [/FS_d,sis/g, "FS_{d,\\mathrm{sis}}"],
    [/FS_v,sis/g, "FS_{v,\\mathrm{sis}}"],
    [/FS_d/g, "FS_d"],
    [/FS_v/g, "FS_v"],
    [/FS_c/g, "FS_c"],
    [/c_base/g, "c_{\\mathrm{base}}"],
    [/φ_base/g, "\\varphi_{\\mathrm{base}}"],
    [/Pa,v/g, "P_{a,v}"],
    [/Pa,s/g, "P_{a,s}"],
    [/Pw,s/g, "P_{w,s}"],
    [/Pq,s/g, "P_{q,s}"],
    [/Ms,sis/g, "M_{s,\\mathrm{sis}}"],
    [/Ma,sis/g, "M_{a,\\mathrm{sis}}"],
    [/ΔPae/g, "\\Delta P_{ae}"],
    [/Pae/g, "P_{ae}"],
    [/PIR/g, "P_{IR}"],
    [/h'''/g, "h'''"],
    [/h''/g, "h''"],
    [/x̄/g, "\\bar{x}"],
    [/ȳ/g, "\\bar{y}"],
  ];
  for (const [re, to] of named) s = s.replace(re, to);

  s = s
    .replace(/log₁₀/g, "\\log_{10}")
    .replace(/ⁿ/g, "^{n}")
    .replace(/máx/g, "\\max")
    .replace(/mín/g, "\\min")
    .replace(/\barctan\b/g, "\\arctan")
    .replace(/\bsen\b/g, "\\sin")
    .replace(/\bcos\b/g, "\\cos")
    .replace(/\btan\b/g, "\\tan")
    .replace(/½/g, "\\tfrac{1}{2}")
    .replace(/⅔/g, "\\tfrac{2}{3}")
    .replace(/≥/g, "\\ge ")
    .replace(/≤/g, "\\le ")
    .replace(/≠/g, "\\ne ")
    .replace(/≈/g, "\\approx ")
    .replace(/±/g, "\\pm ")
    .replace(/→/g, "\\rightarrow ")
    .replace(/×/g, "\\times ")
    .replace(/−/g, "-")
    .replace(/′/g, "'")
    .replace(/°/g, "^{\\circ}")
    .replace(/√\s*\(([^)]+)\)/g, "\\sqrt{$1}")
    .replace(/√([A-Za-z\\][A-Za-z0-9'_\\{},^]*)/g, "\\sqrt{$1}")
    .replace(/²/g, "^{2}")
    .replace(/³/g, "^{3}")
    .replace(/⁴/g, "^{4}")
    .replace(/⁵/g, "^{5}")
    .replace(/⁻³/g, "^{-3}")
    .replace(/⁻²/g, "^{-2}")
    .replace(/⁻¹/g, "^{-1}")
    .replace(/φ_([A-Za-z]+)/g, "\\varphi_{\\mathrm{$1}}")
    .replace(/φ/g, "\\varphi ")
    .replace(/γ/g, "\\gamma ")
    .replace(/β/g, "\\beta ")
    .replace(/δ/g, "\\delta ")
    .replace(/ε/g, "\\varepsilon ")
    .replace(/ω/g, "\\omega ")
    .replace(/π/g, "\\pi ")
    .replace(/θ/g, "\\theta ")
    .replace(/σ/g, "\\sigma ")
    .replace(/η/g, "\\eta ")
    .replace(/α/g, "\\alpha ")
    .replace(/Δ/g, "\\Delta ")
    .replace(/ℓ/g, "\\ell ")
    .replace(/Ø/g, "\\varnothing ")
    .replace(/∫/g, "\\displaystyle\\int ")
    .replace(/⌈/g, "\\left\\lceil ")
    .replace(/⌉/g, "\\right\\rceil ")
    .replace(/↑/g, "^{\\uparrow}")
    .replace(/↓/g, "^{\\downarrow}")
    .replace(/·/g, "\\cdot ")
    .replace(/(\d),(\d)/g, "$1{,}$2");

  return s.replace(/\s{2,}/g, " ").trim();
}

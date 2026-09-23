import { catPorId } from "./categorias";
import type { Noticia } from "./tipos";

/**
 * Motor de ilustraciones editoriales: genera una imagen SVG real por nota
 * (27 motivos de categoría × 3 variantes = 81 portadas únicas).
 * Se sirven como <img> vía data URI: sin dependencias externas ni enlaces rotos.
 */

const W = 640;
const H = 360;

function fondo(color: string, v: number) {
  const sx = 480 + v * 60;
  return `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">`
    + `<stop offset="0" stop-color="${color}"/><stop offset="1" stop-color="#141b29"/></linearGradient>`
    + `<radialGradient id="glow" cx="0.78" cy="0.22" r="0.7"><stop offset="0" stop-color="#ffffff" stop-opacity="0.28"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></radialGradient></defs>`
    + `<rect width="${W}" height="${H}" fill="url(#g)"/><rect width="${W}" height="${H}" fill="url(#glow)"/>`
    + `<circle cx="${sx}" cy="70" r="34" fill="#ffffff" opacity="0.9"/>`
    + `<circle cx="${sx}" cy="70" r="52" fill="#ffffff" opacity="0.12"/>`
    + `<ellipse cx="150" cy="86" rx="90" ry="16" fill="#ffffff" opacity="0.14"/>`
    + `<ellipse cx="200" cy="104" rx="60" ry="11" fill="#ffffff" opacity="0.10"/>`
    + `<rect y="292" width="${W}" height="68" fill="#0b0f18" opacity="0.55"/>`
    + `<rect y="292" width="${W}" height="3" fill="#ffffff" opacity="0.25"/>`;
}

function estrellas() {
  let s = "";
  const pts: [number, number, number][] = [[60, 50, 2], [130, 120, 1.5], [220, 60, 2], [320, 110, 1.5], [420, 50, 2], [520, 130, 1.5], [590, 70, 2], [90, 200, 1.5], [260, 190, 1.5], [470, 210, 2], [560, 200, 1.5], [360, 40, 1.5]];
  for (const [x, y, r] of pts) s += `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" opacity="0.9"/>`;
  return s;
}

const INK = "#f5efe0";
const INK_SOFT = "#e8dfc9";
const DARK = "#101623";

const MOTIVOS: Record<string, string> = {
  industria:
    `<rect x="90" y="200" width="120" height="92" fill="${INK}"/><polygon points="90,200 120,168 150,200 180,168 210,200" fill="${INK_SOFT}"/>`
    + `<rect x="230" y="180" width="110" height="112" fill="${INK_SOFT}"/><rect x="250" y="150" width="18" height="60" fill="${DARK}" opacity="0.85"/><rect x="292" y="140" width="18" height="70" fill="${DARK}" opacity="0.85"/>`
    + `<circle cx="259" cy="120" r="12" fill="#fff" opacity="0.5"/><circle cx="272" cy="98" r="16" fill="#fff" opacity="0.35"/><circle cx="301" cy="112" r="12" fill="#fff" opacity="0.5"/>`
    + `<rect x="380" y="210" width="130" height="82" fill="${INK}"/><polygon points="380,210 445,168 510,210" fill="${INK_SOFT}"/>`
    + `<rect x="110" y="225" width="26" height="26" fill="${DARK}" opacity="0.7"/><rect x="150" y="225" width="26" height="26" fill="${DARK}" opacity="0.7"/><rect x="400" y="232" width="90" height="14" fill="${DARK}" opacity="0.7"/>`,
  "economia-finanzas":
    `<line x1="90" y1="120" x2="90" y2="270" stroke="${INK}" stroke-width="5"/><line x1="90" y1="270" x2="560" y2="270" stroke="${INK}" stroke-width="5"/>`
    + `<rect x="140" y="200" width="52" height="70" fill="${INK}"/><rect x="220" y="170" width="52" height="100" fill="${INK_SOFT}"/><rect x="300" y="140" width="52" height="130" fill="${INK}"/><rect x="380" y="185" width="52" height="85" fill="${INK_SOFT}"/>`
    + `<polyline points="140,190 246,160 326,120 470,80" fill="none" stroke="#ffd97a" stroke-width="6" stroke-linecap="round"/>`
    + `<circle cx="470" cy="80" r="10" fill="#ffd97a"/><circle cx="520" cy="150" r="26" fill="none" stroke="#ffd97a" stroke-width="6"/><text x="520" y="160" font-size="28" text-anchor="middle" fill="#ffd97a" font-family="serif">$</text>`,
  energia:
    `<polygon points="120,250 200,250 180,190 100,190" fill="#20304a" stroke="${INK}" stroke-width="5"/><line x1="150" y1="190" x2="150" y2="250" stroke="${INK}" stroke-width="4"/><line x1="100" y1="220" x2="200" y2="220" stroke="${INK}" stroke-width="4"/>`
    + `<polygon points="230,250 310,250 290,190 210,190" fill="#20304a" stroke="${INK}" stroke-width="5"/><line x1="260" y1="190" x2="260" y2="250" stroke="${INK}" stroke-width="4"/><line x1="210" y1="220" x2="310" y2="220" stroke="${INK}" stroke-width="4"/>`
    + `<line x1="430" y1="292" x2="430" y2="150" stroke="${INK}" stroke-width="7"/><line x1="390" y1="190" x2="470" y2="190" stroke="${INK}" stroke-width="5"/><line x1="400" y1="220" x2="460" y2="220" stroke="${INK}" stroke-width="5"/>`
    + `<line x1="430" y1="150" x2="390" y2="190" stroke="${INK}" stroke-width="4"/><line x1="430" y1="150" x2="470" y2="190" stroke="${INK}" stroke-width="4"/>`
    + `<path d="M452 160 l-14 26 h9 l-6 20 20 -28 h-10 z" fill="#ffd97a"/>`,
  agricultura:
    `<line x1="320" y1="292" x2="120" y2="150" stroke="${INK}" stroke-width="4" opacity="0.7"/><line x1="320" y1="292" x2="260" y2="150" stroke="${INK}" stroke-width="4" opacity="0.7"/><line x1="320" y1="292" x2="380" y2="150" stroke="${INK}" stroke-width="4" opacity="0.7"/><line x1="320" y1="292" x2="520" y2="150" stroke="${INK}" stroke-width="4" opacity="0.7"/>`
    + `<line x1="320" y1="250" x2="320" y2="180" stroke="#7fc46a" stroke-width="8" stroke-linecap="round"/><ellipse cx="300" cy="205" rx="22" ry="10" fill="#7fc46a" transform="rotate(-30 300 205)"/><ellipse cx="340" cy="205" rx="22" ry="10" fill="#7fc46a" transform="rotate(30 340 205)"/>`
    + `<line x1="180" y1="262" x2="180" y2="215" stroke="#7fc46a" stroke-width="7" stroke-linecap="round"/><ellipse cx="164" cy="232" rx="17" ry="8" fill="#7fc46a" transform="rotate(-30 164 232)"/><ellipse cx="196" cy="232" rx="17" ry="8" fill="#7fc46a" transform="rotate(30 196 232)"/>`
    + `<line x1="460" y1="262" x2="460" y2="215" stroke="#7fc46a" stroke-width="7" stroke-linecap="round"/><ellipse cx="444" cy="232" rx="17" ry="8" fill="#7fc46a" transform="rotate(-30 444 232)"/><ellipse cx="476" cy="232" rx="17" ry="8" fill="#7fc46a" transform="rotate(30 476 232)"/>`,
  emprendimiento:
    `<ellipse cx="320" cy="180" rx="42" ry="70" fill="${INK}"/><polygon points="320,80 288,130 352,130" fill="#c0392b"/><circle cx="320" cy="160" r="18" fill="#20304a"/>`
    + `<polygon points="282,220 258,268 288,250" fill="#c0392b"/><polygon points="358,220 382,268 352,250" fill="#c0392b"/>`
    + `<polygon points="308,250 332,250 320,292" fill="#ffb03a"/><polygon points="313,250 327,250 320,274" fill="#ff7a2e"/>`
    + `<circle cx="150" cy="120" r="4" fill="#fff"/><circle cx="500" cy="160" r="4" fill="#fff"/><circle cx="200" cy="240" r="3" fill="#fff"/><circle cx="460" cy="250" r="3" fill="#fff"/>`
    + `<rect x="120" y="252" width="80" height="40" fill="${INK_SOFT}" opacity="0.9"/><polygon points="120,252 160,228 200,252" fill="${INK_SOFT}" opacity="0.9"/>`,
  tecnologia:
    `<rect x="250" y="140" width="140" height="110" rx="10" fill="${DARK}" stroke="${INK}" stroke-width="6"/><rect x="285" y="172" width="70" height="46" fill="none" stroke="#7fd4ff" stroke-width="5"/>`
    + `<line x1="250" y1="165" x2="200" y2="165" stroke="#7fd4ff" stroke-width="5"/><circle cx="190" cy="165" r="10" fill="#7fd4ff"/>`
    + `<line x1="250" y1="225" x2="200" y2="225" stroke="#7fd4ff" stroke-width="5"/><circle cx="190" cy="225" r="10" fill="#7fd4ff"/>`
    + `<line x1="390" y1="165" x2="440" y2="165" stroke="#7fd4ff" stroke-width="5"/><circle cx="450" cy="165" r="10" fill="#7fd4ff"/>`
    + `<line x1="390" y1="225" x2="440" y2="225" stroke="#7fd4ff" stroke-width="5"/><circle cx="450" cy="225" r="10" fill="#7fd4ff"/>`
    + `<line x1="320" y1="140" x2="320" y2="100" stroke="#7fd4ff" stroke-width="5"/><circle cx="320" cy="90" r="10" fill="#7fd4ff"/>`,
  ia:
    `<circle cx="160" cy="120" r="16" fill="${INK}"/><circle cx="160" cy="200" r="16" fill="${INK}"/><circle cx="160" cy="280" r="16" fill="${INK}"/>`
    + `<circle cx="320" cy="110" r="20" fill="#8f7bff"/><circle cx="320" cy="200" r="20" fill="#8f7bff"/><circle cx="320" cy="290" r="20" fill="#8f7bff"/>`
    + `<circle cx="480" cy="200" r="24" fill="${INK}"/>`
    + `<g stroke="#8f7bff" stroke-width="4" opacity="0.8"><line x1="176" y1="120" x2="300" y2="115"/><line x1="176" y1="120" x2="300" y2="200"/><line x1="176" y1="200" x2="300" y2="115"/><line x1="176" y1="200" x2="300" y2="200"/><line x1="176" y1="200" x2="300" y2="285"/><line x1="176" y1="280" x2="300" y2="200"/><line x1="176" y1="280" x2="300" y2="285"/><line x1="340" y1="115" x2="456" y2="195"/><line x1="340" y1="200" x2="456" y2="200"/><line x1="340" y1="285" x2="456" y2="205"/></g>`,
  ingenieria:
    `<rect x="80" y="230" width="24" height="62" fill="${INK}"/><rect x="536" y="230" width="24" height="62" fill="${INK}"/>`
    + `<path d="M104 230 Q320 90 536 230" fill="none" stroke="#ffb03a" stroke-width="9"/>`
    + `<line x1="80" y1="230" x2="560" y2="230" stroke="${INK}" stroke-width="10"/>`
    + `<g stroke="${INK}" stroke-width="4"><line x1="170" y1="230" x2="170" y2="185"/><line x1="240" y1="230" x2="240" y2="152"/><line x1="320" y1="230" x2="320" y2="142"/><line x1="400" y1="230" x2="400" y2="152"/><line x1="470" y1="230" x2="470" y2="185"/></g>`
    + `<rect x="270" y="196" width="60" height="34" fill="#c0392b"/><circle cx="285" cy="230" r="8" fill="${DARK}"/><circle cx="315" cy="230" r="8" fill="${DARK}"/>`,
  ciencias:
    `<polygon points="270,110 370,110 340,250 300,250" fill="none" stroke="${INK}" stroke-width="8"/><line x1="255" y1="110" x2="385" y2="110" stroke="${INK}" stroke-width="8"/>`
    + `<path d="M292 210 h56 l-8 40 h-40 z" fill="#59d6a4"/><circle cx="315" cy="190" r="7" fill="#59d6a4"/><circle cx="330" cy="172" r="5" fill="#59d6a4"/><circle cx="305" cy="168" r="4" fill="#59d6a4"/>`
    + `<circle cx="470" cy="140" r="14" fill="none" stroke="${INK}" stroke-width="6"/><circle cx="520" cy="180" r="14" fill="none" stroke="${INK}" stroke-width="6"/><circle cx="480" cy="225" r="14" fill="none" stroke="${INK}" stroke-width="6"/><line x1="482" y1="147" x2="508" y2="172" stroke="${INK}" stroke-width="6"/><line x1="508" y1="192" x2="488" y2="213" stroke="${INK}" stroke-width="6"/>`,
  salud:
    `<rect x="130" y="150" width="120" height="120" rx="26" fill="${INK}"/><rect x="176" y="172" width="28" height="76" fill="#c0392b"/><rect x="152" y="196" width="76" height="28" fill="#c0392b"/>`
    + `<polyline points="300,230 340,230 355,195 375,260 395,210 410,230 470,230" fill="none" stroke="#59d6a4" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>`
    + `<circle cx="520" cy="150" r="20" fill="none" stroke="${INK}" stroke-width="6"/><line x1="520" y1="170" x2="520" y2="230" stroke="${INK}" stroke-width="6"/><line x1="500" y1="200" x2="540" y2="200" stroke="${INK}" stroke-width="6"/>`,
  ciberseguridad:
    `<path d="M320 90 L450 135 V210 C450 260 390 285 320 300 C250 285 190 260 190 210 V135 Z" fill="${DARK}" stroke="${INK}" stroke-width="8"/>`
    + `<rect x="296" y="180" width="48" height="44" rx="8" fill="${INK}"/><circle cx="320" cy="196" r="10" fill="${DARK}"/><rect x="316" y="196" width="8" height="20" fill="${DARK}"/>`
    + `<circle cx="140" cy="120" r="5" fill="#7fd4ff"/><circle cx="510" cy="110" r="5" fill="#7fd4ff"/><circle cx="120" cy="230" r="5" fill="#7fd4ff"/><circle cx="530" cy="240" r="5" fill="#7fd4ff"/>`,
  espacio:
    `<circle cx="430" cy="180" r="62" fill="#d98a4a"/><ellipse cx="430" cy="180" rx="105" ry="26" fill="none" stroke="${INK}" stroke-width="7" transform="rotate(-18 430 180)"/>`
    + `<ellipse cx="180" cy="220" rx="26" ry="42" fill="${INK}"/><polygon points="180,158 162,190 198,190" fill="#c0392b"/><polygon points="158,250 146,278 170,262" fill="#c0392b"/><polygon points="202,250 214,278 190,262" fill="#c0392b"/><polygon points="172,262 188,262 180,292" fill="#ffb03a"/>`,
  delincuencia:
    `<rect x="90" y="170" width="80" height="122" fill="${DARK}"/><rect x="185" y="140" width="90" height="152" fill="${DARK}"/><rect x="290" y="190" width="70" height="102" fill="${DARK}"/>`
    + `<g fill="#ffd97a" opacity="0.9"><rect x="100" y="185" width="14" height="14"/><rect x="124" y="185" width="14" height="14"/><rect x="100" y="210" width="14" height="14"/><rect x="200" y="155" width="14" height="14"/><rect x="224" y="155" width="14" height="14"/><rect x="200" y="180" width="14" height="14"/></g>`
    + `<polygon points="430,292 560,120 600,160 470,292" fill="#fff" opacity="0.25"/><circle cx="580" cy="140" r="16" fill="#ff5a5a"/><circle cx="580" cy="140" r="26" fill="none" stroke="#ff5a5a" stroke-width="5" opacity="0.7"/>`
    + `<rect x="400" y="250" width="90" height="42" fill="#1f6b3a"/><rect x="400" y="238" width="90" height="12" fill="#ff5a5a"><animate attributeName="opacity" values="1;0.2;1" dur="1.2s" repeatCount="indefinite"/></rect>`,
  extorsion:
    `<rect x="250" y="110" width="140" height="170" rx="18" fill="${DARK}" stroke="${INK}" stroke-width="7"/><rect x="268" y="132" width="104" height="110" fill="#1d2a40"/><circle cx="320" cy="262" r="9" fill="${INK}"/>`
    + `<text x="320" y="205" font-size="64" text-anchor="middle" fill="#ffd97a" font-family="sans-serif" font-weight="bold">$</text>`
    + `<polygon points="480,120 540,220 420,220" fill="#ff5a5a" stroke="${INK}" stroke-width="6"/><rect x="475" y="160" width="10" height="30" fill="#fff"/><circle cx="480" cy="203" r="6" fill="#fff"/>`
    + `<path d="M150 200 q30 -40 60 0" stroke="${INK}" stroke-width="6" fill="none" stroke-linecap="round"/><circle cx="180" cy="230" r="10" fill="${INK}"/>`,
  justicia:
    `<rect x="290" y="270" width="60" height="22" fill="${INK}"/><rect x="312" y="130" width="16" height="140" fill="${INK}"/><line x1="200" y1="140" x2="440" y2="140" stroke="#ffd97a" stroke-width="8" stroke-linecap="round"/><circle cx="320" cy="118" r="10" fill="#ffd97a"/>`
    + `<line x1="220" y1="140" x2="200" y2="190" stroke="${INK}" stroke-width="5"/><line x1="220" y1="140" x2="240" y2="190" stroke="${INK}" stroke-width="5"/><path d="M195 190 a25 18 0 0 0 50 0" fill="none" stroke="${INK}" stroke-width="6"/>`
    + `<line x1="420" y1="140" x2="400" y2="190" stroke="${INK}" stroke-width="5"/><line x1="420" y1="140" x2="440" y2="190" stroke="${INK}" stroke-width="5"/><path d="M395 190 a25 18 0 0 0 50 0" fill="none" stroke="${INK}" stroke-width="6"/>`
    + `<rect x="120" y="200" width="40" height="92" fill="${INK_SOFT}" opacity="0.9"/><rect x="112" y="190" width="56" height="12" fill="${INK_SOFT}" opacity="0.9"/>`,
  "futbol-peruano":
    `<rect x="60" y="150" width="520" height="142" fill="#2e7a3e"/><line x1="60" y1="221" x2="580" y2="221" stroke="#fff" stroke-width="5" opacity="0.9"/><circle cx="320" cy="221" r="34" fill="none" stroke="#fff" stroke-width="5" opacity="0.9"/>`
    + `<rect x="60" y="185" width="70" height="72" fill="none" stroke="#fff" stroke-width="5" opacity="0.9"/><rect x="510" y="185" width="70" height="72" fill="none" stroke="#fff" stroke-width="5" opacity="0.9"/>`
    + `<circle cx="320" cy="130" r="34" fill="#fff"/><polygon points="320,118 331,126 327,139 313,139 309,126" fill="${DARK}"/><circle cx="303" cy="128" r="4" fill="${DARK}"/><circle cx="337" cy="128" r="4" fill="${DARK}"/><circle cx="310" cy="143" r="4" fill="${DARK}"/><circle cx="330" cy="143" r="4" fill="${DARK}"/>`,
  "futbol-extranjero":
    `<path d="M270 110 h100 v50 c0 40 -22 62 -50 62 c-28 0 -50 -22 -50 -62 z" fill="#ffd97a" stroke="${INK}" stroke-width="6"/>`
    + `<path d="M270 130 c-30 0 -40 25 -25 45" fill="none" stroke="#ffd97a" stroke-width="8"/><path d="M370 130 c30 0 40 25 25 45" fill="none" stroke="#ffd97a" stroke-width="8"/>`
    + `<rect x="305" y="222" width="30" height="30" fill="#ffd97a" stroke="${INK}" stroke-width="5"/><rect x="280" y="252" width="80" height="16" fill="#ffd97a" stroke="${INK}" stroke-width="5"/>`
    + `<circle cx="470" cy="220" r="30" fill="#fff"/><polygon points="470,210 479,217 476,228 464,228 461,217" fill="${DARK}"/>`
    + `<circle cx="150" cy="220" r="30" fill="#fff"/><polygon points="150,210 159,217 156,228 144,228 141,217" fill="${DARK}"/>`,
  "geopolitica-global":
    `<circle cx="320" cy="200" r="95" fill="#1d3a5f" stroke="${INK}" stroke-width="7"/>`
    + `<ellipse cx="320" cy="200" rx="95" ry="38" fill="none" stroke="${INK}" stroke-width="4" opacity="0.8"/><ellipse cx="320" cy="200" rx="42" ry="95" fill="none" stroke="${INK}" stroke-width="4" opacity="0.8"/><line x1="225" y1="200" x2="415" y2="200" stroke="${INK}" stroke-width="4" opacity="0.8"/>`
    + `<ellipse cx="320" cy="200" rx="135" ry="135" fill="none" stroke="#ffd97a" stroke-width="4" stroke-dasharray="10 12" transform="rotate(-20 320 200)"/>`
    + `<circle cx="455" cy="200" r="9" fill="#ffd97a"/><circle cx="200" cy="120" r="7" fill="#ff5a5a"/>`,
  "geopolitica-latam":
    `<path d="M320 120 c-34 0 -56 24 -56 54 c0 40 56 96 56 96 c0 0 56 -56 56 -96 c0 -30 -22 -54 -56 -54 z" fill="#c0392b" stroke="${INK}" stroke-width="6"/><circle cx="320" cy="174" r="22" fill="${INK}"/>`
    + `<path d="M120 260 q60 -30 120 0 t120 0 t120 0" fill="none" stroke="${INK}" stroke-width="5" stroke-dasharray="12 10" opacity="0.9"/>`
    + `<rect x="120" y="200" width="34" height="22" fill="#fff"/><rect x="486" y="200" width="34" height="22" fill="#ffd97a"/>`
    + `<circle cx="137" cy="262" r="8" fill="#7fd4ff"/><circle cx="503" cy="262" r="8" fill="#7fd4ff"/>`,
  cristianas:
    `<rect x="230" y="180" width="180" height="112" fill="${INK}"/><polygon points="230,180 320,120 410,180" fill="${INK_SOFT}"/><rect x="200" y="150" width="52" height="142" fill="${INK_SOFT}"/><polygon points="200,150 226,118 252,150" fill="${INK}"/>`
    + `<line x1="226" y1="88" x2="226" y2="118" stroke="#ffd97a" stroke-width="7"/><line x1="214" y1="98" x2="238" y2="98" stroke="#ffd97a" stroke-width="7"/>`
    + `<path d="M300 292 v-50 a20 20 0 0 1 40 0 v50" fill="${DARK}"/>`
    + `<g stroke="#ffd97a" stroke-width="5" stroke-linecap="round" opacity="0.9"><line x1="120" y1="120" x2="160" y2="150"/><line x1="520" y1="120" x2="480" y2="150"/><line x1="320" y1="60" x2="320" y2="95"/></g>`,
  educacion:
    `<polygon points="140,220 260,170 380,220 260,270" fill="${DARK}" stroke="${INK}" stroke-width="6"/><polygon points="380,220 500,170 500,200 380,250" fill="${INK_SOFT}" opacity="0.85"/>`
    + `<rect x="180" y="225" width="160" height="55" fill="${INK}"/><line x1="260" y1="225" x2="260" y2="280" stroke="${DARK}" stroke-width="5"/><line x1="320" y1="100" x2="320" y2="150" stroke="#ffd97a" stroke-width="5"/><circle cx="320" cy="158" r="9" fill="#ffd97a"/>`
    + `<rect x="420" y="235" width="70" height="50" fill="#c0392b" transform="rotate(8 455 260)"/><line x1="455" y1="238" x2="455" y2="282" stroke="${INK}" stroke-width="4"/>`,
  ambiente:
    `<polygon points="60,292 200,140 340,292" fill="#2e5a4a"/><polygon points="200,140 240,180 160,180" fill="#fff"/><polygon points="260,292 400,110 540,292" fill="#3e6e5a"/><polygon points="400,110 432,150 368,150" fill="#fff"/>`
    + `<polygon points="470,250 500,200 530,250" fill="#2e7a3e"/><rect x="494" y="250" width="12" height="42" fill="#5a4028"/>`
    + `<path d="M60 292 q80 -18 160 0 t160 0 t160 0" fill="none" stroke="#7fd4ff" stroke-width="8"/>`
    + `<circle cx="520" cy="80" r="26" fill="#ffd97a" opacity="0.9"/>`,
  transporte:
    `<polygon points="120,220 520,220 470,292 170,292" fill="#20304a" stroke="${INK}" stroke-width="6"/>`
    + `<rect x="150" y="176" width="70" height="44" fill="#c0392b" stroke="${INK}" stroke-width="4"/><rect x="225" y="176" width="70" height="44" fill="#2e7a8a" stroke="${INK}" stroke-width="4"/><rect x="300" y="176" width="70" height="44" fill="#c98a2e" stroke="${INK}" stroke-width="4"/><rect x="375" y="176" width="70" height="44" fill="#3e6e3e" stroke="${INK}" stroke-width="4"/>`
    + `<line x1="520" y1="292" x2="560" y2="120" stroke="${INK}" stroke-width="7"/><line x1="560" y1="120" x2="440" y2="120" stroke="${INK}" stroke-width="7"/><line x1="470" y1="120" x2="470" y2="176" stroke="${INK}" stroke-width="4"/><rect x="452" y="176" width="36" height="24" fill="#ffd97a"/>`
    + `<path d="M60 292 q80 -14 160 0 t160 0 t160 0" fill="none" stroke="#7fd4ff" stroke-width="6" opacity="0.8"/>`,
  cultura:
    `<ellipse cx="240" cy="200" rx="62" ry="78" fill="${INK}"/><ellipse cx="218" cy="190" rx="13" ry="18" fill="${DARK}"/><ellipse cx="262" cy="190" rx="13" ry="18" fill="${DARK}"/><path d="M210 240 q30 22 60 0" fill="none" stroke="${DARK}" stroke-width="7" stroke-linecap="round"/>`
    + `<rect x="360" y="140" width="140" height="120" fill="${DARK}" stroke="${INK}" stroke-width="6"/><g fill="${INK}"><rect x="372" y="152" width="26" height="26"/><rect x="408" y="152" width="26" height="26"/><rect x="444" y="152" width="26" height="26"/><rect x="372" y="222" width="26" height="26"/><rect x="408" y="222" width="26" height="26"/><rect x="444" y="222" width="26" height="26"/></g>`
    + `<circle cx="430" cy="200" r="12" fill="none" stroke="#ffd97a" stroke-width="5"/>`,
  migracion:
    `<polygon points="150,220 260,190 250,205 300,200 250,215 258,230 230,218 170,240" fill="${INK}"/>`
    + `<path d="M300 205 q100 -60 200 -20" fill="none" stroke="#ffd97a" stroke-width="5" stroke-dasharray="12 10"/>`
    + `<path d="M520 150 c-20 0 -32 14 -32 30 c0 23 32 55 32 55 c0 0 32 -32 32 -55 c0 -16 -12 -30 -32 -30 z" fill="#c0392b" stroke="${INK}" stroke-width="5"/><circle cx="520" cy="180" r="12" fill="${INK}"/>`
    + `<rect x="110" y="250" width="120" height="42" rx="8" fill="${INK_SOFT}" opacity="0.9"/><rect x="122" y="262" width="96" height="8" fill="${DARK}" opacity="0.6"/><rect x="122" y="276" width="60" height="8" fill="${DARK}" opacity="0.6"/>`,
  "politica-nacional":
    `<polygon points="320,90 470,150 170,150" fill="${INK}"/><rect x="170" y="150" width="300" height="18" fill="${INK_SOFT}"/>`
    + `<g fill="${INK}"><rect x="195" y="168" width="26" height="90"/><rect x="247" y="168" width="26" height="90"/><rect x="299" y="168" width="26" height="90"/><rect x="351" y="168" width="26" height="90"/><rect x="403" y="168" width="26" height="90"/></g>`
    + `<rect x="170" y="258" width="300" height="16" fill="${INK_SOFT}"/><rect x="150" y="274" width="340" height="18" fill="${INK}"/>`
    + `<rect x="120" y="200" width="26" height="58" fill="#c0392b"/><rect x="494" y="200" width="26" height="58" fill="#c0392b"/>`,
  "politica-internacional":
    `<line x1="220" y1="120" x2="220" y2="292" stroke="${INK}" stroke-width="7"/><rect x="220" y="120" width="110" height="70" fill="#1d3a5f" stroke="${INK}" stroke-width="5"/><circle cx="262" cy="155" r="20" fill="none" stroke="#fff" stroke-width="5"/>`
    + `<line x1="420" y1="120" x2="420" y2="292" stroke="${INK}" stroke-width="7"/><rect x="310" y="120" width="110" height="70" fill="#7a1e2e" stroke="${INK}" stroke-width="5"/><rect x="310" y="141" width="110" height="14" fill="#fff"/><rect x="310" y="155" width="110" height="14" fill="#fff" opacity="0.0"/><rect x="355" y="120" width="20" height="70" fill="#fff"/>`
    + `<rect x="270" y="240" width="100" height="52" fill="${DARK}" stroke="${INK}" stroke-width="6"/><rect x="292" y="222" width="56" height="20" fill="${DARK}" stroke="${INK}" stroke-width="6"/><circle cx="320" cy="266" r="10" fill="none" stroke="#ffd97a" stroke-width="5"/>`,
  escandalo:
    `<circle cx="270" cy="190" r="70" fill="none" stroke="${INK}" stroke-width="10"/><line x1="322" y1="242" x2="380" y2="292" stroke="${INK}" stroke-width="16" stroke-linecap="round"/>`
    + `<text x="270" y="222" font-size="72" text-anchor="middle" fill="#ffd97a" font-family="serif" font-weight="bold">?</text>`
    + `<rect x="430" y="130" width="110" height="140" fill="${INK}" opacity="0.92"/><line x1="430" y1="130" x2="540" y2="130" stroke="${DARK}" stroke-width="6"/>`
    + `<g stroke="${DARK}" stroke-width="5" opacity="0.55"><line x1="444" y1="152" x2="526" y2="152"/><line x1="444" y1="170" x2="526" y2="170"/><line x1="444" y1="188" x2="500" y2="188"/><line x1="444" y1="206" x2="526" y2="206"/><line x1="444" y1="224" x2="512" y2="224"/></g>`
    + `<rect x="150" y="240" width="70" height="52" fill="#c0392b" opacity="0.9"/><text x="185" y="274" font-size="26" text-anchor="middle" fill="#fff" font-family="sans-serif" font-weight="bold">!</text>`,
};

/** Variante por nota (0, 1, 2): desplaza el sol y el brillo para que no se repitan. */
export function varianteDe(noticia: Noticia): number {
  const n = Number(String(noticia.id).split("-").pop() ?? 1);
  return ((Number.isFinite(n) ? n : 1) + 1) % 3;
}

/** Slugs oficiales de la maestra → motivo del motor. */
const ALIAS: Record<string, string> = {
  "agricultura-alimentacion": "agricultura",
  "emprendimiento-startups": "emprendimiento",
  "inteligencia-artificial": "ia",
  "medicina-salud": "salud",
  "espacio-astronomia": "espacio",
  "delincuencia-seguridad-ciudadana": "delincuencia",
  "extorsion-sicariato": "extorsion",
  "derechos-justicia": "justicia",
  "geopolitica-regional-latam": "geopolitica-latam",
  "noticias-cristianas-devocional": "cristianas",
  "medio-ambiente-clima": "ambiente",
  "transporte-infraestructura": "transporte",
  "cultura-entretenimiento": "cultura",
};

export function ilustracionSrc(noticia: Noticia, variante?: number, colorOficial?: string): string {
  const motivoKey = ALIAS[noticia.cat] ?? noticia.cat;
  const motivo = MOTIVOS[motivoKey] ?? MOTIVOS["cultura"];
  const color = colorOficial ?? catPorId(noticia.cat).color;
  const v = variante ?? varianteDe(noticia);
  const oscuro = motivoKey === "espacio" || motivoKey === "espacio-astronomia" || motivoKey === "ciberseguridad";
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`
    + fondo(color, v)
    + (oscuro ? estrellas() : "")
    + motivo
    + `</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

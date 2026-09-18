import { looksLikeMathLine } from "../src/lib/tex.ts";

const cases: [string, boolean][] = [
  ["Haga clic en las celdas para armar la planta (recta, L", false],
  ["A = 24.00 m²", true],
  ["baricentro (4.00, 1.20) m", false],
  ["4×2 celdas", false],
  ["Ixx = 12.34 m⁴", true],
  ["0 pintadas", false],
  ["Planta de ejemplo del expediente (editable en el croquis)", false],
];

let fail = 0;
for (const [s, want] of cases) {
  const got = looksLikeMathLine(s);
  if (got !== want) {
    console.error("FAIL", JSON.stringify(s), "got", got, "want", want);
    fail++;
  }
}
if (fail) process.exit(1);
console.log("ok", cases.length);

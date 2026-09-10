import fs from "node:fs";
import path from "node:path";

const dir = "dist/assets";
for (const file of fs.readdirSync(dir)) {
  if (!file.endsWith(".js")) continue;
  const js = fs.readFileSync(path.join(dir, file), "utf8");
  const hits = [];
  for (const needle of ["google-session", "qfvgksstvdrxcugbdwkv", "functions/v1", "setSession", "554728885093"]) {
    if (js.includes(needle)) hits.push(needle);
  }
  if (hits.length) {
    console.log(file, hits.join(", "));
    const i = js.indexOf("google-session");
    if (i >= 0) console.log("  ", js.slice(i - 70, i + 90).replace(/\s+/g, " "));
  }
}

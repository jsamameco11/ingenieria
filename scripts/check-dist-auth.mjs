import { readFileSync } from "node:fs";
const html = readFileSync("C:/Users/Renzo/Desktop/WEB MEMORIAS DESCRIPTIVAS/dist/index.html", "utf8");
const m = html.match(/assets\/main-[^"']+\.js/);
if (!m) throw new Error("no main");
const js = readFileSync(`C:/Users/Renzo/Desktop/WEB MEMORIAS DESCRIPTIVAS/dist/${m[0]}`, "utf8");
console.log("jnn9", js.includes("jnn9ibrh"));
console.log("google-session", js.includes("google-session"));
console.log("api/google", js.includes("/api/google-session"));
console.log("autorizada", js.includes("autorizada"));

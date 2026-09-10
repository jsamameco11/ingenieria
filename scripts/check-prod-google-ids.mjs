import { readFileSync } from "node:fs";

const html = await (await fetch("https://ingenieria.miacademiapreu.com/")).text();
const assets = [...html.matchAll(/\/?assets\/[A-Za-z0-9._-]+\.js/g)].map((m) => m[0]);
console.log("assets", assets.slice(0, 8));
const jsPath = assets.find((p) => /main|index/.test(p)) || assets[0];
if (!jsPath) process.exit(1);
const js = await (await fetch(`https://ingenieria.miacademiapreu.com/${jsPath.replace(/^\//, "")}`)).text();
for (const needle of ["jnn9ibrh", "5f9q8een", "2hovflq9", "autorizada", "google-session", "554728885093"]) {
  console.log(needle, js.includes(needle));
}
console.log("clientIds", [...new Set([...js.matchAll(/554728885093-[a-z0-9]+\.apps\.googleusercontent\.com/g)].map((m) => m[0]))]);
const sessionUrls = [...js.matchAll(/https:\/\/[^\"']+google-session[^\"']*/g)].map((m) => m[0]);
console.log("sessionUrls", [...new Set(sessionUrls)]);

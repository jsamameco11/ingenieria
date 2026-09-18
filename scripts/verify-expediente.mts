import puppeteer from "puppeteer-core";
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const CHROME =
  process.env.CHROME_PATH ||
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const BASE = process.env.APP_URL || "http://127.0.0.1:5174";
const OUT = resolve("tmp-mae-verify");
mkdirSync(OUT, { recursive: true });

function pick(html: string, re: RegExp) {
  return [...html.matchAll(re)].map((m) => (m[1] ?? m[0]).replace(/\s+/g, " ").trim());
}

async function shot(page: puppeteer.Page, hash: string, name: string) {
  await page.goto(`${BASE}/${hash}`, { waitUntil: "networkidle2", timeout: 60_000 });
  await page.waitForFunction(
    () => {
      const root = document.querySelector("#root");
      return !!root && (root.textContent || "").length > 80;
    },
    { timeout: 40_000 },
  );
  await new Promise((r) => setTimeout(r, 1800));
  const html = await page.content();
  const text = await page.evaluate(() => document.body.innerText || "");
  const pasosUi = await page.evaluate(() =>
    [...document.querySelectorAll("section.paso")].slice(0, 14).map((el) => {
      const title = (el.querySelector("h4")?.textContent || "").replace(/\s+/g, " ").trim();
      const n = (el.querySelector(".paso-kicker")?.textContent || "").replace(/\s+/g, " ").trim();
      const res = (el.querySelector(".paso-res")?.textContent || "").replace(/\s+/g, " ").trim();
      return { n, title, res: res.slice(0, 280) };
    }),
  );
  writeFileSync(resolve(OUT, `${name}.html`), html);
  writeFileSync(resolve(OUT, `${name}.txt`), text);
  writeFileSync(resolve(OUT, `${name}-pasos.json`), JSON.stringify(pasosUi, null, 2));
  await page.screenshot({
    path: resolve(OUT, `${name}.png`) as `${string}.png`,
    fullPage: true,
  });
  const pasos = pick(html, /PASO\s+\d+[^<]*/gi);
  const formulas = pick(html, /class="katex[^"]*"[^>]*>[\s\S]*?<\/span>/gi).length;
  const glued = /Hagaclicenlasceldas/i.test(text);
  const noCumpleCero = /Celdas de zapata: valor 0/i.test(text);
  const taller = /Taller de maestr[ií]a/i.test(text);
  return {
    name,
    hash,
    len: text.length,
    pasos: pasos.slice(0, 20),
    glued,
    noCumpleCero,
    taller,
    hasFormula: /katex/i.test(html),
    pasosUi,
    snippet: text.replace(/\s+/g, " ").slice(0, 900),
  };
}

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--no-sandbox", "--disable-gpu", "--window-size=1440,2200"],
  defaultViewport: { width: 1440, height: 2200 },
});
const page = await browser.newPage();
page.setDefaultTimeout(60_000);

const results: unknown[] = [];
try {
  results.push(await shot(page, "#zapata-corrida", "v-zapata"));
  results.push(await shot(page, "#platea", "v-platea"));
  results.push(await shot(page, "#losa-2dir", "v-losa"));
  await page.goto(`${BASE}/#edificaciones`, { waitUntil: "networkidle2", timeout: 60_000 });
  await new Promise((r) => setTimeout(r, 1500));
  await page.evaluate(() => {
    const el = [...document.querySelectorAll("a,button,summary,[role='button']")].find((n) =>
      /edificaciones/i.test(n.textContent || ""),
    );
    (el as HTMLElement | undefined)?.click();
  });
  await new Promise((r) => setTimeout(r, 1200));
  const home = await page.evaluate(() => document.body.innerText || "");
  const cards = await page.evaluate(() =>
    [...document.querySelectorAll("a, h3, .card, .mod-card")]
      .map((n) => (n.textContent || "").replace(/\s+/g, " ").trim())
      .filter((t) => /losa|zapata|platea|taller|maestr/i.test(t))
      .slice(0, 40),
  );
  writeFileSync(resolve(OUT, "v-edificaciones.txt"), home + "\n\nCARDS\n" + cards.join("\n"));
  await page.screenshot({
    path: resolve(OUT, "v-edificaciones.png") as `${string}.png`,
    fullPage: true,
  });
  results.push({
    name: "edificaciones",
    taller: /Taller de maestr[ií]a/i.test(home),
    maestriaMod: /maestria-estructuras/i.test(home),
    cards,
    snippet: home.replace(/\s+/g, " ").slice(0, 700),
  });
} finally {
  await browser.close();
}

writeFileSync(resolve(OUT, "v-notes.json"), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));

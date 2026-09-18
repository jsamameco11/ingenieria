import puppeteer from "puppeteer-core";

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const BASE = process.env.APP_URL || "http://127.0.0.1:5175";

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--no-sandbox"],
  defaultViewport: { width: 1440, height: 1600 },
});
const page = await browser.newPage();

async function shotPaso(hash: string, out: string) {
  await page.goto(`${BASE}/${hash}`, { waitUntil: "networkidle2", timeout: 60_000 });
  await page.waitForSelector("section.paso", { timeout: 40_000 });
  await new Promise((r) => setTimeout(r, 1200));
  const el = await page.$("section.paso");
  if (el) await el.screenshot({ path: out as `${string}.png` });
}

await shotPaso("#zapata-corrida", "tmp-mae-verify/v-zapata-paso01.png");
await shotPaso("#platea", "tmp-mae-verify/v-platea-paso01.png");
await shotPaso("#losa-2dir", "tmp-mae-verify/v-losa-paso01.png");
await browser.close();
console.log("ok");

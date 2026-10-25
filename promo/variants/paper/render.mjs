import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const root = path.dirname(new URL(import.meta.url).pathname);
const executablePath = process.env.CHROME_BIN
  || `${process.env.HOME}/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`;
const scale = Number(process.env.SCALE || 2);
const times = process.env.TIMES ? process.env.TIMES.split(',').map(Number) : null;
const shotName = process.env.SHOT || null;

fs.mkdirSync(path.join(root, 'frames'), { recursive: true });

const browser = await chromium.launch({
  executablePath,
  headless: true,
  args: ['--hide-scrollbars', '--force-color-profile=srgb', '--disable-lcd-text'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: scale });
await page.addStyleTag({ content: 'html,body{cursor:none!important}' });
await page.goto(`file://${path.join(root, 'src', 'index.html')}`, { waitUntil: 'load' });
const info = await page.evaluate(() => window.initPromo());
if (process.env.HUD === '1') await page.evaluate(() => window.setPreviewHud(true));

let from = Number(process.env.FROM || 0);
let to = process.env.TO ? Number(process.env.TO) : null;
if (shotName) {
  const key = shotName.startsWith('s-') ? shotName : `s-${shotName}`;
  const found = info.shots.find((s) => s.id === key);
  if (!found) {
    console.error(`unknown shot: ${shotName}. known: ${info.shots.map((s) => s.id.replace('s-', '')).join(', ')}`);
    process.exit(2);
  }
  from = Math.round(found.start * info.fps);
  to = Math.round(found.end * info.fps);
}

const total = Math.ceil(info.duration * info.fps);
const end = to === null ? total : Math.min(to, total);
const frameList = times
  ? times.map((s) => Math.round(s * info.fps))
  : Array.from({ length: end - from }, (_, i) => from + i);
const meta = {
  from,
  to: end,
  fps: info.fps,
  duration: info.duration,
  shot: shotName,
  scale,
  frames: frameList.length,
};
fs.writeFileSync(path.join(root, 'frames', 'meta.json'), JSON.stringify(meta, null, 2));
console.log(`render ${frameList.length} frames (${from}..${end - 1}) of ${total} at ${scale}x, ${info.duration.toFixed(3)}s`);

const t0 = Date.now();
for (const [i, f] of frameList.entries()) {
  const t = f / info.fps;
  await page.evaluate((time) => window.renderFrame(time), t);
  await page.screenshot({ path: path.join(root, 'frames', `${String(f).padStart(5, '0')}.png`) });
  if (i % 60 === 0) {
    const elapsed = (Date.now() - t0) / 1000;
    console.log(`frame ${f} · ${elapsed.toFixed(1)}s`);
  }
}
await browser.close();
console.log(`done in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

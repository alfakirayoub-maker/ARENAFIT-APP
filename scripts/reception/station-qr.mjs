#!/usr/bin/env node
// Printable reception QR assets for one station (A5 poster + A6 counter card).
//
//   node scripts/reception/station-qr.mjs 'AFR1.<token>' \
//     --name 'Réception principale' --out ./print [--pdf] [--png] [--verify]
//
// Writes <out>/<slug>-a5.svg and <slug>-a6.svg (+ .pdf / .png with --pdf / --png,
// via the Playwright Chromium installed on the machine). --verify renders each
// layout and decodes the QR back, failing if it doesn't read the exact payload.
//
// The payload is a secret: it is encoded in the QR only — never printed as
// text, never logged here. Don't commit the generated files.
// Procedure (create / rotate / print): docs/RECEPTION.md.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import QRCode from 'qrcode';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const LOGO = join(ROOT, 'apps/mobile/assets/brand/arena-fit-logo.png');
const LOGO_RATIO = 1080 / 639; // official file, never reshaped

const args = process.argv.slice(2);
const payload = args.find((a) => !a.startsWith('--') && !isOptionValue(a));
function isOptionValue(a) {
  const i = args.indexOf(a);
  return i > 0 && ['--name', '--out'].includes(args[i - 1]);
}
const opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const flag = (k) => args.includes(k);

if (!/^AFR1\.[A-Za-z0-9_-]{43}$/.test(payload ?? '')) {
  console.error("Usage: node scripts/reception/station-qr.mjs 'AFR1.<43-char token>' --name 'Réception principale' --out ./print [--pdf] [--png] [--verify]");
  process.exit(1);
}
const name = opt('--name', 'Réception principale');
const outDir = opt('--out', '.');
const slug = name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const logoHref = `data:image/png;base64,${readFileSync(LOGO).toString('base64')}`;

/** QR as one black path, drawn inside a white square with a 4-module quiet zone. */
function qrSvg(x, y, size) {
  const qr = QRCode.create(payload, { errorCorrectionLevel: 'M' });
  const n = qr.modules.size;
  const quiet = 4;
  const cell = size / (n + 2 * quiet);
  let d = '';
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (qr.modules.get(r, c)) d += `M${(x + (c + quiet) * cell).toFixed(3)} ${(y + (r + quiet) * cell).toFixed(3)}h${cell.toFixed(3)}v${cell.toFixed(3)}h-${cell.toFixed(3)}z`;
    }
  }
  return `<rect x="${x}" y="${y}" width="${size}" height="${size}" fill="#FFFFFF"/><path d="${d}" fill="#000000"/>`;
}

// Sizes in millimetres.
const LAYOUTS = {
  a5: { w: 148, h: 210, band: 44, logoW: 56, head: 8.2, qr: 88, station: 6.2, hint: 3.8, gap: 1 },
  a6: { w: 105, h: 148, band: 30, logoW: 40, head: 5.8, qr: 62, station: 4.6, hint: 2.7, gap: 0.7 },
};

function layout(key) {
  const L = LAYOUTS[key];
  const cx = L.w / 2;
  const logoH = L.logoW / LOGO_RATIO;
  const font = "font-family=\"Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif\"";
  const headY1 = L.band + L.head * 2.1;
  const headY2 = headY1 + L.head * 1.15;
  const qrY = headY2 + L.head * 1.4;
  const qrX = cx - L.qr / 2;
  const frame = 5 * L.gap; // clear space around the QR before the outline
  const stationY = qrY + L.qr + frame + L.station * 2;
  const hintY = stationY + L.hint * 2.6;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${L.w}mm" height="${L.h}mm" viewBox="0 0 ${L.w} ${L.h}">
  <title>Arena Fit — ${esc(name)}</title>
  <rect width="${L.w}" height="${L.h}" fill="#FFFFFF"/>
  <rect width="${L.w}" height="${L.band}" fill="#0A0A0B"/>
  <image href="${logoHref}" x="${cx - L.logoW / 2}" y="${(L.band - logoH) / 2}" width="${L.logoW}" height="${logoH}" preserveAspectRatio="xMidYMid meet"/>
  <rect y="${L.band}" width="${L.w}" height="${L.gap * 1.6}" fill="#80B918"/>
  <text x="${cx}" y="${headY1}" text-anchor="middle" ${font} font-weight="800" font-size="${L.head}" fill="#0A0A0B" letter-spacing="0.2">SCANNEZ POUR UTILISER</text>
  <text x="${cx}" y="${headY2}" text-anchor="middle" ${font} font-weight="800" font-size="${L.head}" fill="#0A0A0B" letter-spacing="0.2">VOTRE PASS</text>
  <rect x="${qrX - frame}" y="${qrY - frame}" width="${L.qr + 2 * frame}" height="${L.qr + 2 * frame}" rx="${3 * L.gap}" fill="none" stroke="#D4D4D8" stroke-width="${0.35 * L.gap}"/>
  ${qrSvg(qrX, qrY, L.qr)}
  <text x="${cx}" y="${stationY}" text-anchor="middle" ${font} font-weight="700" font-size="${L.station}" fill="#0A0A0B">${esc(name)}</text>
  <text x="${cx}" y="${hintY}" text-anchor="middle" ${font} font-weight="500" font-size="${L.hint}" fill="#52525B">Ouvrez l’application Arena Fit puis touchez « Scanner le QR ».</text>
</svg>
`;
}

mkdirSync(outDir, { recursive: true });
const written = [];
for (const key of Object.keys(LAYOUTS)) {
  const file = join(outDir, `${slug}-${key}.svg`);
  writeFileSync(file, layout(key));
  written.push({ key, file });
  console.log(`✓ ${file}`);
}

if (flag('--pdf') || flag('--png') || flag('--verify')) {
  const require = createRequire(import.meta.url);
  let chromium;
  try {
    ({ chromium } = require('playwright'));
  } catch {
    console.error('Playwright is needed for --pdf / --png / --verify (npx playwright install chromium).');
    process.exit(1);
  }
  const browser = await chromium.launch();
  let failed = false;
  for (const { key, file } of written) {
    const L = LAYOUTS[key];
    const page = await browser.newPage({ viewport: { width: Math.round(L.w * 4), height: Math.round(L.h * 4) }, deviceScaleFactor: 2 });
    const svg = readFileSync(file, 'utf8').replace(/width="[\d.]+mm" height="[\d.]+mm"/, 'width="100%" height="100%"');
    await page.setContent(`<!doctype html><html><head><style>@page{size:${L.w}mm ${L.h}mm;margin:0}html,body{margin:0;width:100%;height:100%}svg{display:block}</style></head><body>${svg}</body></html>`);
    if (flag('--pdf')) {
      const pdf = file.replace(/\.svg$/, '.pdf');
      await page.pdf({ path: pdf, width: `${L.w}mm`, height: `${L.h}mm`, printBackground: true });
      console.log(`✓ ${pdf}`);
    }
    if (flag('--png') || flag('--verify')) {
      const png = await page.screenshot({ type: 'png' });
      if (flag('--png')) {
        writeFileSync(file.replace(/\.svg$/, '.png'), png);
        console.log(`✓ ${file.replace(/\.svg$/, '.png')}`);
      }
      if (flag('--verify')) {
        const { PNG } = require('pngjs');
        const jsQR = require('jsqr');
        const img = PNG.sync.read(png);
        const decoded = jsQR(new Uint8ClampedArray(img.data), img.width, img.height);
        const ok = decoded?.data === payload;
        failed ||= !ok;
        console.log(`${ok ? '✓' : '✗'} ${key}: QR ${ok ? 'decodes to the station payload' : 'did NOT decode correctly'}`);
      }
    }
    await page.close();
  }
  await browser.close();
  if (failed) process.exit(1);
}

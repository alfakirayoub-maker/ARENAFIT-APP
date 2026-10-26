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

import { buildStationPrintSvg, PRINT_FORMATS, RECEPTION_QR_PATTERN, stationSlug } from '@arenafit/reception-print';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const LOGO = join(ROOT, 'apps/mobile/assets/brand/arena-fit-logo.png');

const args = process.argv.slice(2);
const isOptionValue = (a) => {
  const i = args.indexOf(a);
  return i > 0 && ['--name', '--out'].includes(args[i - 1]);
};
const payload = args.find((a) => !a.startsWith('--') && !isOptionValue(a));
const opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const flag = (k) => args.includes(k);

if (!RECEPTION_QR_PATTERN.test(payload ?? '')) {
  console.error("Usage: node scripts/reception/station-qr.mjs 'AFR1.<43-char token>' --name 'Réception principale' --out ./print [--pdf] [--png] [--verify]");
  process.exit(1);
}
const name = opt('--name', 'Réception principale');
const outDir = opt('--out', '.');
const slug = stationSlug(name);
const logoHref = `data:image/png;base64,${readFileSync(LOGO).toString('base64')}`;
const LAYOUTS = PRINT_FORMATS;
const layout = (key) => buildStationPrintSvg({ payload, stationName: name, format: key, logoHref });

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

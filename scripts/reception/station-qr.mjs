#!/usr/bin/env node
// Turns a reception station QR payload (AFR1.<token>) into a printable SVG.
//
//   1. In the Supabase SQL editor (service role), create or rotate a station:
//        select public.create_reception_station('Réception principale');
//        select public.rotate_reception_station_token('<station id>');
//      Copy "qr_payload" from the result — it is shown ONCE (only its hash is stored).
//   2. node scripts/reception/station-qr.mjs 'AFR1.…' reception-principale.svg
//   3. Print it (≥ 8 cm wide), display it at the reception. Rotating the token
//      invalidates the previous print.
//
// Treat the payload like a key: don't commit it, don't send it around.
import { writeFileSync } from 'node:fs';
import QRCode from 'qrcode';

const [payload, out = 'reception-qr.svg'] = process.argv.slice(2);
if (!/^AFR1\.[A-Za-z0-9_-]{43}$/.test(payload ?? '')) {
  console.error('Usage: node scripts/reception/station-qr.mjs AFR1.<43-char token> [out.svg]');
  process.exit(1);
}
const svg = await QRCode.toString(payload, { type: 'svg', errorCorrectionLevel: 'M', margin: 4, color: { dark: '#000000', light: '#FFFFFF' } });
writeFileSync(out, svg);
console.log(`✓ ${out}`);

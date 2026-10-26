// Printable Arena Fit reception QR assets (A5 poster, A6 counter card).
// Shared by scripts/reception/station-qr.mjs (CLI) and the admin dashboard.
import QRCode from 'qrcode';

export const RECEPTION_QR_PATTERN = /^AFR1\.[A-Za-z0-9_-]{43}$/;

const LOGO_RATIO = 1080 / 639; // official file, never reshaped

// Millimetres.
const LAYOUTS = {
  a5: { w: 148, h: 210, band: 44, logoW: 56, head: 8.2, qr: 88, station: 6.2, hint: 3.8, gap: 1 },
  a6: { w: 105, h: 148, band: 30, logoW: 40, head: 5.8, qr: 62, station: 4.6, hint: 2.7, gap: 0.7 },
};

export const PRINT_FORMATS = { a5: { w: 148, h: 210 }, a6: { w: 105, h: 148 } };

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function stationSlug(name) {
  return (
    String(name)
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'reception'
  );
}

/** QR as one black path inside a white square with a 4-module quiet zone. */
function qrSvg(payload, x, y, size) {
  const qr = QRCode.create(payload, { errorCorrectionLevel: 'M' });
  const n = qr.modules.size;
  const quiet = 4;
  const cell = size / (n + 2 * quiet);
  let d = '';
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (qr.modules.get(r, c)) {
        d += `M${(x + (c + quiet) * cell).toFixed(3)} ${(y + (r + quiet) * cell).toFixed(3)}h${cell.toFixed(3)}v${cell.toFixed(3)}h-${cell.toFixed(3)}z`;
      }
    }
  }
  return `<rect x="${x}" y="${y}" width="${size}" height="${size}" fill="#FFFFFF"/><path d="${d}" fill="#000000"/>`;
}

export function buildStationPrintSvg({ payload, stationName, format, logoHref }) {
  if (!RECEPTION_QR_PATTERN.test(payload ?? '')) throw new Error('Invalid reception QR payload');
  const L = LAYOUTS[format];
  if (!L) throw new Error(`Unknown format: ${format}`);
  const cx = L.w / 2;
  const logoH = L.logoW / LOGO_RATIO;
  const font = `font-family="Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif"`;
  const headY1 = L.band + L.head * 2.1;
  const headY2 = headY1 + L.head * 1.15;
  const qrY = headY2 + L.head * 1.4;
  const qrX = cx - L.qr / 2;
  const frame = 5 * L.gap; // clear space around the QR before the outline
  const stationY = qrY + L.qr + frame + L.station * 2;
  const hintY = stationY + L.hint * 2.6;
  const hintY2 = hintY + L.hint * 1.35;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${L.w}mm" height="${L.h}mm" viewBox="0 0 ${L.w} ${L.h}">
  <title>Arena Fit — ${esc(stationName)}</title>
  <rect width="${L.w}" height="${L.h}" fill="#FFFFFF"/>
  <rect width="${L.w}" height="${L.band}" fill="#0A0A0B"/>
  <image href="${esc(logoHref)}" x="${cx - L.logoW / 2}" y="${(L.band - logoH) / 2}" width="${L.logoW}" height="${logoH}" preserveAspectRatio="xMidYMid meet"/>
  <rect y="${L.band}" width="${L.w}" height="${L.gap * 1.6}" fill="#80B918"/>
  <text x="${cx}" y="${headY1}" text-anchor="middle" ${font} font-weight="800" font-size="${L.head}" fill="#0A0A0B" letter-spacing="0.2">SCANNER POUR UTILISER</text>
  <text x="${cx}" y="${headY2}" text-anchor="middle" ${font} font-weight="800" font-size="${L.head}" fill="#0A0A0B" letter-spacing="0.2">VOTRE PASS</text>
  <rect x="${qrX - frame}" y="${qrY - frame}" width="${L.qr + 2 * frame}" height="${L.qr + 2 * frame}" rx="${3 * L.gap}" fill="none" stroke="#D4D4D8" stroke-width="${0.35 * L.gap}"/>
  ${qrSvg(payload, qrX, qrY, L.qr)}
  <text x="${cx}" y="${stationY}" text-anchor="middle" ${font} font-weight="700" font-size="${L.station}" fill="#0A0A0B">${esc(stationName)}</text>
  <text x="${cx}" y="${hintY}" text-anchor="middle" ${font} font-weight="500" font-size="${L.hint}" fill="#52525B">Ouvrez l’application Arena Fit puis scannez ce QR</text>
  <text x="${cx}" y="${hintY2}" text-anchor="middle" ${font} font-weight="500" font-size="${L.hint}" fill="#52525B">depuis “Utiliser mon Pass”.</text>
</svg>
`;
}

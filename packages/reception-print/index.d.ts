export type PrintFormat = 'a5' | 'a6';

export type PrintLayout = {
  /** Page size in millimetres. */
  w: number;
  h: number;
};

export const PRINT_FORMATS: Record<PrintFormat, PrintLayout>;

export const RECEPTION_QR_PATTERN: RegExp;

/**
 * Printable reception QR (SVG, sizes in mm). The payload is encoded in the QR
 * only — never written as text. `logoHref` is the official Arena Fit logo
 * (data: URI or URL), drawn unchanged at its native aspect ratio.
 */
export function buildStationPrintSvg(options: {
  payload: string;
  stationName: string;
  format: PrintFormat;
  logoHref: string;
}): string;

/** File-name friendly version of a station name. */
export function stationSlug(name: string): string;

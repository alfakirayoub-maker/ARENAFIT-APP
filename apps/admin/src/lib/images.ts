/**
 * Image uploads: JPEG, PNG or WebP up to 5 MB — checked here by type,
 * extension AND file signature (so a renamed executable or HTML file is
 * refused), and again by the storage buckets (allowed MIME types + size).
 */
export const IMAGE_BUCKETS = ['coaches', 'activities', 'classes', 'news'] as const;
export type ImageBucket = (typeof IMAGE_BUCKETS)[number];

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/**
 * Temporary presentation photography (presentation/README.md) lives under this
 * prefix. Shown like any image, but flagged « Photo de démo » so staff know to
 * replace it with a real Arena Fit photo.
 */
export const PRESENTATION_PREFIX = 'presentation/';
export const isPresentationImage = (key: string | null | undefined): boolean => !!key && key.startsWith(PRESENTATION_PREFIX);

const KINDS = {
  'image/jpeg': { ext: 'jpg', magic: (b: Uint8Array) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  'image/png': {
    ext: 'png',
    magic: (b: Uint8Array) => [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((v, i) => b[i] === v),
  },
  'image/webp': {
    ext: 'webp',
    magic: (b: Uint8Array) =>
      String.fromCharCode(...b.slice(0, 4)) === 'RIFF' && String.fromCharCode(...b.slice(8, 12)) === 'WEBP',
  },
} as const;
export type ImageMime = keyof typeof KINDS;

export type ImageCheck = { ok: true; mime: ImageMime; ext: string } | { ok: false; reason: string };

export function checkImage(file: { type: string; size: number; name: string }, head: Uint8Array): ImageCheck {
  const kind = KINDS[file.type as ImageMime];
  if (!kind) return { ok: false, reason: 'Format non accepté (JPEG, PNG ou WebP uniquement).' };
  if (file.size <= 0) return { ok: false, reason: 'Fichier vide.' };
  if (file.size > MAX_IMAGE_BYTES) return { ok: false, reason: 'Image trop lourde (5 Mo maximum).' };
  if (!kind.magic(head)) return { ok: false, reason: 'Le contenu du fichier ne correspond pas à une image valide.' };
  return { ok: true, mime: file.type as ImageMime, ext: kind.ext };
}

/** Storage key: <folder>/<random>.<ext> — never derived from the user's file name. */
export function imageKey(folder: string, ext: string, random: string = crypto.randomUUID()): string {
  return `${folder.replace(/[^a-z0-9-]/gi, '')}/${random}.${ext}`;
}

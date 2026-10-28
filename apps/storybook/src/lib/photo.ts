import type { LocalPhoto } from '@/lib/engine/types';

export const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const MAX_PHOTO_BYTES = 12 * 1024 * 1024;
const MAX_EDGE = 640;

export type PhotoError = 'errorType' | 'errorSize' | 'errorRead';

/**
 * Prepares a photo entirely in the browser: downscales it and re-encodes it as
 * JPEG. Re-encoding drops EXIF metadata (including GPS position), and the small
 * result fits in local storage. Nothing leaves the device.
 */
export async function preparePhoto(file: File): Promise<{ photo: LocalPhoto } | { error: PhotoError }> {
  if (!PHOTO_TYPES.includes(file.type)) return { error: 'errorType' };
  if (file.size > MAX_PHOTO_BYTES) return { error: 'errorSize' };
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return { error: 'errorRead' };
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    return { photo: { dataUrl: canvas.toDataURL('image/jpeg', 0.82), width, height } };
  } catch {
    return { error: 'errorRead' };
  }
}

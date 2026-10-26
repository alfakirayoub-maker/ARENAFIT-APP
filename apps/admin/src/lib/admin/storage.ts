import { AdminError, toAdminError } from '../errors';
import { checkImage, imageKey, type ImageBucket } from '../images';
import type { Db } from './core';

/** Validates then uploads an image; returns its storage key (stored in *_path columns). */
export async function uploadImage(db: Db, bucket: ImageBucket, folder: string, file: File): Promise<string> {
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const check = checkImage(file, head);
  if (!check.ok) throw new AdminError('invalid', check.reason);
  const key = imageKey(folder, check.ext);
  const { error } = await db.storage.from(bucket).upload(key, file, { contentType: check.mime, upsert: false, cacheControl: '31536000' });
  if (error) throw toAdminError(error);
  return key;
}

export function publicImageUrl(db: Db, bucket: ImageBucket, key: string | null | undefined): string | null {
  return key ? db.storage.from(bucket).getPublicUrl(key).data.publicUrl : null;
}

'use client';

import { publicImageUrl } from '@/lib/admin/storage';
import { isPresentationImage, type ImageBucket } from '@/lib/images';
import { getBrowserClient } from '@/lib/supabase/browser';

/** Small list thumbnail; a « Démo » tag marks temporary presentation photos. */
export function Thumb({ bucket, path }: { bucket: ImageBucket; path: string | null }) {
  const url = publicImageUrl(getBrowserClient(), bucket, path);
  return (
    <span className="thumb" aria-hidden style={url ? { backgroundImage: `url("${url}")` } : undefined}>
      {isPresentationImage(path) && <span className="thumb-tag">Démo</span>}
    </span>
  );
}

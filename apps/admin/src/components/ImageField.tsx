'use client';

import { useRef, useState } from 'react';

import { messageFor } from '@/lib/errors';
import { publicImageUrl, uploadImage } from '@/lib/admin/storage';
import { isPresentationImage, type ImageBucket } from '@/lib/images';
import { getBrowserClient } from '@/lib/supabase/browser';

import { Badge, Button } from './ui';

/**
 * Optional image (coach photo, activity cover, news cover, class override).
 * Validated (type, size, signature) before upload; the bucket re-checks. The
 * value is the storage key; empty means the app shows its fallback artwork.
 */
export function ImageField({
  bucket,
  folder,
  value,
  onChange,
  round,
  label,
}: {
  bucket: ImageBucket;
  folder: string;
  value: string | null;
  onChange: (key: string | null) => void;
  round?: boolean;
  label: string;
}) {
  const db = getBrowserClient();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const url = publicImageUrl(db, bucket, value);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      onChange(await uploadImage(db, bucket, folder, file));
    } catch (e) {
      setError(messageFor(e));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };

  return (
    <div className="field full">
      <span className="label">{label}</span>
      <div className="image-field">
        <div className={`preview${round ? ' round' : ''}`} style={url ? { backgroundImage: `url("${url}")` } : undefined}>
          {!url && 'Aucune image'}
        </div>
        {isPresentationImage(value) && (
          <span className="faint small" style={{ maxWidth: 260 }}>
            <Badge tone="warning">Photo de démo</Badge> Visuel temporaire de présentation — remplacez-le par une photo du club.
          </span>
        )}
        <div className="row">
          <Button size="sm" loading={busy} onClick={() => input.current?.click()}>
            {url ? 'Remplacer' : 'Ajouter une image'}
          </Button>
          {url && (
            <Button size="sm" variant="ghost" onClick={() => onChange(null)}>
              Retirer
            </Button>
          )}
          <input
            ref={input}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            hidden
            aria-label={label}
            onChange={(e) => onFile(e.target.files?.[0])}
          />
        </div>
      </div>
      {error ? (
        <span className="error" role="alert">
          {error}
        </span>
      ) : (
        <span className="hint">JPEG, PNG ou WebP · 5 Mo maximum. Sans image, l’application affiche son visuel par défaut.</span>
      )}
    </div>
  );
}

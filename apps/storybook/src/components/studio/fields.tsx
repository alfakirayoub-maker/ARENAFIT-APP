'use client';

/* eslint-disable @next/next/no-img-element -- local data-URL previews */
import { Check, ImagePlus, Lock, Minus, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { forwardRef, useId, useRef, useState, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react';

import { useI18n } from '@/i18n/client';
import type { LocalPhoto } from '@/lib/engine/types';
import { preparePhoto } from '@/lib/photo';

/** Translates a validation key from the schemas; falls back to the raw text. */
export function useErrorText() {
  const { t } = useI18n();
  return (key?: string) => (key ? ((t.studio.errors as Record<string, string>)[key] ?? (t.order.fieldErrors as Record<string, string>)[key] ?? key) : undefined);
}

export function FieldError({ id, children }: { id?: string; children?: ReactNode }) {
  if (!children) return null;
  return (
    <motion.p id={id} role="alert" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="mt-2 text-[0.92rem] font-medium text-coral-deep">
      {children}
    </motion.p>
  );
}

export function Label({ htmlFor, children, optional }: { htmlFor?: string; children: ReactNode; optional?: boolean }) {
  const { t } = useI18n();
  return (
    <label htmlFor={htmlFor} className="mb-2 flex items-baseline gap-2 text-[0.95rem] font-medium text-ink">
      {children}
      {optional && <span className="text-sm font-normal text-ink-muted">({t.studio.optional})</span>}
    </label>
  );
}

const inputBase =
  'w-full rounded-2xl border border-ink/15 bg-ivory/90 px-4 text-ink shadow-[inset_0_1px_2px_rgb(32_38_61/0.04)] outline-none transition-[border-color,box-shadow] placeholder:text-ink-muted/70 focus:border-lavender-deep focus:ring-4 focus:ring-lavender/60 aria-[invalid=true]:border-coral-deep';

export const TextInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { display?: boolean }>(function TextInput({ display, className = '', ...props }, ref) {
  return <input ref={ref} className={`${inputBase} ${display ? 'font-display min-h-16 text-2xl' : 'min-h-13 text-base'} ${className}`} {...props} />;
});

export const TextArea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function TextArea({ className = '', ...props }, ref) {
  return <textarea ref={ref} className={`${inputBase} min-h-28 resize-none py-3 text-base leading-relaxed ${className}`} {...props} />;
});

/** Radio-group tile. Uses a native radio so arrow keys, focus and screen readers work for free. */
export function ChoiceTile({
  name,
  value,
  checked,
  onSelect,
  children,
  className = '',
  tone = 'light',
}: {
  name: string;
  value: string;
  checked: boolean;
  onSelect: (value: string) => void;
  children: ReactNode;
  className?: string;
  tone?: 'light' | 'gold';
}) {
  const reduce = useReducedMotion();
  return (
    <label className={`group relative block cursor-pointer ${className}`}>
      <input type="radio" name={name} value={value} checked={checked} onChange={() => onSelect(value)} className="peer sr-only" />
      <motion.span
        whileTap={reduce ? undefined : { scale: 0.97 }}
        className={`relative flex h-full rounded-[1.25rem] border transition-[border-color,background-color,box-shadow] duration-200 peer-focus-visible:ring-4 peer-focus-visible:ring-lavender-deep/40 ${
          checked
            ? 'border-ink bg-ivory shadow-[0_12px_30px_-14px_rgb(32_38_61/0.5)]'
            : tone === 'gold'
              ? 'border-gold/60 bg-gold/15 hover:border-gold-deep/60'
              : 'border-ink/12 bg-ivory/70 hover:border-ink/30 hover:bg-ivory'
        }`}
      >
        {children}
        {checked && (
          <motion.span
            initial={reduce ? false : { scale: 0, rotate: -30 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
            className="absolute end-2.5 top-2.5 grid size-6 place-items-center rounded-full bg-ink text-ivory"
          >
            <Check className="size-3.5" strokeWidth={3} />
          </motion.span>
        )}
      </motion.span>
    </label>
  );
}

export function Segmented<T extends string>({ name, value, options, onChange, label }: { name: string; value?: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="grid auto-cols-fr grid-flow-col gap-1 rounded-2xl bg-ink/[0.06] p-1">
      {options.map((o) => (
        <label key={o.value} className="relative cursor-pointer">
          <input type="radio" name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} className="peer sr-only" />
          <span className="flex min-h-12 items-center justify-center rounded-xl px-3 text-center text-[0.95rem] font-medium text-ink-soft transition-colors peer-checked:bg-ivory peer-checked:text-ink peer-checked:shadow-[0_2px_8px_rgb(32_38_61/0.12)] peer-focus-visible:ring-2 peer-focus-visible:ring-lavender-deep">
            {o.label}
          </span>
        </label>
      ))}
    </div>
  );
}

export function AgeStepper({ value, onChange, min, max, format, labels, id }: { value?: number; onChange: (n: number) => void; min: number; max: number; format: (n: number) => string; labels: { decrease: string; increase: string }; id: string }) {
  const current = value ?? 0;
  const btn = 'grid size-12 shrink-0 place-items-center rounded-full bg-ivory text-ink ring-1 ring-ink/15 transition hover:ring-ink/40 active:scale-95 disabled:opacity-35';
  return (
    <div className="flex items-center gap-3">
      <button type="button" className={btn} aria-label={labels.decrease} aria-controls={id} disabled={!!value && current <= min} onClick={() => onChange(value ? Math.max(min, current - 1) : 4)}>
        <Minus className="size-5" />
      </button>
      <output id={id} aria-live="polite" className="font-display min-w-[5.5rem] text-center text-2xl tabular-nums">
        {value ? format(value) : '—'}
      </output>
      <button type="button" className={btn} aria-label={labels.increase} aria-controls={id} disabled={current >= max} onClick={() => onChange(value ? Math.min(max, current + 1) : 4)}>
        <Plus className="size-5" />
      </button>
    </div>
  );
}

/**
 * Optional photo, processed and kept on the device. A parent/guardian consent
 * box appears once a photo is chosen; without consent the photo is not used.
 */
export function PhotoField({
  label,
  photo,
  consent,
  onChange,
  onConsent,
  altName,
  consentError,
}: {
  label: string;
  photo?: LocalPhoto;
  consent: boolean;
  onChange: (photo?: LocalPhoto) => void;
  onConsent: (v: boolean) => void;
  altName: string;
  consentError?: boolean;
}) {
  const { t } = useI18n();
  const input = useRef<HTMLInputElement>(null);
  const id = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const pick = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    setError(undefined);
    const res = await preparePhoto(file);
    setBusy(false);
    if ('error' in res) setError(t.studio.photo[res.error]);
    else {
      onChange(res.photo);
      onConsent(false);
    }
    if (input.current) input.current.value = '';
  };

  return (
    <div>
      <Label htmlFor={id} optional>
        {label}
      </Label>
      <div className="flex items-center gap-4">
        <button
          type="button"
          tabIndex={-1}
          onClick={() => input.current?.click()}
          className="group relative grid size-20 shrink-0 place-items-center overflow-hidden rounded-[45%] bg-lavender/60 ring-2 ring-gold/60 ring-offset-2 ring-offset-ivory transition hover:ring-gold"
          aria-hidden
        >
          {photo ? <img src={photo.dataUrl} alt={t.studio.photo.alt(altName)} className="size-full object-cover" /> : <ImagePlus className="size-7 text-lavender-deep" aria-hidden />}
        </button>
        <div className="min-w-0">
          {photo ? (
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => input.current?.click()} className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-ink/5 px-3.5 text-sm font-medium hover:bg-ink/10">
                <RefreshCw className="size-4" /> {t.studio.photo.replace}
              </button>
              <button
                type="button"
                onClick={() => {
                  onChange(undefined);
                  onConsent(false);
                }}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-ink/5 px-3.5 text-sm font-medium text-coral-deep hover:bg-coral/20"
              >
                <Trash2 className="size-4" /> {t.studio.photo.remove}
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => input.current?.click()} aria-describedby={`${id}-help`} className="inline-flex min-h-10 items-center rounded-full bg-ink/5 px-4 text-sm font-medium hover:bg-ink/10">
              {busy ? t.studio.photo.processing : t.studio.photo.add}
            </button>
          )}
          <p id={`${id}-help`} className="mt-1.5 flex items-start gap-1.5 text-[0.82rem] leading-snug text-ink-muted">
            <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <span>
              {t.studio.photo.privacy} {t.studio.photo.formats}
            </span>
          </p>
        </div>
        <input id={id} ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" tabIndex={-1} onChange={(e) => pick(e.target.files?.[0])} />
      </div>
      <FieldError>{error}</FieldError>
      {photo && (
        <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-2xl bg-gold/15 p-3.5 text-[0.9rem] leading-snug text-ink">
          <input type="checkbox" checked={consent} onChange={(e) => onConsent(e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-[#20263d]" aria-invalid={consentError || undefined} />
          <span>{t.studio.photo.consent}</span>
        </label>
      )}
      {photo && consentError && !consent && <FieldError>{t.studio.photo.consentRequired}</FieldError>}
    </div>
  );
}

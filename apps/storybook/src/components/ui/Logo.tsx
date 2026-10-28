import { BRAND } from '@/config/brand';
import type { Locale } from '@/lib/engine/types';

/** Wordmark: an open book whose pages become a crescent of light. */
export function Logo({ locale, className = '' }: { locale: Locale; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <svg viewBox="0 0 40 32" className="h-7 w-8 shrink-0" aria-hidden>
        <path d="M20 8 C14 4 7 4 2 6 L2 27 C7 25 14 25 20 29 Z" fill="#20263d" />
        <path d="M20 8 C26 4 33 4 38 6 L38 27 C33 25 26 25 20 29 Z" fill="#3b4260" />
        <path d="M20 8 L20 29" stroke="#e8bc75" strokeWidth="1.4" />
        <path d="M26 3 C22 6 22 12 26 15 C21 15 18 11 19.5 6.5 C20.5 4.5 23 3 26 3 Z" fill="#e8bc75" />
      </svg>
      <span className="font-display text-[1.45rem] leading-none tracking-[-0.01em]">{locale === 'ar' ? 'حكاية' : BRAND.name}</span>
    </span>
  );
}

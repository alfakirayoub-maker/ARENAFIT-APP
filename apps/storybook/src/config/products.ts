import type { BookFormat, BookFormatId } from '@/lib/engine/types';

/**
 * Book formats and PLACEHOLDER prices (MAD).
 *
 * ⚠️ These prices are not commercial decisions. Edit them here once confirmed and
 * set `pricePlaceholder: false` — the UI stops showing the "provisional" notice.
 */
export const BOOK_FORMATS: Record<BookFormatId, BookFormat> = {
  'digital-pdf': { id: 'digital-pdf', physical: false, price: 149, currency: 'MAD', pricePlaceholder: true, pages: 28 },
  'printed-softcover': {
    id: 'printed-softcover',
    physical: true,
    price: 299,
    currency: 'MAD',
    pricePlaceholder: true,
    pages: 28,
    dimensionsCm: '21 × 21',
  },
  'premium-hardcover': {
    id: 'premium-hardcover',
    physical: true,
    price: 449,
    currency: 'MAD',
    pricePlaceholder: true,
    pages: 32,
    dimensionsCm: '24 × 24',
  },
};

export const FORMAT_ORDER: BookFormatId[] = ['digital-pdf', 'printed-softcover', 'premium-hardcover'];
export const MAX_QUANTITY = 5;

/** Delivery is quoted later: no shipping price or delay is promised in the demo. */
export const DELIVERY = { quoted: false } as const;

export function formatPrice(amount: number, locale: string): string {
  const tag = locale === 'ar' ? 'ar-MA' : locale === 'en' ? 'en-MA' : 'fr-MA';
  return new Intl.NumberFormat(tag, { style: 'currency', currency: 'MAD', maximumFractionDigits: 0 }).format(amount);
}

import type { TFunction } from 'i18next';

import { DataError } from '@/data/errors';
import { clubDaysUntil } from '@/lib/club-time';
import { colors } from '@/theme';

import { GuestPassError, type GuestInvitationStatus, type Invitation } from './types';

export const statusTone: Record<GuestInvitationStatus, 'neutral' | 'accent' | 'success' | 'warning' | 'error'> = {
  sent: 'warning',
  activated: 'accent',
  used: 'neutral',
  expired: 'neutral',
  cancelled: 'neutral',
  converted: 'success',
};

/** "Expire dans 12 jours" for an invitation still waiting, else null. */
export function expiryLabel(inv: Invitation, t: TFunction, now: Date = new Date()): string | null {
  if (inv.status !== 'sent') return null;
  const days = clubDaysUntil(inv.expiresAt, now);
  return days <= 0 ? t('guestPass.expiresToday') : t('guestPass.expiresIn', { count: days });
}

/** "Invitation envoyée — Expire dans 12 jours", "Pass activé", … */
export function invitationLine(inv: Invitation, t: TFunction, now: Date = new Date()): string {
  const label = t(`guestPass.status.${inv.status}`);
  const expiry = expiryLabel(inv, t, now);
  return expiry ? `${label} — ${expiry}` : label;
}

export const toneColor = {
  neutral: colors.textTertiary,
  accent: colors.primary,
  success: colors.success,
  warning: colors.warning,
  error: colors.error,
} as const;

/** User-facing message for a failed Guest Pass operation. */
export function errorMessage(error: unknown, t: TFunction): string {
  if (error instanceof GuestPassError) {
    switch (error.code) {
      case 'no_pass_available':
      case 'daily_limit':
      case 'not_eligible':
      case 'invalid_name':
      case 'not_cancellable':
      case 'not_shareable':
        return t(`guestPass.errors.${error.code}`);
      default:
        return t('guestPass.errors.generic');
    }
  }
  if (error instanceof DataError) {
    if (error.kind === 'network') return t('guestPass.errors.network');
    if (error.kind === 'config') return t('guestPass.errors.config');
  }
  return t('guestPass.errors.generic');
}

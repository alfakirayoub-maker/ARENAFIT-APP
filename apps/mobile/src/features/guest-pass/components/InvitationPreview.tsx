import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Logo } from '@/components/brand/Logo';
import { Button } from '@/components/ui/Button';
import { DetailScreen } from '@/components/ui/DetailScreen';
import { ErrorState } from '@/components/ui/ErrorState';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { useToast } from '@/components/ui/Toast';
import { useSession } from '@/features/session/session';
import { haptics } from '@/lib/haptics';
import { formatInstantDateLong } from '@/lib/club-time';
import { colors, radius, spacing } from '@/theme';

import { useActivateInvitation, useInvitationPreview } from '../hooks';
import type { InvitationRef } from '../links';
import { errorMessage } from '../presentation';
import type { ActivationResult, PreviewResult } from '../types';

type StateKey = Exclude<PreviewResult, 'valid' | 'yours'> | Exclude<ActivationResult['result'], 'activated' | 'already_active'>;

const stateIcon: Record<StateKey, IconName> = {
  invalid: 'help-circle-outline',
  expired: 'time-outline',
  cancelled: 'close-circle-outline',
  already_claimed: 'lock-closed-outline',
  rate_limited: 'hourglass-outline',
  own_invitation: 'person-outline',
  not_eligible: 'star-outline',
  has_active_pass: 'ticket-outline',
  used: 'checkmark-done-outline',
};

/**
 * Invitation preview → « Activer mon Pass ». Nothing is created before the
 * tap: the preview is a public, read-only lookup by secret; the guest identity
 * and the claim happen on activation only.
 */
export function InvitationPreview({ invitation }: { invitation: InvitationRef | null }) {
  const { t } = useTranslation();
  const toast = useToast();
  const { session } = useSession();
  const preview = useInvitationPreview(invitation);
  const activate = useActivateInvitation();
  const [outcome, setOutcome] = useState<StateKey | null>(null);

  const result = preview.data?.result;
  // Already holding this pass (e.g. the link opened twice) → straight to it.
  useEffect(() => {
    if (result === 'yours' && session.kind === 'guest') router.replace('/guest/pass');
  }, [result, session.kind]);

  if (!invitation) return <StateView state="invalid" />;
  if (preview.isError) {
    return (
      <DetailScreen>
        <ErrorState onRetry={() => preview.refetch()} />
      </DetailScreen>
    );
  }
  if (!preview.data) {
    return (
      <DetailScreen>
        <Skeleton height={60} width={160} borderRadius={radius.md} />
        <Skeleton height={260} borderRadius={radius.xl} />
      </DetailScreen>
    );
  }

  const data = preview.data;
  if (outcome) return <StateView state={outcome} />;
  if (data.result !== 'valid' && data.result !== 'yours') return <StateView state={data.result} />;
  if (session.kind === 'member') return <StateView state="not_eligible" />;

  const onActivate = () =>
    activate.mutate(invitation, {
      onSuccess: (r) => {
        if (r.result === 'activated' || r.result === 'already_active') {
          haptics.success();
          router.replace({ pathname: '/guest/pass', params: { welcome: '1' } });
        } else {
          setOutcome(r.result);
        }
      },
      onError: (e) => toast.show(errorMessage(e, t), 'alert-circle'),
    });

  const sessions = data.sessions ?? 1;

  return (
    <DetailScreen
      footer={
        <View style={styles.footer}>
          <Button label={t('guestPass.invite.activate')} size="lg" fullWidth loading={activate.isPending} onPress={onActivate} />
          <Button label={t('guestPass.invite.discover')} variant="ghost" fullWidth onPress={() => router.replace('/')} />
        </View>
      }>
      <View style={styles.logo}>
        <Logo height={40} />
      </View>

      <View style={styles.texts}>
        <Text variant="title" color="accent" accessibilityRole="header" style={styles.center}>
          {t('guestPass.invite.gift')}
        </Text>
        <Text variant="display" style={styles.center}>
          {data.inviterName ? t('guestPass.invite.invitedBy', { name: data.inviterName }) : t('guestPass.invite.invitedAnonymous')}
        </Text>
      </View>

      <View style={styles.ticket} accessible>
        <View style={styles.ticketRow}>
          <Icon name="barbell-outline" size={20} color={colors.primary} />
          <Text variant="heading">{t('guestPass.invite.sessions', { count: sessions })}</Text>
        </View>
        <View style={styles.ticketDivider} />
        {data.expiresAt && (
          <Text variant="body" color="secondary">
            {t('guestPass.invite.validUntil', { date: formatInstantDateLong(data.expiresAt) })}
          </Text>
        )}
      </View>

      <Text variant="caption" color="tertiary" style={styles.center}>
        {t('guestPass.invite.terms')}
      </Text>
    </DetailScreen>
  );
}

function StateView({ state }: { state: StateKey }) {
  const { t } = useTranslation();
  return (
    <DetailScreen
      footer={
        <View style={styles.footer}>
          {state === 'has_active_pass' || state === 'used' ? (
            <Button label={t('guestPass.home.use')} size="lg" fullWidth onPress={() => router.replace('/guest/pass')} />
          ) : (
            <Button label={t('guestPass.invite.discover')} size="lg" fullWidth onPress={() => router.replace('/')} />
          )}
          {(state === 'invalid' || state === 'rate_limited') && (
            <Button label={t('guestPass.invite.enterCode')} variant="ghost" fullWidth onPress={() => router.replace('/invite/code')} />
          )}
        </View>
      }>
      <View style={styles.logo}>
        <Logo height={40} />
      </View>
      <View style={styles.stateIcon}>
        <Icon name={stateIcon[state]} size={30} color={colors.textSecondary} />
      </View>
      <View style={styles.texts}>
        <Text variant="title" accessibilityRole="header" style={styles.center}>
          {t(`guestPass.invite.states.${state}.title`)}
        </Text>
        <Text variant="body" color="secondary" style={styles.center}>
          {t(`guestPass.invite.states.${state}.body`)}
        </Text>
      </View>
    </DetailScreen>
  );
}

const styles = StyleSheet.create({
  logo: { alignItems: 'center', marginBottom: spacing.xl },
  texts: { gap: spacing.sm },
  center: { textAlign: 'center' },
  ticket: {
    gap: spacing.md,
    padding: spacing.xl,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.brandMuted,
  },
  ticketRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  ticketDivider: { height: 1, backgroundColor: colors.border },
  stateIcon: {
    alignSelf: 'center',
    width: 72,
    height: 72,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: { gap: spacing.xs },
});

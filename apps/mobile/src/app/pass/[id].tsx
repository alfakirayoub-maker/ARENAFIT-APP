import { Redirect, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Badge } from '@/components/ui/Badge';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { DetailScreen } from '@/components/ui/DetailScreen';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { useToast } from '@/components/ui/Toast';
import { FallbackCode } from '@/features/guest-pass/components/FallbackCode';
import {
  useCanOfferPasses,
  useCancelInvitation,
  useInvitationShareDetails,
  useMyInvitations,
  useShareInvitation,
} from '@/features/guest-pass/hooks';
import { errorMessage, expiryLabel, statusTone } from '@/features/guest-pass/presentation';
import type { Invitation } from '@/features/guest-pass/types';
import { useSession } from '@/features/session/session';
import { formatInstantDateLong } from '@/lib/club-time';
import { colors, radius, spacing } from '@/theme';

/** One invitation: status, history, « Partager à nouveau » and « Annuler » while unused. */
export default function InvitationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const toast = useToast();
  const { restored } = useSession();
  const canOffer = useCanOfferPasses();
  const query = useMyInvitations();
  const invitation = query.data?.invitations.find((i) => i.id === id);
  const pending = invitation?.status === 'sent';
  const details = useInvitationShareDetails(id, pending);
  const share = useShareInvitation();
  const cancel = useCancelInvitation();
  const [confirming, setConfirming] = useState(false);

  if (!restored) return null;
  if (!canOffer) return <Redirect href="/pass" />;

  if (!invitation) {
    return (
      <DetailScreen>
        {query.isError ? (
          <ErrorState onRetry={() => query.refetch()} />
        ) : query.data ? (
          <EmptyState icon="mail-outline" title={t('guestPass.detail.notFound')} />
        ) : (
          <Skeleton height={200} borderRadius={radius.xl} />
        )}
      </DetailScreen>
    );
  }

  const name = invitation.inviteeName ?? t('guestPass.unnamed');

  return (
    <DetailScreen
      footer={
        pending ? (
          <View style={styles.footer}>
            <Button
              label={t('guestPass.detail.shareAgain')}
              icon="share-outline"
              size="lg"
              fullWidth
              loading={share.isPending}
              onPress={() =>
                share.mutate(
                  { invitationId: invitation.id, via: 'sheet' },
                  {
                    onSuccess: (o) =>
                      o === 'copied'
                        ? toast.show(t('guestPass.created.copied'), 'copy-outline')
                        : o === 'shared' && toast.show(t('guestPass.created.shared')),
                    onError: (e) => toast.show(errorMessage(e, t), 'alert-circle'),
                  },
                )
              }
            />
            <Button label={t('guestPass.detail.cancel')} variant="ghost" fullWidth onPress={() => setConfirming(true)} />
          </View>
        ) : undefined
      }>
      <View style={styles.header}>
        <Badge label={t(`guestPass.status.${invitation.status}`)} tone={statusTone[invitation.status]} />
        <Text variant="display" accessibilityRole="header" numberOfLines={2}>
          {name}
        </Text>
        {expiryLabel(invitation, t) && (
          <Text variant="body" color="secondary">
            {expiryLabel(invitation, t)}
          </Text>
        )}
      </View>

      {pending && details.data && <FallbackCode code={details.data.shortCode} />}
      {pending && details.data === null && (
        <Text variant="caption" color="tertiary">
          {t('guestPass.detail.newLinkNote')}
        </Text>
      )}

      <View style={styles.block}>
        <Text variant="heading" accessibilityRole="header">
          {t('guestPass.detail.timeline')}
        </Text>
        <Timeline invitation={invitation} />
        {(invitation.status === 'cancelled' || invitation.status === 'expired') && (
          <Text variant="caption" color="tertiary">
            {t('guestPass.detail.passReturned')}
          </Text>
        )}
      </View>

      <BottomSheet
        visible={confirming}
        onClose={() => setConfirming(false)}
        closeLabel={t('common.close')}
        title={t('guestPass.detail.cancelTitle')}
        subtitle={t('guestPass.detail.cancelBody')}>
        <Button
          label={t('guestPass.detail.cancelConfirm')}
          variant="secondary"
          fullWidth
          loading={cancel.isPending}
          onPress={() =>
            cancel.mutate(invitation.id, {
              onSuccess: () => {
                setConfirming(false);
                toast.show(t('guestPass.detail.cancelDone'));
              },
              onError: (e) => {
                setConfirming(false);
                toast.show(errorMessage(e, t), 'alert-circle');
              },
            })
          }
        />
        <Button label={t('guestPass.detail.keep')} variant="ghost" fullWidth onPress={() => setConfirming(false)} />
      </BottomSheet>
    </DetailScreen>
  );
}

function Timeline({ invitation: inv }: { invitation: Invitation }) {
  const { t } = useTranslation();
  const d = (iso: string) => formatInstantDateLong(iso);
  const steps: { icon: IconName; label: string; active?: boolean }[] = [
    { icon: 'gift-outline', label: t('guestPass.detail.created', { date: d(inv.createdAt) }) },
  ];
  if (inv.lastSharedAt) steps.push({ icon: 'share-outline', label: t('guestPass.detail.shared', { date: d(inv.lastSharedAt) }) });
  if (inv.activatedAt) steps.push({ icon: 'checkmark-circle-outline', label: t('guestPass.detail.activated', { date: d(inv.activatedAt) }) });
  if (inv.usedAt) steps.push({ icon: 'barbell-outline', label: t('guestPass.detail.used', { date: d(inv.usedAt) }) });
  if (inv.convertedAt) steps.push({ icon: 'star-outline', label: t('guestPass.detail.converted', { date: d(inv.convertedAt) }) });
  if (inv.cancelledAt) steps.push({ icon: 'close-circle-outline', label: t('guestPass.detail.cancelled', { date: d(inv.cancelledAt) }) });
  if (inv.expiredAt) steps.push({ icon: 'time-outline', label: t('guestPass.detail.expired', { date: d(inv.expiredAt) }) });
  if (inv.status === 'sent' || inv.status === 'activated') {
    steps.push({ icon: 'hourglass-outline', label: t('guestPass.detail.validUntil', { date: d(inv.expiresAt) }), active: true });
  }
  return (
    <View style={styles.timeline}>
      {steps.map((s, i) => (
        <View key={i} style={styles.step}>
          <View style={[styles.stepIcon, s.active && styles.stepIconActive]}>
            <Icon name={s.icon} size={16} color={s.active ? colors.primary : colors.textSecondary} />
          </View>
          <Text variant="body" color={s.active ? 'primary' : 'secondary'} style={styles.stepText}>
            {s.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.sm, alignItems: 'flex-start' },
  block: { gap: spacing.md },
  footer: { gap: spacing.xs },
  timeline: { gap: spacing.md, padding: spacing.lg, borderRadius: radius.xl, backgroundColor: colors.surface },
  step: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  stepIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepIconActive: { backgroundColor: colors.primaryMuted },
  stepText: { flex: 1 },
});

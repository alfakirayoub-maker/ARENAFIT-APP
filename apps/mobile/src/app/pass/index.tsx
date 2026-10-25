import { Redirect } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Badge } from '@/components/ui/Badge';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { DetailScreen } from '@/components/ui/DetailScreen';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon } from '@/components/ui/Icon';
import { ListGroup } from '@/components/ui/ListRow';
import { Text } from '@/components/ui/Text';
import { useSession } from '@/features/session/session';
import { formatPublishedAt } from '@/lib/club-time';
import { colors, fontFamily, radius, spacing } from '@/theme';
import type { GuestInvitationStatus } from '@/types/domain';

const statusTone: Record<GuestInvitationStatus, 'neutral' | 'accent' | 'success' | 'warning' | 'error'> = {
  sent: 'warning',
  activated: 'accent',
  used: 'neutral',
  expired: 'error',
  cancelled: 'error',
  converted: 'success',
};

/**
 * Profil › Pass & Invitations (members only).
 * Sprint 2: UI with mock data. Sharing, invitation links and deferred deep
 * linking (Branch) arrive in the Guest Pass sprint.
 */
export default function PassScreen() {
  const { t } = useTranslation();
  const { session } = useSession();
  const [soonVisible, setSoonVisible] = useState(false);

  if (session.kind !== 'member') return <Redirect href="/profil" />;
  const { allowance, available, invitations } = session.guestPasses;

  return (
    <DetailScreen
      footer={
        <Button
          label={t('guestPass.offer')}
          icon="gift-outline"
          size="lg"
          fullWidth
          disabled={available === 0}
          onPress={() => setSoonVisible(true)}
        />
      }>
      <Text variant="display" accessibilityRole="header">
        {t('profile.passes')}
      </Text>

      {/* Balance */}
      <View style={styles.balance} accessible accessibilityLabel={`${t('guestPass.myPasses')}: ${available} ${t('guestPass.available')}`}>
        <Text variant="overline" color="secondary" uppercase>
          {t('guestPass.myPasses')}
        </Text>
        <View style={styles.balanceRow}>
          <Text style={styles.bigNumber} maxFontSizeMultiplier={1.2}>
            {available}
          </Text>
          <Text variant="subheading" color="secondary">
            {t('guestPass.available')}
          </Text>
        </View>
        <View style={styles.dots}>
          {Array.from({ length: allowance }, (_, i) => (
            <View key={i} style={[styles.dot, { backgroundColor: i < available ? colors.primary : colors.surfacePressed }]} />
          ))}
        </View>
        {available === 0 && (
          <Text variant="caption" color="tertiary">
            {t('guestPass.noneLeft')}
          </Text>
        )}
      </View>

      {/* How it works */}
      <View style={styles.block}>
        <Text variant="heading" accessibilityRole="header">
          {t('guestPass.howItWorks')}
        </Text>
        {(['share', 'install', 'visit'] as const).map((step, i) => (
          <View key={step} style={styles.step}>
            <View style={styles.stepNumber}>
              <Text variant="label" color="accent">
                {i + 1}
              </Text>
            </View>
            <Text variant="body" color="secondary" style={styles.stepText}>
              {t(`guestPass.steps.${step}`)}
            </Text>
          </View>
        ))}
      </View>

      {/* Invitations */}
      <View style={styles.block}>
        <Text variant="heading" accessibilityRole="header">
          {t('guestPass.invitations')}
        </Text>
        {invitations.length === 0 ? (
          <EmptyState compact icon="mail-outline" title={t('empty.noInvitations.title')} body={t('empty.noInvitations.body')} />
        ) : (
          <ListGroup>
            {invitations.map((inv) => (
              <View
                key={inv.id}
                style={styles.invitation}
                accessible
                accessibilityLabel={`${inv.inviteeName ?? ''}, ${t(`guestPass.status.${inv.status}`)}`}>
                <View style={styles.invitationIcon}>
                  <Icon name="person-outline" size={18} />
                </View>
                <View style={styles.invitationText}>
                  <Text variant="bodyStrong">{inv.inviteeName ?? '—'}</Text>
                  <Text variant="caption" color="tertiary">
                    {formatPublishedAt(inv.createdAt)}
                  </Text>
                </View>
                <Badge label={t(`guestPass.status.${inv.status}`)} tone={statusTone[inv.status]} />
              </View>
            ))}
          </ListGroup>
        )}
      </View>

      <BottomSheet
        visible={soonVisible}
        onClose={() => setSoonVisible(false)}
        closeLabel={t('common.close')}
        title={t('guestPass.offerSoon.title')}
        subtitle={t('guestPass.offerSoon.body')}>
        <Button label={t('common.close')} variant="secondary" fullWidth onPress={() => setSoonVisible(false)} />
      </BottomSheet>
    </DetailScreen>
  );
}

const styles = StyleSheet.create({
  balance: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.xl, gap: spacing.sm },
  balanceRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  bigNumber: { fontFamily: fontFamily.extrabold, fontSize: 56, lineHeight: 62, color: colors.textPrimary },
  dots: { flexDirection: 'row', gap: spacing.xs },
  dot: { width: 28, height: 6, borderRadius: radius.pill },
  block: { gap: spacing.md },
  step: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: { flex: 1 },
  invitation: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg },
  invitationIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  invitationText: { flex: 1, gap: spacing.xxs },
});

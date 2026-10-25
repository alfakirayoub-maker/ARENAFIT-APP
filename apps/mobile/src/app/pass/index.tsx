import { Redirect, router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { DetailScreen } from '@/components/ui/DetailScreen';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Icon } from '@/components/ui/Icon';
import { ListGroup } from '@/components/ui/ListRow';
import { PressableScale } from '@/components/ui/PressableScale';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { useMyInvitations } from '@/features/guest-pass/hooks';
import { invitationLine, statusTone, toneColor } from '@/features/guest-pass/presentation';
import type { Invitation } from '@/features/guest-pass/types';
import { useSession } from '@/features/session/session';
import { colors, fontFamily, radius, spacing } from '@/theme';

/** Profil › Pass & Invitations (members only). */
export default function PassScreen() {
  const { t } = useTranslation();
  const { session, restored } = useSession();
  const query = useMyInvitations();

  if (!restored) return null;
  if (session.kind !== 'member') return <Redirect href="/profil" />;

  if (session.demo) {
    return (
      <DetailScreen>
        <Text variant="display" accessibilityRole="header">
          {t('profile.passes')}
        </Text>
        <Card>
          <Text variant="body" color="secondary">
            {t('guestPass.demoNotice')}
          </Text>
        </Card>
      </DetailScreen>
    );
  }

  const data = query.data;
  const available = data?.available ?? 0;

  return (
    <DetailScreen
      footer={
        <Button
          label={t('guestPass.offer')}
          icon="gift-outline"
          size="lg"
          fullWidth
          disabled={!data || available === 0}
          onPress={() => router.push('/pass/offer')}
        />
      }>
      <Text variant="display" accessibilityRole="header">
        {t('profile.passes')}
      </Text>

      {/* Balance */}
      {data === undefined ? (
        query.isError ? (
          <ErrorState onRetry={() => query.refetch()} />
        ) : (
          <Skeleton height={150} borderRadius={radius.xl} />
        )
      ) : (
        <View
          style={styles.balance}
          accessible
          accessibilityLabel={`${t('guestPass.myPasses')}: ${available} ${t('guestPass.available', { count: available })}`}>
          <Text variant="overline" color="secondary" uppercase>
            {t('guestPass.myPasses')}
          </Text>
          <View style={styles.balanceRow}>
            <Text style={styles.bigNumber} maxFontSizeMultiplier={1.2}>
              {available}
            </Text>
            <Text variant="subheading" color="secondary">
              {t('guestPass.available', { count: available })}
            </Text>
          </View>
          <View style={styles.dots}>
            {Array.from({ length: Math.max(data.allowance, available) }, (_, i) => (
              <View key={i} style={[styles.dot, { backgroundColor: i < available ? colors.primary : colors.surfacePressed }]} />
            ))}
          </View>
          <Text variant="caption" color="tertiary">
            {available === 0 ? t('guestPass.noneLeft') : t('guestPass.returnRule')}
          </Text>
        </View>
      )}

      {/* Invitations */}
      <View style={styles.block}>
        <Text variant="heading" accessibilityRole="header">
          {t('guestPass.invitations')}
        </Text>
        {data === undefined ? null : data.invitations.length === 0 ? (
          <EmptyState compact icon="mail-outline" title={t('empty.noInvitations.title')} body={t('empty.noInvitations.body')} />
        ) : (
          <ListGroup>
            {data.invitations.map((inv) => (
              <InvitationRow key={inv.id} invitation={inv} />
            ))}
          </ListGroup>
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
    </DetailScreen>
  );
}

function InvitationRow({ invitation: inv }: { invitation: Invitation }) {
  const { t } = useTranslation();
  const name = inv.inviteeName ?? t('guestPass.unnamed');
  const line = invitationLine(inv, t);
  return (
    <PressableScale
      onPress={() => router.push({ pathname: '/pass/[id]', params: { id: inv.id } })}
      scaleTo={0.99}
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${line}`}
      style={styles.invitation}>
      <View style={styles.invitationIcon}>
        <Icon name={inv.status === 'converted' ? 'star-outline' : 'person-outline'} size={18} />
      </View>
      <View style={styles.invitationText}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {name}
        </Text>
        <View style={styles.statusLine}>
          <View style={[styles.statusDot, { backgroundColor: toneColor[statusTone[inv.status]] }]} />
          <Text variant="caption" color="secondary" numberOfLines={2} style={styles.flex}>
            {line}
          </Text>
        </View>
      </View>
      <Icon name="chevron-forward" size={16} color={colors.textTertiary} />
    </PressableScale>
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
  statusLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  flex: { flex: 1 },
});

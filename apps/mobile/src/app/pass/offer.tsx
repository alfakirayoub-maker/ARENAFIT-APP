import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { DetailScreen } from '@/components/ui/DetailScreen';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { useToast } from '@/components/ui/Toast';
import { FallbackCode } from '@/features/guest-pass/components/FallbackCode';
import { ShareMessagePreview } from '@/features/guest-pass/components/ShareMessagePreview';
import { useCanOfferPasses, useCreateInvitation, useMyInvitations, useShareInvitation } from '@/features/guest-pass/hooks';
import { buildShareMessage } from '@/features/guest-pass/links';
import { errorMessage } from '@/features/guest-pass/presentation';
import { haptics } from '@/lib/haptics';
import { useSession } from '@/features/session/session';
import { formatInstantDateLong } from '@/lib/club-time';
import { colors, radius, spacing } from '@/theme';

/** Offrir un Pass: name (optional) → invitation created server-side → share. */
export default function OfferPassScreen() {
  const { t } = useTranslation();
  const toast = useToast();
  const { restored } = useSession();
  const canOffer = useCanOfferPasses();
  const overview = useMyInvitations();
  const create = useCreateInvitation();
  const share = useShareInvitation();
  const [name, setName] = useState('');

  if (!restored) return null;
  if (!canOffer) return <Redirect href="/pass" />;

  const created = create.data;
  const available = overview.data?.available ?? 0;

  const onShare = (via: 'sheet' | 'whatsapp') => {
    if (!created) return;
    share.mutate(
      { invitationId: created.invitationId, via },
      {
        onSuccess: (outcome) => {
          if (outcome === 'copied') toast.show(t('guestPass.created.copied'), 'copy-outline');
          else if (outcome === 'shared') toast.show(t('guestPass.created.shared'));
        },
        onError: (e) => toast.show(errorMessage(e, t), 'alert-circle'),
      },
    );
  };

  if (created) {
    const message = buildShareMessage(created.url);
    return (
      <DetailScreen
        footer={
          <View style={styles.footer}>
            <Button label={t('guestPass.created.share')} icon="share-outline" size="lg" fullWidth loading={share.isPending} onPress={() => onShare('sheet')} />
            <View style={styles.footerRow}>
              <Button label={t('guestPass.created.whatsapp')} icon="logo-whatsapp" variant="secondary" style={styles.flex} onPress={() => onShare('whatsapp')} />
              <Button label={t('guestPass.created.done')} variant="ghost" onPress={() => router.back()} />
            </View>
          </View>
        }>
        <View style={styles.header}>
          <View style={styles.giftMark}>
            <Icon name="gift-outline" size={26} color={colors.primary} />
          </View>
          <Text variant="display" accessibilityRole="header">
            {t('guestPass.created.title')}
          </Text>
          <Text variant="body" color="secondary">
            {t('guestPass.created.body')}
          </Text>
          <Text variant="caption" color="tertiary">
            {t('guestPass.offerScreen.sessions')} · {t('guestPass.detail.validUntil', { date: formatInstantDateLong(created.expiresAt) })}
          </Text>
        </View>
        <ShareMessagePreview message={message} url={created.url} />
        <FallbackCode code={created.shortCode} />
      </DetailScreen>
    );
  }

  return (
    <DetailScreen
      footer={
        <Button
          label={t('guestPass.offerScreen.create')}
          icon="gift-outline"
          size="lg"
          fullWidth
          loading={create.isPending}
          disabled={!overview.data || available === 0}
          onPress={() =>
            create.mutate(name.trim() || null, {
              onSuccess: () => haptics.success(),
              onError: (e) => toast.show(errorMessage(e, t), 'alert-circle'),
            })
          }
        />
      }>
      <View style={styles.header}>
        <Text variant="display" accessibilityRole="header">
          {t('guestPass.offerScreen.title')}
        </Text>
        <Text variant="body" color="secondary">
          {t('guestPass.offerScreen.body')}
        </Text>
      </View>

      <View style={styles.facts}>
        <Fact icon="barbell-outline" label={t('guestPass.offerScreen.sessions')} />
        <Fact icon="refresh-outline" label={t('guestPass.returnRule')} />
      </View>

      <TextField
        label={t('guestPass.offerScreen.nameLabel')}
        hint={t('guestPass.offerScreen.nameOptional')}
        placeholder={t('guestPass.offerScreen.namePlaceholder')}
        value={name}
        onChangeText={setName}
        maxLength={60}
        autoCapitalize="words"
        autoCorrect={false}
        returnKeyType="done"
      />

      {overview.data && (
        <Text variant="caption" color="tertiary">
          {available === 0 ? t('guestPass.noneLeft') : t('guestPass.offerScreen.remaining', { count: available - 1 })}
        </Text>
      )}
    </DetailScreen>
  );
}

function Fact({ icon, label }: { icon: 'barbell-outline' | 'refresh-outline'; label: string }) {
  return (
    <View style={styles.fact}>
      <Icon name={icon} size={18} color={colors.primary} />
      <Text variant="body" color="secondary" style={styles.flex}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.sm },
  giftMark: {
    width: 52,
    height: 52,
    borderRadius: radius.lg,
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  facts: { gap: spacing.md, padding: spacing.lg, borderRadius: radius.xl, backgroundColor: colors.surface },
  fact: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
  footer: { gap: spacing.sm },
  footerRow: { flexDirection: 'row', gap: spacing.sm },
});

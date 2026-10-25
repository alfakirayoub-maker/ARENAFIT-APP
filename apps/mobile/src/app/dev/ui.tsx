import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Logo } from '@/components/brand/Logo';
import { ClassCard } from '@/components/cards/ClassCard';
import { MediaCard } from '@/components/cards/MediaCard';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { FadeIn } from '@/components/ui/FadeIn';
import { IconButton } from '@/components/ui/IconButton';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { ClassCardSkeleton, MediaCardSkeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { colors, radius, spacing, typography, type TypographyVariant } from '@/theme';
import { useUpcomingSessions } from '@/data/queries';

// Dev-only visual QA page for the design system. Not reachable in production.

const swatches = Object.entries(colors).filter(([, v]) => v.startsWith('#'));
const filters = ['Tous', 'Fitness', 'Combat', 'Cycling', 'Mind & Body'];

export default function UiKitScreen() {
  const [filter, setFilter] = useState(filters[0]);
  const sampleSessions = useUpcomingSessions({ limit: 2 }).data ?? [];

  if (!__DEV__) return <Redirect href="/" />;

  return (
    <Screen>
      <ScreenHeader
        eyebrow={<Logo />}
        title="UI kit"
        subtitle="Arena Fit design system"
        right={<IconButton icon="close" accessibilityLabel="Fermer" onPress={() => router.back()} />}
      />

      <SectionHeader title="Colors" />
      <View style={styles.swatches}>
        {swatches.map(([name, value]) => (
          <View key={name} style={styles.swatch}>
            <View style={[styles.swatchColor, { backgroundColor: value }]} />
            <Text variant="caption" color="secondary" numberOfLines={1}>
              {name}
            </Text>
          </View>
        ))}
      </View>

      <SectionHeader title="Typography" />
      <View style={styles.stack}>
        {(Object.keys(typography) as TypographyVariant[]).map((v) => (
          <Text key={v} variant={v}>
            {v} — Prochain cours
          </Text>
        ))}
      </View>

      <SectionHeader title="Buttons" />
      <View style={styles.stack}>
        <Button label="Me le rappeler" icon="notifications-outline" />
        <Button label="Offrir un Pass" icon="gift-outline" variant="secondary" />
        <Button label="Voir tout" variant="ghost" />
        <Button label="Valider" size="lg" fullWidth />
        <Button label="Chargement" loading />
      </View>

      <SectionHeader title="Chips" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {filters.map((f) => (
          <Chip key={f} label={f} selected={f === filter} onPress={() => setFilter(f)} />
        ))}
      </ScrollView>

      <SectionHeader title="Badges" />
      <View style={[styles.row, styles.wrap]}>
        <Badge label="Tous niveaux" />
        <Badge label="Mode Invité" tone="accent" icon="person-outline" />
        <Badge label="Pass activé" tone="success" />
        <Badge label="Invitation envoyée" tone="warning" />
        <Badge label="Pass expiré" tone="error" />
      </View>

      <SectionHeader title="Class cards" actionLabel="Voir tout" onAction={() => {}} />
      <View style={styles.stack}>
        {sampleSessions.map((s, i) => (
          <FadeIn key={s.id} index={i}>
            <ClassCard session={s} />
          </FadeIn>
        ))}
        <ClassCardSkeleton />
      </View>

      <SectionHeader title="Media cards" />
      <View style={styles.stack}>
        <MediaCard eyebrow="Cycling" title="RPM" category="cycling" subtitle="Coach ANAS D" onPress={() => {}} />
        <MediaCardSkeleton />
      </View>

      <SectionHeader title="Cards" />
      <View style={styles.stack}>
        <Card>
          <Text variant="subheading">Arena Premium</Text>
          <Text variant="caption" color="secondary">
            Valide jusqu’au 24/08/2027
          </Text>
        </Card>
        <Card variant="accent" onPress={() => {}} accessibilityLabel="Offrir un Pass">
          <Text variant="subheading">🎁 2 Pass à offrir</Text>
          <Text variant="caption" color="secondary">
            Invitez un proche à découvrir Arena Fit.
          </Text>
        </Card>
      </View>

      <SectionHeader title="Empty state" />
      <EmptyState
        compact
        icon="calendar-outline"
        title="Aucun cours aujourd’hui"
        body="Consultez le planning de la semaine."
        actionLabel="Voir le planning"
        onAction={() => {}}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.md, marginBottom: spacing.xxxl },
  row: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xxxl },
  wrap: { flexWrap: 'wrap' },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginBottom: spacing.xxxl },
  swatch: { width: 76, gap: spacing.xs },
  swatchColor: {
    height: 44,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
});

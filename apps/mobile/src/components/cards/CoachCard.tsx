import { router } from 'expo-router';
import { StyleSheet } from 'react-native';

import { Avatar } from '@/components/ui/Avatar';
import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { spacing } from '@/theme';
import type { CoachRef } from '@/types/domain';

/** Round portrait + name, for horizontal coach rails. */
export function CoachCard({ coach, subtitle }: { coach: CoachRef; subtitle?: string }) {
  return (
    <PressableScale
      onPress={() => router.push({ pathname: '/coaches/[slug]', params: { slug: coach.slug } })}
      accessibilityLabel={['Coach', coach.displayName, subtitle].filter(Boolean).join(', ')}
      style={styles.card}>
      <Avatar name={coach.displayName} imageUrl={coach.photoUrl} size={72} />
      <Text variant="label" numberOfLines={1} align="center">
        {coach.displayName}
      </Text>
      {subtitle && (
        <Text variant="caption" color="tertiary" numberOfLines={1} align="center">
          {subtitle}
        </Text>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: { width: 88, alignItems: 'center', gap: spacing.xs },
});

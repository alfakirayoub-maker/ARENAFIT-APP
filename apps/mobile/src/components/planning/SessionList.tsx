import { StyleSheet, View } from 'react-native';

import { ClassCard } from '@/components/cards/ClassCard';
import { Text } from '@/components/ui/Text';
import { relativeDayLabel } from '@/features/planning/session-utils';
import { spacing } from '@/theme';
import type { ClassSession } from '@/types/domain';

/** Sessions grouped under day headings ("Aujourd’hui", "Demain", "Mardi 27…"). */
export function SessionList({ sessions }: { sessions: ClassSession[] }) {
  const days = [...new Set(sessions.map((s) => s.date))];
  return (
    <View style={styles.container}>
      {days.map((date) => (
        <View key={date} style={styles.day}>
          <Text variant="label" color="secondary">
            {relativeDayLabel(date)}
          </Text>
          {sessions
            .filter((s) => s.date === date)
            .map((s) => (
              <ClassCard key={s.id} session={s} />
            ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.xl },
  day: { gap: spacing.sm },
});

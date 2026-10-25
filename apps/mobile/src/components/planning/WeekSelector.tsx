import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { IconButton } from '@/components/ui/IconButton';
import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { formatDayLong, formatDayOfMonth, formatMonthYear, formatWeekdayShort, weekDates, type ClubDate } from '@/lib/club-time';
import { colors, radius, spacing } from '@/theme';

export type WeekSelectorProps = {
  monday: ClubDate;
  selected: ClubDate;
  today: ClubDate;
  onSelect: (date: ClubDate) => void;
  /** Omit to disable the corresponding arrow. */
  onPreviousWeek?: () => void;
  onNextWeek?: () => void;
  /** Dates with at least one class get a dot. */
  datesWithClasses?: Set<ClubDate>;
};

/** "Lun 7 · Mar 8 · …" — seven equal day pills with week navigation. */
export function WeekSelector({
  monday,
  selected,
  today,
  onSelect,
  onPreviousWeek,
  onNextWeek,
  datesWithClasses,
}: WeekSelectorProps) {
  const { t } = useTranslation();
  const days = weekDates(monday);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text variant="subheading">{formatMonthYear(selected)}</Text>
        <View style={styles.nav}>
          <IconButton
            icon="chevron-back"
            accessibilityLabel={t('planning.previousWeek')}
            onPress={onPreviousWeek}
            disabled={!onPreviousWeek}
            size={36}
          />
          <IconButton
            icon="chevron-forward"
            accessibilityLabel={t('planning.nextWeek')}
            onPress={onNextWeek}
            disabled={!onNextWeek}
            size={36}
          />
        </View>
      </View>
      <View style={styles.days}>
        {days.map((date) => {
          const isSelected = date === selected;
          const isToday = date === today;
          const isPast = date < today;
          const hasClasses = datesWithClasses?.has(date) ?? false;
          return (
            <PressableScale
              key={date}
              onPress={() => onSelect(date)}
              haptic="selection"
              accessibilityRole="tab"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={isToday ? `${t('common.today')}, ${formatDayLong(date)}` : formatDayLong(date)}
              style={[styles.day, isSelected && styles.daySelected]}>
              <Text
                variant="caption"
                maxFontSizeMultiplier={1.2}
                style={{ color: isSelected ? colors.onPrimary : isPast ? colors.textTertiary : colors.textSecondary }}>
                {formatWeekdayShort(date)}
              </Text>
              <Text
                variant="subheading"
                maxFontSizeMultiplier={1.2}
                style={{ color: isSelected ? colors.onPrimary : isPast ? colors.textTertiary : colors.textPrimary }}>
                {formatDayOfMonth(date)}
              </Text>
              <View
                style={[
                  styles.dot,
                  { backgroundColor: hasClasses ? (isSelected ? colors.onPrimary : isToday ? colors.primary : colors.textTertiary) : 'transparent' },
                ]}
              />
            </PressableScale>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  nav: { flexDirection: 'row', gap: spacing.sm },
  days: { flexDirection: 'row', gap: spacing.xs },
  day: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xxs,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  daySelected: { backgroundColor: colors.primary },
  dot: { width: 4, height: 4, borderRadius: 2, marginTop: spacing.xxs },
});

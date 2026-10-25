import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { Logo } from '@/components/brand/Logo';
import { ClassCard } from '@/components/cards/ClassCard';
import { GuestPassCard } from '@/components/cards/GuestPassCard';
import { MediaCard } from '@/components/cards/MediaCard';
import { MembershipCard } from '@/components/cards/MembershipCard';
import { NextClassCard } from '@/components/cards/NextClassCard';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { FadeIn } from '@/components/ui/FadeIn';
import { PressableScale } from '@/components/ui/PressableScale';
import { Screen } from '@/components/ui/Screen';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { ClassCardSkeleton, Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { queryKeys, useActivities, useRefresh, useTodaySessions, useUpcomingSessions } from '@/data/queries';
import { useFavoriteActivities } from '@/features/favorites/store';
import { hasStarted } from '@/features/planning/session-utils';
import { useSession } from '@/features/session/session';
import { colors, radius, screenGutter, spacing } from '@/theme';

const TODAY_LIMIT = 3;

export default function HomeScreen() {
  const { t } = useTranslation();
  const { session } = useSession();
  const upcomingQuery = useUpcomingSessions({ limit: 4 });
  const todayQuery = useTodaySessions();
  const activitiesQuery = useActivities();
  const favorites = useFavoriteActivities();
  const refresh = useRefresh(queryKeys.sessions, queryKeys.activities);

  const nextClass = upcomingQuery.data?.[0];
  // The hero already shows the next class; the day list shows what follows it.
  const laterToday = (todayQuery.data ?? []).filter((s) => !s.isCancelled && !hasStarted(s) && s.id !== nextClass?.id);
  const favoriteActivities = (activitiesQuery.data ?? []).filter((a) => favorites.isFavorite(a.slug));

  const firstName = session.kind === 'member' ? session.member.firstName : session.kind === 'guest' ? session.firstName : null;

  return (
    <Screen
      refreshControl={
        <RefreshControl refreshing={refresh.refreshing} onRefresh={refresh.onRefresh} tintColor={colors.primary} />
      }>
      {/* Header */}
      <View style={styles.header}>
        <Logo height={26} />
        {session.kind === 'member' && (
          <PressableScale
            onPress={() => router.push('/profil')}
            accessibilityLabel={t('tabs.profile')}
            accessibilityRole="link">
            <Avatar name={`${session.member.firstName} ${session.member.lastName}`} imageUrl={session.member.avatarUrl} size={40} />
          </PressableScale>
        )}
      </View>

      <View style={styles.greeting}>
        {session.kind === 'guest' && <Badge label={t('guestPass.guestMode')} tone="accent" icon="person-outline" />}
        <Text variant="display" accessibilityRole="header">
          {firstName ? t('home.greeting', { name: firstName }) : t('home.greetingAnonymous')}
        </Text>
        <Text variant="body" color="secondary">
          {t('home.subtitle')}
        </Text>
      </View>

      {/* 1. Next class — the most useful thing on the screen */}
      <Section title={t('home.nextClass')}>
        {upcomingQuery.data === undefined ? (
          upcomingQuery.isError ? (
            <ErrorState compact onRetry={() => upcomingQuery.refetch()} />
          ) : (
            <Skeleton height={330} borderRadius={radius.xl} />
          )
        ) : nextClass ? (
          <FadeIn>
            <NextClassCard session={nextClass} />
          </FadeIn>
        ) : (
          <EmptyState compact icon="calendar-outline" title={t('home.noUpcoming.title')} body={t('home.noUpcoming.body')} />
        )}
      </Section>

      {/* 2. Today's schedule */}
      <Section
        title={t('home.todaySchedule')}
        actionLabel={t('common.seeAll')}
        onAction={() => router.push('/planning')}>
        {todayQuery.data === undefined ? (
          todayQuery.isError ? (
            <ErrorState compact onRetry={() => todayQuery.refetch()} />
          ) : (
            <View style={styles.list}>
              <ClassCardSkeleton />
              <ClassCardSkeleton />
            </View>
          )
        ) : laterToday.length > 0 ? (
          <View style={styles.list}>
            {laterToday.slice(0, TODAY_LIMIT).map((s, i) => (
              <FadeIn key={s.id} index={i}>
                <ClassCard session={s} />
              </FadeIn>
            ))}
          </View>
        ) : (
          <EmptyState
            compact
            icon="moon-outline"
            title={t('home.dayDone.title')}
            body={t('home.dayDone.body')}
            actionLabel={t('home.seePlanning')}
            onAction={() => router.push('/planning')}
          />
        )}
      </Section>

      {/* 3. Guest Pass — visible but secondary */}
      {session.kind === 'member' && session.guestPasses.available > 0 && (
        <View style={styles.section}>
          <GuestPassCard available={session.guestPasses.available} />
        </View>
      )}

      {/* 4. Favorite activities */}
      <Section
        title={t('home.favoriteActivities')}
        actionLabel={favoriteActivities.length > 0 ? t('home.manage') : undefined}
        onAction={() => router.push('/activites')}>
        {activitiesQuery.data === undefined ? (
          activitiesQuery.isError ? (
            <ErrorState compact onRetry={() => activitiesQuery.refetch()} />
          ) : (
            <View style={styles.rail}>
              <Skeleton width={140} height={150} borderRadius={radius.xl} />
              <Skeleton width={140} height={150} borderRadius={radius.xl} />
            </View>
          )
        ) : favoriteActivities.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.bleed}
            contentContainerStyle={styles.railContent}>
            {favoriteActivities.map((a) => (
              <MediaCard
                key={a.id}
                title={a.name}
                eyebrow={t(`categories.${a.category}`)}
                imageUrl={a.imageUrl}
                category={a.category}
                width={140}
                height={150}
                onPress={() => router.push({ pathname: '/activities/[slug]', params: { slug: a.slug } })}
              />
            ))}
          </ScrollView>
        ) : (
          <EmptyState
            compact
            icon="heart-outline"
            title={t('empty.noFavorites.title')}
            body={t('empty.noFavorites.body')}
            actionLabel={t('empty.noFavorites.action')}
            onAction={() => router.push('/activites')}
          />
        )}
      </Section>

      {/* 5. Membership summary */}
      {session.kind === 'member' && session.member.membership && (
        <Section title={t('home.membership')}>
          <MembershipCard
            membership={session.member.membership}
            holderName={`${session.member.firstName} ${session.member.lastName}`}
          />
        </Section>
      )}
    </Screen>
  );
}

function Section({
  title,
  actionLabel,
  onAction,
  children,
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <SectionHeader title={title} actionLabel={actionLabel} onAction={onAction} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
    marginTop: spacing.sm,
  },
  greeting: { gap: spacing.xs, marginTop: spacing.xl, marginBottom: spacing.xxl },
  section: { marginBottom: spacing.xxxl },
  list: { gap: spacing.md },
  rail: { flexDirection: 'row', gap: spacing.md },
  bleed: { marginHorizontal: -screenGutter },
  railContent: { paddingHorizontal: screenGutter, gap: spacing.md },
});

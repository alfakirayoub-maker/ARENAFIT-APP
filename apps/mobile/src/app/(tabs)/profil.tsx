import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Alert, Platform, StyleSheet, View } from 'react-native';

import { MembershipCard } from '@/components/cards/MembershipCard';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { ChipRow } from '@/components/ui/ChipRow';
import { EmptyState } from '@/components/ui/EmptyState';
import { ListGroup, ListRow } from '@/components/ui/ListRow';
import { Screen } from '@/components/ui/Screen';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Text } from '@/components/ui/Text';
import { useActivities } from '@/data/queries';
import { dataSource } from '@/data/source';
import { useFavoriteActivities } from '@/features/favorites/store';
import { useNotificationPermission } from '@/features/reminders/hooks';
import { setSimulatedPermission } from '@/features/reminders/simulated-permission';
import { useSession, type SessionKind } from '@/features/session/session';
import { spacing } from '@/theme';

export default function ProfileScreen() {
  const { t } = useTranslation();
  const { session, setMockKind, signOut } = useSession();
  const favorites = useFavoriteActivities();
  const activitiesQuery = useActivities();
  const favoriteActivities = (activitiesQuery.data ?? []).filter((a) => favorites.isFavorite(a.slug));

  const displayName =
    session.kind === 'member'
      ? `${session.member.firstName} ${session.member.lastName}`
      : session.kind === 'guest'
        ? (session.firstName ?? t('profile.kind.guest'))
        : t('profile.kind.visitor');

  const confirmSignOut = () =>
    Alert.alert(t('profile.logout'), undefined, [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('profile.logout'), style: 'destructive', onPress: signOut },
    ]);

  return (
    <Screen>
      {/* Identity */}
      <View style={styles.identity}>
        <Avatar
          name={displayName}
          imageUrl={session.kind === 'member' ? session.member.avatarUrl : null}
          size={72}
          highlighted={session.kind === 'member'}
        />
        <View style={styles.identityText}>
          <Text variant="title" accessibilityRole="header" numberOfLines={1}>
            {displayName}
          </Text>
          {session.kind === 'guest' ? (
            <Badge label={t('guestPass.guestMode')} tone="accent" icon="person-outline" />
          ) : (
            <Badge label={t(`profile.kind.${session.kind}`)} tone={session.kind === 'member' ? 'success' : 'neutral'} />
          )}
        </View>
      </View>

      {/* Membership / sign-in / guest welcome */}
      <View style={styles.section}>
        {session.kind === 'member' && session.member.membership ? (
          <MembershipCard membership={session.member.membership} holderName={displayName} />
        ) : session.kind === 'visitor' ? (
          <Card>
            <Text variant="subheading">{t('profile.visitor.title')}</Text>
            <Text variant="body" color="secondary" style={styles.cardBody}>
              {t('profile.visitor.body')}
            </Text>
            <Button label={t('profile.visitor.action')} icon="log-in-outline" onPress={() => router.push('/login')} />
          </Card>
        ) : session.kind === 'guest' ? (
          <Card variant="accent">
            <Text variant="subheading">{t('profile.guest.title')}</Text>
            <Text variant="body" color="secondary" style={styles.cardBody}>
              {t('profile.guest.body')}
            </Text>
          </Card>
        ) : null}
      </View>

      {/* Favorites */}
      <View style={styles.section}>
        <SectionHeader
          title={t('profile.favorites')}
          actionLabel={t('home.manage')}
          onAction={() => router.push('/activites')}
        />
        {favoriteActivities.length > 0 ? (
          <View style={styles.chips}>
            {favoriteActivities.map((a) => (
              <Chip
                key={a.id}
                label={a.name}
                onPress={() => router.push({ pathname: '/activities/[slug]', params: { slug: a.slug } })}
              />
            ))}
          </View>
        ) : (
          <EmptyState compact icon="heart-outline" title={t('empty.noFavorites.title')} body={t('empty.noFavorites.body')} />
        )}
      </View>

      {/* My club */}
      <View style={styles.section}>
        <SectionHeader title={t('profile.sections.club')} />
        <ListGroup>
          {session.kind === 'member' && (
            <ListRow
              icon="gift-outline"
              label={t('profile.passes')}
              value={`${session.guestPasses.available}`}
              onPress={() => router.push('/pass')}
            />
          )}
          <ListRow icon="notifications-outline" label={t('profile.notifications')} onPress={() => router.push('/settings/notifications')} />
        </ListGroup>
      </View>

      {/* App */}
      <View style={styles.section}>
        <SectionHeader title={t('profile.sections.app')} />
        <ListGroup>
          <ListRow icon="settings-outline" label={t('profile.account')} onPress={() => router.push('/settings/account')} />
          <ListRow icon="help-circle-outline" label={t('profile.help')} onPress={() => router.push('/help')} />
          {session.kind !== 'visitor' && (
            <ListRow icon="log-out-outline" label={t('profile.logout')} destructive onPress={confirmSignOut} />
          )}
        </ListGroup>
      </View>

      {setMockKind && <DevTools kind={session.kind} onChange={setMockKind} />}
    </Screen>
  );
}

/** Development-only: preview the app as a visitor, guest or member. */
function DevTools({ kind, onChange }: { kind: SessionKind; onChange: (k: SessionKind) => void }) {
  const { t } = useTranslation();
  return (
    <View style={styles.section}>
      <SectionHeader title={t('profile.dev')} />
      <Text variant="caption" color="tertiary" style={styles.devHint}>
        {t('profile.devSession')}
      </Text>
      <ChipRow
        options={(['visitor', 'guest', 'member'] as const).map((k) => ({ value: k, label: t(`profile.kind.${k}`) }))}
        value={kind}
        onChange={onChange}
      />
      <Text variant="caption" color="tertiary" style={styles.devHint}>
        {t('profile.devDataSource')} : {dataSource}
      </Text>
      {Platform.OS === 'web' && <SimulatedPermission />}
      <View style={styles.devButton}>
        <Button label="UI kit" variant="ghost" icon="color-palette-outline" onPress={() => router.push('/dev/ui')} />
      </View>
    </View>
  );
}

/** Web preview only: pick the notification permission the simulated OS reports. */
function SimulatedPermission() {
  const { t } = useTranslation();
  const { permission } = useNotificationPermission();
  return (
    <>
      <Text variant="caption" color="tertiary" style={styles.devHint}>
        {t('profile.devPermission')}
      </Text>
      <ChipRow
        options={[
          { value: 'undetermined' as const, label: t('notificationSettings.permissionUndetermined') },
          { value: 'granted' as const, label: t('notificationSettings.permissionGranted') },
          { value: 'denied' as const, label: t('notificationSettings.permissionDenied') },
        ]}
        value={permission === 'granted' || permission === 'denied' ? permission : 'undetermined'}
        onChange={setSimulatedPermission}
      />
    </>
  );
}

const styles = StyleSheet.create({
  identity: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, marginTop: spacing.xl },
  identityText: { flex: 1, gap: spacing.sm },
  section: { marginTop: spacing.xxxl },
  cardBody: { marginTop: spacing.xs, marginBottom: spacing.lg },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  devHint: { marginBottom: spacing.sm },
  devButton: { marginTop: spacing.md },
});

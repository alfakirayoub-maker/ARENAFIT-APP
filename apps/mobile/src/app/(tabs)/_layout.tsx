import { Tabs } from 'expo-router/js-tabs';
import { useTranslation } from 'react-i18next';

import { TabBar } from '@/components/navigation/TabBar';

export default function TabsLayout() {
  const { t } = useTranslation();

  return (
    <Tabs tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: t('tabs.home') }} />
      <Tabs.Screen name="planning" options={{ title: t('tabs.planning') }} />
      <Tabs.Screen name="activites" options={{ title: t('tabs.activities') }} />
      <Tabs.Screen name="actualites" options={{ title: t('tabs.news') }} />
      <Tabs.Screen name="profil" options={{ title: t('tabs.profile') }} />
    </Tabs>
  );
}

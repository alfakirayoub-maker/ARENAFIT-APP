import '@/i18n';

import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/inter';
import { QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, ThemeProvider, type Theme } from 'expo-router';
import { Stack } from 'expo-router/stack';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { ToastProvider } from '@/components/ui/Toast';
import { queryClient, useRefetchOnAppForeground } from '@/data/queries';
import { ReminderSheetProvider } from '@/features/reminders/ReminderSheet';
import { NotificationRouter } from '@/features/notifications/NotificationRouter';
import { ReminderSync } from '@/features/reminders/hooks';
import { SessionProvider } from '@/features/session/session';
import { colors } from '@/theme';

SplashScreen.preventAutoHideAsync();

const navigationTheme: Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: colors.primary,
    background: colors.background,
    card: colors.background,
    text: colors.textPrimary,
    border: colors.border,
    notification: colors.primary,
  },
};

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });
  const ready = fontsLoaded || fontError !== null;
  useRefetchOnAppForeground();

  useEffect(() => {
    if (ready) SplashScreen.hide();
  }, [ready]);

  // Keep the native splash until fonts are in, to avoid a flash of system type.
  if (!ready) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <ThemeProvider value={navigationTheme}>
          <ToastProvider>
            <ReminderSheetProvider>
              <StatusBar style="light" />
              <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
                <Stack.Screen name="(tabs)" />
              </Stack>
              <ReminderSync />
              <NotificationRouter />
            </ReminderSheetProvider>
          </ToastProvider>
        </ThemeProvider>
      </SessionProvider>
    </QueryClientProvider>
  );
}

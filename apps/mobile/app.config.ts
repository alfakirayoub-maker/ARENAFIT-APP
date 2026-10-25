import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Extends app.json. Branch (deferred deep linking for Guest Pass invitations)
 * is wired only when its environment variables are set — no Branch key or
 * domain is ever committed. See docs/BRANCH.md.
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  const branchKey = process.env.EXPO_PUBLIC_BRANCH_KEY?.trim();
  const domains = [process.env.EXPO_PUBLIC_BRANCH_DOMAIN, process.env.EXPO_PUBLIC_BRANCH_ALTERNATE_DOMAIN]
    .map((d) => d?.trim())
    .filter((d): d is string => !!d);

  const base = config as ExpoConfig;
  if (!branchKey || domains.length === 0) return base;

  return {
    ...base,
    plugins: [...(base.plugins ?? []), ['@config-plugins/react-native-branch', { apiKey: branchKey, iosUniversalLinkDomains: domains }]],
    ios: { ...base.ios, associatedDomains: domains.map((d) => `applinks:${d}`) },
    android: {
      ...base.android,
      intentFilters: [
        ...(base.android?.intentFilters ?? []),
        {
          action: 'VIEW',
          autoVerify: true,
          data: domains.map((host) => ({ scheme: 'https', host })),
          category: ['BROWSABLE', 'DEFAULT'],
        },
      ],
    },
  };
};

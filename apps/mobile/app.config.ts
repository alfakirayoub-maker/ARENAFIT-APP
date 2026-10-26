import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * EAS build guard, on the build server only (EAS_BUILD=true: EAS environment
 * variables are loaded there; eas-cli also reads this file locally without
 * them). The `preview` profile is the stakeholder demo build: it must talk to
 * the hosted staging project (never localhost / a LAN address) and carry the
 * staging demo sign-in. `production` must never carry it.
 */
function isServerKey(value: string): boolean {
  if (value.startsWith('sb_secret_')) return true;
  const payload = value.split('.')[1];
  if (!payload) return false;
  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')).role === 'service_role';
  } catch {
    return false;
  }
}

function checkBuildEnvironment() {
  if (process.env.EAS_BUILD !== 'true') return;
  const leaked = Object.entries(process.env).filter(([k, v]) => k.startsWith('EXPO_PUBLIC_') && v && isServerKey(v.trim()));
  if (leaked.length) throw new Error(`Server key in public variable(s): ${leaked.map(([k]) => k).join(', ')} — use the anon/publishable key.`);
  const profile = process.env.EAS_BUILD_PROFILE;
  const demoSignIn = process.env.EXPO_PUBLIC_STAGING_DEMO_SIGNIN === '1';
  if (profile === 'production' && demoSignIn) {
    throw new Error('EXPO_PUBLIC_STAGING_DEMO_SIGNIN must not be set for production builds.');
  }
  if (profile !== 'preview') return;
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() ?? '';
  const problems = [
    !/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(url) && `EXPO_PUBLIC_SUPABASE_URL must be the staging project URL (https://<ref>.supabase.co), got "${url}"`,
    !process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() && 'EXPO_PUBLIC_SUPABASE_ANON_KEY is missing',
    !demoSignIn && 'EXPO_PUBLIC_STAGING_DEMO_SIGNIN=1 is missing',
    !process.env.EXPO_PUBLIC_STAGING_MEMBER_EMAIL?.trim() && 'EXPO_PUBLIC_STAGING_MEMBER_EMAIL is missing',
    !process.env.EXPO_PUBLIC_STAGING_MEMBER_PASSWORD?.trim() && 'EXPO_PUBLIC_STAGING_MEMBER_PASSWORD is missing',
    Object.keys(process.env).some((k) => k.startsWith('EXPO_PUBLIC_DEV_')) && 'EXPO_PUBLIC_DEV_* variables must not be set for preview builds',
  ].filter(Boolean);
  if (problems.length) throw new Error(`Preview (staging demo) build misconfigured:\n- ${problems.join('\n- ')}\nSee docs/STAGING.md.`);
}

/**
 * Extends app.json. Branch (deferred deep linking for Guest Pass invitations)
 * is wired only when its environment variables are set — no Branch key or
 * domain is ever committed. See docs/BRANCH.md.
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  checkBuildEnvironment();
  // APP_VARIANT comes from eas.json (preview profile): the demo APK installs next
  // to a future store build instead of clashing with it.
  if (process.env.APP_VARIANT === 'preview') {
    config = { ...config, android: { ...config.android, package: 'com.arenafit.app.preview' } };
  }
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

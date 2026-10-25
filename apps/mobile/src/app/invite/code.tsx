import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Logo } from '@/components/brand/Logo';
import { Button } from '@/components/ui/Button';
import { DetailScreen } from '@/components/ui/DetailScreen';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { InvitationPreview } from '@/features/guest-pass/components/InvitationPreview';
import { normalizeShortCode } from '@/features/guest-pass/links';
import { spacing } from '@/theme';

/**
 * « J'ai un code d'invitation » — fallback when the link didn't carry the
 * invitation into the app. The code resolves the same invitation as the link.
 */
export default function InviteByCodeScreen() {
  const { t } = useTranslation();
  const [input, setInput] = useState('');
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (submitted) return <InvitationPreview invitation={{ kind: 'code', code: submitted }} />;

  const submit = () => {
    const code = normalizeShortCode(input);
    if (!code) return setError(t('guestPass.invite.codeInvalid'));
    setError(null);
    setSubmitted(code);
  };

  return (
    <DetailScreen
      footer={<Button label={t('guestPass.invite.codeSubmit')} size="lg" fullWidth disabled={input.trim().length < 8} onPress={submit} />}>
      <View style={styles.logo}>
        <Logo height={40} />
      </View>
      <View style={styles.texts}>
        <Text variant="display" accessibilityRole="header">
          {t('guestPass.invite.codeTitle')}
        </Text>
        <Text variant="body" color="secondary">
          {t('guestPass.invite.codeBody')}
        </Text>
      </View>
      <TextField
        label={t('guestPass.invite.codeLabel')}
        placeholder="AF-XXXX-XXXX"
        value={input}
        onChangeText={(v) => {
          setInput(v.toUpperCase());
          setError(null);
        }}
        error={error}
        code
        autoCapitalize="characters"
        autoCorrect={false}
        autoComplete="off"
        maxLength={14}
        returnKeyType="go"
        onSubmitEditing={submit}
      />
    </DetailScreen>
  );
}

const styles = StyleSheet.create({
  logo: { alignItems: 'center' },
  texts: { gap: spacing.sm },
});

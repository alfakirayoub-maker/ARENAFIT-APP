import { useState } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { colors, fontFamily, hitTarget, radius, spacing, typography } from '@/theme';

import { Text } from './Text';

type TextFieldProps = Omit<TextInputProps, 'style' | 'placeholderTextColor'> & {
  label: string;
  hint?: string;
  error?: string | null;
  /** Larger, spaced type for codes. */
  code?: boolean;
};

export function TextField({ label, hint, error, code, onFocus, onBlur, ...input }: TextFieldProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.root}>
      <Text variant="label" color="secondary">
        {label}
      </Text>
      <TextInput
        {...input}
        accessibilityLabel={label}
        accessibilityHint={error ?? hint}
        placeholderTextColor={colors.textTertiary}
        selectionColor={colors.primary}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={[
          styles.input,
          code && styles.code,
          focused && styles.focused,
          !!error && styles.invalid,
        ]}
      />
      {error ? (
        <Text variant="caption" color="error" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption" color="tertiary">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.sm },
  input: {
    ...typography.body,
    minHeight: hitTarget + 8,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.textPrimary,
  },
  code: { fontFamily: fontFamily.bold, fontSize: 22, letterSpacing: 2, textAlign: 'center' },
  focused: { borderColor: colors.primary },
  invalid: { borderColor: colors.error },
});

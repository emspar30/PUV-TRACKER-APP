import { router } from 'expo-router';
import { LogIn, Mail, UserPlus } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { Button, Card, Screen } from '@/components';
import { signInWithPassword, signUpWithPassword } from '@/services/auth';
import { syncUsername } from '@/state/usernameStore';
import { strings } from '@/strings';
import { makeStyles, MIN_TOUCH_TARGET, radii, spacing, useTheme } from '@/theme';

// Supabase asks for at least this many characters
const PASSWORD_MIN_LENGTH = 6;

type Mode = 'signIn' | 'signUp';

// Sign in, or create an account with an email and a password (open sign-up, 2026-10-05)
export default function SignInScreen() {
  const styles = useStyles();
  const { colors, typography } = useTheme();
  const [mode, setMode] = useState<Mode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const canSubmit = email.trim().length > 0 && password.length >= (mode === 'signUp' ? PASSWORD_MIN_LENGTH : 1) && !busy;

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    if (mode === 'signUp') {
      const result = await signUpWithPassword(email, password);
      setBusy(false);
      if (!result.ok) return setError(result.message);
      if (result.confirm) {
        setMode('signIn');
        return setNotice(strings.signIn.checkEmail);
      }
      await syncUsername();
      return router.back();
    }
    const result = await signInWithPassword(email, password);
    setBusy(false);
    if (!result.ok) return setError(result.message);
    await syncUsername();
    router.back();
  };

  const field = { ...typography.bodyLg, color: colors.textPrimary };

  return (
    <Screen title={mode === 'signIn' ? strings.signIn.title : strings.signIn.createTitle}>
      <Card>
        <Text style={typography.bodyMd}>{mode === 'signIn' ? strings.signIn.note : strings.signIn.createNote}</Text>
      </Card>
      <View style={styles.form}>
        <View style={styles.input}>
          <Mail color={colors.textSecondary} size={spacing.md + spacing.xs} />
          <TextInput
            style={[field, styles.grow]}
            value={email}
            onChangeText={setEmail}
            placeholder={strings.signIn.email}
            placeholderTextColor={colors.textTertiary}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
            accessibilityLabel={strings.signIn.email}
          />
        </View>
        <View style={styles.input}>
          <TextInput
            style={[field, styles.grow]}
            value={password}
            onChangeText={setPassword}
            placeholder={mode === 'signUp' ? strings.signIn.newPassword(PASSWORD_MIN_LENGTH) : strings.signIn.password}
            placeholderTextColor={colors.textTertiary}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
            textContentType={mode === 'signUp' ? 'newPassword' : 'password'}
            accessibilityLabel={strings.signIn.password}
            onSubmitEditing={submit}
          />
        </View>
        {error ? <Text style={[typography.bodySm, styles.error]}>{error}</Text> : null}
        {notice ? <Text style={[typography.bodySm, styles.notice]}>{notice}</Text> : null}
        <Button
          label={busy ? strings.signIn.submitting : mode === 'signIn' ? strings.signIn.submit : strings.signIn.create}
          leadingIcon={mode === 'signIn' ? LogIn : UserPlus}
          onPress={submit}
          disabled={!canSubmit}
        />
        <Pressable
          style={styles.link}
          onPress={() => {
            setMode(mode === 'signIn' ? 'signUp' : 'signIn');
            setError(null);
          }}
          accessibilityRole="button"
        >
          <Text style={[typography.labelLg, styles.linkText]}>{mode === 'signIn' ? strings.signIn.toCreate : strings.signIn.toSignIn}</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  form: {
    gap: spacing.md,
  },
  input: {
    minHeight: MIN_TOUCH_TARGET + spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.outline,
    backgroundColor: colors.card,
  },
  grow: {
    flex: 1,
  },
  error: {
    color: colors.danger,
  },
  notice: {
    color: colors.success,
  },
  link: {
    minHeight: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkText: {
    color: colors.primary,
  },
}));

import { router, useLocalSearchParams } from 'expo-router';
import { Eye, EyeOff, LogIn, Mail, UserPlus } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { Button, Screen } from '@/components';
import { sendPasswordReset, signInWithPassword, signUpWithPassword } from '@/services/auth';
import { syncUsername } from '@/state/usernameStore';
import { strings } from '@/strings';
import { makeStyles, MIN_TOUCH_TARGET, radii, spacing, useTheme } from '@/theme';

// Supabase asks for at least this many characters
const PASSWORD_MIN_LENGTH = 6;
const ICON_SIZE = spacing.md + spacing.xs;

type Mode = 'signIn' | 'signUp';

// Sign in, or create an account with an email and a password (open sign-up, 2026-10-05). ST2-A: no
// notes above the form, the password can be shown, a new password is typed twice, and a reset link
// can be sent. AU1: opened by the account gate (gate=1) it has no way back, and signing in opens the
// app; opened from the introduction it returns there.
export default function SignInScreen() {
  const styles = useStyles();
  const gated = useLocalSearchParams<{ gate?: string }>().gate === '1';
  const done = () => (gated ? router.replace('/') : router.back());
  const { colors, typography } = useTheme();
  const [mode, setMode] = useState<Mode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const mismatch = mode === 'signUp' && confirm.length > 0 && confirm !== password;
  const canSubmit =
    email.trim().length > 0 &&
    !busy &&
    (mode === 'signIn' ? password.length > 0 : password.length >= PASSWORD_MIN_LENGTH && confirm === password);

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
        setConfirm('');
        return setNotice(strings.signIn.checkEmail);
      }
      await syncUsername();
      return done();
    }
    const result = await signInWithPassword(email, password);
    setBusy(false);
    if (!result.ok) return setError(result.message);
    await syncUsername();
    done();
  };

  const forgot = async () => {
    setNotice(null);
    if (email.trim().length === 0) return setError(strings.signIn.forgotNeedsEmail);
    setBusy(true);
    setError(null);
    const result = await sendPasswordReset(email);
    setBusy(false);
    if (!result.ok) return setError(result.message);
    setNotice(strings.signIn.resetSent);
  };

  const field = { ...typography.bodyLg, color: colors.textPrimary };

  return (
    <Screen title={mode === 'signIn' ? strings.signIn.title : strings.signIn.createTitle} noBack={gated}>
      <View style={styles.form}>
        <View style={styles.input}>
          <Mail color={colors.textSecondary} size={ICON_SIZE} />
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
        <PasswordField
          value={password}
          onChangeText={setPassword}
          placeholder={mode === 'signUp' ? strings.signIn.newPassword(PASSWORD_MIN_LENGTH) : strings.signIn.password}
          label={strings.signIn.password}
          newPassword={mode === 'signUp'}
          onSubmitEditing={mode === 'signIn' ? submit : undefined}
        />
        {mode === 'signUp' ? (
          <PasswordField
            value={confirm}
            onChangeText={setConfirm}
            placeholder={strings.signIn.confirmPassword}
            label={strings.signIn.confirmPassword}
            newPassword
            onSubmitEditing={submit}
          />
        ) : null}
        {mismatch ? <Text style={[typography.bodySm, styles.error]}>{strings.signIn.mismatch}</Text> : null}
        {error ? <Text style={[typography.bodySm, styles.error]}>{error}</Text> : null}
        {notice ? <Text style={[typography.bodySm, styles.notice]}>{notice}</Text> : null}
        {mode === 'signIn' ? (
          <Pressable style={styles.forgot} onPress={forgot} disabled={busy} accessibilityRole="button">
            <Text style={[typography.labelLg, styles.linkText]}>{strings.signIn.forgot}</Text>
          </Pressable>
        ) : null}
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
            setConfirm('');
            setError(null);
            setNotice(null);
          }}
          accessibilityRole="button"
        >
          <Text style={[typography.labelLg, styles.linkText]}>{mode === 'signIn' ? strings.signIn.toCreate : strings.signIn.toSignIn}</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

// A password box with an eye button that shows or hides what was typed
function PasswordField({
  value,
  onChangeText,
  placeholder,
  label,
  newPassword,
  onSubmitEditing,
}: {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  label: string;
  newPassword: boolean;
  onSubmitEditing?: () => void;
}) {
  const styles = useStyles();
  const { colors, typography } = useTheme();
  const [visible, setVisible] = useState(false);
  const Icon = visible ? EyeOff : Eye;
  return (
    <View style={styles.input}>
      <TextInput
        style={[{ ...typography.bodyLg, color: colors.textPrimary }, styles.grow]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textTertiary}
        autoCapitalize="none"
        autoCorrect={false}
        secureTextEntry={!visible}
        textContentType={newPassword ? 'newPassword' : 'password'}
        accessibilityLabel={label}
        onSubmitEditing={onSubmitEditing}
      />
      <Pressable
        style={styles.eye}
        onPress={() => setVisible(!visible)}
        accessibilityRole="button"
        accessibilityLabel={visible ? strings.signIn.hidePassword : strings.signIn.showPassword}
      >
        <Icon color={colors.textSecondary} size={ICON_SIZE} />
      </Pressable>
    </View>
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
  eye: {
    minWidth: MIN_TOUCH_TARGET,
    minHeight: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -spacing.sm,
  },
  error: {
    color: colors.danger,
  },
  notice: {
    color: colors.success,
  },
  forgot: {
    minHeight: MIN_TOUCH_TARGET,
    alignSelf: 'flex-end',
    justifyContent: 'center',
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

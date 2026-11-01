import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text, TextInput } from 'react-native';

import { Button, Screen } from '@/components';
import { appealStrike } from '@/services/moderation';
import { APPEAL_MAX_CHARS } from '@/shared/config';
import { showDialog } from '@/state/dialogStore';
import { refreshModeration } from '@/state/moderationStore';
import { strings } from '@/strings';
import { makeStyles, radii, spacing, useTheme } from '@/theme';

// MOD1b: appeal a strike in the rider's own words. A moderator decides; an upheld appeal lifts the
// strike, gives back a Merit point it used, and lifts a suspension it caused.
export default function AppealScreen() {
  const styles = useStyles();
  const { colors, typography } = useTheme();
  const { strike } = useLocalSearchParams<{ strike: string }>();
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const m = strings.moderation;

  const send = async () => {
    const text = body.trim();
    if (!strike || !text || sending) return;
    setSending(true);
    const failure = await appealStrike(strike, text);
    setSending(false);
    if (failure) {
      showDialog({ tone: 'danger', title: m.appealFailedTitle, body: failure.includes('appeal_too_late') ? m.appealTooLate : failure.includes('appeal_exists') ? m.appealExists : m.appealFailedBody });
      return;
    }
    void refreshModeration();
    showDialog({ tone: 'success', title: m.appealSentTitle, body: m.appealSentBody });
    router.back();
  };

  return (
    <Screen title={m.appealTitle}>
      <Text style={typography.bodyMd}>{m.appealBody}</Text>
      <TextInput
        style={[typography.bodyMd, styles.input]}
        value={body}
        onChangeText={setBody}
        multiline
        maxLength={APPEAL_MAX_CHARS}
        placeholder={m.appealPlaceholder}
        placeholderTextColor={colors.textTertiary}
        accessibilityLabel={m.appealPlaceholder}
      />
      <Text style={typography.bodySm}>{m.appealCount(body.length, APPEAL_MAX_CHARS)}</Text>
      <Button label={m.appealSend} onPress={() => void send()} disabled={!body.trim() || sending} />
    </Screen>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  input: {
    minHeight: spacing.xl * 4,
    padding: spacing.sm + spacing.xs,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.outline,
    backgroundColor: colors.surfaceLow,
    color: colors.textPrimary,
    textAlignVertical: 'top',
  },
}));

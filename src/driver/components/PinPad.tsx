import { Delete } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import { strings } from '@/strings';
import { makeStyles, radii, spacing, useTheme } from '@/theme';

type PinPadProps = {
  length: number;
  value: string;
  onChange: (value: string) => void;
  // What the PIN is for, read out with the number of digits entered
  label: string;
  // Under the boxes, such as "Wrong PIN."
  error?: string | null;
};

const BOX_HEIGHT = spacing.xl + spacing.lg;
const DOT_SIZE = spacing.sm + spacing.xs;
const KEY_HEIGHT = spacing.xl * 2 + spacing.sm;
const KEY_GAP = spacing.sm + spacing.xs;
const DELETE_ICON = spacing.lg + spacing.xs;
const ROWS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
];

// The admin PIN (Stitch 3.11; owner, 2026-10-14): one box per digit, filled with a dot as it is
// typed, and a keypad on the screen, so the system keyboard never covers the boxes. The keys span the
// screen's width and sit low, near the thumb, so it works one-handed; the caller puts Unlock under
// it. Digits are never shown, not even for a moment.
export function PinPad({ length, value, onChange, label, error }: PinPadProps) {
  const styles = useStyles();
  const { colors, typography } = useTheme();
  const text = strings.driver.admin;
  const type = (digit: string) => {
    if (value.length < length) onChange(value + digit);
  };
  const digitKey = (digit: string) => (
    <Key key={digit} onPress={() => type(digit)} label={digit}>
      <Text style={[typography.headlineLg, styles.digit]}>{digit}</Text>
    </Key>
  );
  return (
    <View style={styles.root}>
      <View style={styles.boxes} accessible accessibilityLabel={`${label}: ${text.pinProgress(value.length, length)}`}>
        {Array.from({ length }, (_, index) => (
          <View key={index} style={[styles.box, index === value.length && styles.boxNext]}>
            {index < value.length ? <View style={styles.dot} /> : null}
          </View>
        ))}
      </View>
      {error ? <Text style={[typography.bodyLg, styles.error]}>{error}</Text> : null}
      <View style={styles.keys}>
        {ROWS.map((row) => (
          <View key={row.join('')} style={styles.row}>
            {row.map(digitKey)}
          </View>
        ))}
        <View style={styles.row}>
          <Key onPress={() => onChange('')} label={text.clear} plain>
            <Text style={typography.labelLg}>{text.clear}</Text>
          </Key>
          {digitKey('0')}
          <Key onPress={() => onChange(value.slice(0, -1))} label={text.deleteDigit} plain>
            <Delete color={colors.textPrimary} size={DELETE_ICON} />
          </Key>
        </View>
      </View>
    </View>
  );
}

function Key({ onPress, label, plain = false, children }: { onPress: () => void; label: string; plain?: boolean; children: ReactNode }) {
  const styles = useStyles();
  return (
    <Pressable
      style={({ pressed }) => [styles.key, !plain && styles.keyFilled, pressed && styles.keyPressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {children}
    </Pressable>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  // Fills the space between the heading and Unlock; the keypad sits at its bottom
  root: {
    flex: 1,
    gap: spacing.md,
  },
  boxes: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  box: {
    flex: 1,
    height: BOX_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.outline,
    backgroundColor: colors.card,
  },
  // The box the next digit goes into
  boxNext: {
    borderWidth: 2,
    borderColor: colors.primary,
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE,
    backgroundColor: colors.textPrimary,
  },
  error: {
    color: colors.danger,
    textAlign: 'center',
  },
  keys: {
    flex: 1,
    justifyContent: 'flex-end',
    gap: KEY_GAP,
  },
  row: {
    flexDirection: 'row',
    gap: KEY_GAP,
  },
  key: {
    flex: 1,
    height: KEY_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.card,
  },
  keyFilled: {
    borderWidth: 1,
    borderColor: colors.outline,
    backgroundColor: colors.card,
  },
  keyPressed: {
    backgroundColor: colors.surfaceHigh,
  },
  digit: {
    fontVariant: ['tabular-nums'],
  },
}));

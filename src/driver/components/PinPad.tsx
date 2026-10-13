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
};

const BOX_HEIGHT = spacing.xl + spacing.lg;
const DOT_SIZE = spacing.sm + spacing.xs;
const KEY_SIZE = spacing.xl * 2;
const KEY_GAP = spacing.sm + spacing.xs;
const DELETE_ICON = spacing.lg;
const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

// The admin PIN (Stitch 3.11): one box per digit, filled with a dot as it is typed, and a keypad on
// the screen, so the system keyboard never covers the boxes or the Unlock button. Digits are never
// shown, not even for a moment.
export function PinPad({ length, value, onChange, label }: PinPadProps) {
  const styles = useStyles();
  const { colors, typography } = useTheme();
  const text = strings.driver.admin;
  const type = (digit: string) => {
    if (value.length < length) onChange(value + digit);
  };
  return (
    <View style={styles.root}>
      <View style={styles.boxes} accessible accessibilityLabel={`${label}: ${text.pinProgress(value.length, length)}`}>
        {Array.from({ length }, (_, index) => (
          <View key={index} style={[styles.box, index === value.length && styles.boxNext]}>
            {index < value.length ? <View style={styles.dot} /> : null}
          </View>
        ))}
      </View>
      <View style={styles.keys}>
        {DIGITS.map((digit) => (
          <Key key={digit} onPress={() => type(digit)} label={digit}>
            <Text style={[typography.headlineMd, styles.digit]}>{digit}</Text>
          </Key>
        ))}
        <Key onPress={() => onChange('')} label={text.clear} plain>
          <Text style={typography.labelLg}>{text.clear}</Text>
        </Key>
        <Key onPress={() => type('0')} label="0">
          <Text style={[typography.headlineMd, styles.digit]}>0</Text>
        </Key>
        <Key onPress={() => onChange(value.slice(0, -1))} label={text.deleteDigit} plain>
          <Delete color={colors.textPrimary} size={DELETE_ICON} />
        </Key>
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
  root: {
    gap: spacing.lg,
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
  keys: {
    width: KEY_SIZE * 3 + KEY_GAP * 2,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignSelf: 'center',
    gap: KEY_GAP,
  },
  key: {
    width: KEY_SIZE,
    height: KEY_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
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

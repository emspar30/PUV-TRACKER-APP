import { router, useIsFocused } from 'expo-router';
import { SendHorizontal, WifiOff, X } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { Image, KeyboardAvoidingView, Pressable, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomSheet, Chip, TOP_BAR_HEIGHT, type SheetRequest } from '@/components';
import { useRepositories } from '@/data/live/useRepositories';
import { useRouteData } from '@/data/RouteDataProvider';
import { replyOf, STARTER_CHIPS, type ChipAction, type Reply } from '@/features/assistant/reply';
import { useAssistantAccess } from '@/features/assistant/useAssistantAccess';
import { useCommuterPosition } from '@/features/map/useCommuterPosition';
import { useSearchablePlaces } from '@/features/search/useSearchablePlaces';
import { useRoutesVehicles } from '@/features/vehicles/useRoutesVehicles';
import { tripParams } from '@/navigation/tripParams';
import { answer, routesToWatch, type AssistantContext } from '@/shared/assistant/answer';
import { parseQuery, type Intent } from '@/shared/assistant/intent';
import { isNight } from '@/shared/backend/rules';
import { ASSISTANT_INPUT_MAX_CHARS } from '@/shared/config';
import { discountMultiplier } from '@/shared/fare/fare';
import { sheetTopClearance } from '@/shared/ui/sheetSnap';
import { useAssistantStore } from '@/state/assistantStore';
import { useFareType } from '@/state/fareType';
import { useSessionStore } from '@/state/sessionStore';
import { strings } from '@/strings';
import { MIN_TOUCH_TARGET, makeStyles, radii, spacing, useTheme } from '@/theme';

const ICON_SIZE = spacing.lg;
const DISABLED_OPACITY = 0.5;
const TUNIE = require('../../assets/assistant/tunie.png');
const TUNIE_SIZE = spacing.xl;

// A chip that leaves the conversation: the Map tab (with a route) or My Rides (with the trip). Each
// tap carries a new time stamp, so the tab applies it once. The conversation is kept (CA1.1).
function leave(action: Exclude<ChipAction, { kind: 'ask' }>) {
  if (action.kind === 'openMap') {
    router.navigate(action.route ? { pathname: '/', params: { route: action.route, at: String(Date.now()) } } : '/');
    return;
  }
  router.navigate({ pathname: '/ride', params: tripParams(action, Date.now()) });
}

// CA1.1: a question kept in the conversation, with the time it was asked
function remember(question: string, intent: Intent) {
  useAssistantStore.getState().ask(question, intent, Date.now());
}

// CA1: Ask Tunton (PRD 19.5). A question is typed or tapped as a chip, parsed by fixed rules
// (shared/assistant) and answered from the data on the phone: the planner and fare as My Rides, the
// coverage states as the Map tab, the nearest stop. Answers about routes follow the live (or demo)
// multicabs while the screen is open. CA1.1: Tunie, in My Rides' draggable sheet over the Map: it
// slides up fully open (so the first message shows whole), can be dragged to half, and slides away
// when closed (Close, a tap above it, or dragged to the bottom); a chat with the message box at the
// bottom and the newest message last, open no higher than the Map's top bar; the questions are kept
// on the phone for an hour (assistantStore); online only.
export default function AssistantScreen() {
  const styles = useStyles();
  const { colors, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const { lines, stops } = useRouteData();
  const places = useSearchablePlaces({ saved: true });
  const commuter = useCommuterPosition();
  const [fareType] = useFareType();
  const repos = useRepositories();
  const teamAccount = useSessionStore((state) => state.teamAccount);
  const focused = useIsFocused();
  const entries = useAssistantStore((state) => state.entries);
  // Typing opens the sheet fully, so the answers show above the keyboard
  const [sheetRequest, setSheetRequest] = useState<SheetRequest | null>(null);
  // A new value slides the sheet away; the screen closes once it is gone
  const [dismissKey, setDismissKey] = useState(0);
  const close = () => setDismissKey((key) => key + 1);
  const access = useAssistantAccess();
  const online = access === 'open';
  const [draft, setDraft] = useState('');

  // Questions older than an hour are let go when the screen opens
  useEffect(() => useAssistantStore.getState().prune(Date.now()), []);

  // Live multicabs only for the routes asked about (and those sharing their stops, for an alternative)
  const watched = useMemo(() => routesToWatch(entries.map((entry) => entry.intent), stops), [entries, stops]);
  const supply = useRoutesVehicles(repos.vehicles, watched, !focused);

  const context = useMemo<AssistantContext>(() => {
    const live = repos.vehicles.source === 'live';
    const title = !commuter
      ? ''
      : commuter.source === 'simulated' && commuter.stopCode
        ? strings.assistant.youAt(commuter.stopCode)
        : commuter.source === 'pin'
          ? strings.assistant.yourPin
          : strings.assistant.yourLocation;
    return {
      lines,
      stops,
      places,
      position: commuter ? { lat: commuter.lat, lon: commuter.lon, title } : null,
      fareMultiplier: discountMultiplier(fareType),
      live: {
        // Live markers are for team accounts only (PRD 0.7); the demo is open to everyone
        access: live && teamAccount !== true ? 'teamOnly' : 'open',
        night: live && supply.nowMs > 0 && isNight(supply.nowMs),
        vehicles: supply.vehicles,
        nowMs: supply.nowMs,
      },
    };
  }, [lines, stops, places, commuter, fareType, repos.vehicles.source, teamAccount, supply]);

  const replies = useMemo<Reply[]>(
    () => entries.map((entry) => replyOf(answer(entry.intent, context), entry.intent, fareType)),
    [entries, context, fareType],
  );

  // CA1.1: nothing is asked while offline
  const ask = (question: string, intent: Intent) => {
    if (online) remember(question, intent);
  };

  const send = () => {
    const question = draft.trim();
    if (!question || !online) return;
    setDraft('');
    ask(question, parseQuery(question));
  };

  const act = (action: ChipAction) => (action.kind === 'ask' ? ask(action.question, action.intent) : leave(action));
  const canSend = online && draft.trim().length > 0;

  const bubble = (reply: Reply, key: string) => (
    <View key={key} style={styles.answer}>
      <View style={styles.bot}>
        {reply.lines.map((line, index) => (
          <Text key={index} style={typography.bodyMd}>
            {line}
          </Text>
        ))}
      </View>
      {reply.chips.length > 0 ? (
        <View style={styles.chips}>
          {reply.chips.map((chip) => {
            // Offline, a chip that asks a question is dimmed and does nothing; one that opens a tab works
            const locked = !online && chip.action.kind === 'ask';
            return (
              <View key={chip.label} style={locked && styles.disabled}>
                <Chip label={chip.label} onPress={locked ? undefined : () => act(chip.action)} />
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );

  const header = (
    <View style={styles.headerContent}>
      <View style={styles.bar}>
        <Image source={TUNIE} style={styles.tunie} accessibilityIgnoresInvertColors />
        <Text style={[typography.headlineSm, styles.title]} accessibilityRole="header" numberOfLines={1}>
          {strings.assistant.title}
        </Text>
        <Pressable style={styles.iconButton} onPress={close} accessibilityRole="button" accessibilityLabel={strings.assistant.close}>
          <X color={colors.textPrimary} size={ICON_SIZE} />
        </Pressable>
      </View>
      {online ? null : (
        <View style={styles.notice} accessibilityLiveRegion="polite">
          <WifiOff color={colors.textSecondary} size={ICON_SIZE} />
          <Text style={[typography.bodySm, styles.grow]}>
            {access === 'checking' ? strings.assistant.checkingConnection : strings.assistant.needsInternet}
          </Text>
        </View>
      )}
    </View>
  );

  const messageBox = (
    <View style={styles.inputRow}>
      <TextInput
        style={[typography.bodyMd, styles.input, !online && styles.disabled]}
        value={draft}
        onChangeText={setDraft}
        onFocus={() => setSheetRequest((current) => ({ key: (current?.key ?? 0) + 1, snap: 'expanded' }))}
        placeholder={online ? strings.assistant.placeholder : strings.assistant.needsInternet}
        placeholderTextColor={colors.textTertiary}
        maxLength={ASSISTANT_INPUT_MAX_CHARS}
        editable={online}
        returnKeyType="send"
        submitBehavior="submit"
        onSubmitEditing={send}
        accessibilityLabel={strings.assistant.placeholder}
      />
      <Pressable
        style={[styles.send, !canSend && styles.disabled]}
        onPress={send}
        disabled={!canSend}
        accessibilityRole="button"
        accessibilityLabel={strings.assistant.send}
        accessibilityState={{ disabled: !canSend }}
      >
        <SendHorizontal color={colors.onPrimary} size={ICON_SIZE} />
      </Pressable>
    </View>
  );

  return (
    // The sheet's room shrinks with the keyboard, so the message box stays just above it
    <KeyboardAvoidingView style={styles.overlay} behavior="padding">
      {/* Above the sheet: a tap closes Ask Tunton and goes back to the Map */}
      <Pressable style={styles.outside} onPress={close} accessibilityLabel={strings.assistant.close} />
      <BottomSheet
        id="assistant"
        // Opens fully, sliding up; collapsed means closed
        defaultSnap="expanded"
        remember={false}
        slideIn
        dismissKey={dismissKey}
        onDismissed={() => router.back()}
        // The Map's top bar stays in view above the open sheet
        topClearance={sheetTopClearance(insets.top + spacing.sm, TOP_BAR_HEIGHT, spacing.sm)}
        request={sheetRequest}
        onSnapChange={(settled) => {
          if (settled === 'peek') close();
        }}
        header={header}
        footer={messageBox}
        chat
        chevron={false}
      >
        {bubble({ lines: [...strings.assistant.help], chips: [...STARTER_CHIPS] }, 'welcome')}
        {entries.map((entry, index) => (
          <View key={entry.id} style={styles.turn}>
            <View style={styles.user}>
              <Text style={[typography.bodyMd, styles.userText]}>{entry.question}</Text>
            </View>
            {bubble(replies[index], `reply-${entry.id}`)}
          </View>
        ))}
      </BottomSheet>
    </KeyboardAvoidingView>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  overlay: {
    flex: 1,
  },
  outside: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  headerContent: {
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  grow: {
    flex: 1,
  },
  bar: {
    minHeight: MIN_TOUCH_TARGET,
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
  },
  tunie: {
    width: TUNIE_SIZE,
    height: TUNIE_SIZE,
    marginRight: spacing.sm,
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm + spacing.xs,
    borderRadius: radii.card,
    backgroundColor: colors.card,
  },
  turn: {
    gap: spacing.md,
  },
  answer: {
    gap: spacing.sm,
    alignItems: 'flex-start',
  },
  bot: {
    maxWidth: '88%',
    gap: spacing.xs,
    padding: spacing.sm + spacing.xs,
    borderRadius: radii.card,
    borderTopLeftRadius: radii.badge,
    backgroundColor: colors.card,
  },
  user: {
    alignSelf: 'flex-end',
    maxWidth: '80%',
    padding: spacing.sm + spacing.xs,
    borderRadius: radii.card,
    borderTopRightRadius: radii.badge,
    backgroundColor: colors.primaryContainer,
  },
  userText: {
    color: colors.onPrimaryContainer,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    minHeight: MIN_TOUCH_TARGET,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    color: colors.textPrimary,
  },
  send: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  disabled: {
    opacity: DISABLED_OPACITY,
  },
}));

import { router, useIsFocused } from 'expo-router';
import { ArrowLeft, SendHorizontal } from 'lucide-react-native';
import { useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Chip } from '@/components';
import { useRepositories } from '@/data/live/useRepositories';
import { useRouteData } from '@/data/RouteDataProvider';
import { replyOf, STARTER_CHIPS, type ChipAction, type Reply } from '@/features/assistant/reply';
import { useCommuterPosition } from '@/features/map/useCommuterPosition';
import { useSearchablePlaces } from '@/features/search/useSearchablePlaces';
import { useRoutesVehicles } from '@/features/vehicles/useRoutesVehicles';
import { answer, routesToWatch, type AssistantContext } from '@/shared/assistant/answer';
import { parseQuery, type Intent } from '@/shared/assistant/intent';
import { isNight } from '@/shared/backend/rules';
import { ASSISTANT_INPUT_MAX_CHARS } from '@/shared/config';
import { discountMultiplier } from '@/shared/fare/fare';
import { useFareType } from '@/state/fareType';
import { useSessionStore } from '@/state/sessionStore';
import { strings } from '@/strings';
import { MIN_TOUCH_TARGET, makeStyles, radii, spacing, useTheme } from '@/theme';

const ICON_SIZE = spacing.lg;
const DISABLED_OPACITY = 0.5;

type Entry = { id: number; question: string; intent: Intent };

// A chip that leaves the conversation: the Map tab (with a route) or My Rides (with the trip). Each
// tap carries a new time stamp, so the tab applies it once.
function open(action: Exclude<ChipAction, { kind: 'ask' }>) {
  const at = String(Date.now());
  if (action.kind === 'openMap') {
    router.navigate(action.route ? { pathname: '/', params: { route: action.route, at } } : '/');
    return;
  }
  const { from, to, route } = action;
  router.navigate({
    pathname: '/ride',
    params: {
      toLat: String(to.lat),
      toLon: String(to.lon),
      toTitle: to.title,
      ...(from ? { fromLat: String(from.lat), fromLon: String(from.lon), fromTitle: from.title } : {}),
      route,
      at,
    },
  });
}

// CA1: Ask Tunton, the offline assistant (PRD 19.5). A question is typed or tapped as a chip, parsed
// by fixed rules (shared/assistant) and answered from the data on the phone: the planner and fare
// as My Rides, the coverage states as the Map tab, the nearest stop. Nothing is sent anywhere and
// nothing is kept: the conversation ends when the screen closes. Answers about routes follow the
// live (or demo) multicabs while the screen is open.
export default function AssistantScreen() {
  const styles = useStyles();
  const { colors, typography } = useTheme();
  const { lines, stops } = useRouteData();
  const places = useSearchablePlaces({ saved: true });
  const commuter = useCommuterPosition();
  const [fareType] = useFareType();
  const repos = useRepositories();
  const teamAccount = useSessionStore((state) => state.teamAccount);
  const focused = useIsFocused();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [draft, setDraft] = useState('');
  const nextId = useRef(0);
  const scroll = useRef<ScrollView>(null);

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
    () => entries.map((entry) => replyOf(answer(entry.intent, context), fareType)),
    [entries, context, fareType],
  );

  const ask = (question: string, intent: Intent) => {
    const id = nextId.current;
    nextId.current += 1;
    setEntries((current) => [...current, { id, question, intent }]);
  };

  const send = () => {
    const question = draft.trim();
    if (!question) return;
    setDraft('');
    ask(question, parseQuery(question));
  };

  const act = (action: ChipAction) => (action.kind === 'ask' ? ask(action.question, action.intent) : open(action));

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
          {reply.chips.map((chip) => (
            <Chip key={chip.label} label={chip.label} onPress={() => act(chip.action)} />
          ))}
        </View>
      ) : null}
    </View>
  );

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.bar}>
        <Pressable style={styles.back} onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={strings.common.back}>
          <ArrowLeft color={colors.textPrimary} size={ICON_SIZE} />
        </Pressable>
        <Text style={[typography.headlineSm, styles.title]} accessibilityRole="header" numberOfLines={1}>
          {strings.assistant.title}
        </Text>
      </View>
      <KeyboardAvoidingView style={styles.grow} behavior="padding">
        <ScrollView
          ref={scroll}
          style={styles.grow}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}
        >
          <Text style={[typography.bodySm, styles.note]}>{strings.assistant.offline}</Text>
          {bubble({ lines: [...strings.assistant.help], chips: [...STARTER_CHIPS] }, 'welcome')}
          {entries.map((entry, index) => (
            <View key={entry.id} style={styles.turn}>
              <View style={styles.user}>
                <Text style={[typography.bodyMd, styles.userText]}>{entry.question}</Text>
              </View>
              {bubble(replies[index], `reply-${entry.id}`)}
            </View>
          ))}
        </ScrollView>
        <View style={styles.inputRow}>
          <TextInput
            style={[typography.bodyMd, styles.input]}
            value={draft}
            onChangeText={setDraft}
            placeholder={strings.assistant.placeholder}
            placeholderTextColor={colors.textTertiary}
            maxLength={ASSISTANT_INPUT_MAX_CHARS}
            returnKeyType="send"
            submitBehavior="submit"
            onSubmitEditing={send}
            accessibilityLabel={strings.assistant.placeholder}
          />
          <Pressable
            style={[styles.send, !draft.trim() && styles.sendOff]}
            onPress={send}
            disabled={!draft.trim()}
            accessibilityRole="button"
            accessibilityLabel={strings.assistant.send}
          >
            <SendHorizontal color={colors.onPrimary} size={ICON_SIZE} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  root: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  grow: {
    flex: 1,
  },
  bar: {
    minHeight: MIN_TOUCH_TARGET + spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
  },
  back: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    paddingHorizontal: spacing.sm + spacing.xs,
  },
  content: {
    padding: spacing.md,
    gap: spacing.md,
  },
  note: {
    textAlign: 'center',
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
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.outline,
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
  sendOff: {
    opacity: DISABLED_OPACITY,
  },
}));

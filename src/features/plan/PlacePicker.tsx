import { Check, LocateFixed, Map as MapIcon, MapPin, Search, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { strings } from '@/strings';
import { MIN_TOUCH_TARGET, colors, radii, spacing, typography } from '@/theme';

import type { Place, StopOption } from './places';

export type HereStatus = {
  // True when there is a live fix or a pin from the Map tab
  available: boolean;
  detail: string;
};

// Mount only while open: each opening starts on the tab that matches the current choice,
// with an empty search
type PlacePickerProps = {
  target: 'from' | 'to';
  current: Place | null;
  here: HereStatus;
  stops: StopOption[];
  onSelect: (place: Place) => void;
  onPickOnMap: () => void;
  onClose: () => void;
};

type Segment = 'current' | 'place';

const ICON_SIZE = 20;
const SHEET_MAX_HEIGHT = '85%';

function directionsText(directions: StopOption['directions']): string {
  const names = directions.map((d) => (d === 'outbound' ? strings.plan.directionOutbound : strings.plan.directionReturn));
  return strings.plan.servedBy(names.join(' and '));
}

// Bottom sheet for choosing where a trip starts or ends. For the start, the rider first chooses
// between the phone's current location and a specific place, so the two are never confused.
export function PlacePicker({ target, current, here, stops, onSelect, onPickOnMap, onClose }: PlacePickerProps) {
  const insets = useSafeAreaInsets();
  const isFrom = target === 'from';
  const [segment, setSegment] = useState<Segment>(() =>
    isFrom && (current?.kind === 'here' || (!current && here.available)) ? 'current' : 'place',
  );
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return stops;
    return stops.filter((stop) => `${stop.title} ${stop.subtitle}`.toLowerCase().includes(q));
  }, [query, stops]);

  const selectedStop = current?.kind === 'stop' ? current.stationId : null;

  return (
    <Modal visible transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel={strings.plan.close} />

        <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.md }]}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={[typography.title, styles.headerTitle]} accessibilityRole="header">
              {isFrom ? strings.plan.pickerTitleFrom : strings.plan.pickerTitleTo}
            </Text>
            <Pressable onPress={onClose} style={styles.iconButton} accessibilityRole="button" accessibilityLabel={strings.plan.close}>
              <X color={colors.textMuted} size={ICON_SIZE} />
            </Pressable>
          </View>

          {isFrom && (
            <View style={styles.segments} accessibilityRole="tablist">
              {(['current', 'place'] as const).map((key) => {
                const active = segment === key;
                const Icon = key === 'current' ? LocateFixed : MapPin;
                return (
                  <Pressable
                    key={key}
                    onPress={() => setSegment(key)}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: active }}
                    style={[styles.segment, active && styles.segmentActive]}
                  >
                    <Icon color={active ? colors.primary : colors.textMuted} size={ICON_SIZE - 4} />
                    <Text style={[styles.segmentLabel, active && styles.segmentLabelActive]}>
                      {key === 'current' ? strings.plan.segmentCurrent : strings.plan.segmentPlace}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}

          {isFrom && segment === 'current' ? (
            <View style={styles.currentPanel}>
              <View style={styles.currentIcon}>
                <LocateFixed color={colors.locationDot} size={ICON_SIZE + 8} />
              </View>
              <Text style={[typography.body, styles.currentTitle]}>{strings.plan.useCurrent}</Text>
              <Text style={[typography.caption, styles.center]}>{here.available ? here.detail : strings.plan.currentOff}</Text>
              {here.available && <Text style={[typography.caption, styles.center]}>{strings.plan.currentHelp}</Text>}
              <Pressable
                disabled={!here.available}
                onPress={() => onSelect({ kind: 'here' })}
                accessibilityRole="button"
                style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed, !here.available && styles.disabled]}
              >
                <Text style={styles.primaryLabel}>{strings.plan.useCurrent}</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <View style={styles.searchBox}>
                <Search color={colors.textMuted} size={ICON_SIZE - 2} />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder={strings.plan.search}
                  placeholderTextColor={colors.textMuted}
                  style={styles.searchInput}
                  autoCorrect={false}
                  returnKeyType="search"
                />
              </View>

              <Pressable
                onPress={onPickOnMap}
                accessibilityRole="button"
                style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              >
                <View style={[styles.rowIcon, styles.rowIconMap]}>
                  <MapIcon color={colors.primary} size={ICON_SIZE} />
                </View>
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle}>{strings.plan.pickOnMap}</Text>
                  <Text style={typography.caption}>{strings.plan.pickOnMapHelp}</Text>
                </View>
              </Pressable>

              <Text style={styles.sectionHeading}>{strings.plan.stopsHeading(filtered.length)}</Text>
              <FlatList
                data={filtered}
                keyExtractor={(stop) => stop.stationId}
                keyboardShouldPersistTaps="handled"
                ListEmptyComponent={<Text style={[typography.caption, styles.empty]}>{strings.plan.noMatches}</Text>}
                renderItem={({ item }) => {
                  const selected = item.stationId === selectedStop;
                  return (
                    <Pressable
                      onPress={() => onSelect({ kind: 'stop', stationId: item.stationId })}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      style={({ pressed }) => [styles.row, pressed && styles.pressed, selected && styles.rowSelected]}
                    >
                      <View style={styles.rowIcon}>
                        <MapPin color={selected ? colors.primary : colors.textMuted} size={ICON_SIZE} />
                      </View>
                      <View style={styles.rowText}>
                        <Text style={styles.rowTitle} numberOfLines={1}>
                          {item.title}
                        </Text>
                        <Text style={typography.caption} numberOfLines={1}>
                          {[item.subtitle, item.directions.length ? directionsText(item.directions) : '']
                            .filter(Boolean)
                            .join(' · ')}
                        </Text>
                      </View>
                      {selected && <Check color={colors.primary} size={ICON_SIZE} />}
                    </Pressable>
                  );
                }}
              />
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.scrim,
  },
  sheet: {
    maxHeight: SHEET_MAX_HEIGHT,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
  },
  iconButton: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segments: {
    flexDirection: 'row',
    backgroundColor: colors.canvas,
    borderRadius: radii.sm,
    padding: spacing.xs,
    gap: spacing.xs,
  },
  segment: {
    flex: 1,
    minHeight: MIN_TOUCH_TARGET - spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderRadius: radii.sm - 2,
  },
  segmentActive: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  segmentLabel: {
    ...typography.body,
    color: colors.textMuted,
  },
  segmentLabelActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  currentPanel: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  currentIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.canvas,
    alignItems: 'center',
    justifyContent: 'center',
  },
  currentTitle: {
    fontWeight: '700',
  },
  center: {
    textAlign: 'center',
  },
  primaryButton: {
    alignSelf: 'stretch',
    minHeight: MIN_TOUCH_TARGET,
    borderRadius: radii.sm,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  primaryLabel: {
    ...typography.body,
    color: colors.onPrimary,
    fontWeight: '700',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: MIN_TOUCH_TARGET,
    paddingHorizontal: spacing.md,
    borderRadius: radii.sm,
    backgroundColor: colors.canvas,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: {
    ...typography.body,
    flex: 1,
    paddingVertical: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: MIN_TOUCH_TARGET + spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.sm,
  },
  rowSelected: {
    backgroundColor: colors.canvas,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.canvas,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowIconMap: {
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowText: {
    flex: 1,
  },
  rowTitle: {
    ...typography.body,
    fontWeight: '600',
  },
  sectionHeading: {
    ...typography.caption,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: spacing.xs,
  },
  empty: {
    paddingVertical: spacing.md,
    textAlign: 'center',
  },
  pressed: {
    backgroundColor: colors.canvas,
  },
  disabled: {
    opacity: 0.4,
  },
});

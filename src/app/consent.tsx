import { router, useLocalSearchParams } from 'expo-router';
import { Navigation } from 'lucide-react-native';
import { Text, View } from 'react-native';

import { Button, Card, IconTile, Screen } from '@/components';
import { askLocationPermission } from '@/services/location';
import { useLocationStore } from '@/state/locationStore';
import { strings } from '@/strings';
import { makeStyles, spacing, useTheme } from '@/theme';

// G0: the privacy notice and explicit consent before any location use (PRD 7.1, 15.1), apart from
// the introduction. Opened by "Locate me" (then the explainer, then the system prompt) or by the
// introduction's location switch (`next=ask`: the introduction is the explainer, so the system
// prompt comes straight after). "Not now" leaves the app in reduced mode with manual pins.
export default function ConsentScreen() {
  const styles = useStyles();
  const { typography } = useTheme();
  const { next } = useLocalSearchParams<{ next?: string }>();
  const permission = useLocationStore((state) => state.permission);
  const agree = useLocationStore((state) => state.agree);
  const acceptExplainer = useLocationStore((state) => state.acceptExplainer);
  const dismissExplainer = useLocationStore((state) => state.dismissExplainer);
  const reopenExplainer = useLocationStore((state) => state.reopenExplainer);
  const requestPermission = useLocationStore((state) => state.requestPermission);

  const onAgree = () => {
    agree(Date.now());
    if (permission !== 'granted') {
      if (next === 'ask') {
        acceptExplainer();
        void requestPermission(askLocationPermission);
      } else {
        reopenExplainer();
      }
    }
    router.back();
  };

  const onNotNow = () => {
    dismissExplainer();
    router.back();
  };

  return (
    <Screen title={strings.consent.title}>
      <View style={styles.intro}>
        <IconTile icon={Navigation} />
        <Text style={[typography.bodyLg, styles.grow]}>{strings.consent.intro}</Text>
      </View>
      {strings.consent.sections.map((section) => (
        <Card key={section.heading}>
          <Text style={typography.labelLg}>{section.heading}</Text>
          <Text style={typography.bodyMd}>{section.body}</Text>
        </Card>
      ))}
      <Text style={typography.bodySm}>{strings.consent.draft}</Text>
      <Button label={strings.consent.agree} onPress={onAgree} />
      <Button label={strings.consent.notNow} variant="secondary" onPress={onNotNow} />
    </Screen>
  );
}

const useStyles = makeStyles(() => ({
  intro: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + spacing.xs,
  },
  grow: {
    flex: 1,
  },
}));

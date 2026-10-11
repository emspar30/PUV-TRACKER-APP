import { Text } from 'react-native';

import { Screen } from '@/components/Screen';
import { strings } from '@/strings';
import { useTheme } from '@/theme';

// DR1 placeholder. DR4 adds provisioning and the beacon status, DR5 the heatmap.
export default function DriverHome() {
  const { typography } = useTheme();
  return (
    <Screen title={strings.driver.appName}>
      <Text style={typography.headlineSm}>{strings.driver.notProvisioned}</Text>
      <Text style={typography.bodyLg}>{strings.driver.notProvisionedBody}</Text>
    </Screen>
  );
}

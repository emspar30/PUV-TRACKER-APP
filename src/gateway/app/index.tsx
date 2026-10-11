import { Text } from 'react-native';

import { Screen } from '@/components/Screen';
import { strings } from '@/strings';
import { useTheme } from '@/theme';

// DR1 placeholder. DR7 adds setup by QR, the sending service and its status.
export default function GatewayHome() {
  const { typography } = useTheme();
  return (
    <Screen title={strings.gateway.appName}>
      <Text style={typography.headlineSm}>{strings.gateway.notSetUp}</Text>
      <Text style={typography.bodyLg}>{strings.gateway.notSetUpBody}</Text>
    </Screen>
  );
}

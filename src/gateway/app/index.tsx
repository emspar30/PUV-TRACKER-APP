import { router } from 'expo-router';
import { Text } from 'react-native';

import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { strings } from '@/strings';
import { useTheme } from '@/theme';

import { carrierTestEnabled } from '../carrierTest';

// DR1 placeholder. DR7 adds setup by QR, the sending service and its status. DR5: in development
// and preview builds, the way to the carrier test.
export default function GatewayHome() {
  const { typography } = useTheme();
  return (
    <Screen title={strings.gateway.appName}>
      <Text style={typography.headlineSm}>{strings.gateway.notSetUp}</Text>
      <Text style={typography.bodyLg}>{strings.gateway.notSetUpBody}</Text>
      {carrierTestEnabled() ? <Button label={strings.gateway.spike.open} variant="secondary" onPress={() => router.push('/spike')} /> : null}
    </Screen>
  );
}

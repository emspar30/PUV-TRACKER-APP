import { Text } from 'react-native';

import { BentoCard, BentoGrid, Screen } from '@/components';
import { ClassificationPicker } from '@/features/profile/ClassificationPicker';
import { typography } from '@/theme';

export default function ProfileScreen() {
  return (
    <Screen title="Profile">
      <BentoGrid>
        <BentoCard span={2}>
          <Text style={typography.body}>Fare classification</Text>
          <Text style={typography.caption}>
            Used only to estimate your fare. Stored on this device only and never sent anywhere.
          </Text>
          <ClassificationPicker />
        </BentoCard>
      </BentoGrid>
    </Screen>
  );
}

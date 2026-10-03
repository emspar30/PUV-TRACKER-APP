import { BentoGrid, Screen } from '@/components';
import { ClassificationPicker } from '@/features/profile/ClassificationPicker';
import { strings } from '@/strings';

export default function ProfileScreen() {
  return (
    <Screen title={strings.profile.title}>
      <BentoGrid>
        <ClassificationPicker />
      </BentoGrid>
    </Screen>
  );
}

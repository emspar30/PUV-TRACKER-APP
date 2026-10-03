import { Text } from 'react-native';

import { BentoCard } from '@/components';
import { ChoiceChips } from '@/features/plan/ChoiceChips';
import { CLASSIFICATIONS, type Classification } from '@/shared/config';
import { useProfileStore } from '@/state/profileStore';
import { strings } from '@/strings';
import { typography } from '@/theme';

const CHOICES = CLASSIFICATIONS.map((key) => ({ key, label: strings.classifications[key] }));

// Regular, Student, Senior Citizen or Person with Disability (PRD 7.1)
export function ClassificationPicker() {
  const classification = useProfileStore((state) => state.classification);
  const setClassification = useProfileStore((state) => state.setClassification);

  return (
    <BentoCard span={2}>
      <Text style={typography.caption}>{strings.profile.fareType}</Text>
      <ChoiceChips
        choices={CHOICES}
        selected={classification}
        onSelect={(key) => setClassification(key as Classification)}
      />
      <Text style={typography.caption}>{strings.profile.fareTypeHelp}</Text>
    </BentoCard>
  );
}

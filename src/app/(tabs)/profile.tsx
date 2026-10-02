import { BentoCard, BentoGrid, Screen } from '@/components';

export default function ProfileScreen() {
  return (
    <Screen title="Profile">
      <BentoGrid>
        <BentoCard span={2} />
        <BentoCard />
        <BentoCard />
      </BentoGrid>
    </Screen>
  );
}

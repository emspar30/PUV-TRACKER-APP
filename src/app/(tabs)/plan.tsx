import { BentoCard, BentoGrid, Screen } from '@/components';

export default function PlanScreen() {
  return (
    <Screen title="Plan">
      <BentoGrid>
        <BentoCard span={2} />
        <BentoCard />
        <BentoCard />
      </BentoGrid>
    </Screen>
  );
}

import { BentoCard, BentoGrid, Screen } from '@/components';

export default function MapScreen() {
  return (
    <Screen title="Map">
      <BentoGrid>
        <BentoCard span={2} />
        <BentoCard />
        <BentoCard />
      </BentoGrid>
    </Screen>
  );
}

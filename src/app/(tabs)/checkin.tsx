import { MapPin } from 'lucide-react-native';

import { TabPlaceholder } from '@/components/TabPlaceholder';
import { strings } from '@/strings';

// Built in UX2 part 4 (local check-in)
export default function CheckInScreen() {
  return <TabPlaceholder icon={MapPin} title={strings.tabs.checkin} />;
}

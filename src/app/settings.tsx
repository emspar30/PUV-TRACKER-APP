import { router } from 'expo-router';
import { Armchair, BellRing, FileText, Languages, Map as MapIcon, Moon, Route, ShieldCheck, Type } from 'lucide-react-native';

import { Screen, SettingsGroup, SettingsRow } from '@/components';
import { useRouteData } from '@/data/RouteDataProvider';
import { routeCodesOf } from '@/shared/ui/routeVisibility';
import { useSettingsStore } from '@/state/settingsStore';
import { strings } from '@/strings';

// Settings & preferences (restyle), opened from the menu. Everything here is stored on this phone
// only and never sent anywhere.
export default function SettingsScreen() {
  const { lines } = useRouteData();
  const routes = routeCodesOf(lines);
  const s = useSettingsStore();

  // Tapping the default route steps through None and each route
  const nextRoute = () => {
    const steps: (string | null)[] = [null, ...routes];
    s.setDefaultRoute(steps[(steps.indexOf(s.defaultRoute) + 1) % steps.length]);
  };

  return (
    <Screen title={strings.settings.title}>
      <SettingsGroup title={strings.settings.transit}>
        <SettingsRow
          first
          icon={Route}
          title={strings.settings.defaultRoute}
          detail={s.defaultRoute ? strings.live.vehicle.route(s.defaultRoute) : strings.settings.defaultRouteNone}
          onPress={nextRoute}
        />
        <SettingsRow
          icon={Armchair}
          tone="success"
          title={strings.settings.seatFilter}
          subtitle={strings.settings.seatFilterBody}
          value={s.seatFilter}
          onValueChange={s.setSeatFilter}
        />
        <SettingsRow
          icon={BellRing}
          tone="warning"
          title={strings.settings.arrivalAlert}
          subtitle={strings.settings.arrivalAlertBody}
          value={s.arrivalAlert}
          onValueChange={s.setArrivalAlert}
        />
      </SettingsGroup>

      <SettingsGroup title={strings.settings.appearance}>
        <SettingsRow first icon={Moon} title={strings.settings.darkMode} value={s.theme === 'dark'} onValueChange={(on) => s.setTheme(on ? 'dark' : 'light')} />
        <SettingsRow icon={Type} title={strings.settings.mapLabels} subtitle={strings.settings.mapLabelsBody} value={s.mapLabels} onValueChange={s.setMapLabels} />
      </SettingsGroup>

      <SettingsGroup title={strings.settings.privacy}>
        <SettingsRow
          first
          icon={ShieldCheck}
          tone="success"
          title={strings.settings.profileOnPhone}
          subtitle={strings.settings.profileOnPhoneBody}
          badge={strings.settings.localOnly}
        />
      </SettingsGroup>

      <SettingsGroup title={strings.settings.system}>
        <SettingsRow first icon={Languages} title={strings.settings.language} detail={strings.settings.english} />
        <SettingsRow icon={MapIcon} title={strings.settings.offlineMap} subtitle={strings.settings.offlineMapBody} badge={strings.settings.bundled} />
        <SettingsRow icon={FileText} title={strings.settings.licences} onPress={() => router.push('/licences')} />
      </SettingsGroup>
    </Screen>
  );
}

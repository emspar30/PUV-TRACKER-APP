import { router } from 'expo-router';
import { Armchair, BellRing, FileDown, FileText, Languages, Lightbulb, Mail, Map as MapIcon, Moon, Navigation, ShieldCheck, Trash2, Type } from 'lucide-react-native';
import { Linking } from 'react-native';

import { Screen, SettingsGroup, SettingsRow } from '@/components';
import { confirmDeleteAccount } from '@/features/account/deleteAccount';
import { PRIVACY_CONTACT_EMAIL } from '@/shared/config';
import { consentStatus } from '@/shared/location/consent';
import { showDialog } from '@/state/dialogStore';
import { useLocationStore } from '@/state/locationStore';
import { useSessionStore } from '@/state/sessionStore';
import { useSettingsStore } from '@/state/settingsStore';
import { useTourStore } from '@/state/tourStore';
import { strings } from '@/strings';

// Settings & preferences (restyle), opened from the menu. Everything here is stored on this phone
// only and never sent anywhere. Privacy also holds the contact point, data requests and Delete
// account (PRD 15.1, D10).
export default function SettingsScreen() {
  const s = useSettingsStore();
  const consent = useLocationStore((state) => consentStatus(state.consent));
  const permission = useLocationStore((state) => state.permission);
  const withdraw = useLocationStore((state) => state.withdraw);
  const signedIn = useSessionStore((state) => state.status === 'signed-in');

  // PRD 15.1: questions and data requests go to the contact point by email
  const mail = (subject: string) =>
    Linking.openURL(`mailto:${PRIVACY_CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}`).catch(() =>
      showDialog({ tone: 'warning', icon: Mail, title: strings.settings.mailFailedTitle, body: strings.settings.mailFailedBody(PRIVACY_CONTACT_EMAIL) }),
    );

  // G0: the consent state and the Android permission; withdrawing works at once, and the
  // permission itself can only be removed in Android settings
  const locationDetail =
    consent === 'consented'
      ? permission === 'granted'
        ? strings.settings.locationOn
        : strings.settings.locationAgreedOnly
      : consent === 'withdrawn'
        ? strings.settings.locationWithdrawn
        : strings.settings.locationNone;
  const onLocation = () => {
    if (consent !== 'consented') {
      router.push('/consent');
      return;
    }
    showDialog({
      tone: 'warning',
      icon: Navigation,
      title: strings.settings.withdrawTitle,
      body: strings.settings.withdrawBody,
      actions: [
        { label: strings.settings.withdraw, variant: 'danger', onPress: () => withdraw(Date.now()) },
        { label: strings.settings.androidSettings, variant: 'secondary', onPress: () => void Linking.openSettings() },
        { label: strings.common.close, variant: 'secondary' },
      ],
    });
  };

  return (
    <Screen title={strings.settings.title}>
      <SettingsGroup title={strings.settings.transit}>
        {/* CA1.1: Default route removed; the Map opens on All routes and its route list picks one */}
        <SettingsRow
          first
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
        <SettingsRow icon={Navigation} title={strings.settings.location} subtitle={locationDetail} onPress={onLocation} />
        <SettingsRow
          icon={Mail}
          title={strings.settings.privacyContact}
          subtitle={strings.settings.privacyContactBody(PRIVACY_CONTACT_EMAIL)}
          onPress={() => void mail(strings.settings.privacyContactSubject)}
        />
        <SettingsRow
          icon={FileDown}
          title={strings.settings.requestData}
          subtitle={strings.settings.requestDataBody}
          onPress={() => void mail(strings.settings.requestDataSubject)}
        />
        <SettingsRow
          icon={Trash2}
          destructive
          title={strings.settings.deleteAccount}
          subtitle={signedIn ? strings.settings.deleteAccountBody : strings.settings.deleteAccountLocalBody}
          onPress={() => confirmDeleteAccount(signedIn)}
        />
      </SettingsGroup>

      <SettingsGroup title={strings.settings.system}>
        <SettingsRow first icon={Languages} title={strings.settings.language} detail={strings.settings.english} />
        <SettingsRow icon={MapIcon} title={strings.settings.offlineMap} subtitle={strings.settings.offlineMapBody} badge={strings.settings.bundled} />
        {/* ST2-D: the tips tour again, on the Map tab */}
        <SettingsRow
          icon={Lightbulb}
          title={strings.settings.replayTour}
          subtitle={strings.settings.replayTourBody}
          onPress={() => {
            useTourStore.getState().start();
            router.navigate('/');
          }}
        />
        <SettingsRow icon={FileText} title={strings.settings.licences} onPress={() => router.push('/licences')} />
      </SettingsGroup>
    </Screen>
  );
}

import { useEffect, useRef } from 'react';

import { localPhNumber, type ConsoleDriver, type ConsoleRegistration } from '@/shared/driver/registrationConsole';
import { strings } from '@/strings';

import { Icon } from './Icon';

const text = strings.adminConsole;
const t = text.drivers.details;

// One driver phone's details in a modal, opened with View on the Drivers page. The registration it was
// set up from (when the console still lists it) adds when it was sent and approved.
export function DriverDetails({ driver, registration, onClose }: { driver: ConsoleDriver; registration: ConsoleRegistration | null; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  const fields: [string, string][] = [
    [t.driverId, driver.device_id],
    [t.plate, driver.plate],
    [t.route, driver.route_id],
    [t.number, driver.phone_e164 ? localPhNumber(driver.phone_e164) : t.notRecorded],
    [t.registered, registration ? text.whenFull(registration.created_at) : t.notRecorded],
    [t.approved, registration?.decided_at ? text.whenFull(registration.decided_at) : t.notRecorded],
  ];

  return (
    <dialog
      ref={dialog}
      className="details-dialog"
      aria-labelledby="driver-details-title"
      onClose={onClose}
      onClick={(event) => {
        // A click on the dim area around the card closes it
        if (event.target === event.currentTarget) event.currentTarget.close();
      }}>
      <div className="details-head">
        <span className="toolbar-icon">
          <Icon name="idCard" />
        </span>
        <div className="toolbar-text">
          <h2 id="driver-details-title">{t.title}</h2>
          <p className="details-sub">
            <span className="plate small">{driver.plate}</span>
            <span className="status ok">
              <span className="dot" aria-hidden="true" />
              {t.active}
            </span>
          </p>
        </div>
        <form method="dialog">
          <button type="submit" className="icon-button" aria-label={t.close}>
            <Icon name="close" />
          </button>
        </form>
      </div>
      <dl className="details-list">
        {fields.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      {!registration && (
        <p className="callout details-note">
          <Icon name="info" />
          {t.noRegistration}
        </p>
      )}
      <form method="dialog" className="details-foot">
        <button type="submit" className="button secondary">
          {t.close}
        </button>
      </form>
    </dialog>
  );
}

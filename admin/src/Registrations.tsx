import { useCallback, useEffect, useRef, useState } from 'react';

import { CONSOLE_REFRESH_S } from '@/shared/config';
import { localPhNumber, photosLeft, splitRegistrations, type ConsoleRegistration } from '@/shared/driver/registrationConsole';
import { strings } from '@/strings';

import type { ConsoleApi } from './api';
import { errorText } from './errors';
import { RegistrationCard } from './RegistrationCard';

const text = strings.adminConsole;
const t = text.registrations;
const MS_PER_S = 1000;

// The review queue and the decided registrations (PRD 9.5 "Review"). The list reloads by itself while
// the page is in view, so a new registration shows up without a click.
export function Registrations({ api }: { api: ConsoleApi }) {
  const [rows, setRows] = useState<ConsoleRegistration[] | null>(null);
  const [pinSet, setPinSet] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Registrations whose leftover photos are being deleted, so a reload does not start it twice
  const cleaning = useRef(new Set<string>());

  const load = useCallback(async () => {
    const [list, pin] = await Promise.all([api.registrations(), api.pinIsSet()]);
    if (!list.ok) {
      setError(list.error);
      return;
    }
    setError(null);
    setRows(list.value);
    if (pin.ok) setPinSet(pin.value);
    for (const left of photosLeft(list.value)) {
      if (cleaning.current.has(left.registrationId)) continue;
      cleaning.current.add(left.registrationId);
      void api.deletePhotos(left.registrationId, left.paths).finally(() => cleaning.current.delete(left.registrationId));
    }
  }, [api]);

  useEffect(() => {
    const first = setTimeout(() => void load(), 0);
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void load();
    }, CONSOLE_REFRESH_S * MS_PER_S);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [load]);

  if (!rows) {
    return error ? (
      <p className="notice error" role="alert">
        {errorText(error)}
      </p>
    ) : (
      <p className="muted">{text.loading}</p>
    );
  }

  const { waiting, decided } = splitRegistrations(rows);
  return (
    <>
      <section aria-labelledby="waiting-heading">
        <div className="section-head">
          <h2 id="waiting-heading">{t.waitingHeading(waiting.length)}</h2>
          <button type="button" className="button quiet" onClick={() => void load()}>
            {text.refresh}
          </button>
        </div>
        {error && (
          <p className="notice error" role="alert">
            {errorText(error)}
          </p>
        )}
        {!pinSet && (
          <p className="notice warning">
            {t.pinMissing} <a href="#settings">{text.tabs.settings}</a>
          </p>
        )}
        {waiting.length === 0 ? (
          <p className="muted">{t.none}</p>
        ) : (
          <>
            <p className="muted">{t.howToCheck}</p>
            <ol className="queue">
              {waiting.map((row) => (
                <li key={row.registration_id}>
                  <RegistrationCard row={row} api={api} canApprove={pinSet} onDecided={load} />
                </li>
              ))}
            </ol>
          </>
        )}
      </section>

      <section aria-labelledby="decided-heading">
        <h2 id="decided-heading">{t.decidedHeading}</h2>
        {decided.length === 0 ? (
          <p className="muted">{t.decidedNone}</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">{t.columns.plate}</th>
                  <th scope="col">{t.columns.route}</th>
                  <th scope="col">{t.columns.number}</th>
                  <th scope="col">{t.columns.outcome}</th>
                  <th scope="col">{t.columns.when}</th>
                </tr>
              </thead>
              <tbody>
                {decided.map((row) => (
                  <tr key={row.registration_id}>
                    <td>
                      <span className="plate small">{row.plate}</span>
                    </td>
                    <td>{row.route_id}</td>
                    <td className="nowrap">{localPhNumber(row.phone_e164)}</td>
                    <td>
                      {t.status[row.status]}
                      {row.reason && <span className="reason">{row.reason}</span>}
                      {(row.id_photo_path || row.vehicle_photo_path) && <span className="reason warning">{t.photosStillStored}</span>}
                    </td>
                    <td className="nowrap">{text.when(row.decided_at ?? row.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

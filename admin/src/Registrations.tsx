import { localPhNumber, splitRegistrations, type ConsoleRegistration } from '@/shared/driver/registrationConsole';
import { strings } from '@/strings';

import type { ConsoleApi } from './api';
import { errorText } from './errors';
import { Icon } from './Icon';
import { PageHeader } from './PageHeader';
import { RegistrationCard } from './RegistrationCard';
import type { RegistrationsState } from './useRegistrations';

const text = strings.adminConsole;
const t = text.registrations;

// How each outcome is marked in the Decided table
const OUTCOME_TONE: Record<ConsoleRegistration['status'], string> = {
  pending: 'muted',
  approved: 'primary',
  collected: 'ok',
  rejected: 'danger',
  expired: 'muted',
};

// The review queue and the decided registrations (PRD 9.5 "Review"). The list itself is loaded by
// useRegistrations in the console shell, which keeps it current on every page.
export function Registrations({ api, state }: { api: ConsoleApi; state: RegistrationsState }) {
  const { rows, pinSet, error, updatedAt, load } = state;
  const reload = () => void load();

  if (!rows) {
    return (
      <>
        <PageHeader title={t.title} onRefresh={reload} />
        {error ? (
          <p className="notice error" role="alert">
            <Icon name="error" />
            {errorText(error)}
          </p>
        ) : (
          <p className="muted">{text.loading}</p>
        )}
      </>
    );
  }

  const { waiting, decided } = splitRegistrations(rows);
  return (
    <>
      <PageHeader title={t.title} subtitle={t.waitingHeading(waiting.length)} updatedAt={updatedAt} onRefresh={reload} />
      {error && (
        <p className="notice error" role="alert">
          <Icon name="error" />
          {errorText(error)}
        </p>
      )}
      {!pinSet && (
        <p className="notice warning">
          <Icon name="warning" />
          <span>
            {t.pinMissing} <a href="#settings">{text.tabs.settings}</a>
          </span>
        </p>
      )}

      <section aria-label={t.title} className="stack">
        {waiting.length === 0 ? (
          <p className="callout">
            <Icon name="info" />
            {t.none}
          </p>
        ) : (
          <>
            <p className="callout">
              <Icon name="shield" />
              {t.howToCheck}
            </p>
            <ol className="queue">
              {waiting.map((row, index) => (
                <li key={row.registration_id}>
                  <RegistrationCard row={row} position={t.position(index + 1, waiting.length)} api={api} canApprove={pinSet} onDecided={reload} />
                </li>
              ))}
            </ol>
          </>
        )}
      </section>

      <section aria-labelledby="decided-heading" className="stack">
        <div>
          <h2 id="decided-heading">{t.decidedHeading}</h2>
          <p className="muted">{t.decidedSubtitle}</p>
        </div>
        {decided.length === 0 ? (
          <p className="muted">{t.decidedNone}</p>
        ) : (
          <div className="card table-card">
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th scope="col">{t.columns.plate}</th>
                    <th scope="col">{t.columns.route}</th>
                    <th scope="col">{t.columns.number}</th>
                    <th scope="col">{t.columns.outcome}</th>
                    <th scope="col" className="end">
                      {t.columns.when}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {decided.map((row) => (
                    <tr key={row.registration_id}>
                      <td>
                        <span className="plate small">{row.plate}</span>
                      </td>
                      <td>
                        <span className="chip-code">{row.route_id}</span>
                      </td>
                      <td className="nowrap number">{localPhNumber(row.phone_e164)}</td>
                      <td>
                        <span className={`status ${OUTCOME_TONE[row.status]}`}>
                          <span className="dot" aria-hidden="true" />
                          {t.status[row.status]}
                        </span>
                        {row.reason && <span className="subline">{row.reason}</span>}
                        {(row.id_photo_path || row.vehicle_photo_path) && <span className="subline warning">{t.photosStillStored}</span>}
                      </td>
                      <td className="nowrap end muted">{text.when(row.decided_at ?? row.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </>
  );
}

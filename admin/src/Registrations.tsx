import { useState } from 'react';

import {
  localPhNumber,
  REGISTRATION_TABS,
  rowsInTab,
  splitRegistrations,
  tabCounts,
  type ConsoleRegistration,
  type RegistrationTab,
} from '@/shared/driver/registrationConsole';
import { strings } from '@/strings';

import type { ConsoleApi } from './api';
import { errorText } from './errors';
import { Icon } from './Icon';
import { PageHeader } from './PageHeader';
import { RegistrationCard } from './RegistrationCard';
import type { RegistrationsState } from './useRegistrations';

const text = strings.adminConsole;
const t = text.registrations;

// How each status is marked in the tables
const STATUS_TONE: Record<ConsoleRegistration['status'], string> = {
  pending: 'warning',
  approved: 'primary',
  collected: 'ok',
  rejected: 'danger',
  expired: 'muted',
};

// The registrations by status (PRD 9.5 "Review"): Pending is the review queue, the other tabs are
// lists. The list itself is loaded by useRegistrations in the console shell, which keeps it current on
// every page.
export function Registrations({ api, state }: { api: ConsoleApi; state: RegistrationsState }) {
  const { rows, pinSet, error, updatedAt, load } = state;
  const [tab, setTab] = useState<RegistrationTab>('pending');
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

  const { waiting } = splitRegistrations(rows);
  const counts = tabCounts(rows);
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

      <div className="segmented" role="tablist" aria-label={t.tabsLabel}>
        {REGISTRATION_TABS.map((name) => (
          <button
            key={name}
            type="button"
            role="tab"
            id={`registrations-tab-${name}`}
            aria-selected={tab === name}
            aria-controls="registrations-panel"
            className="segment"
            onClick={() => setTab(name)}>
            {t.tabs[name]}
            <span className="segment-count">{counts[name]}</span>
          </button>
        ))}
      </div>

      <section role="tabpanel" id="registrations-panel" aria-labelledby={`registrations-tab-${tab}`} className="stack">
        {tab !== 'pending' ? (
          <RegistrationTable rows={rowsInTab(rows, tab)} empty={t.tabEmpty[tab]} />
        ) : waiting.length === 0 ? (
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
    </>
  );
}

// One tab's registrations as a table, newest change first
function RegistrationTable({ rows, empty }: { rows: ConsoleRegistration[]; empty: string }) {
  if (rows.length === 0) return <p className="muted">{empty}</p>;
  return (
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
            {rows.map((row) => (
              <tr key={row.registration_id}>
                <td>
                  <span className="plate small">{row.plate}</span>
                </td>
                <td>
                  <span className="chip-code">{row.route_id}</span>
                </td>
                <td className="nowrap number">{localPhNumber(row.phone_e164)}</td>
                <td>
                  <span className={`status ${STATUS_TONE[row.status]}`}>
                    <span className="dot" aria-hidden="true" />
                    {t.status[row.status]}
                  </span>
                  {row.reason && <span className="subline">{row.reason}</span>}
                  {row.status !== 'pending' && (row.id_photo_path || row.vehicle_photo_path) && (
                    <span className="subline warning">{t.photosStillStored}</span>
                  )}
                </td>
                <td className="nowrap end muted">{text.when(row.decided_at ?? row.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

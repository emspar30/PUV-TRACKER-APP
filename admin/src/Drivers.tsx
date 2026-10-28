import { useCallback, useEffect, useState } from 'react';

import {
  driverRegistration,
  filterDrivers,
  listedRoutes,
  localPhNumber,
  type ConsoleDriver,
  type ConsoleRegistration,
} from '@/shared/driver/registrationConsole';
import { strings } from '@/strings';

import type { ConsoleApi } from './api';
import { DriverDetails } from './DriverDetails';
import { errorText } from './errors';
import { Icon } from './Icon';
import { PageHeader } from './PageHeader';
import { RouteSelect } from './RouteSelect';

const text = strings.adminConsole;
const t = text.drivers;

// The active driver phones, newest set up first, by route and by plate, with Retire (PRD 9.5 "After
// setup"), as scripts/retire-device.ts does, and View for one phone's details. The registrations (loaded
// by the console shell) give the details when each phone's registration was sent and approved.
export function Drivers({ api, registrations }: { api: ConsoleApi; registrations: ConsoleRegistration[] | null }) {
  const [rows, setRows] = useState<ConsoleDriver[] | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [retiring, setRetiring] = useState<string | null>(null);
  // The filters: one route (null: every route) and a plate search
  const [route, setRoute] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [viewing, setViewing] = useState<ConsoleDriver | null>(null);

  const load = useCallback(async () => {
    const result = await api.drivers();
    if (result.ok) {
      setRows(result.value);
      setUpdatedAt(Date.now());
      setError(null);
    } else {
      setError(result.error);
    }
  }, [api]);

  useEffect(() => {
    const first = setTimeout(() => void load(), 0);
    return () => clearTimeout(first);
  }, [load]);

  async function retire(driver: ConsoleDriver) {
    if (!window.confirm(t.confirmRetire(driver.device_id, driver.plate))) return;
    setRetiring(driver.device_id);
    setDone(null);
    const result = await api.retire(driver.device_id);
    setRetiring(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setDone(t.retired(driver.device_id));
    void load();
  }

  const clearFilters = () => {
    setRoute(null);
    setSearch('');
  };

  const routes = rows ? listedRoutes(rows) : [];
  // A route chosen before the last phone on it was retired no longer filters
  const routeShown = route !== null && routes.includes(route) ? route : null;
  const shown = rows ? filterDrivers(rows, routeShown, search) : [];

  return (
    <>
      {done && (
        <div className="notice ok banner" role="status">
          <Icon name="checkCircle" />
          <span>{done}</span>
          <button type="button" className="icon-button" aria-label={t.dismiss} onClick={() => setDone(null)}>
            <Icon name="close" size={16} />
          </button>
        </div>
      )}
      <PageHeader title={t.title} subtitle={rows ? t.heading(rows.length) : undefined} updatedAt={updatedAt} onRefresh={() => void load()} />
      {error && (
        <p className="notice error" role="alert">
          <Icon name="error" />
          {errorText(error)}
        </p>
      )}

      {!rows ? (
        !error && <DriversSkeleton />
      ) : rows.length === 0 ? (
        <div className="card empty-state">
          <span className="empty-icon">
            <Icon name="drivers" size={22} />
          </span>
          <h2>{t.emptyHeading}</h2>
          <p className="muted">{t.none}</p>
          <a className="button secondary" href="#registrations">
            <Icon name="registrations" size={16} />
            {t.viewRegistrations}
          </a>
        </div>
      ) : (
        <div className="card table-card">
          <div className="table-toolbar">
            <span className="toolbar-icon">
              <Icon name="drivers" />
            </span>
            <div className="toolbar-text">
              <h2>{t.tableHeading}</h2>
              <p className="muted small">{t.tableBody}</p>
            </div>
            <div className="filters">
              <label className="search">
                <span className="visually-hidden">{t.searchLabel}</span>
                <Icon name="search" size={16} />
                <input type="search" value={search} placeholder={t.searchPlaceholder} onChange={(event) => setSearch(event.target.value)} />
              </label>
              <RouteSelect routes={routes} value={routeShown} onChange={setRoute} />
            </div>
          </div>
          {shown.length === 0 ? (
            <div className="no-match">
              <p className="muted">{t.noMatch}</p>
              <button type="button" className="button secondary" onClick={clearFilters}>
                {t.clearFilters}
              </button>
            </div>
          ) : (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th scope="col">{t.columns.device}</th>
                    <th scope="col">{t.columns.plate}</th>
                    <th scope="col">{t.columns.route}</th>
                    <th scope="col">{t.columns.number}</th>
                    <th scope="col">{t.columns.since}</th>
                    <td />
                  </tr>
                </thead>
                <tbody>
                  {shown.map((driver) => (
                    <tr key={driver.device_id}>
                      <td className="nowrap">
                        <span className="status ok">
                          <span className="dot" aria-hidden="true" />
                          <span className="code">{driver.device_id}</span>
                        </span>
                      </td>
                      <td>
                        <span className="plate small">{driver.plate}</span>
                      </td>
                      <td>
                        <span className="chip-code">{driver.route_id}</span>
                      </td>
                      <td className="nowrap number">{driver.phone_e164 ? localPhNumber(driver.phone_e164) : t.noNumber}</td>
                      <td className="nowrap muted">{text.when(driver.provisioned_at)}</td>
                      <td className="end">
                        <span className="row-actions">
                          <button type="button" className="button secondary" aria-label={t.viewLabel(driver.device_id)} onClick={() => setViewing(driver)}>
                            <Icon name="idCard" size={16} />
                            {t.view}
                          </button>
                          <button type="button" className="button danger-soft" disabled={retiring !== null} onClick={() => void retire(driver)}>
                            <Icon name="retire" size={16} />
                            {t.retire}
                          </button>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="table-foot">{t.showing(shown.length, rows.length)}</p>
        </div>
      )}
      {viewing && <DriverDetails driver={viewing} registration={driverRegistration(viewing, registrations ?? [])} onClose={() => setViewing(null)} />}
    </>
  );
}

// The shape of the table while the first load is on its way. The bars' lengths (percent of each
// column) vary from row to row, as real plates, numbers and dates do.
const SKELETON_ROWS = [
  [70, 80, 50, 85, 75],
  [60, 70, 50, 75, 65],
  [75, 80, 50, 80, 70],
  [65, 70, 50, 70, 75],
];

function DriversSkeleton() {
  return (
    <div className="card table-card" aria-busy="true">
      <span className="visually-hidden">{text.loading}</span>
      <div className="table-toolbar" aria-hidden="true">
        <span className="skeleton circle" />
        <div className="toolbar-text skeleton-lines">
          <span className="skeleton title" />
          <span className="skeleton subtitle" />
        </div>
        <span className="skeleton field" />
      </div>
      <div aria-hidden="true">
        {SKELETON_ROWS.map((widths, row) => (
          <div key={row} className="skeleton-row">
            {widths.map((width, column) => (
              <span key={column} className="skeleton" style={{ width: `${width}%` }} />
            ))}
            <span className="skeleton pill-button" />
          </div>
        ))}
      </div>
    </div>
  );
}

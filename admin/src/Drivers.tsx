import { useCallback, useEffect, useState } from 'react';

import { localPhNumber, type ConsoleDriver } from '@/shared/driver/registrationConsole';
import { strings } from '@/strings';

import type { ConsoleApi } from './api';
import { errorText } from './errors';
import { Icon } from './Icon';
import { PageHeader } from './PageHeader';

const text = strings.adminConsole;
const t = text.drivers;

// The active driver phones and Retire (PRD 9.5 "After setup"), as scripts/retire-device.ts does
export function Drivers({ api }: { api: ConsoleApi }) {
  const [rows, setRows] = useState<ConsoleDriver[] | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [retiring, setRetiring] = useState<string | null>(null);

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
        !error && <p className="muted">{text.loading}</p>
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
            <div>
              <h2>{t.tableHeading}</h2>
              <p className="muted small">{t.tableBody}</p>
            </div>
          </div>
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
                {rows.map((driver) => (
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
                      <button type="button" className="button danger-soft" disabled={retiring !== null} onClick={() => void retire(driver)}>
                        <Icon name="retire" size={16} />
                        {t.retire}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="table-foot">{t.showing(rows.length)}</p>
        </div>
      )}
    </>
  );
}

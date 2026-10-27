import { useCallback, useEffect, useState } from 'react';

import { localPhNumber, type ConsoleDriver } from '@/shared/driver/registrationConsole';
import { strings } from '@/strings';

import type { ConsoleApi } from './api';
import { errorText } from './errors';

const text = strings.adminConsole;
const t = text.drivers;

// The active driver phones and Retire (PRD 9.5 "After setup"), as scripts/retire-device.ts does
export function Drivers({ api }: { api: ConsoleApi }) {
  const [rows, setRows] = useState<ConsoleDriver[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [retiring, setRetiring] = useState<string | null>(null);

  const load = useCallback(async () => {
    const result = await api.drivers();
    if (result.ok) {
      setRows(result.value);
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
    <section aria-labelledby="drivers-heading">
      <div className="section-head">
        <h2 id="drivers-heading">{rows ? t.heading(rows.length) : text.tabs.drivers}</h2>
        <button type="button" className="button quiet" onClick={() => void load()}>
          {text.refresh}
        </button>
      </div>
      {error && (
        <p className="notice error" role="alert">
          {errorText(error)}
        </p>
      )}
      {done && (
        <p className="notice ok" role="status">
          {done}
        </p>
      )}
      {!rows ? (
        !error && <p className="muted">{text.loading}</p>
      ) : rows.length === 0 ? (
        <p className="muted">{t.none}</p>
      ) : (
        <div className="table-wrap">
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
                  <td className="nowrap">{driver.device_id}</td>
                  <td>
                    <span className="plate small">{driver.plate}</span>
                  </td>
                  <td>{driver.route_id}</td>
                  <td className="nowrap">{driver.phone_e164 ? localPhNumber(driver.phone_e164) : t.noNumber}</td>
                  <td className="nowrap">{text.when(driver.provisioned_at)}</td>
                  <td className="end">
                    <button type="button" className="button outline" disabled={retiring !== null} onClick={() => void retire(driver)}>
                      {t.retire}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

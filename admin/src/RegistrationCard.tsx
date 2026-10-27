import { useEffect, useRef, useState } from 'react';

import { REGISTRATION_REASON_MAX_CHARS } from '@/shared/config';
import { localPhNumber, rejectionReason, type ConsoleRegistration } from '@/shared/driver/registrationConsole';
import { strings } from '@/strings';

import type { ConsoleApi } from './api';
import { errorText } from './errors';

const text = strings.adminConsole;
const t = text.registrations;

type Props = {
  row: ConsoleRegistration;
  api: ConsoleApi;
  // Off while no admin PIN is set: an approved phone could not collect its setup
  canApprove: boolean;
  onDecided: () => void;
};

// One registration waiting for review: the ID photo, the multicab photo with the typed plate under
// it (the two must match), and the decision
export function RegistrationCard({ row, api, canApprove, onDecided }: Props) {
  const [links, setLinks] = useState<Record<string, string> | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const idPath = row.id_photo_path;
  const vehiclePath = row.vehicle_photo_path;
  useEffect(() => {
    let live = true;
    const paths = [idPath, vehiclePath].filter((path): path is string => path !== null);
    void api.photoLinks(paths).then((result) => {
      if (live) setLinks(result.ok ? result.value : {});
    });
    return () => {
      live = false;
    };
  }, [api, idPath, vehiclePath]);

  const phone = localPhNumber(row.phone_e164);
  const reasonToSend = rejectionReason(reason);
  const reasonId = `reason-${row.registration_id}`;

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    const result = await api.decide(row.registration_id, approve, reasonToSend);
    setBusy(false);
    if (result.ok) onDecided();
    else setError(result.error);
  }

  function approve() {
    const question = t.confirmApprove(row.plate, row.route_id, phone) + (row.active_device ? t.confirmReplace(row.active_device) : '');
    if (window.confirm(question)) void decide(true);
  }

  return (
    <article className="review" aria-label={`${row.plate}, ${t.route(row.route_id)}`}>
      <figure className="photo-cell">
        <h3>{t.idPhoto}</h3>
        <Photo label={t.idPhoto} path={idPath} links={links} />
      </figure>

      <figure className="photo-cell">
        <h3>{t.vehiclePhoto}</h3>
        <Photo label={t.vehiclePhoto} path={vehiclePath} links={links} />
        <figcaption className="typed-plate">
          <span className="plate">{row.plate}</span>
          <span className="plate-caption">{t.typedPlate}</span>
        </figcaption>
      </figure>

      <div className="facts">
        <p className="route">{t.route(row.route_id)}</p>
        <p className="phone">{phone}</p>
        <p className="muted small">{t.sent(text.when(row.created_at))}</p>
        {row.active_device && <p className="notice warning">{t.replaces(row.active_device)}</p>}
        {error && (
          <p className="notice error" role="alert">
            {errorText(error)}
          </p>
        )}

        {rejecting ? (
          <div className="reject">
            <label htmlFor={reasonId}>{t.reasonLabel}</label>
            <div className="picks">
              {t.reasonPicks.map((pick) => (
                <button key={pick} type="button" className="chip" aria-pressed={reason === pick} onClick={() => setReason(pick)}>
                  {pick}
                </button>
              ))}
            </div>
            <textarea id={reasonId} rows={3} maxLength={REGISTRATION_REASON_MAX_CHARS} value={reason} onChange={(event) => setReason(event.target.value)} />
            <p className="muted small">{t.reasonLength(reason.trim().length, REGISTRATION_REASON_MAX_CHARS)}</p>
            <div className="actions">
              <button type="button" className="button danger" disabled={busy || reasonToSend === null} onClick={() => void decide(false)}>
                {busy ? t.saving : t.sendRejection}
              </button>
              <button
                type="button"
                className="button quiet"
                disabled={busy}
                onClick={() => {
                  setRejecting(false);
                  setReason('');
                }}>
                {t.cancel}
              </button>
            </div>
          </div>
        ) : (
          <div className="actions">
            <button type="button" className="button primary" disabled={busy || !canApprove} onClick={approve}>
              {busy ? t.saving : t.approve}
            </button>
            <button type="button" className="button outline" disabled={busy} onClick={() => setRejecting(true)}>
              {t.reject}
            </button>
          </div>
        )}
      </div>
    </article>
  );
}

// A photo from its short-lived link, enlarged in place on a click (the enlarged one is the picture
// already loaded, so the link is not needed again)
function Photo({ label, path, links }: { label: string; path: string | null; links: Record<string, string> | null }) {
  const enlarged = useRef<HTMLDialogElement>(null);
  const [failed, setFailed] = useState(false);

  if (!path) return <div className="photo empty">{t.noPhoto}</div>;
  if (!links) return <div className="photo empty" aria-busy="true" />;
  const url = links[path];
  if (!url || failed) return <div className="photo empty">{t.photoFailed}</div>;

  return (
    <>
      <button type="button" className="photo" aria-label={t.enlarge(label)} onClick={() => enlarged.current?.showModal()}>
        <img src={url} alt={label} onError={() => setFailed(true)} />
      </button>
      <dialog
        ref={enlarged}
        className="lightbox"
        aria-label={label}
        onClick={(event) => {
          // A click on the dim area around the photo closes it
          if (event.target === event.currentTarget) event.currentTarget.close();
        }}>
        <img src={url} alt={label} />
        <form method="dialog">
          <button type="submit" className="button">
            {t.close}
          </button>
        </form>
      </dialog>
    </>
  );
}

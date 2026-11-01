import { useEffect, useRef, useState } from 'react';

import { REGISTRATION_REASON_MAX_CHARS } from '@/shared/config';
import { localPhNumber, rejectionReason, type ConsoleRegistration } from '@/shared/driver/registrationConsole';
import { strings } from '@/strings';

import type { ConsoleApi } from './api';
import { errorText } from './errors';
import { Icon } from './Icon';

const text = strings.adminConsole;
const t = text.registrations;

type Props = {
  row: ConsoleRegistration;
  // "Registration 1 of 2"
  position: string;
  api: ConsoleApi;
  // Off while no admin PIN is set: an approved phone could not collect its setup
  canApprove: boolean;
  onDecided: () => void;
};

// One registration waiting for review: the ID photo, the multicab photo with the typed plate under it
// (the two must match), the details and the decision. Rejecting opens the reason panel underneath.
export function RegistrationCard({ row, position, api, canApprove, onDecided }: Props) {
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

  function cancelRejecting() {
    setRejecting(false);
    setReason('');
  }

  return (
    <article className="card review" aria-label={`${row.plate}, ${t.route(row.route_id)}`}>
      {row.active_device && (
        <p className="review-warning">
          <Icon name="warning" size={20} />
          {t.replaces(row.active_device)}
        </p>
      )}
      <div className="review-head">
        <span>{position}</span>
        <span className="with-icon">
          <Icon name="send" size={14} />
          {t.sent(text.when(row.created_at))}
        </span>
      </div>

      <div className="review-body">
        <div className="review-col">
          <div className="col-head">
            <h3>{t.idPhoto}</h3>
            <span className="hint">
              <Icon name="zoom" size={14} />
              {t.enlargeHint}
            </span>
          </div>
          <Photo label={t.idPhoto} path={idPath} links={links} />
        </div>

        <div className="review-col">
          <div className="col-head">
            <h3>{t.vehiclePhoto}</h3>
            <span className="hint">
              <Icon name="zoom" size={14} />
              {t.enlargeHint}
            </span>
          </div>
          <Photo label={t.vehiclePhoto} path={vehiclePath} links={links} />
          <div className="plate-panel">
            <span className="plate">{row.plate}</span>
            <span className="caption">{t.typedPlate}</span>
          </div>
        </div>

        <div className="review-col details">
          <div>
            <p className="detail-label">{t.routeLabel}</p>
            <p className="route-value">{row.route_id}</p>
          </div>
          <div className="detail-divided">
            <p className="detail-label">{t.numberLabel}</p>
            <p className="phone-value">
              <Icon name="drivers" />
              {phone}
            </p>
          </div>
          {error && (
            <p className="notice error" role="alert">
              <Icon name="error" />
              {errorText(error)}
            </p>
          )}
          <div className="review-actions">
            {rejecting ? (
              <p className="muted small">{t.rejectingNote}</p>
            ) : (
              <>
                <button type="button" className="button primary grow" disabled={busy || !canApprove} onClick={approve}>
                  <Icon name="check" />
                  {busy ? t.saving : t.approve}
                </button>
                <button type="button" className="button secondary" disabled={busy} onClick={() => setRejecting(true)}>
                  <span className="danger-ink">
                    <Icon name="close" />
                  </span>
                  {t.reject}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {rejecting && (
        <div className="reject-panel">
          <div className="reject-head">
            <h3 id={`${reasonId}-label`} className="with-icon">
              <span className="danger-ink">
                <Icon name="block" size={20} />
              </span>
              {t.reasonLabel}
            </h3>
            <span className="muted small">{t.driverSeesIt}</span>
          </div>
          <div className="picks">
            {t.reasonPicks.map((pick) => (
              <button key={pick} type="button" className="pick" aria-pressed={reason === pick} onClick={() => setReason(pick)}>
                <span>{pick}</span>
                <Icon name="checkCircle" />
              </button>
            ))}
          </div>
          <textarea
            id={reasonId}
            aria-labelledby={`${reasonId}-label`}
            rows={2}
            maxLength={REGISTRATION_REASON_MAX_CHARS}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
          <div className="reject-foot">
            <span className="muted small">{t.reasonLength(reason.trim().length, REGISTRATION_REASON_MAX_CHARS)}</span>
            <div className="actions">
              <button type="button" className="button text" disabled={busy} onClick={cancelRejecting}>
                {t.cancel}
              </button>
              <button type="button" className="button danger" disabled={busy || reasonToSend === null} onClick={() => void decide(false)}>
                <Icon name="block" />
                {busy ? t.saving : t.sendRejection}
              </button>
            </div>
          </div>
        </div>
      )}
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
          <button type="submit" className="button secondary">
            <Icon name="close" />
            {t.close}
          </button>
        </form>
      </dialog>
    </>
  );
}

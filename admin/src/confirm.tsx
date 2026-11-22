import { useEffect, useRef, useState } from 'react';

import { strings } from '@/strings';

import { Icon } from './Icon';

const text = strings.adminConsole;

// The console's own confirmation box (2026-11-23), in place of the browser's "localhost says" one.
// askConfirm opens it and answers true for the confirm button, false for Cancel, Escape or a click
// outside. One box at a time; ConfirmHost (in main.tsx) shows it.
export type ConfirmRequest = {
  title: string;
  body?: string;
  confirmLabel: string;
  // A red confirm button for what cannot be undone
  danger?: boolean;
};

type Pending = ConfirmRequest & { resolve: (yes: boolean) => void };

let show: ((pending: Pending) => void) | null = null;

export function askConfirm(request: ConfirmRequest): Promise<boolean> {
  return new Promise((resolve) => {
    if (!show) {
      resolve(false);
      return;
    }
    show({ ...request, resolve });
  });
}

export function ConfirmHost() {
  const dialog = useRef<HTMLDialogElement>(null);
  const [pending, setPending] = useState<Pending | null>(null);

  useEffect(() => {
    show = (next) => setPending(next);
    return () => {
      show = null;
    };
  }, []);

  useEffect(() => {
    const box = dialog.current;
    if (pending && box && !box.open) box.showModal();
  }, [pending]);

  function answer(yes: boolean) {
    dialog.current?.close();
    pending?.resolve(yes);
    setPending(null);
  }

  return (
    <dialog
      ref={dialog}
      className="confirm-box"
      aria-labelledby="confirm-title"
      onCancel={(event) => {
        event.preventDefault();
        answer(false);
      }}
      onClick={(event) => {
        // A click on the dim area around the box cancels
        if (event.target === event.currentTarget) answer(false);
      }}>
      {pending && (
        <div className="confirm-inner">
          <div className="confirm-head">
            <span className={`confirm-icon${pending.danger ? ' danger' : ''}`}>
              <Icon name={pending.danger ? 'warning' : 'info'} size={20} />
            </span>
            <h2 id="confirm-title">{pending.title}</h2>
          </div>
          {pending.body && <p className="confirm-body">{pending.body}</p>}
          <div className="confirm-actions">
            <button type="button" className="button secondary" onClick={() => answer(false)}>
              {text.registrations.cancel}
            </button>
            <button type="button" className={`button ${pending.danger ? 'danger' : 'primary'}`} autoFocus onClick={() => answer(true)}>
              {pending.confirmLabel}
            </button>
          </div>
        </div>
      )}
    </dialog>
  );
}

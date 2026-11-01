import { useState, type InputHTMLAttributes } from 'react';

import { Icon } from './Icon';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { showLabel: string; hideLabel: string };

// A password or PIN field with an eye button that shows what was typed
export function SecretInput({ showLabel, hideLabel, ...input }: Props) {
  const [shown, setShown] = useState(false);
  return (
    <div className="with-button">
      <input {...input} type={shown ? 'text' : 'password'} />
      <button type="button" className="icon-button" aria-label={shown ? hideLabel : showLabel} aria-pressed={shown} onClick={() => setShown(!shown)}>
        <Icon name={shown ? 'eyeOff' : 'eye'} />
      </button>
    </div>
  );
}

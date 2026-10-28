import { strings } from '@/strings';

import { Icon } from './Icon';

const text = strings.adminConsole;

// The top of each page: its title and one line about it, then when its data last loaded and Refresh
export function PageHeader({
  title,
  subtitle,
  updatedAt,
  onRefresh,
}: {
  title: string;
  subtitle?: string;
  updatedAt?: number | null;
  onRefresh?: () => void;
}) {
  return (
    <header className="page-head">
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
      {onRefresh && (
        <div className="page-actions">
          {updatedAt ? (
            <span className="updated">
              <Icon name="clock" size={15} />
              {text.updated(text.time(updatedAt))}
            </span>
          ) : null}
          <button type="button" className="button secondary" onClick={onRefresh}>
            <Icon name="refresh" size={16} />
            {text.refresh}
          </button>
        </div>
      )}
    </header>
  );
}

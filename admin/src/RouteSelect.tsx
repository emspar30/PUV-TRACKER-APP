import { strings } from '@/strings';

const t = strings.adminConsole.routeFilter;

// The route filter (Registrations and Drivers): every route, or one by its code
export function RouteSelect({ routes, value, onChange }: { routes: string[]; value: string | null; onChange: (route: string | null) => void }) {
  return (
    <label className="select">
      <span className="visually-hidden">{t.label}</span>
      <select value={value ?? ''} onChange={(event) => onChange(event.target.value || null)}>
        <option value="">{t.all}</option>
        {routes.map((code) => (
          <option key={code} value={code}>
            {code}
          </option>
        ))}
      </select>
    </label>
  );
}

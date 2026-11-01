import { strings } from '@/strings';

const text = strings.adminConsole;

// What the admin reads for an error a console call answered (api.ts)
export function errorText(error: string): string {
  if (error === 'not_admin') return text.notAdmin;
  if (error === 'offline') return text.offline;
  if (error === 'not_pending') return text.registrations.notPending;
  return text.failed(error);
}

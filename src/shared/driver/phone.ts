// Philippine mobile numbers in E.164. Defined beside the Edge Functions, which check registering
// drivers' numbers too (DRG3), and re-exported here.
export { isSameNumber, normalizePhNumber } from '../../../supabase/functions/_shared/phone.ts';

// Numbers are stored in E.164 (+639…) for the server; people read and type them the local way (09…)
const PH_E164 = /^\+63(9\d{2})(\d{3})(\d{4})$/;

// +639171234567 as 0917 123 4567, for reading; anything else as given
export function localPhNumber(e164: string): string {
  const parts = PH_E164.exec(e164);
  return parts ? `0${parts[1]} ${parts[2]} ${parts[3]}` : e164;
}

// +639171234567 as 09171234567, as the driver typed it in the number field; anything else as given
export function localPhDigits(e164: string): string {
  const parts = PH_E164.exec(e164);
  return parts ? `0${parts[1]}${parts[2]}${parts[3]}` : e164;
}

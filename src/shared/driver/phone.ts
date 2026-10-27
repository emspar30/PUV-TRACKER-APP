// Philippine mobile numbers in E.164. Defined beside the Edge Functions, which check registering
// drivers' numbers too (DRG3), and re-exported here.
export { isSameNumber, normalizePhNumber } from '../../../supabase/functions/_shared/phone.ts';

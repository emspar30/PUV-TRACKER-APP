// The check-in verification hook lives beside verifyReport, so ENABLE_VERIFICATION is read in one place
export { verifyCheckIn, type CheckInReport } from '../../../supabase/functions/_shared/verifyReport.ts';

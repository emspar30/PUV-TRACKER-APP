// The retired pop-up (owner, 2026-10-29): when a signed retire notice for this phone has arrived, the
// driver app shows "This phone was removed from Tunton" once, over the red card that stays. Once per
// retirement: the time the notice arrived is remembered when the pop-up shows, so a phone that
// registers again and is retired again later shows it again.
export function retiredDialogDue(retiredAtMs: number | null, seenAtMs: number | null): boolean {
  return retiredAtMs !== null && seenAtMs !== retiredAtMs;
}

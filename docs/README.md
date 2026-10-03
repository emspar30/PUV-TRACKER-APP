# Docs index

Start with **`STATUS.md`**.

## 1. Every file in `docs/`

| File | Purpose | Status |
| --- | --- | --- |
| `PRD.md` | Requirements; section 19 is user flow v2 | **LIVE** |
| `IMPLEMENTATION_PLAN_MASTER.md` | The plan for all remaining work | **LIVE** |
| `STATUS.md` | Where we are, from code and tests | **LIVE** |
| `AUDIT_BACKLOG.md` | Things Emjay must check by hand | **LIVE** |
| `device-tests.md` | Manual test scripts and the results log | **LIVE** |
| `README.md` | This index | **LIVE** |
| `DESIGN.md` | Design tokens and components (cited in theme code comments) | REFERENCE |
| `BACKEND_SETUP.md` | Supabase dashboard steps and S4 Part 2 commands (needs an update for `app_config` and `team_accounts` in SB1) | REFERENCE |
| `PARTNER_BUILD_GUIDE.md` | How the partner builds on his own PC and with EAS | REFERENCE |
| `tiles.md` | How the offline tile file was made (cited by `tileset.ts`) | REFERENCE |
| `route-trace.md` | How the candidate Route 4 trace was made (cited by `r4.traced.candidate.ts`) | REFERENCE |
| `FLOW_GAP_ANALYSIS.md` | User flow v2 analysis; its privacy table still applies | REFERENCE |
| `MERGE_RESULT.md` | What the partner merge kept, R1a build steps, post-rebuild tests | REFERENCE until ST1 is done, then HISTORY |
| `AUDIT_3.md` | Latest full audit (2026-10-04) | REFERENCE |
| `MERGE_ANALYSIS.md` | Analysis before the merge | HISTORY (superseded by `MERGE_RESULT.md`) |
| `AUDIT.md` | First audit; §11 records the deferred `npm audit` advisories | HISTORY (superseded by `AUDIT_3.md`; the advisory decision is in the master plan §9, item 24) |
| `AUDIT_2.md` | Second audit | HISTORY (superseded by `AUDIT_3.md`) |
| `IMPLEMENTATION_PLAN_v2.md` | S0 to S5, Revisions 1 and 2 | HISTORY (superseded by `IMPLEMENTATION_PLAN_MASTER.md`) |
| `IMPLEMENTATION_PLAN_GPS.md` | UX2, G0 to G4, R1, decisions after Audit 2 | HISTORY (superseded by `IMPLEMENTATION_PLAN_MASTER.md`) |
| `IMPLEMENTATION_PLAN_FLOW.md` | F1 to F9, flow decisions | HISTORY (superseded by `IMPLEMENTATION_PLAN_MASTER.md`) |
| `S0_S1_REPORT.md` | Step report for S0 and S1 | HISTORY (superseded by `STATUS.md`) |
| `S2_REPORT.md` | The partner's report on **his** S2 (offline map) | HISTORY (his code was replaced by ours at the merge) |
| `S3_REPORT.md` | The partner's report on **his** S3 (routing) | HISTORY (same) |
| `PRD_v1_old.md` | PRD v1.0 draft | HISTORY (superseded by `PRD.md`) |
| `archive/AGENT_PROMPT.md` | The original agent prompt | HISTORY |
| `archive/IMPLEMENTATION_PLAN_v1.md` | The first plan | HISTORY (superseded by `IMPLEMENTATION_PLAN_v2.md`) |
| `archive/crowdfeed.tsx.txt`, `archive/routes.tsx.txt` | Removed stub screens | HISTORY |

## 2. The five live documents

**Confirmed:** `PRD.md`, `IMPLEMENTATION_PLAN_MASTER.md`, `STATUS.md`, `AUDIT_BACKLOG.md`, `device-tests.md`. `README.md` is only the index.

**The backlog is too long to be useful.**
- It has 477 lines and 64 items.
- About 15 items are confirmed by Emjay, decided, or replaced by later items (for example 5, 52, 53, 55, 58, and the UX1 items 22 to 30 that the UX2 mapping table points elsewhere).

**Proposal (not applied):**
1. Move the closed and superseded items, with their detail, into `docs/history/AUDIT_BACKLOG_closed.md`.
2. Keep in the backlog only the open items, grouped by what they need: emulator, phone, live project, decision.

That should bring it under about 150 lines.

## 3. Proposed moves (not applied)

All HISTORY files would go into one folder, `docs/history/`. Nothing is deleted.

```text
git mv docs/archive docs/history
git mv docs/MERGE_ANALYSIS.md docs/history/
git mv docs/AUDIT.md docs/history/
git mv docs/AUDIT_2.md docs/history/
git mv docs/IMPLEMENTATION_PLAN_v2.md docs/history/
git mv docs/IMPLEMENTATION_PLAN_GPS.md docs/history/
git mv docs/IMPLEMENTATION_PLAN_FLOW.md docs/history/
git mv docs/S0_S1_REPORT.md docs/history/
git mv docs/S2_REPORT.md docs/history/
git mv docs/S3_REPORT.md docs/history/
git mv docs/PRD_v1_old.md docs/history/
```

After ST1 is done: `git mv docs/MERGE_RESULT.md docs/history/`.

**Would a move break anything?**
- **No code, test or script reads a document.** Paths appear only in code comments:
  - `DESIGN.md` in the theme and component files;
  - `tiles.md` in `tileset.ts`;
  - `route-trace.md` in the candidate trace;
  - `BACKEND_SETUP.md` in the integration test header;
  - `AUDIT_BACKLOG.md` in two test headers.

  None of these files is on the move list.
- **`AGENTS.md`** (loaded through `CLAUDE.md`) names `docs/IMPLEMENTATION_PLAN_v2.md` as the approved plan. It should point to `docs/IMPLEMENTATION_PLAN_MASTER.md` once the move happens, which needs Emjay's approval to edit.
- **Links between documents** to the moved files would become stale text, but nothing fails. The master plan's supersession table and the PRD's section 19 cite the old plans by name.

## 4. Rules to keep it tidy (for the agent, from now on)

1. After every step, update only `STATUS.md` and `AUDIT_BACKLOG.md`, plus the `device-tests.md` results log when a device run happens.
2. New reports, analyses and audits go into `docs/history/` from the start.
3. Never create a new top-level document in `docs/` without asking Emjay.

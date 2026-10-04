# Docs index

Start with **`STATUS.md`**.

## Rules to keep it tidy (for the agent)

1. After every step, update only `STATUS.md` and `AUDIT_BACKLOG.md`, plus the `device-tests.md` results log when a device run happens.
2. New reports, analyses and audits go into `docs/history/` from the start.
3. Never create a new top-level document in `docs/` without asking Emjay.

## 1. Live documents (five)

| File | Purpose |
| --- | --- |
| `PRD.md` | Requirements; section 19 is user flow v2 |
| `IMPLEMENTATION_PLAN_MASTER.md` | The plan for all remaining work. `AGENTS.md` will name it once the one-line change waiting for Emjay's review is committed. |
| `STATUS.md` | Where we are, from code and tests |
| `AUDIT_BACKLOG.md` | Open things Emjay must check by hand; closed items are in `history/AUDIT_BACKLOG_CLOSED.md` |
| `device-tests.md` | Manual test scripts and the results log |

`README.md` is this index.

## 2. Reference documents

| File | Purpose |
| --- | --- |
| `DESIGN.md` | Design tokens and components; cited in theme code comments |
| `BACKEND_SETUP.md` | The commuter-side database design (SB1), dashboard steps and the live commands |
| `PARTNER_BUILD_GUIDE.md` | How the partner builds, locally and with EAS |
| `tiles.md` | How the offline tile file was made; cited by `tileset.ts` |
| `route-trace.md` | How the candidate Route 4 trace was made; cited by `r4.traced.candidate.ts` |
| `FLOW_GAP_ANALYSIS.md` | User flow v2 analysis; its privacy table still applies |
| `MERGE_RESULT.md` | What the partner merge kept; R1a build steps; tests after the rebuild. Becomes history after ST1. |
| `AUDIT_3.md` | Latest full audit (2026-10-04) |
| `APP_FEEL_PLAN.md` | Demo mode and the clean-UI steps AF1 to AF10; approved 2026-10-04 with Emjay's answers |

## 3. History (`docs/history/`)

| File | Superseded by |
| --- | --- |
| `AUDIT_BACKLOG_CLOSED.md` | Closed and superseded backlog items, with the original numbers |
| `MERGE_ANALYSIS.md` | `MERGE_RESULT.md` |
| `AUDIT.md` | `AUDIT_3.md`. Its §11 on the deferred `npm audit` advisories is item 24 of the master plan decision log. |
| `AUDIT_2.md` | `AUDIT_3.md` |
| `IMPLEMENTATION_PLAN_v2.md`, `IMPLEMENTATION_PLAN_GPS.md`, `IMPLEMENTATION_PLAN_FLOW.md` | `IMPLEMENTATION_PLAN_MASTER.md` |
| `IMPLEMENTATION_PLAN_v1.md` | `IMPLEMENTATION_PLAN_v2.md` |
| `S0_S1_REPORT.md` | `STATUS.md` |
| `S2_REPORT.md`, `S3_REPORT.md` | The partner's reports on **his** S2 and S3. His code was replaced by ours at the merge. |
| `PRD_v1_old.md` | `PRD.md` |
| `AGENT_PROMPT.md` | The original agent prompt |
| `crowdfeed.tsx.txt`, `routes.tsx.txt` | Removed stub screens |

**Paths.** No code, test, script or config reads a document. Paths appear only in code comments, and none of those files were moved. Links between documents that point at the old locations are stale text only.

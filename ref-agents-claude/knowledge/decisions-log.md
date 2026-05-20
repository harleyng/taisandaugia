# Decisions Log — EduLMS

> Living document. Every significant design/business decision is logged here with rationale.
> Note: most entries below are dated by **migration filename timestamp** (e.g. `20260919110000` → 2026-09-19). Pure incident/operational entries are dated by **calendar date** instead.

---

## 2026-05-14 (evening) — OJT `code` vs `claim_code` Split Into Distinct Columns

**Decision:** `ojt_assignments` now has TWO distinct fields:

| Concept | Column | Format | Lifecycle | Where shown |
|---|---|---|---|---|
| **OJT session identifier** | `code` | `OJT-{NNNNNN}` (sequential from `ojt_assignment_code_seq`) | Permanent, never cleared, unique per tenant | Admin Portal — list column, detail chip, search, agenda card |
| **Mentor-claim token** | `claim_code` | Random 6 digits | Generated only while `status = 'pending_mentor'`; cleared by `claim_ojt_as_mentor` on successful claim | Learner Portal only — `OjtClaimQrPanel`, `OjtStatusAlert`, kiosk page `/mentor/ojt/claim/:code` |

**Why:** Originally (2026-05-06 / migration `20260914120000`) `ojt_assignments.code` was a sequential `OJT-NNNNNN` identifier. The 2026-05-12 deferred-mentor flow reused the column as the mentor-claim token, and migration `20261013100000` then overwrote every row's `code` with a random 6-digit value (destroying the identifier). On 2026-05-14 morning, an attempted fix removed admin display entirely on the mistaken premise that the column had only one purpose. User clarified — the OJT-NNNNNN identifier is required and distinct from the claim token. This entry restores both as separate fields.

**Supersedes:**
- 2026-05-14 (morning) — "OJT `code` is a One-Time Mentor-Claim Token" — was a one-sided fix.
- 2026-05-06 — partial; the `code` semantics in that entry are restored, but now living in a column where it's the only meaning.

**How to apply:**
- **Admin UI:** display `assignment.code` (OJT-NNNNNN). Restored: leftmost "Mã" column in `OjtSessions.{current,new}.tsx`, search predicate including `code`, monospace `<p>` line in `OjtSessionCard.tsx`, H1 chip in `OjtAssignmentDetail.{current,new}.tsx`. Search placeholder restored.
- **Learner UI:** the claim flow reads `assignment.claim_code`. `OjtDetail.{desktop,mobile}.tsx` pass `assignment.claim_code` into `OjtStatusAlert` and `OjtClaimQrPanel`. Render gate is `isPendingMentor && assignment.claim_code`.
- **DB:** migration `20261122100000_ojt_split_code_and_claim_code.sql` renames `code` → `claim_code`, adds new `code TEXT NOT NULL` populated by the existing sequence (backfilled for every row), rewrites trigger + RPC. Partial unique index recreated on `(company_id, claim_code) WHERE status = 'pending_mentor'`. Both public and v2 schemas.
- **RPC contract:** `claim_ojt_as_mentor(p_code)` now looks up by `claim_code`, clears `claim_code = NULL` on success, returns both `code` (OJT-NNNNNN) and `claim_code` (pre-clear value) in the JSON payload. `useClaimOjtByCode.ts` `ClaimOjtSuccess` type updated.
- **One-time identifier reset (unavoidable):** the original 2026-05-06 `OJT-NNNNNN` values were destroyed by `20261013100000` and cannot be recovered. The migration backfills fresh identifiers — every existing row now has a *new* `OJT-NNNNNN`. Any pre-deploy bookmark/screenshot is stale.
- **i18n:** restored `training:ojt.table.code` = "Mã" / "Code". `deferMentorHint` rewritten to explicitly distinguish the two values: "Mã định danh OJT (OJT-XXXXXX) sẽ tự sinh. Học viên cũng sẽ nhận một mã 6 chữ số trong cổng Học viên..."

**Skipped step (with rationale):** the migration's cleanup of stale `claim_code` values on non-pending rows hit pre-existing FK orphan rows (`template_id`, `skill_level_id`). It was tidiness only — leftover values are noise but harmless (partial unique index ignores them; RPC scopes by status). A future migration can do the cleanup after the orphan FKs are repaired.

---

## 2026-05-12 — Phase 1C: Event-Level Participants Eliminated (Session-Scoped Only)

**Decision:** Candidates belong to **Sessions**, not to "the Event-as-a-pool." Phase 1B (2026-05-11) introduced `exam_sessions` and added nullable `session_id` to `exam_event_participants` for transitional support; the UI never finished the pivot, leaving admins forced into a broken event-add-then-carve flow. Phase 1C makes session-scoped placement the only flow that exists, in both data and code.

**Why:**
- Requirements §5 step 4: "Finalize candidate list, **assign Exam Paper + Exam Session**" — candidates are placed *into Sessions*, not "added to the Event."
- Requirements §6.7 expects ~24 sessions per event (HVLĐ scale, 8/day × 3 days). One flat event-wide roster is unworkable at that fan-out.
- Phase 1B's transitional nullable was a backwards-compat hedge, not the end-state. Leaving it open invited duplicate concepts (event-level vs session-level participants) and broke the mental model for admins.

**Scope (shipped):**
- Migration `20261110200000_eliminate_event_level_participants.sql` (both schemas):
  1. Backfilled NULL-session participants into the event's earliest session (creating a "<name> — Default Session" if none, mirroring Phase 1B's auto-session). Defensive `RAISE EXCEPTION` aborts if any orphans remain.
  2. Flipped `exam_event_participants.session_id` to `NOT NULL`.
  3. Dropped both partial UNIQUEs from Phase 1B; replaced with plain `UNIQUE (session_id, user_id)` plus new `UNIQUE (exam_event_id, user_id)` to enforce one placement per (event, user) per requirements §6.2.
  4. Extended `exam_event_registrations.status` to include terminal `placed`; added `placed_at` + `placed_by` audit columns.
  5. New SECURITY DEFINER RPC `place_registration_into_session(p_registration_id, p_session_id, p_exam_paper_id)`: validates registration is awaiting placement, session ↔ event matches, session not terminal, event.created_by OR super_admin auth. Atomically upserts the participant row (`ON CONFLICT (exam_event_id, user_id) DO UPDATE`) and transitions the registration to `placed`. Fires a learner notification.
- Hooks (`useExamEventParticipants.ts`): `sessionId` required on add/bulk/assign/remove; new `useExamSessionParticipants(sessionId)` server-side filter; new `usePlaceRegistrationIntoSession` RPC wrapper; new `bySession` query key + invalidations.
- UI: ExamEventDetail Participants tab deleted (stale `?tab=participants` redirects to `?tab=sessions`); `AssignCandidatesDialog` rewritten with 3 tabs (Direct users / User groups / Awaiting placement) — no more "From event pool"; SessionDetail switched to `useExamSessionParticipants`; RegistrationsTab filter gains `placed`.
- Deleted: `ExamEventParticipantsTab.tsx`, `AddParticipantsDialog.tsx`, their test files.

**Phase 6 interaction:** Phase 6's attempt model is submission-counted (`count_used_attempts` joins `assessment_submissions`) — multiple attempts per (event, user) coexist with a single participant row. The new `(exam_event_id, user_id)` UNIQUE is therefore consistent: re-opens issue new submissions, not new participant rows. If a future iteration ever needs N participant rows per (event, user), it will need a separate `exam_attempts` table.

**Backwards-compat shims unaffected:** `assign_exam_paper_to_participant` (Phase 4A) and vsf-learner's `useAssignedExamPaper` still work — their `session_id IS NULL` branches become dead code but are not removed (cleanup deferred).

**Out of scope:** renaming `exam_event_participants` → `exam_session_participants` (cosmetic refactor, deferred); read-only aggregate participants view at event level (user preferred no aggregate); cleanup of NULL-session dead branches in Phase 4A/learner.

---

## 2026-05-12 — Deferred Mentor & Claim-by-Code Flow for OJT Sessions

**Decision:** Admins may create an OJT session with mentor unassigned. The mentee shows the auto-generated `OJT-{NNNNNN}` code at the training ground; the on-site Person-in-Charge (PIC) claims the session as mentor via the Learner Portal (kiosk URL `/mentor/ojt/claim/:code` or manual entry from the OJT hub). The claim is atomic, scoped to the learner's company, and rejects self-claim and supervisor-as-mentor.

**Why:**
- In real operations the PIC isn't known until the learner physically arrives, so admins were either blocking creation or guessing.
- The existing `ojt_assignments.code` (UNIQUE per company, added 2026-05-06) is a perfect claim token — no new identifier needed.
- Compliance (NĐ 44/2016 Đ.19–21): the OJT record still names a mentor before any item is graded; the claim moves the naming from "admin desk" to "training-ground check-in." Grading is blocked while status is `pending_mentor`.

**Scope (shipped):**
- Migrations (public + v2): drop `NOT NULL` on `mentor_id`; add `pending_mentor` to status CHECK; add `mentor_claimed_at TIMESTAMPTZ`; add lockstep CHECK `((mentor_id IS NULL) = (status = 'pending_mentor'))`. `create_ojt_assignment` RPC made `p_mentor_id` optional and branches: NULL → `pending_mentor` + null mentor; else existing `not_started` behavior. New RPC `claim_ojt_as_mentor(p_code TEXT) RETURNS jsonb` (SECURITY DEFINER) with named errors `OJT_CLAIM_NOT_FOUND | OJT_CLAIM_ALREADY_CLAIMED | OJT_CLAIM_SELF | OJT_CLAIM_IS_SUPERVISOR | OJT_CLAIM_EXPIRED | OJT_CLAIM_NO_COMPANY` and optimistic-lock UPDATE.
- Admin Portal: defer-mentor toggle in `CreateOjtAssignmentDialog` — **gated by `useVersion().isNew`** so the Stable view keeps the existing required-mentor flow intact (Stable's `OjtSessions.current.tsx` is not modified per the experimental-canvas rule). `OjtAssignmentsTab` and `OjtSessions.new.tsx` made null-safe with an amber "Chờ HDV nhận" chip. `pending_mentor` added to `STATUS_ENTITY_RULES.ojtSession`.
- Learner Portal: new `OjtClaimPage` at `/mentor/ojt/claim/:code?` (mirrors `/check-in/:qrCode` kiosk pattern) with manual-entry form, success, and per-error-code states. `useClaimOjtByCode` hook (+ 18 tests). "Nhập mã buổi OJT" entry button in `OjtHub` mentor tab. Status registry gains `pending_mentor` row (learner sees amber banner with the code; mentor descriptor is defensive). `OjtDetail.desktop/mobile` show the code banner and hide action bar / item evaluation in `pending_mentor`.

**Tenant safety:** claim restricted to caller `profiles.company_id == assignment.company_id`. Codes are UNIQUE per company so leaked codes can't be claimed cross-tenant.

**Race safety:** the claim UPDATE includes `WHERE status='pending_mentor'`; concurrent claimants — only the first wins, others get `OJT_CLAIM_ALREADY_CLAIMED`.

**Out of scope:** supervisor cannot be deferred (separate decision if needed). No transfer/undo of a wrong claim (admin manually edits). No QR generation; manual code entry is the primary path. No push notification on claim.

**End-to-end caveat:** Learner Portal reads only `public` schema. Full end-to-end on the Learner Portal requires the OJT row to be in `public`; for `v2`-only happy path verification, the claim RPC exists in both schemas and can be tested directly.

**Migrations:** `20261007100000_ojt_assignments_optional_mentor.sql`, `20261007100100_ojt_create_assignment_optional_mentor.sql`, `20261007100200_claim_ojt_as_mentor_rpc.sql`.

---

## 2026-05-12 — Retire event-level `exam_events.questions_json` + the "Đề thi" tab on ExamEventDetail

**Decision:** Plan to remove the legacy `?tab=exam-paper` surface on `/exams/events/:id` and the `exam_events.questions_json` storage it edits. Migrate existing data into first-class `exam_papers` + `exam_session_papers` (the Phase 1A/1B canonical hierarchy), then strip the fallback reads in both portals and delete the tab. The column drop itself lags by one release for rollback safety.

**Why:**
- Phase 1A (2026-05-10) made `exam_papers` the canonical Đề thi runtime artifact and Phase 1B (2026-05-11) introduced `exam_sessions` + `exam_session_papers`. The forward model is `Event → Session → Paper → Candidate`.
- The pre-Phase-1A flat-questions surface — `exam_events.questions_json` edited via [`ExamEventQuestionsTab.tsx`](../../vsf-lms/src/components/exams/ExamEventQuestionsTab.tsx) — was left running in parallel. No phase scheduled its cleanup. Result: 34/42 events in `public` (29/37 in `v2`) sit in dual-state with populated `questions_json` AND attached sessions, while the runtime fallback chain still reaches `questions_json` whenever no paper is assigned. The tab is misleadingly labelled "Đề thi" but does not produce a real `exam_papers` row.
- Today the Sessions+Papers UI is *built* but the data hasn't been backfilled (0 `exam_session_papers` rows in `public`; 6 in `v2` from manual testing). The fix is to migrate the data — then the tab has nothing left to do.

**Scope (planned, see [phasing.md → Phase LGCY](../../vsf-lms/docs/exam-event-management/phasing.md#phase-lgcy--legacy-data-cleanup-parallel-track-outside-the-numbered-plan) and [progress.md → Phase LGCY](../../vsf-lms/docs/exam-event-management/progress.md#phase-lgcy--retire-event-level-questions_json-parallel-cleanup-track)):**
- **LGCY-02 (migration):** new `migrate_event_questions_to_papers(p_event_id uuid)` RPC + backfill loop. Dual-schema. Inserts one `exam_papers` row per event (DE code auto-filled by the existing `set_exam_paper_code()` trigger from `20260921100000`), populates `exam_paper_questions` with order preserved, attaches the new paper to every session of the event via `exam_session_papers`, then sets `questions_json = '[]'` (the auto-sync trigger from `20260511230000` zeros `question_count`). Idempotent. Chunked ≤5 per the SQL-editor RAM-crash incident. Excludes 5 empty-everything stubs (all draft/cancelled test events).
- **LGCY-03 (learner):** delete `questions_json` fallback in `ExamPlayer.tsx`, delete `useExamEventQuestions.ts`, drop the column from the `useStandaloneExamDetail` select.
- **LGCY-04 (admin):** delete `ExamEventQuestionsTab.tsx`, remove the `exam-paper` entry from `ExamEventDetail.{current,new}.tsx` (with `?tab=exam-paper` → `?tab=sessions` redirect for old bookmarks), replace the `questions_json` fallback in `ExamGradingWorkspace.{current,new}.tsx` with an explicit empty state, drop the `questions_json` count fallback in `ExamQuestionsSummaryCard.tsx`.
- **LGCY-05 (deferred):** drop the `questions_json` column + auto-sync trigger ≥ 2 weeks after LGCY-04 ships.

**Why (not "just delete the tab now"):** the runtime in `ExamPlayer.tsx:86-92` still reads `questions_json` as the last-resort fallback for any event without an assigned paper. With 0 session-paper rows in `public`, that fallback fires for every live event in that schema. Removing the tab without first migrating the data orphans the only edit path on records the runtime still depends on. The migration-first sequence keeps the runtime correct at every step.

**Verification (planned):** after backfill, `SELECT count(*) FROM exam_events WHERE jsonb_array_length(questions_json) > 0` returns 0 (or matches the 5-event exclusion list). Three sample events sampled via the admin UI must show a `DE-XXX` paper attached at SessionDetail → Papers with question-count parity. Lint + build green on both portals for LGCY-03/04. Manual learner-side exam end-to-end on a migrated event confirms questions render from the assigned paper.

**Out of scope:** Phase 2 (Blueprint assembly), Phase 4A (random paper assignment) — those continue on their own track and are unaffected.

**Reference:** plan file `/Users/rocketeer/.claude/plans/i-think-we-should-stateful-hummingbird.md` (approved 2026-05-12).

**Status update (2026-05-12, same day):**
- **LGCY-01 audit revealed a scope expansion**: 190/298 questions across 28/34 dual-state events use synthetic `eq-{timestamp}-...` ids that do NOT match real `questions.id` rows. The original plan assumed a 1:1 link via `exam_paper_questions`; reality required synthesizing real `questions` + `question_options` rows first. User chose the "per-company legacy bank" path (vs. "skip synthetic events", "per-event bank", or "abort").
- **LGCY-02 shipped**: migration `20260513210000_migrate_legacy_event_questions_to_papers.sql`. PUBLIC: 34 events → 34 papers. V2: 27 events → 27 papers (2 skipped — pre-existing session-paper rows). One per-company `question_banks` row named "Đề câu hỏi di chuyển (Legacy)" created per schema. Synthesized rows use `exam_paper_questions.link_mode='copy'`; real-UUID matches use `'linked'`. Per-event point overrides preserved via `override_points`. **Excluded**: 5 empty-stub events (draft/cancelled test data) + 1 event with malformed string-typed questions_json (`c378565d-8aa4-4a15-9334-b6392bb4fc64`).
- **Three schema-drift bugs hit during apply**, each fixed in a retry without state loss (migration runs in a transaction, partial inserts rolled back cleanly):
  1. `OR` evaluation order — PostgreSQL does not reliably short-circuit `IS NULL OR jsonb_typeof <> 'array' OR jsonb_array_length` across function calls. Fixed with nested `IF` statements.
  2. `question_banks.status` enum was `active → approved` in Phase 2A migration `20260923100000` (re-added status with new enum). My initial INSERT used the old `'active'` value.
  3. `questions.status` column was removed in migration `20260425100000_remove_question_status.sql`. My INSERT referenced a non-existent column.
- **LGCY-03 + LGCY-04 shipped** (same day): learner-portal fallback chain simplified, admin tab + ExamEventQuestionsPage + ExamQuestionsSummaryCard deleted, ExamGradingWorkspace's `virtualTemplate` fallback removed. Both portals lint + build green.
- **LGCY-04b regression discovered**: removing the `virtualTemplate` fallback broke `ExamGradingWorkspace` for ALL exam-event submissions, not just migrated ones — because `assessment_submissions` had no `exam_paper_id` column and `ExamPlayer` had always hardcoded `assessment_template_id: null` on exam-event submissions. Grading was relying on the questions_json fallback the entire time.
- **LGCY-04b shipped (same session)**: user approved option (b) — schema change over read-time-resolution. Two migrations (`20260513220000` adds nullable FK + participants-direct backfill, `20260513230000` session-derived backfill via `exam_session_papers`). Result: 19/19 public + 17/20 v2 exam_event submissions now carry `exam_paper_id`. `useSubmitExam` records it on new submissions; `ExamGradingWorkspace` falls back to `useExamPaperWithDetails(submission.exam_paper_id)` + `adaptExamPaperToTemplate` (new pure util in `examUtils.ts`); paper code `DE-NNNNNN` rendered as header badge. Bug fixed mid-apply: `MIN(uuid)` doesn't exist — used `(array_agg(...))[1]`.
- **Remaining**: LGCY-05 (column drop, deferred ≥ 2 weeks).

---

## 2026-05-11 — Course Activities sync: replaced mount-time reconciler with write-site dual-write

**Decision:** Removed the "sync-on-Activities-tab-mount" pattern that kept `course_subjects` and `course_activities (activity_type='subject_content')` aligned. Replaced with atomic dual-write at every write site via Postgres RPCs. Subject content cards in the Activities tab are now produced by the same insert that creates the `course_subjects` row, not by a later reconciliation pass.

**Scope shipped:**
- Migration `20260511105200_course_subject_activity_rpcs.sql` — three RPCs in BOTH `public` and `v2`:
  - `add_course_subject_with_activity(p_course_id, p_subject_id, p_order_index?, p_source_ct_subject_id?)` — single atomic insert into both tables. Raises `DUPLICATE_SUBJECT` / `COURSE_AUTHORING_LOCKED` (SQLSTATE P0001) on conflicts.
  - `remove_course_subject_with_activity(p_course_id, p_subject_id)` — atomic delete from both tables.
  - `replace_course_subjects(p_course_id, p_subjects jsonb)` — used by the Info tab's bulk delete-and-reinsert; wraps full replace in one statement so activity rows always mirror subject rows.
- Migration `20260511105201_template_rpc_dual_write_subject_activities.sql` — patched `v2_create_course_from_template` (public + v2) to insert matching `course_activities` rows after the existing `course_subjects` block. Courses created from templates now arrive with the Activities tab pre-populated.
- Migration `20260511105202_backfill_subject_content_activities.sql` — one-time idempotent backfill. Inserted **139 rows in public + 126 in v2** for courses that had drifted under the old reconciler (incl. the reported course 100073).
- [src/hooks/useCourseSubjects.ts](vsf-lms/src/hooks/useCourseSubjects.ts) — all six write hooks (`useUpdateCourseSubjects`, `useAddCourseSubject`, `useAddSubjectsToCourse`, `useRemoveCourseSubject`, `useRemoveSubjectWithContent`, `useAddSubjectWithContent`) call the new RPCs and invalidate the `course-activity-sequence` query key alongside their existing invalidations.
- [src/hooks/useCourseActivitySequence.ts](vsf-lms/src/hooks/useCourseActivitySequence.ts) — `useSyncSubjectActivities` still exported as an emergency reconciler but no longer auto-fires (`useEffect` removed). Added `onError` with `handleMutationError` toast for any manual `.sync()` use.
- [CourseActivitiesTab.new.tsx](vsf-lms/src/components/training/course-detail/CourseActivitiesTab.new.tsx) + [.current.tsx](vsf-lms/src/components/training/course-detail/CourseActivitiesTab.current.tsx) — removed the mount-time `useSyncSubjectActivities(courseId)` call.

**Invariant now enforced:** Every `course_subjects(course_id, subject_id)` row MUST have exactly one corresponding `course_activities` row with `activity_type='subject_content'`. Enforced at the write site.

**Why (write-site over DB trigger):** Two expert reviews (CTO + system-architect) agreed: a DB trigger preserves the antipattern (couples tables via hidden logic, requires `course_activities` rows to be second-class without `title`/`gates_next`/`delivery_mode` authority). RPC-based dual-write keeps the write contract explicit in app code while still atomic. Trigger remains a defensible Phase 2 hardening but not needed to fix the bug.

**Why (not table consolidation):** `course_subjects` carries `source_ct_subject_id` (template traceability) that `course_activities` doesn't, and consolidation would require rewriting the two `create_course_from_template` RPCs plus every reader on both portals. Out of scope; revisit if drift recurs.

**Verification:** Migrations applied via `npx supabase db push --include-all`. Backfill log: `NOTICE: public schema: backfilled 139 subject_content activity rows`, `NOTICE: v2 schema: backfilled 126`. Types regenerated. Scoped vitest on the two changed test files: 33/33 passing. `npm run lint && npm run build` clean (0 errors).

**How to apply going forward:** Any new writer of `course_subjects` MUST call `add_course_subject_with_activity` / `remove_course_subject_with_activity` / `replace_course_subjects` instead of inserting directly. The same rule applies to any new RPC that creates courses from a template — mirror each `course_subjects` insert into `course_activities`.

---

## 2026-05-12 — Phase 5C-Proctor shipped: live exam proctor module (Giám sát kỳ thi)

**Decision:** Slotted between Phase 5 and Phase 6 to close a BO-required gap surfaced during Phase 5 wrap-up review. The BO (`requirements.md` §4, §6.3) lists Proctor/Invigilator as a required role with active duties during the exam. Phase 4 had only shipped warning *log* + post-hoc admin dispute review; Phase 7 had bundled the proctor dashboard with AI behavior detection. We split the human-proctor surface out of Phase 7 so it can ship without AI infrastructure.

**Scope shipped (5C-Proctor):**
- Migration `20261002100000_exam_proctor.sql`:
  - `exam_session_proctors(session_id, proctor_id)` UNIQUE junction with RLS (proctor SELECT own OR `is_admin_user`).
  - `exam_incidents` audit table: `(submission_id, proctor_id, kind 'force_submit'|'invalidate', reason, created_at)` with RLS.
  - `assessment_submissions.auto_submit_reason` enum extended with `'proctor_force_submit'`.
  - `assessment_submissions.status` constraint extended with `'void'`.
  - Helper `is_proctor_of_submission(submission_id, user_id)` resolves submission → participant → session → proctor assignment.
  - 4 RPCs (public + v2): `assign_proctor_to_session`, `unassign_proctor_from_session`, `proctor_force_submit`, `proctor_invalidate_attempt`. Intervention RPCs gated by `is_proctor_of_submission OR is_admin_user` + require `reason ≥10 chars`.
- vsf-lms code:
  - 4 new hooks: `useExamSessionProctors` (list + assign + unassign), `useProctorActiveSessions` (lists active sessions for a proctor with warning counts, polls every 10s), `useProctorIntervention` (force_submit + invalidate), `useExamIncidents` (admin read for grading workspace).
  - `ProctorsTab` on `SessionDetail` (both `.current` and `.new`) — admin assignment UI with multi-select dialog.
  - `ProctorDashboard` page at `/exams/proctor` — live "exams in progress" with intervention buttons.
  - `InterventionDialog` — reason ≥10 chars textarea, destructive variant on invalidate.
  - `IncidentsCardAdmin` on `ExamGradingWorkspace` (current+new) — renders incident audit chips for force_submit/invalidate.
  - `exam-proctor` permission module added under `assessment` category (module count 34 → 35; actions `view`, `intervene`).
  - Sidebar entry "Giám sát kỳ thi" (vi/en/id root locales updated).
  - i18n: `examSessions.proctor.*`, `examSessions.tabProctors`, top-level `proctor.dashboard.*` + `proctor.intervention.*` + `proctor.incidents.*` (vi only — admin surface).
- Co-located tests: 7 cases in `useExamSessionProctors.test.ts` + 6 cases in `useProctorIntervention.test.ts`.

**Decisions locked (user-confirmed 2026-05-12):**
- Slot BEFORE Phase 6.
- Dashboard scoped strictly to proctor's assigned Sessions (no tenant-wide view).
- Intervention reason ≥10 chars (matches dispute-reason convention).
- `invalidate_attempt` flips status to new `void` enum value (not audit-only).

**Why (no AI, no realtime):** Per "keep this minimal" constraint. 10s polling on the dashboard matches the heartbeat cadence from Phase 4C. AI proctor flagging + webcam stay in Phase 7.

**Why (admin can also intervene without proctor assignment):** Admins are super-set proctors. RPCs accept both `is_proctor_of_submission` OR `is_admin_user`. UI-side gating decides what to surface.

**Verification:** Migration applied. Types regenerated. Phase 4 gate passes both portals.

---

## 2026-05-11 — Phase 5A + 5B shipped: hide-identity, session publish, multi-grader assignment

**Decision:** First half of Phase 5 (grading enhancements). Bundles three independent features:
- **5A-i**: `exam_events.hide_identity_when_grading` BOOLEAN. When ON, admin GradingWorkspace masks learner name+email with "Thí sinh #N" for non-super-admin graders. Super-admin always sees real identity (for support/dispute).
- **5A-ii**: `exam_sessions.scores_published` BOOLEAN (nullable). Session-level override of event-level scores_published. Priority: Session non-null wins; NULL = inherit from event. 3-state UI in CreateSessionDialog ("Theo kỳ thi / Bật / Tắt").
- **5B**: `exam_submission_graders` junction tracks WHO is assigned to grade. Admin can attach multiple graders via `AssignGraderDialog`. The single `assessment_submissions.graded_by / score / feedback` fields remain authoritative — multi-grader resolution (avg / calibration) deferred to 5C.

**Scope shipped:**
- Migration `20261001100000_grading_enhancements_5ab.sql`:
  - 5A schema columns (both schemas).
  - `exam_submission_graders` table with `(submission_id, grader_id)` UNIQUE, RLS owner-or-admin SELECT, indexed both ways.
  - 2 RPCs: `assign_grader_to_submission(submission_id, grader_id, notes)` (admin-only, validates grader is admin/teacher via `is_admin_user`, idempotent on conflict), `unassign_grader_from_submission(submission_id, grader_id)`.
- vsf-lms:
  - `src/lib/maskLearnerIdentity.ts` — pure helper. Super-admin always sees real values.
  - `useExamEvents` `ExamEventRow` + `ExamEventUpdate` extended with `hide_identity_when_grading`.
  - `types/examSession.ts` extended with `scores_published?: boolean | null` on ExamSession + Insert + Update.
  - `useExamSubmissionGraders` hook (list + assign + unassign) + 7 co-located tests.
  - `AssignedGradersPanel` + `AssignGraderDialog` components mounted on ExamGradingWorkspace.
  - `CreateExamEvent` (both `.current` and `.new`) gains a "Ẩn danh tính khi chấm" Switch.
  - `CreateSessionDialog` gains a 3-state segmented control for `scores_published_override` (mapped to `scores_published` boolean | null on save).
  - `ExamGradingWorkspace` (both `.current` and `.new`) applies `maskLearnerIdentity` to learner name/email based on event + super-admin status, with participant order derived from `useExamEventParticipants` (created_at ASC).
  - i18n: `examEvents.hideIdentity{Label,Help}`, `examSessions.scoresPublished{Label,Help,Option.{inherit,on,off}}`, `grading.maskedLearnerName`, `grading.assignGrader.*`.
- vsf-learner:
  - `useStandaloneExamDetail` joins `session.scores_published` and computes effective `scoresPublished`: session non-null wins, else event value.
  - ExamResult inherits this automatically (no changes — already keys off `examDetail.scoresPublished`).

**Why (no multi-grader scoring resolution in 5B):** Per user "don't overcomplicate" — building avg / calibration / independent grader scores requires a new `submission_grader_scores` table + finalization workflow. Significant complexity. 5B ships assignment intent only; the existing single-grader fields stay authoritative. Real-world usage will inform 5C.

**Why (super-admin override on hide-identity):** Necessary for support/dispute resolution. Implemented via `useCurrentUser().isSuperAdmin` predicate; passes through to `maskLearnerIdentity`.

**Why (3-state session scores_published instead of nullable boolean):** Form UX. A nullable boolean rendered as a checkbox is ambiguous; the segmented control "Theo kỳ thi / Bật / Tắt" makes intent explicit.

**Verification:** Migration applied via `npx supabase db push`. Types regenerated in both portals.

**Deferred to 5C (future):** Auto-resolution rules (org chart / Council / Session), scoring modes (avg vs calibration), independent grader scores, finalization workflow.

---

## 2026-05-11 — Phase 4C shipped: single-device enforcement (deterministic anti-cheat)

**Decision:** Last sub-phase of Phase 4 (deterministic anti-cheat baseline). When a learner is in the exam player on Device A and someone else (or themselves on another browser) opens the exam on Device B, Device A's heartbeat detects the takeover within ~10s and auto-submits with `auto_submit_reason='device_change'`. Reuses Phase 4B-1's `exam_anticheat_events` log and dispute flow.

**Scope shipped (4C):**
- Migration `20260930100000_exam_active_sessions_and_device_change.sql`:
  - Extended `exam_anticheat_events.kind` CHECK to accept `'device_change'`.
  - Extended `assessment_submissions.auto_submit_reason` CHECK to accept `'device_change'`.
  - New `exam_active_sessions` table with `(user_id, exam_event_id)` UNIQUE (one row per user per event; UPSERT pattern). RLS owner-or-admin SELECT; RPC-only writes.
  - 3 RPCs (public + v2): `start_exam_active_session(event, fingerprint, ua)`, `heartbeat_exam_active_session(event, fingerprint)` → `{alive, kicked_reason}`, `end_exam_active_session(event, fingerprint)` (fingerprint-guarded DELETE so a kicked Device A can't wipe Device B's row).
  - `start_exam_active_session` logs ONE `device_change` warning to `exam_anticheat_events` at the takeover moment — but only if the user has an existing `assessment_submission` row (the warning table requires `submission_id NOT NULL`; we sidestep a schema change by gating the log on submission existence). The kick signal is delivered to Device A regardless.
- vsf-learner:
  - `src/lib/deviceFingerprint.ts` — FNV-1a hash of `userAgent + screen.width + screen.height + tz`. Deterministic, browser-stable, NOT a security primitive.
  - `useExamActiveSession(eventId, { active })` — manages start/heartbeat/end lifecycle, default 10s heartbeat. Returns `{ alive, kickedReason, isStarting }`. Network blips during heartbeat are ignored (only an explicit `alive: false` triggers the kick).
  - `DeviceKickDialog` — blocking AlertDialog (no cancel button). ExamPlayer auto-submits behind it.
  - `ExamPlayer` wires the hook; on `kickedReason === 'device_change'` → `handleAutoSubmit({ autoSubmitReason: 'device_change' })`.
  - `types/examAnticheat.ts`: `AnticheatKind` + `AutoSubmitReason` unions extended.
  - i18n: `anticheat.deviceKickDialog.*` + `anticheat.kindLabel.*` in vi/en/id.
- vsf-lms:
  - Admin `AnticheatWarningsCardAdmin`: per-row warning chip now shows the kind label via `anticheat.admin.kindLabel.${kind}` (defaults to raw kind). One-line JSX change.
  - i18n: `anticheat.admin.kindLabel.{tab_switch,device_change}` in vi.

**Why (no submission_id nullability change):** The Phase 4B-1 `exam_anticheat_events` table has `submission_id NOT NULL`. Making it nullable touches RLS and FK semantics across two schemas. The simpler design: log device_change only when a submission row exists (post-submit visibility for admin), and rely on the heartbeat for the kick. Per user constraint "keep this minimal — LMS still under development".

**Why (no realtime / WebSocket):** 10s polling is simple, no new infra, kick latency ≤10s. Acceptable for a deterministic baseline. Real-time can come later if needed.

**Why (no stale-row cleanup):** UNIQUE constraint bounds growth to one row per (user, event). Resubmits UPSERT in place. Cleanup cron premature at this scale.

**Verification:** Migration applied via `npx supabase db push`. Types regenerated in both portals. 5 co-located tests for `useExamActiveSession` pass (start RPC + heartbeat polling + kick latch + post-kick polling-stopped + end on unmount).

---

## 2026-05-11 — Phase 4B-2 shipped: per-session password switch + manual paper re-assign

**Decision:** Closes the remaining Phase 4B items. Two independent features in one PR: (A) learner password verification now respects Session > Event priority, persisting per-layer; (B) admin can override a candidate's assigned paper with audit trail.

**Scope shipped (4B-2):**
- Migration `20260929100000_exam_passwords_session_layer_and_paper_reassign.sql`:
  - `exam_password_verifications` gains nullable `session_id` + two partial UNIQUE indexes (event-level vs session-level) so both layers coexist independently per user.
  - `verify_exam_session_password` now persists the verification row on success (the Phase 1B comment "persistence is event-level via exam_password_verifications for backwards compat" was a gap; closed now).
  - `has_exam_password_verified(p_exam_event_id, p_session_id DEFAULT NULL)` extended signature. Session given → checks session layer (or session.password_enabled=false → true). Session NULL → existing event-level behavior (unchanged).
  - `exam_event_participants` gains `paper_reassigned_at`, `paper_reassigned_by`, `paper_reassign_reason` audit columns.
  - New RPC `reassign_exam_paper_to_participant(p_participant_id, p_paper_id, p_reason)`. Admin-only via `is_admin_user`. Hard-blocks when any `assessment_submission` exists for the (user, event). Specific paper id validated against session's pool; NULL p_paper_id triggers random re-roll.
- vsf-lms:
  - `useReassignExamPaper` mutation hook + 7 co-located test cases.
  - `ReassignPaperDialog` component: radio group (specific pick OR re-roll) + required reason textarea (≥5 chars).
  - `SessionDetail.{current,new}.tsx`: per-candidate "Đổi đề" button opens the dialog.
  - `useExamEventParticipants` type extended with audit fields (the `*` select picks them up automatically).
  - i18n `examSessions.reassignPaper.*` namespace.
- vsf-learner:
  - `useVerifyExamSessionPassword` hook + 5 co-located test cases.
  - `useHasExamPasswordVerified` accepts optional `sessionId`; query key includes it so cache stays correct.
  - `useStandaloneExamDetail` reads participant's `session_id` + joined `session.password_enabled`; surfaces `sessionId` + `sessionPasswordEnabled`.
  - `ExamPasswordDialog` accepts `sessionId`; routes to session RPC when set; cache invalidation key includes sessionId.
  - `ExamDetail` decides dialog flow: `sessionPasswordEnabled` wins; falls back to event `passwordEnabled`.
  - `ExamPlayer` passes the appropriate sessionId to `useHasExamPasswordVerified` so refresh doesn't re-prompt at the wrong layer.

**Why (extend existing table vs new table for verifications):** Cleaner RLS (one policy), simpler migration, and partial UNIQUEs cleanly handle the (event-level | session-level) bifurcation. A parallel `exam_session_password_verifications` would have duplicated infrastructure for marginal gain.

**Why (hard-block re-assign when any submission exists):** Defensive default per user-confirmation 2026-05-11. Admin re-assigning a paper for a candidate who's already started invalidates their attempt. Edge cases requiring mid-attempt swap are rare and warrant a separate, more conspicuous admin action (out of scope for 4B-2).

**Why (re-assign reason ≥5 chars, not ≥10 like dispute reasons):** Admin context — lower friction. The reason is for audit recall, not for cross-actor justification.

**Verification:** Migration applied via `npx supabase db push`. Types regenerated in both portals.

---

## 2026-05-11 — Phase 4B-1 shipped: tab-switch warning log + dispute UX (deterministic anti-cheat baseline)

**Decision:** First half of Phase 4B. Introduces a generic anti-cheat warning log table (`exam_anticheat_events`) plus tab-switch detection + dispute UX. The log table is reserved for future warning kinds (off-screen, single-device) — only `kind='tab_switch'` is wired up in 4B-1.

**Scope shipped (4B-1):**
- Migration `20260928100000_exam_anticheat_v1.sql`:
  - `exam_events.tab_switch_threshold INTEGER` + `exam_sessions.tab_switch_threshold INTEGER` (per-session overrides event). NULL = disabled.
  - `assessment_submissions.auto_submit_reason TEXT` enum (`time_expired` | `tab_switch_threshold`). Optional metadata.
  - `exam_anticheat_events` table with RLS (`user_id = auth.uid()` OR `is_admin_user(auth.uid())`). RPC-only writes. Indexed for unresolved-dispute scans.
  - 3 RPCs (both schemas): `log_exam_anticheat_event` (learner, idempotent on (submission_id, warning_number)) / `dispute_exam_anticheat_events` (learner, batch all unresolved per event, reason ≥10 chars, 7-day window) / `resolve_exam_anticheat_dispute` (admin, one-at-a-time accept/reject).
- vsf-learner:
  - Types `examAnticheat.ts` (events, buffered warnings, RPC results, `AutoSubmitReason`).
  - 4 hooks (`useLogAnticheatEvent`, `useMyAnticheatEvents`, `useDisputeAnticheatEvents`, `useExamTabSwitchTracker`) + co-located tests.
  - `useExamTabSwitchTracker` listens to `visibilitychange` (NOT `window.blur` — keeps false-positive rate low), debounces 1.5s hidden, buffers warnings client-side. Threshold semantics: `N` = budget; switch #(N+1) triggers `onExceeded`.
  - `useSubmitExam` extended with `autoSubmitReason` + `anticheatWarnings`; flushes the buffer to `log_exam_anticheat_event` after submission insert (best-effort, no failure propagation).
  - `ExamPlayer` wires the tracker; modal `TabSwitchWarningDialog` appears on each warning; threshold-exceeded triggers `handleAutoSubmit({ autoSubmitReason: 'tab_switch_threshold' })`. Existing time-expired path now also tags `auto_submit_reason: 'time_expired'`.
  - `ExamResult` shows `AnticheatWarningsCard` with batch-dispute flow (one reason covers all warnings on the event).
  - i18n `anticheat.*` namespace in vi/en/id.
- vsf-lms:
  - `useExamAnticheatEvents.ts` (list-by-submission + resolve mutation) with co-located tests.
  - `AnticheatWarningsCardAdmin` component on `ExamGradingWorkspace` (both `.current` and `.new`). Per-warning Accept/Reject buttons; reason popover.
  - `CreateExamEvent` (both `.current` and `.new`) form gains `tab_switch_threshold` numeric input. Empty = NULL = disabled.
  - `CreateSessionDialog` form gains the same field (session override).
  - `ExamSession` / `ExamSessionInsert` / `ExamSessionUpdate` types extended with `tab_switch_threshold?: number | null`.
  - Admin i18n `anticheat.admin.*` in vi only (en/id deferred — admin UI is admin-only and not exposed to learners in non-vi locales).
- Both portals: types regenerated.

**Why (buffered warnings vs real-time):** No `assessment_submissions` row exists until submit. Either insert a draft `in_progress` row on player mount (new schema concept, orphan-cleanup needed) OR buffer client-side and flush at submit time. We chose buffer — simpler, no new "draft submission" pattern. Trade-off: admin doesn't see warnings live during the exam; that's a Phase 7 (proctor flagging) concern anyway.

**Why (`visibilitychange` only, not `blur`):** `window.blur` fires when DevTools opens, when the user clicks outside the browser to a notification, etc. Far noisier than tab-switching. Per user-confirmation 2026-05-11, ship visibilitychange only; revisit blur if real-world tab-switch data is too lenient.

**Why (dispute window = 7 days hardcoded):** Open-ended disputes complicate the admin queue. 7 days mirrors typical content moderation SLAs and matches the existing reject-reason ≥10-char pattern from Phase 2A. Not made per-event configurable yet (premature).

**Why (auto_submit_reason on submissions):** At-a-glance visibility on admin grading workspace — admin sees "đã tự động nộp do rời tab" without drilling into the warning log. Keeps the audit trail (`exam_anticheat_events`) separate from at-a-glance metadata (`assessment_submissions.auto_submit_reason`).

**Out of scope (deferred to 4B-2 or 4C/7):**
- Per-Session password switch on the learner side (still uses event password) → 4B-2.
- Manual admin "Re-assign paper" override → 4B-2.
- Single-device enforcement → 4C.
- Off-screen / leaving-screen detection beyond visibilitychange → not in 4B-1 unless cheap (currently no).
- Score recalculation after dispute acceptance → Phase 6 (appeal/regrade).
- Real-time admin proctor flagging during exam (needs draft submission rows) → Phase 7.
- Mobile-native detection → 4B-mobile.

**Verification:** Migration applied via `npx supabase db push`. Types regenerated in both portals.

---

## 2026-05-11 — Phase 4A shipped: random exam paper assignment per candidate (BO priority #1)

**Decision:** Phase 4A delivers the first slice of "Anti-cheat v1" — random Paper assignment per candidate within a Session. When a learner enters an exam, an RPC randomly picks one of the Session's attached Papers, writes it to `exam_event_participants.exam_paper_id`, and the player loads questions from that Paper instead of the Event's legacy `assessment_template_id` / `questions_json`. Sticky: subsequent visits reuse the existing assignment (re-attempts in Phase 6 will use the same paper).

**Scope shipped (4A):**
- Migration `20260927100000_assign_exam_paper_rpc.sql` — SECURITY DEFINER RPC `assign_exam_paper_to_participant(p_event_id UUID) → JSONB` on both `public` and `v2` schemas. Errors: `not_authenticated`, `not_a_participant`, `no_session`, `no_papers_assigned`. Idempotent — returns `{ reused: true }` when the participant already has a paper.
- 2 vsf-learner hooks: `useAssignedExamPaper` (passive read of participant row) and `useAssignExamPaper` (mutation wrapping the RPC). Co-located tests cover happy path + reused-sticky path + 3 error codes.
- `ExamPlayer` now: (1) reads the assigned paper id, (2) triggers the RPC once when null + session present, (3) routes `useExamPaper` to the assigned paper, falls back to legacy `assessmentTemplateId` for events without sessions.
- Admin: `useExamEventParticipants` now joins `exam_papers!exam_event_participants_exam_paper_id_fkey(id, code, name)`; `SessionDetail` Candidates tab (both `.current` and `.new`) shows the assigned paper code as a link to the paper detail or a "Chưa giao" warning chip.
- i18n: `assignPaper.errors.*` in vi/en/id for the 5 error codes; admin gains `candidatesPaperColumn` / `candidatesPaperNotAssigned`.

**Decision (sticky vs re-roll):** Sticky — re-attempts reuse the same paper. Per user-confirmation 2026-05-11, this prevents learners from gaming retries to land an easier paper. Re-attempt policy lives in Phase 6 (attempt control) and inherits this rule.

**Decision (no-paper failure mode):** Explicit error + redirect to Event detail, not silent fallback to legacy `questions_json`. Mixing data sources would hide misconfiguration; an explicit toast forces admin attention.

**Decision (concurrency):** Single-row UPDATE serializes naturally on the row lock; first writer wins, the (unlikely) second concurrent call from the same user will then read the freshly-written paper id on a follow-up call. No `FOR UPDATE` added in 4A — revisit if double-writes are ever observed.

**Out of scope (deferred to 4B/4C):**
- Manual admin re-assignment override → 4B.
- Tab-switch / off-screen detection + dispute UX → 4B.
- Per-session password (learner currently still uses event password) → 4B.
- Single-device enforcement → 4C.
- AI / webcam / behavior anomaly → Phase 7.
- Balanced random (round-robin) distribution → only if pool skew becomes a real problem.

**Verification:** Migration applied via `npx supabase db push`. Types regenerated in both portals. Phase 4 gate (lint + build) passes both sides.

---

## 2026-05-11 — Phase 3B shipped: learner self-registration for exam events (vsf-learner)

**Decision:** Phase 3 of "Advance Exam Event Management" is complete. Phase 3A (server + admin queue) shipped on 2026-05-11 morning; Phase 3B (learner-facing surface) ships in the same calendar day. Learners in `vsf-learner` can now self-register for exam events that have `registration_required=true`, see their pending/approved/rejected registrations, and cancel a pending registration.

**Scope shipped (3B):**
- New RPC `cancel_exam_event_registration(p_registration_id UUID) → JSONB` on both `public` and `v2` schemas (migration `20260926100000`). Owner-only, `status='pending_approval'` only. No notification to admin (cancel is silent — row drops out of pending queue).
- 4 vsf-learner hooks: `useEligibleExamEvents`, `useMyExamRegistrations`, `useSubmitExamEventRegistration`, `useCancelExamEventRegistration` — all co-located tests pass.
- Two new sections inside `vsf-learner/src/pages/exams/Exams.tsx`: "Kỳ thi đang mở đăng ký" (eligible) + "Đăng ký của tôi" (mine). Each section is `MobileAwareProxy` + `.desktop.tsx` + `.mobile.tsx` + a shared `EligibleExamCard`. Sections render `null` when empty so they don't disturb learners outside Vinpearl's self-registration flow.
- `RegisterDialog` (AlertDialog) + `CancelRegistrationDialog` (destructive AlertDialog) using existing sonner toasts.
- i18n `examRegistrations` namespace added to all three locales (vi/en/id).

**Why (3B layering):** Phase 3A's data plane (`exam_event_registrations`, eligible-groups junction, submit/approve/reject RPCs) was deployed first so admin could configure registration before learners saw the surface. Splitting into 3A+3B kept each PR reviewable and let admins dogfood the queue before learners hit it. The `Exams.tsx` integration is additive — existing assigned/upcoming/scheduled/completed sections remain unchanged.

**Decision (cancel scope):** Self-cancel restricted to `pending_approval` only. Cancelling an approved registration is intentionally out of scope (would require re-running the capacity reservation logic and notifying the admin who already moved on). Rejected registrations cannot be re-applied — the DB UNIQUE constraint on `(exam_event_id, user_id)` plus `useEligibleExamEvents`'s client-side filter drop events with any non-cancelled prior registration.

**Decision (`Exams.tsx` shape):** Did NOT refactor the page into `.desktop`/`.mobile` siblings. Only the two new sections split; the existing page wrapper stays as-is. Lower-risk than a sweeping refactor, and the new sections handle their own responsiveness via the proxy pattern.

**Verification:** Migration applied via `npx supabase db push` (single migration, no incident). Types regenerated in both portals.

---

## 2026-05-08 — Production Incident: Supabase project unhealthy due to heavy SQL-editor migrations (calendar date)

**Incident:** From ~04:00–07:00 UTC the Supabase project (`neszdqqqnouawsysbxrn`) entered a restart/crash cycle and reported "unhealthy". All read/write traffic was intermittently unavailable for ~3 hours.

**Root cause (per Supabase support):** RAM spikes from heavy migration scripts run via the SQL editor exceeded the nano-instance ceiling. Burst compute (capped at ~30 min/day for IO beyond ordinary capacity) was consumed quickly because the IO arrived in sudden, large batches. Each crash → restart → retry cycle deepened the saturation. The system eventually stabilized, assisted by a free auto-upgrade from **nano → micro** compute initiated just before 06:00 UTC.

**Decision / Rule:** Heavy migrations and backfills must be **chunked** (small batches per statement) and **preferably run through the migration pipeline**, not the SQL editor. See `common-pitfalls.md → Heavy Migrations via SQL Editor`.

**Why:** With 225+ migrations already in `vsf-lms/supabase/migrations/` and ongoing data-shape work (OJT skill-level FK, OJT resync backfills, certificate ledger refactor), unchunked heavy migrations are a realistic recurring risk. The micro tier raises the ceiling but does not eliminate it.

**Action items:**
- Existing migrations are not retroactively rewritten — risk is forward-looking.
- Add a checklist item to large data migrations: *Will this touch >10k rows in one statement? If yes, chunk it.*
- No code changes from this entry; documentation-only update to `common-pitfalls.md` + this log.

---

## 2026-09-19 — Remove KN3 acknowledgement gate + apply `skill_level_id` fix to `supervisor_review_ojt_assignment`

**Decision:** The KN3 acknowledgement gate (`IF v_target_position = 3 AND NOT p_kn3_acknowledged THEN return kn3_ack_required`) is removed from `finalize_ojt_assignment` (public + v2). The `p_kn3_acknowledged` parameter stays in the RPC signature with `DEFAULT FALSE` for back-compat but is silently ignored. The same `skill_level_id` source-of-truth fix from 2026-09-18 is applied to `supervisor_review_ojt_assignment` (public + v2).

**Why (gate removal):** A user reported `{"error":"kn3_ack_required","success":false}` when pressing "Gửi giám sát viên duyệt" (mentor submit-to-supervisor) on a KN3 OJT. The gate fired *before* the routing decision, so it blocked the supervisor-submit path even though no skill is granted at that transition. The expected flow is **Mentor → Supervisor → Learner → Approved**, and the gate created friction at step 1. Per `project_skill_levels_per_tenant_d1_reversal` (2026-05-04), the KN3 cap was removed and skill levels are per-tenant; the hardcoded `position = 3` gate is vestigial. Multi-step approval (mentor → supervisor → learner) already provides the verification.

**Why (supervisor RPC fix):** `supervisor_review_ojt_assignment`'s skill-grant block had the *exact same* `skill_target_level IS NOT NULL` regression the 2026-09-18 fix patched in `finalize_ojt_assignment` — for templates that only populate `skill_level_id` (the current form behavior), supervisor approval *without* a learner-confirmation gate silently skipped the grant. Same class of bug, identical fix pattern.

**Migration:** `20260919110000_ojt_remove_kn3_gate_and_supervisor_skill_id_fix.sql`
- Rewrites `public.finalize_ojt_assignment` + `v2.finalize_ojt_assignment` to drop the KN3 ack gate. Identical to 20260918100000 otherwise.
- Rewrites `public.supervisor_review_ojt_assignment` + `v2.supervisor_review_ojt_assignment` to resolve target level via `skill_level_id` first (fallback to legacy SMALLINT) and skip cleanly on missing/stale level rows. Extends the JSON return shape with `skill_level_id`, `skill_level_position`, `skill_name`, `skill_level_shorthand`, `skill_level_name` to match the finalize RPC contract.
- Re-runs the idempotent backfill from 20260918100000 to pick up any assignments newly approved between then and now via either RPC.

**Verification:** Reproduced user's exact curl against assignment 35 (KN3 target, supervisor approval enabled, mentor token, `content-profile: v2`) — now returns `{"success": true, "action": "submitted_to_supervisor", "new_status": "supervisor_pending_approval", "skill_name": "Cải tiến quy trình", "skill_level_shorthand": "KN3", "skill_level_position": 3, "skill_granted": false, ...}` (skill grant correctly deferred to the final mentee-confirm step).

**Frontend follow-up (out of scope):** The mobile UI's `requiresKn3` derivation (`OjtDetail.mobile.tsx:182`) and the `KN3EndorsementSheet` are now vestigial. Cleanup is a separate task — they don't break anything because the backend gate is gone, and `kn3Acknowledged` is silently ignored.

---

## 2026-09-18 — Restore `skill_level_id` source-of-truth in `finalize_ojt_assignment` (regression fix)

**Decision:** `finalize_ojt_assignment` resolves the target skill level via `ojt_assignments.skill_level_id` (UUID FK to per-tenant `skill_levels`), with the legacy SMALLINT `skill_target_level` consulted only as a fallback for assignments that pre-date the FK migration. The KN3 ack gate compares the resolved tenant position, not the SMALLINT.

**Why:** Migration `20260914110000_ojt_finalize_allow_mentor.sql` shipped as a "pure authorization fix" (adding the named mentor as a recognised caller alongside admin/manager) but accidentally regressed the skill-grant block to the May-4 logic that keys off `skill_target_level IS NOT NULL`. The OJT template form (`useCreateOjtTemplate`, `EditOjtTemplate.new.tsx`) had already moved to writing only `skill_level_id`, so every template created/edited via the UI had `skill_target_level = NULL`. `create_ojt_assignment` faithfully snapshot-copied the NULL into the assignment, and finalize then silently skipped the entire skill-grant block — `skill_granted` returned `false` with no `skip_reason`, no error. The user-visible symptom was: OJT completes successfully, mentee's `/users/:id?tab=skills` and `/my-skills` show no acquired skill.

**Migration:** `20260918100000_finalize_ojt_use_skill_level_id_v2.sql`
- Rewrites `public.finalize_ojt_assignment` + `v2.finalize_ojt_assignment` so they resolve `(v_target_level_id, v_target_position, v_target_shorthand, v_target_level_name)` from `skill_level_id` first, fall back to `(skill.company_id, skill_target_level)` lookup. Skips the grant cleanly (doesn't blow up the FK) when the resolved level row doesn't actually exist (handles stale FK pointers).
- Extends the JSON return shape with `skill_level_id`, `skill_level_position`, `skill_name`, `skill_level_shorthand`, `skill_level_name` so the learner toast can display human-readable text without a follow-up query. Prior fields (`skill_target_level`, `skill_granted`, `skip_reason`, `previous_level`) retained for back-compat.
- Backfills `user_skill_proficiencies` + `user_skill_proficiency_log` for any assignment with `status = 'approved'` AND `(skill_id, skill_level_id)` set AND no existing log row with `source = 'ojt_completion'`. Idempotent. Respects keep-higher-level policy. Mirrored in v2.

**Hook:** `vsf-learner/src/hooks/useFinalizeOjtAssignment.ts` extends `FinalizeOjtResult` typedef with the new RPC fields and replaces the generic success toast with branching:
- `skill_granted === true` → 🎓 "Bạn vừa đạt kỹ năng <name>" toast with description "Cấp độ: <shorthand> • <name>" + "Xem kỹ năng" action that navigates to `/my-skills`. Also invalidates `["my-skill-proficiencies", userId]`.
- `skip_reason === 'current_level_higher_or_equal'` → info toast "Bạn đã có cấp độ này hoặc cao hơn, không thay đổi."
- All other branches (submitted_to_supervisor, submitted_to_learner, plain success) unchanged.

**Tests:** 4 new test cases for celebration toast, skill-cache invalidation, skipped path, fallback toast. Existing 6 cases kept. All 10 pass.

**Lessons:** Skill-grant logic is high-risk infrastructure; future authorization-only changes to `finalize_ojt_assignment` must preserve the resolution branch verbatim. A regression test that calls finalize with a `skill_level_id`-only assignment (`skill_target_level = NULL`) and asserts `skill_granted === true` would have caught this — worth adding when an integration-test harness exists for the DB function.

---

## 2026-04-25 — OJT Sessions Are Single-Day Calendar Events (not date ranges)

**Decision:** An OJT assignment now models a single calendar event — one `event_date DATE` plus optional `start_time TIME` + `end_time TIME` — replacing the prior `start_date DATE` + `due_date DATE` range. Founder clarification: "OJT is an event that happens in 1 date with start time and end time." Mirrors `class_sessions(session_date, start_time, end_time)` shape from `20250103000600_create_class_sessions_table.sql`.

**Migrations:**
- `20260719100000_ojt_event_time_columns.sql` — additive: adds new columns + CHECK (`end_time > start_time`) + index on `event_date`, backfills `event_date := start_date`, replaces `create_ojt_assignment` RPC with new 9-arg signature (drops `p_start_date`/`p_due_date`, adds `p_event_date`/`p_start_time`/`p_end_time`), updates `create_ojt_assignments_for_program_assignment` trigger to pass NULL for time fields on auto-creation. Mirrored in `v2`.
- `20260719100100_ojt_drop_legacy_dates.sql` — destructive: drops `start_date` and `due_date` columns from both schemas after app cutover verified.

**Removed code:** `useExtendOjtAssignment` hook (no due_date to extend; rescheduling = editing event_date directly). `isOverdue` callback in `OjtSessions.new.tsx`. The dual-purpose `start_date`/`due_date` fields collapsed to a single calendar appointment everywhere.

**UX impact:** `CreateOjtAssignmentDialog` now shows one date picker + two `<input type="time">` with `end_time > start_time` validation. List + detail pages show "Lịch buổi" (date · HH:MM–HH:MM) instead of "Hạn chót". Learner mentor queue shows "Lịch:" prefix instead of "Hạn:" — `formatDueDate` helper replaced by `formatEventSlot`.

**L&D limitation acknowledged (deferred):** The single-row model breaks NĐ 44/2016 Pattern C compliance for safety-sensitive roles (e.g., Group 5 electricians) that require multi-session supervised hours per assignment. L&D Expert recommended a child `ojt_sessions` table for those. Acceptable trade-off for MVP because current target customer (Vinpearl hospitality / GSM) operates Pattern A (single supervised session). Revisit when first Group 3–5 safety customer onboards.

**Out of scope (deferred):** Multi-session per assignment (child table). OJT events on mentor/learner calendar views. Recurring OJT scheduling. Timezone-aware storage (single VN deployment, plain `TIME` is correct).

**Verification:** 7216 admin tests pass, 2533 learner tests pass, lint clean (warnings only, no errors), both portals build. Migration A and B both applied to remote successfully.

---

## 2026-04-25 — Course-Activity OJT Scaffolding Removed (cleanup)

**Decision:** Following the 2026-04-24 promotion of OJT to a first-class program item, the dead `course_activities.activity_type='ojt_checklist'` scaffolding was removed in cleanup migration `20260424110500_remove_dead_ojt_course_activity_scaffolding.sql`:

- Dropped `'ojt_checklist'` from `course_activities.activity_type` CHECK in both schemas — enum is now `subject_content | exam | survey`
- Dropped `course_activities.ojt_config` JSONB column in both schemas
- Dropped `ojt_assignments.course_activity_id` column + FK in both schemas
- Dropped the now-deprecated `p_course_activity_id` parameter from `create_ojt_assignment` RPC (signature went from 9 args to 8) in both schemas; trigger function `create_ojt_assignments_for_program_assignment` updated to match
- Deleted source files: `vsf-lms/src/components/training/dialogs/AddOJTActivityDialog.tsx`
- Removed `'ojt_checklist'` references from: `useCourseActivitySequence` (ActivityType union + insert/update payloads), `SortableActivityCard` (icon map + dispatch case), and 7 vsf-learner files (`ActivityInfoRow`, `curriculum-utils`, `CatalogActivityCard`, `LessonSidebar`, `useClassDetail` (type + select string + mapper), `design-tokens`, `lessonHelpers`, `ActivityPlayer`)
- Removed unused i18n keys `activityTypes.ojt_checklist`, `checklistItems`, `manualEvaluation` from vi/en/id training.json
- Removed the deprecated `courseActivityId` parameter from `useCreateOjtAssignment` (vsf-lms hook)
- Deleted the now-superseded `vsf-learner/src/pages/ojt/MentorOjt.{tsx,desktop,mobile}.tsx` + their `.test.tsx` files; `/mentor/ojt` route now `<Navigate>`-redirects to `/mentor/ojt/queue` (the canonical queue-centric entry point); Sidebar nav updated to point at `/mentor/ojt/queue`

**Pre-flight safety:** the migration aborted on first attempt because 3 public + 2 v2 dead seed rows still used `'ojt_checklist'`. Migration was hardened with a defensive `DELETE` of those rows (the path was never wired to live learner enrollment), gated by a 100-row safety cap that would abort and force human review if the volume ever indicated real production data. Final apply succeeded; 0 ojt_assignments rows had non-null `course_activity_id`.

**Status:** complete — both portals typecheck, lint, and build clean. No callers remained for any of the removed surfaces.

---

## 2026-04-24 — OJT Promoted to First-Class Program Item (not Course Activity)

**Decision:** OJT becomes `program_items.item_type='ojt'` with mentor + supervisor + due_offset_days configured at the program_item level. The dead `course_activities.activity_type='ojt_checklist'` scaffolding (enum value, `ojt_config` JSONB, `AddOJTActivityDialog`, `ojt_assignments.course_activity_id` FK) will be removed in Chunk 4 of this PR. Per-learner `ojt_assignments` are auto-created **eager** via DB trigger on `program_assignments` INSERT. Mentor UX is **queue-centric** (flat list of pending evaluations across programs, Cornerstone/SF pattern) — not class-centric.

**Business drivers (in priority order):**

1. **Vietnamese compliance (NĐ 44/2016 Đ.19–21)** *legally requires* separate audit records for classroom training (`Sổ theo dõi huấn luyện an toàn`) vs OJT practical log (`Sổ theo dõi thực hành`) for Group 3–5 workers — exactly GSM's drivers/technicians. An auditor from Sở Lao động will demand these as separate documents. Collapsing OJT completion into a single Course record creates audit risk.
2. **Industry standard.** Cornerstone Curriculum, SAP SuccessFactors Programs, Workday Learning all model multi-modality onboarding as distinct items in a program/curriculum, never as mixed activities in one course. There is no peer enterprise LMS that ships multi-modality onboarding as a single course with mixed sub-activities.
3. **Mentor adoption reality.** Cornerstone field finding: manager/mentor adoption of LMS-integrated OJT collapses to near zero when sign-off requires more than 2 clicks from the homepage. A flat work queue is the only realistic UX for non-LMS-native users doing operational evaluations. Course → Class → Activity → Student is 4-deep and unusable.
4. **Manager visibility.** Managers tracking new-hire progress need partial-completion granularity ("Part 3 not started") — only Program-level item granularity gives this. "Course 65% done" is opaque.

**Regret radius:** B (Program item) → A (Course activity) is additive: a single-modality course with OJT can be faked as a Program containing one Course item + one OJT item. A → B requires data migration, schema refactor, and extracting OJT from course completion logic.

**MVP cost:** Counter-intuitively, B is faster (~2–2.5 wk) than A (~2.5–3 wk) because B reuses existing `ojt_assignments` + `program_items` polymorphism cleanly. A would require inventing OJT-inside-lesson-player infrastructure that doesn't exist yet.

**Schema changes (Chunk 1, applied 2026-04-24):**

- `program_items.item_type` CHECK extended to `('course', 'assessment', 'ojt')`
- `program_items` gains: `ojt_template_id BIGINT FK ojt_templates ON DELETE CASCADE`, `mentor_id UUID FK auth.users ON DELETE SET NULL` (required for OJT items), `supervisor_id UUID FK auth.users ON DELETE SET NULL` (optional), `due_offset_days INT`
- `program_items_xor` constraint enforces one-of-three shape
- `ojt_assignments` gains: `program_item_id BIGINT FK program_items ON DELETE SET NULL`
- `create_ojt_assignment` RPC gains `p_program_item_id BIGINT DEFAULT NULL` (9th parameter); `p_course_activity_id` deprecated for one release
- New trigger `trg_program_assignments_create_ojt_assignments` (AFTER INSERT, when `status='active'`) loops OJT items in the program and calls `create_ojt_assignment` per learner; idempotent via `EXCEPTION WHEN OTHERS THEN NULL` and the existing partial unique index on `ojt_assignments(template_id, learner_id) WHERE status NOT IN ('approved','expired')`
- Supervisor falls back to mentor when not configured (column nullable on program_items but `ojt_assignments.supervisor_id` is NOT NULL; supervisor role is dead per 2026-04-24 finalize decision)
- Both `public` and `v2` schemas mirrored

Migrations: `20260424110000` (program_items extension), `20260424110100` (program_item_id on ojt_assignments), `20260424110200` (RPC evolution), `20260424110300` (eager trigger).

**Locked decisions for downstream chunks:**

- Mentor UX is queue-centric only (no cohort-grouped view in MVP)
- Admin "Add OJT to Program" UI stays desktop-only in `vsf-lms` (admin portal is desktop-only)
- Mobile + desktop variants required for: mentor OJT queue + mentor session detail (existing `MentorOjtDetail` reused with program breadcrumb)
- Comprehensive mobile design system pass: extract tokens (safe-area, 44px touch, mobile font scale), document patterns

**Deferred (out of scope, future PRs):**

- Prerequisites between OJT and other program items (table exists; UI gating not in this PR)
- OJT-required-for-program-completion gating
- Learner-facing program progress page (showing OJT alongside other parts)
- Removing the deprecated `p_course_activity_id` RPC arg
- Cohort-grouped mentor view
- Multi-mentor / mentor-team support per OJT item

**Plan reference:** `~/.claude/plans/now-we-come-to-dapper-adleman.md`

---

## 2026-04-24 — Mobile OJT Screens Live in `vsf-learner` (reframed as the "workforce app")

**Decision:** The 5 mobile screens for Teacher/Instructor OJT workflows (Home, OJT sessions list + detail, OJT checklists list + detail) are built in `vsf-learner`, NOT in `vsf-lms`. No new AppRole values are added — Teachers are identified contextually via `mentor_id` on `ojt_assignments`. `vsf-learner` is henceforth treated as the **workforce app** (all field/operational surfaces for any role); `vsf-lms` stays as the **back-office app** (content authoring, admin ops, reports — desktop only).

**Business driver:** Teachers and Instructors for OJT need to run live evaluation sessions one-handed on a phone, on a hotel floor / kitchen line / factory workstation. Current OJT screens are desktop-first and hostile to that context. The initial user instinct was to build mobile OJT in `vsf-lms` (admin portal) on the logic that "Admins and Instructors both manage classes — they should share UI." Market audit revealed this instinct maps to an architectural question that's broader than this ticket.

**Market audit (2026-04-24, before committing):**

Three distinct patterns exist in peer enterprise LMS:
- **Pattern A — Unified app with role-based UI:** Cornerstone Galaxy, Docebo Go.Learn, Workday Learning, LinkedIn Learning. All ship one web URL + one mobile app. Instructors and learners share the surface; admin/content authoring is desktop-web only. Dominant for web-based enterprise LMS.
- **Pattern B — Platform/role-gated within the main app:** SuccessFactors Mobile (instructor features iPad-only), Moodle (standard app is learners-only; managers use separate Branded Workplace App).
- **Pattern C — Dedicated specialized app for field checklist validation:** SAP SuccessFactors *Validated Learning Mobile* (iOS-only, separate from SF Mobile, FDA 21 CFR Part 11 compliant — and its docs describe the exact OJT observation-checklist use case EduLMS is building) and HealthStream Checklist (bedside preceptor tool). These exist alongside a main LMS and target regulated industries.

Pattern C has real precedent for "separate specialized OJT surface" — but the drivers are FDA 21 CFR Part 11 regulatory compliance and native-platform capabilities (biometric signature, camera, offline) that EduLMS (web-only, Luật ATVSLĐ 2015 tier) does not share. Absent those drivers, Pattern A (unified) is the right fit for a web LMS.

**Locked constraints:**

- **Portal: `vsf-learner`.** Mentor evaluation hooks (`useMentorOjtAssignments`, `useOjtAssignmentDetail`, `useEvaluateOjtItem`, `useFinalizeOjtAssignment`, `useDisputeOjtAssignment`) already exist here and work against the current single-schema. Moving to `vsf-lms` would cost ~15 proxy files, a rebuild of all 5 hooks against `useVersionedSupabase`, and a non-admin auth path — ~1.5–2 sprints with zero user value.
- **Role model: contextual, no schema change.** No new AppRole; Teacher = user with `mentor_id` on ≥1 `ojt_assignments` row.
- **Mobile ≠ responsive.** Separate `*.mobile.tsx` sibling files selected at runtime by `useIsMobile()` + lazy-loaded variants. Proxy owns data fetching; mobile/desktop variants are pure presentational.
- **File convention:** proxy + `.desktop.tsx` + `.mobile.tsx` co-located in the same directory as the original page. `useIsMobile()` gets a lazy initializer fix (no flash-of-desktop) + `?forceMobile=1` QA override.
- **User's "Learner" naming concern solved at branding/nav layer**, not architecture. Role-aware home: Teachers never see learner content unless they are also a learner. External rebrand to "EduLMS Go" / "Cổng thành viên" (login page, docs, marketing) is a follow-up, zero-code.
- **Scope: Teacher-only v1.** Observer (supervisor) mobile deferred — per the 2026-04-24 supervisor-informational decision, Observer has no transactional mobile use case; email/push notification instead.
- **Compliance non-negotiables (L&D):** full-screen KN3 endorsement Sheet with interpolated learner name + disabled-until-checked CTA; mandatory notes on failed / needs_practice items before finalize; pre-commit summary sheet showing mandatory-item outcome under the template's completion rule; per-item timestamps visible for audit.
- **Deferred to v2:** offline / PWA / service worker / IndexedDB queue; voice notes; photo evidence; new `teacher` / `observer` AppRoles; any OJT schema change.

**Known limitation flagged for future consideration:** peer LMSes (Cornerstone, Workday, LinkedIn) use a single web URL with role-based landing pages. EduLMS's current two-URL split (`vsf-lms` + `vsf-learner`) is uncommon in the market. Consolidating both portals into one web URL is defensible long-term but out of scope for this ticket — it would be a multi-sprint migration. The reframe above (back-office vs workforce app) captures the working mental model without code moves.

**Full implementation plan:** `vsf-learner/docs/mobile-ojt-plan.md` — includes screen-by-screen layouts, shared primitives, implementation sequence, and test plan.

**Durable memory:** `~/.claude/projects/.../memory/project_portal_split_architecture_question.md` — captures the architectural question and market audit for future sessions.

**Expert panel consulted:** CPO (portal placement + MVP scope), L&D (KN3 attestation deliberate-friction, mandatory notes, compliance audit, Observer scope), UI/UX (mobile layouts + bottom tab bar + KN3 sheet), CTO (device routing + file convention + code splitting + PWA deferral).

---

## 2026-04-24 — Skills Development Report v2 UX Recut (supersedes v1)

**Decision:** Full UX recut of `/reports/skills-development` after user feedback on v1 ("UX is terrible"). Tabs cut from 5 to 4 (Content Impact retired), Growth demoted to 4th position, all 7 data/UX bugs flagged by expert panel fixed, 4 drill-through action links added. Backed by new migration `20260716100000_skills_development_report_v2.sql` (adds `rpt_workforce_skill_coverage`, redefines `rpt_ojt_template_effectiveness`, renames `rpt_skill_growth_monthly.kn3_plus_new` → `kn3_plus_events`).

**Locked constraints (user + 3-agent panel: CPO, UI/UX, data-analyst):**

- **Canonical KN3+ denominator: headcount, not assignments.** `% of active users with ≥1 skill at KN3+ / total active users`. v1 had three divergent denominators across hero/dept-bar/matrix. New `rpt_workforce_skill_coverage` view is the single source of truth for org-wide coverage. Per-skill assignment-level metrics still use `rpt_skill_overview_kpis` for Top-N / heatmap.
- **Tabs cut from 5 → 4:** Overview / **Theo phòng ban** (Organization) / **Kênh ghi nhận** (Sources) / Growth. Content Impact tab retired; its useful piece (unused-180d) absorbed into Sources as collapsible admin-only "Catalog Health" section. Content-links table deferred to content-mgmt domain.
- **All 4 action links:**
  1. Stagnant MetricCard → `/users?filter=stagnant_skills`
  2. OJT template name → `/training/ojt-templates/:id`
  3. KN5 expert name → `/users/:id`
  4. Dept × Skill heatmap cell (pct < 50%) → `/users?dept=X&skill=Y&maxLevel=2`
- **7 data/UX bugs fixed:**
  1. OJT dispute rate could exceed 100% — subquery now scoped to approved assignments only.
  2. `kn3_plus_new` was mislabeled (counted all events at KN3+, not just new attainments) — renamed to `kn3_plus_events`.
  3. `StackedBarBySkill` composition math divided by global max, not row total — now divides by `(manager + ojt)` so bars always fill 100%.
  4. Distribution heatmap white-text flipped at pct > 45 (WCAG AA fail, 2.2:1 contrast) — threshold raised to 65. Opacity uses sqrt ramp (`Math.pow(p/100, 0.6) * 0.8 + 0.08`) for better low-end differentiation, visible legend, aria-label on every `<td>`.
  5. Hand-rolled KN5 drill-down modal missing focus trap/Escape/ARIA — replaced with shadcn `Dialog`.
  6. Sticky offset chain broken (banner at `top-0` + filter bar at `top-10` hidden behind 64px admin nav) — banner `top-16 z-40`, filter bar `top-[6.5rem] z-30`.
  7. Top-5 growth rendered as `<ul>` inside `role="img"` ChartCard — replaced with proper horizontal `BarChart`. Monthly AreaChart (with `type="monotone"` on categorical time) → stacked BarChart. Cumulative line deleted (derivative of monthly, no new info).
- **Chart-type swaps:** KN3+ coverage by dept `<ul>` of flex-grow divs → Recharts horizontal `BarChart` with shared axis + 50% ReferenceLine. Source donut (2 slices) → 2 side-by-side MetricCards.
- **Compliance banner styling:** `bg-amber-50/80 text-amber-900 border-amber-200` + Info icon + `role="note"` + aria-label. Sits at `top-16` below the admin nav.
- **MetricCard gains:** `delta?: number | null` with "+X.X% so với kỳ trước" pill (TrendingUp/Down/Minus icon + green/red/muted), tone-based card background (`bg-amber-50/70` warning, `bg-red-50/70` critical), `footer` slot for action links.
- **ExportMenu hidden:** v1's `window.print()` printed admin chrome; real CSV/PNG export deferred. `showExport={false}` on `ReportPageLayout` until a proper pipeline ships.
- **Deleted files:** `SkillsContentImpactTab.tsx`, `useSkillContentLinks.ts` (+ test). i18n keys `tabs.content_impact` + `charts.contentLinks*` removed from vi/en/id.
- **Risks accepted:** Action links land on an unfiltered `/users` if query params aren't wired up — no worse than today; follow-up ticket. Manager role auto-scoping on the dept matrix RPC unchanged from v1.

**Rationale summary:** v1 shipped functional but unusable. Expert panel identified three-way metric divergence (hero used assignment-count, dept bar used headcount, matrix used skilled-user-count — same label, different numbers), broken visual chain (sticky offsets hidden behind admin nav), missing affordances (zero action links, alert-worthy cards styled identically to neutral ones, no compliance icon), and 3 chart-type miscategorizations (smooth monotone area on categorical time, 2-slice donut, `<ul>` masquerading as a chart). v2 resolves all three structurally: one canonical denominator (workforce-coverage view), sticky chain actually visible, every pain-signal card jumps to the list of people/templates driving it.

**Expert panel consulted:** CPO (IA prune Content Impact, demote Growth, all 4 action links approved), UI/UX (sticky chain fix, heatmap WCAG, Dialog replacement, MetricCard tone backgrounds), data-analyst (headcount-based denominator canonicalization, renamed `kn3_plus_events`, dispute-rate subquery scope, composition-math bug).

---

## 2026-04-24 — Skills Development Report (`/reports/skills-development`, full scope)

**Decision:** Ship a 5-tab Skills Development report backed by 9 SQL views + 2 role-gated RPCs. Keep the thin `/reports/skill-proficiency` distribution report as a separate quick-look card (reuses the same `rpt_skill_kn_distribution` view so both screens stay consistent).

**Locked constraints (user + 4-agent panel: data-analyst, L&D, system-architect, UI/UX):**

- **5 tabs** — Overview / Growth / Sources / Organization / Content Impact. Content Impact is Admin-only (hidden for Manager role).
- **Compliance banner** — sticky top 40px muted band, permanent, non-dismissible. Vietnamese + English copy locked in plan file. Reinforces Skills ≠ Competencies (NĐ 44/2016).
- **L&D hard vetos applied:**
  - No mentor/template leaderboard by grant count (invites OJT sign-off inflation in Vietnamese workplace culture).
  - Dispute rate rendered only at aggregate template level, Admin-only column — never per-mentor (would chill legitimate learner disputes).
  - N<5 suppression on all department-level percentages (striped grey + em-dash + tooltip). Mitigates Luật ATVSLĐ surveillance risk.
  - KN5 expert list: counts-only in default view; individual names drill-down Admin-only.
  - `course_completion` source excluded from filter UI and charts (deferred feature; showing "0" is misleading).
- **L&D added metrics:** "Stagnant proficiency 12+ months" (Overview card, retraining trigger) + "Unused skills 180 days" (Content Impact amber callout, program-gap signal).
- **Aggregation: SQL views + RPCs.** Migration `20260715100000_skills_development_report_views.sql` (public + v2). 9 views SECURITY INVOKER (compose with existing RLS); 2 RPCs SECURITY DEFINER with explicit `has_role` gate (log table RLS would otherwise corrupt manager-level aggregates). `rpt_skill_dept_matrix` auto-scopes to caller's department when called by a non-admin manager.
- **Materialized-view promotion path:** triggered when `user_skill_proficiencies > 500K rows` OR p95 tab load > 2s. Not needed now.
- **Shared reporting primitives** extracted under `src/components/reports/` (MetricCard, ChartCard with sr-only table fallback + view-as-table toggle, ReportComplianceBanner, ReportFilterBar, DataFreshnessIndicator, ExportMenu, ReportPageLayout) — future reports build on these.
- **URL-query-backed filter state** (`?tab=&tw=&dept=&skill=&src=`) via `useSearchParams`, no Zustand.
- **Chart a11y:** every ChartCard renders `role="img"` + `aria-label`, always keeps an `sr-only` `<table>` fallback, plus a "Xem dạng bảng" toggle that replaces the chart with a visible table.
- **Old report NOT deleted:** initial plan absorbed `/reports/skill-proficiency` into Overview, but the user requested both coexist. The thin distribution page now reuses `rpt_skill_kn_distribution` (no legacy client-side aggregation hook — single source of truth).

**Rationale summary:** Skills data is now accumulating from multiple sources (manager_assignment + ojt_completion). L&D needs more than a flat distribution. Full-scope 5-tab report answers workforce capability (where are we strong/weak), growth trends, attribution (what's driving growth), org-level coverage, and OJT effectiveness as a training pathway. L&D vetos were non-negotiable: any metric that could pressure mentors to sign off loosely, or turn skill data into de-facto performance review, was cut or gated.

**Expert panel consulted:** data-analyst (canonical metric contracts + chart type selection), L&D (pedagogical validity + Vietnamese compliance framing + metric vetos), system-architect (DB views vs RPCs + RLS posture + materialized-view promotion path), UI/UX (tab IA + shared primitives + accessibility + responsive rules).

---

## 2026-04-24 — OJT: Remove Supervisor Approval + Optional Learner Confirmation

**Decision:** The OJT evaluation lifecycle drops the supervisor approval gate. Mentors finalize directly after evaluating items. Per OJT template, admins can toggle `require_learner_confirmation` which inserts a learner-confirmation gate between mentor-finalize and the skill grant.

**Business driver:** Vinfast / GSM business model — supervisors only receive information about OJT results and never approved. Some tenants additionally want the learner to self-confirm the result. Keeping the supervisor approval step as a required gate was actively blocking the Vinfast/GSM rollout.

**Locked constraints (user panel):**

- **Scope: both.** Remove supervisor approval AND add learner confirmation in the same ticket. No staggered delivery.
- **Toggle scope: per-OJT-template.** New column `ojt_templates.require_learner_confirmation BOOLEAN NOT NULL DEFAULT FALSE`, snapshotted to `ojt_assignments` at creation (same pattern as the skill+level snapshot from 2026-04-23).
- **Default OFF behavior — mentor finalize is atomic:** mentor clicks "Kết thúc buổi OJT" → `finalize_ojt_assignment` RPC flips `in_progress` → `approved` in one transaction + writes audit row `action='mentor_finalized'` + applies keep-higher skill grant. No intermediate `pending_review` state for new flows (kept only for legacy back-compat).
- **ON behavior:** mentor clicks "Gửi cho học viên xác nhận" → RPC flips to new status `learner_pending_confirmation` with audit action `submitted_to_learner`; no skill grant yet. Learner calls the same RPC (role check via `auth.uid() = learner_id`) → flips to `approved`, grants skill, writes `learner_confirmed`. Learner can instead call `dispute_ojt_assignment` → flips to `in_progress` for mentor rework (required notes).
- **KN3 attestation (from 2026-04-23 L&D decision) moves role:** was supervisor at approve time, now mentor at finalize time. The mentor actually observes the behavior — L&D's "conscious endorsement" rationale actually lands better here. Learner-confirm branch doesn't re-gate KN3 because the mentor already acknowledged at submit time.
- **`supervisor_id` column stays NOT NULL:** treated as notification target. No DB relaxation in this ticket — keeping it avoids a cascading schema change; notification wiring is a separate ticket.
- **Yesterday's work rewired:** `approve_ojt_assignment` RPC is dropped. `useApproveOjtAssignment` + `useRejectOjtAssignment` hooks deleted. Admin-portal `OjtAssignmentDetail` is now read-only with a supervisor informational banner; approve/reject buttons + dialogs gone. Mentor + learner surfaces are in the learner portal (see `MentorOjtDetail` and `OjtDetail`).

**New RPCs:**

- `finalize_ojt_assignment(p_assignment_id, p_notes, p_kn3_acknowledged)` — role-aware branching. Admin/manager (mentor) caller flips `in_progress`/`pending_review` → either `approved` (toggle OFF) or `learner_pending_confirmation` (toggle ON). Learner caller flips `learner_pending_confirmation` → `approved`. Skill grant only fires when final status is `approved`.
- `dispute_ojt_assignment(p_assignment_id, p_notes)` — learner-only, `learner_pending_confirmation` → `in_progress`, requires notes.

**Status state machine (post-migration):**

```
not_started ─► in_progress ─┬─► approved                          (OFF, mentor finalize)
                            │
                            └─► learner_pending_confirmation
                                  ├─► approved                    (learner confirm)
                                  └─► in_progress                 (learner dispute)
```

Legacy `pending_review` / `rejected` remain valid for historical rows; the RPC accepts them as valid source states for mentor finalize (back-compat) but no new code paths produce them.

**Migration:** `vsf-lms/supabase/migrations/20260714100000_ojt_remove_supervisor_approval.sql` (public + v2, drops `approve_ojt_assignment`, adds new column + status enum + action enum values + 2 new RPCs, updates `create_ojt_assignment` to snapshot the flag, updates XP rule descriptions).

**Rationale summary:** The supervisor approval step was dead weight at Vinfast/GSM and blocked tenant rollout. The learner-confirmation variant replaces it with a role that actually observes the outcome (the learner themselves). Making the toggle per-template lets admins decide per business flow without a system-wide lock-in. Keeping the skill grant firing only at final `approved` status preserves yesterday's "grant is the lock event" invariant.

**Expert panel consulted:** L&D (KN3 attestation role moves correctly to mentor), System-Architect (single RPC with role-branching vs two RPCs — single chosen for atomicity and simpler client surface).

---

## 2026-04-23 — OJT Template → Skill Proficiency Grant (KN1–KN3 only)

**Decision:** OJT templates can attach exactly one skill + one target KN level. When the supervisor approves the learner's assignment, the system atomically records that skill at the target level with `source='ojt_completion'`, under a **keep-higher-level** policy.

**Locked constraints (user + L&D expert panel):**

- **Level cap: KN1–KN3 only** at both DB (CHECK `BETWEEN 1 AND 3` on `ojt_templates.skill_target_level` and `ojt_assignments.skill_target_level`) and UI (ProficiencyLevelPicker with `max={3}`). KN4/KN5 remain manager-endorsement-only. L&D rationale: Dreyfus KN4/KN5 require coaching ability and process design evidence that a pass/fail checklist cannot produce.
- **Storage shape:** 2 columns on `ojt_templates` (`skill_id` + `skill_target_level`), NOT a junction, because the requirement is strictly 1 skill per template. Snapshot the same two columns onto `ojt_assignments` at creation so template edits don't retro-affect in-flight assignments (mirrors existing `ojt_assignment_items`/`ojt_assignment_areas` snapshot pattern).
- **FK strategy:** `ojt_templates.skill_id` → `skills(id) ON DELETE RESTRICT` — block skill deletion while referenced by any template. `ojt_assignments.skill_id` → `skills(id) ON DELETE SET NULL` (added 2026-04-24 via migration `20260714200000`) — the initial no-FK design for "frozen snapshot" was wrong in context: the template-level RESTRICT already blocks skill deletion while assignments exist, and PostgREST needs the FK to resolve the `skill:skills(...)` embed used by both portals' OJT detail queries. `ON DELETE SET NULL` only triggers for direct-SQL deletion (not possible via UI), preserving snapshot integrity for all realistic flows.
- **Atomic approval:** Replaced the 2-write client-side approval with a SECURITY DEFINER RPC `approve_ojt_assignment(p_assignment_id, p_notes)` that flips status + writes review audit + applies keep-higher logic + writes proficiency log, all in one transaction. Any exception rolls back the entire operation. Client hook (`useApproveOjtAssignment`) no longer accepts `actorId` — the RPC uses `auth.uid()` server-side.
- **Keep-higher policy:** If the learner's current level for the skill ≥ target, do not change the level. Still write an audit row with `previous_level = new_level = current` and notes `[skipped: current ≥ target]`. Same `source='ojt_completion'` (no new enum value needed). Rationale: OJT-task-completion doesn't un-prove a prior manager endorsement.
- **KN3 approval UX:** When the snapshot's `skill_target_level === 3`, the supervisor approval dialog displays an explicit consequence line + gating checkbox "Tôi xác nhận học viên đã đạt năng lực KN3". KN1/KN2 auto-grant silently. Rationale: KN3 is the threshold where the Competency module may begin to apply — sign-off should be a conscious endorsement act, not an incidental side effect of checklist approval.
- **Publish guard:** Soft warning dialog when publishing without a skill. Not a hard block — skill is optional.
- **Edit lock:** Skill fields editable only in `draft` (UI pattern: disabled + inline lock note). Published templates must be reverted to draft to change the skill.
- **Learner disclosure:** On `/my-skills`, rows with `source='ojt_completion'` render an inline tag "Từ OJT • Không có giá trị pháp lý". Prevents conflation of KN3 with ATVSLĐ compliance competency at the per-entry level (the page banner alone is insufficient — users anchor on entries, not headers).

**Migration:** `vsf-lms/supabase/migrations/20260713100000_ojt_skill_grant.sql` (public + v2, including `CREATE OR REPLACE create_ojt_assignment` to snapshot skill fields on new assignments).

**Rationale summary:** This is the first automated skill-grant pathway in the system. Treating OJT (Kirkpatrick Level 3 Behavior) as a defensible source of KN1–KN3 grants while preserving the manager-endorsement model for KN4–KN5 keeps Skills credible as workforce capability signal without undermining the Skills ≠ Competencies separation required by Luật ATVSLĐ.

**Expert panel consulted:** L&D (Dreyfus alignment, compliance disclosure, KN cap), UI/UX (form placement, level picker design, lock visualization), System-Architect (migration + atomic RPC design).

---

## 2026-04-22 — Training Plan approval tab redesigned as flat timeline (bug fix)

**Decision:** Replace the collapsible `ApprovalHistoryCard` (Card + Accordion) with a flat non-collapsible `ApprovalHistoryTimeline` that matches sibling tabs on `TrainingPlanDetail` and reads as a proper vertical-rail timeline. Applied to **both** `.new.tsx` and `.current.tsx` variants under the portal rule's "critical production bug" exception, because the old design was objectively inconsistent (not experimental).

**Problems with the old design:**
1. Wrapped in `<Card>` + `<Accordion>` — visually inconsistent with `PlanSettingsCard`, `TrainingPlanLearningPathsTab`, and the tracking tab, all of which use `bg-card rounded-lg border p-5`.
2. Double disclosure: user clicks the "Phê duyệt" tab AND then has to click an accordion to see content.
3. `HistoryEventRow` was an inline list — no timeline rail, no clear visual hierarchy per item.
4. `fromStatus` / `toStatus` data was fetched by `useTrainingPlanApprovalHistory` but never rendered.
5. Returned `null` when empty — left a blank white area on a tab the user explicitly opened.

**Fix:**
- New component: [`ApprovalHistoryTimeline.tsx`](../../vsf-lms/src/components/training-plans/ApprovalHistoryTimeline.tsx). Flat `<section>` wrapper matching `PlanSettingsCard`. Vertical 2px rail with 40×40 tone-colored nodes (`semanticToneClassMap`). Per-item content: action title, "Hiện tại" pill on index 0, actor avatar + name, assigned approver for submits, `<StatusBadge from="trainingPlan" /> → <StatusBadge to="trainingPlan" />`, absolute + relative timestamps, negative-toned rejection-reason callout.
- **Sort stays DESC** (newest first) — user lands on the tab to answer "what's the current state?" — answer is at index 0 with a "Hiện tại" pill.
- **Empty state** inside the same wrapper: icon + helper copy pointing at the "Gửi phê duyệt" action.
- **Loading skeleton** for 3 items so the heading never flashes.
- **No in-tab action buttons** (explicitly descoped by user — keep approval actions only in the page header dropdown to avoid duplication).
- **No reusable `<Timeline>` primitive yet** (YAGNI until 3rd use case; `RoleHistoryTimelineV2` + this is only 2). TODO comment in both files documents the extraction trigger → `src/components/ui/timeline.tsx`.
- Prop interface simplified: `defaultExpanded` removed (no accordion to control).

**Alternatives rejected:**
- _Keep the component name `ApprovalHistoryCard`, only change internals._ The "Card" name now misleads — every future reader would expect the old structure. Low-cost rename (2 page files + 1 structural regression test updated).
- _Flip sort to ASC (chronological)._ CPO preferred it for "story readability", but the dominant JTBD (plan owner checking rejection reason) is answered faster with DESC + "Hiện tại" marker. Conflict resolved via user-outcome-over-elegance rule.
- _Move `ApprovalStatusBanner` into the tab._ Rejected — banner is a persistent cross-tab alert ("this plan needs your attention") that must stay visible on the Tracking / Info / Paths tabs too. Don't hide it behind a tab click.
- _Keep `.current.tsx` on the old component._ Would leave Current Version users with a broken empty state and inconsistent design. The portal rule reserves Current for stable production; this change **fixes a production bug** and therefore qualifies for the "user must confirm" exception. User confirmed.

**Implementation:**
- New: [`ApprovalHistoryTimeline.tsx`](../../vsf-lms/src/components/training-plans/ApprovalHistoryTimeline.tsx) + [`ApprovalHistoryTimeline.test.tsx`](../../vsf-lms/src/tests/components/training-plans/ApprovalHistoryTimeline.test.tsx) (15 tests, 100% line coverage).
- Deleted: `ApprovalHistoryCard.tsx` + its test file.
- Updated: both `TrainingPlanDetail.{new,current}.tsx` imports + dropped `defaultExpanded` prop.
- Updated: `TrainingPlanDetailApprovalGate.test.ts` — 8 string assertions renamed + 2 new regression guards ("no `ApprovalHistoryCard` leftover", "no `defaultExpanded` prop in approval TabContent").
- i18n: added `count`, `currentBadge`, `approverSuffix`, `transitionArrow`, `rejectionReasonLabel`, `emptyState.{title,description}`, `aria.{timelineLabel,loadingLabel}` under `trainingPlans.detail.history` in `vi` + `en`.

**Approved:** User confirmed scope on 2026-04-22 (sort=DESC, touch `.current.tsx`, skip in-tab actions, skip primitive extraction).

---

## 2026-04-21 — Training Plan approval gate enforced server-side (UI + hook + DB)

**Decision:** Close the draft→scheduled bypass on Training Plans with a three-layer lock. No escape hatch other than the existing approval RPCs.

**Bug:** The approval workflow shipped in `fef50aee` was opt-in. Both [`TrainingPlanDetail.new.tsx`](../../vsf-lms/src/pages/training-plans/TrainingPlanDetail.new.tsx) and `TrainingPlanDetail.current.tsx` (the default variant) still exposed a "Lên Lịch" action that called `useUpdateTrainingPlanStatus({ status: "scheduled" })` against a raw `UPDATE`, silently skipping the approver, the audit log entry, and the notifications. Discovered on `/training-plans/15b0333e-d55c-4be0-a6e9-6823ff1ad9d8`.

**Fix (three layers):**
1. **UI** — Remove the "Lên Lịch" `DropdownMenuItem` and the `case "schedule"` branch from `TrainingPlanDetail.new.tsx`; port the full approval UX (ApprovalStatusBanner, Submit / Approve / Reject dialogs, gating helpers) to `TrainingPlanDetail.current.tsx` so both variants behave identically.
2. **Hook** — Add `isForbiddenTrainingPlanStatusTransition` + an early `throw` inside `useUpdateTrainingPlanStatus` when the caller supplies `currentStatus` and the requested pair is one of the six gated transitions. Callers (`cancel`, `finish`) now pass `currentStatus: plan.status`.
3. **Database** — Migration [`20260707100000_enforce_training_plan_status_gate.sql`](../../vsf-lms/supabase/migrations/20260707100000_enforce_training_plan_status_gate.sql) adds a `BEFORE UPDATE` trigger `training_plans_status_gate` on `public.training_plans` and `v2.training_plans`. The trigger rejects the six gated pairs with `SQLSTATE 42501` unless a transaction-local `app.training_plan_bypass_gate = 'true'` is set. The three approval RPCs (`submit_training_plan_for_approval`, `approve_training_plan`, `reject_training_plan`) were patched (in both schemas) to set that flag via `set_config(..., true)` at the top of their body.

**Forbidden-direct pairs:**
- `draft → scheduled`
- `draft → in_progress`
- `draft → pending_approval`
- `pending_approval → scheduled`
- `pending_approval → in_progress`
- `pending_approval → draft`

All six require going through the matching RPC. Terminal transitions (`→ cancelled`, `scheduled → in_progress` via auto-transition, `in_progress → completed/incomplete` via auto-transition) are not gated.

**Why three layers (not just DB):**
- Client guard catches accidental reintroduction during development before the error round-trips from the server.
- DB trigger is the one that actually matters in production — it fires regardless of which client issues the `UPDATE`.
- Keeping both means a future UI can drop the guard without weakening safety.

**Alternatives rejected:**
- _Only fix the UI._ Any other client (SQL shell, a future mobile app, a typo in another hook) would still bypass approvals.
- _Use a `CHECK` constraint._ Constraints can't read the "current" vs "new" row distinction nor a session/txn flag.
- _RLS policy on UPDATE._ RLS wants a condition over the row, not a transition; implementing a transition check in RLS would require a helper function anyway, and we'd still need the `SECURITY DEFINER` bypass for RPCs. A trigger is more direct.

**Out of scope (deliberate):**
- The `training_plans_status_check` text constraint is left alone — it lists the legal set of status values, not the legal transitions.
- Demo seeds that insert `scheduled` rows directly are unaffected (the trigger fires on `UPDATE` only).

**Implementation:**
- Migration [`20260707100000_enforce_training_plan_status_gate.sql`](../../vsf-lms/supabase/migrations/20260707100000_enforce_training_plan_status_gate.sql) (idempotent: `DROP TRIGGER IF EXISTS` + `CREATE OR REPLACE FUNCTION`).
- Hook changes in [`useTrainingPlans.ts`](../../vsf-lms/src/hooks/useTrainingPlans.ts) — exports `isForbiddenTrainingPlanStatusTransition` for tests, adds optional `currentStatus` parameter to `useUpdateTrainingPlanStatus`.
- UI parity between `TrainingPlanDetail.new.tsx` and `TrainingPlanDetail.current.tsx`.
- Tests: `hooks/useTrainingPlans.test.ts` (pair matrix + guard behaviour) + `pages/TrainingPlanDetailApprovalGate.test.ts` (structural regression test on both variant sources).

**Approved:** User confirmed plan on 2026-04-21.

---

## 2026-04-21 — Permission Registry Refresh (Gamification, OJT, Learning Paths, Skill Proficiency, Audit Log)

**Decision:** Expand [permission-modules.ts](../../vsf-lms/src/lib/permission-modules.ts) from 23 to 30 modules to cover features that shipped after the original seed (Jan 2026). Seed default role grants for Super Admin / Training Admin / Instructor / Learner via an additive migration on both `public` and `v2` schemas.

**New modules:**

| id | category | actions | Placement rationale |
|---|---|---|---|
| `learning-paths` | `training` | view, create, update, delete, publish, archive | Mirrors `courses` / `programs` lifecycle |
| `ojt-templates` | `training` | view, create, update, delete, publish, archive | Sidebar groups all OJT under "Tổ chức đào tạo" |
| `ojt-sessions` | `training` | view, create, update, delete | Sidebar grouping |
| `ojt-evaluations` | `training` | view, create, update, delete | Sidebar grouping (grading is still a training-ops action) |
| `skill-proficiency` | `admin` | view, update | Assignment lives on user profile, not on a skill; fixed KN1–KN5 scale (no create/delete) |
| `gamification` | `admin` | view, update | Tenant-wide config, Super Admin only |
| `audit-log` | `admin` | view | Read-only compliance trail, Super Admin + Training Admin |

**Role grants (seed matrix):**

| Module | Super Admin | Training Admin | Instructor | Learner |
|---|---|---|---|---|
| `learning-paths` | all | all | view | view |
| `ojt-templates` | all | all | view | — |
| `ojt-sessions` | all | all | view, create, update | — |
| `ojt-evaluations` | all | all | all | — |
| `skill-proficiency` | view, update | view, update | view | view (own) |
| `gamification` | view, update | — | — | — |
| `audit-log` | view | view | — | — |

**Locked decisions (user Q&A 2026-04-21):**
1. **Audit log viewing:** Super Admin + Training Admin. Training Admins act on plan approvals and user mgmt; they need the trail.
2. **Gamification config:** Super Admin only. Treated like tenant settings — low-frequency, high-impact.
3. **OJT placement:** all under `training`. Sidebar is the ground truth; no split between planning and grading.
4. **Migration date:** `20260706120000` (plain `supabase db push`, no `--include-all` needed).
5. **Tasks module:** deferred. Page is still a stub (`EmptyState` "Tính năng đang phát triển").
6. **Notifications table:** no permission entry. RLS-scoped to `user_id = auth.uid()`; not a managed resource.

**Reason:** Without registry entries, Super Admin's "full" role stopped being full as new features shipped. The matrix UI had no row for those modules, meaning role admins couldn't turn access on/off and nothing was actually gated outside the UI sidebar. Seeding the grants retroactively via additive migration (`ON CONFLICT DO NOTHING`) is idempotent and dual-schema safe.

**Implementation:**
- Registry update in [permission-modules.ts](../../vsf-lms/src/lib/permission-modules.ts).
- Migration [20260706120000_add_permissions_for_new_modules.sql](../../vsf-lms/supabase/migrations/20260706120000_add_permissions_for_new_modules.sql).
- i18n additions in `src/i18n/locales/{vi,en,id}/organization.json` under `roles.detail.moduleNames`.
- New predicates in [usePermissions.ts](../../vsf-lms/src/hooks/usePermissions.ts): `canViewAuditLog`, `canConfigureGamification`, `canAssignSkillProficiency`.
- Test updates in `permission-modules.test.ts` (30 modules, training=8, admin=9) + new predicate tests in `usePermissions.test.ts`.

**Out of scope / v2 follow-ups:**
- Retrofitting RLS policies on `gamification_*`, `audit_log_entries`, `ojt_*`, `learning_path_*` tables to read `role_permissions` — this refresh only syncs the registry + grants.
- Adding a `descriptionKey` field to `ModuleDefinition` for matrix tooltips.
- Splitting OJT into its own sidebar/category (current flat placement under Training is acceptable).

**Approved:** User confirmed plan on 2026-04-21.

---

## 2026-04-21 — Training Plan Approval Workflow (MVP)

**Decision:** Training Plans gain a `pending_approval` status between `draft` and `scheduled`. A creator submits a plan, picks a **named approver** at submission time (must hold `training-plans:approve`; cannot be self), and the plan locks until that approver (or a Super Admin as an escape hatch) approves or rejects it. Rejection requires a reason (min 10 chars), sends the plan back to `draft`, and surfaces a persistent rejection banner to the creator. Approval is **one-time** — editing an approved plan is allowed but surfaces an "Edited after approval" warning; no re-approval flow.

**Locked product decisions:**
1. **Approver model:** named approver per plan, chosen at submission time (no role-based routing or delegation in v1).
2. **Re-approval:** never. If a plan is edited after approval, warn via banner but do not force re-submission.
3. **Safety-category bypass:** none. Approval is uniform across all plan types. L&D Expert flagged the risk (compliance plans may need stricter gates) — documented as a v2 follow-up.
4. **Creator withdraw:** disallowed. Only the named approver or Super Admin can move a plan out of `pending_approval`.
5. **Stuck-plan escape:** Super Admin can approve/reject any pending plan if the named approver is unavailable.
6. **Notifications MVP:** built a minimal `notifications` table + replaced the AdminHeader mock bell with real data (three event types: `training_plan_approval_requested`, `training_plan_approved`, `training_plan_rejected`). No email notifications in v1.
7. **Self-approval:** blocked at the API (RPC validates `approver_id != creator`). The approver picker also excludes the current user.

**Reason:**
- Enterprise customers (e.g., Vinpearl) require a formal governance gate before a plan commits budget, schedules classes, and enrolls learners. The pre-approval `draft → scheduled` flow had no accountability trail.
- Named approver at submission time (vs role-routed approval) keeps the MVP simple and gives ops full control per plan. Role-based routing and multi-step chains are v2 candidates.
- Denormalized `latest_rejection_*` fields on `training_plans` avoid joining `audit_log_entries` for every detail-page load; full history still flows to the audit log.

**Implementation:**
- Migration adds `pending_approval` to the status enum, 8 new columns on `training_plans` (`submitted_for_approval_at`, `submitted_by`, `approver_id`, `approved_at`, `approved_by`, `latest_rejection_reason/_at/_by`), and a `notifications` table. `auto_transition_training_plan_status()` skips `pending_approval` rows so date rollover doesn't auto-advance a pending plan. Three RPCs enforce the guardrails atomically: `submit_training_plan_for_approval`, `approve_training_plan`, `reject_training_plan`.
- Hooks: [useTrainingPlans.ts](../../vsf-lms/src/hooks/useTrainingPlans.ts) gains `useSubmitTrainingPlanForApproval`, `useApproveTrainingPlan`, `useRejectTrainingPlan`. New [useNotifications.ts](../../vsf-lms/src/hooks/useNotifications.ts) and [useApprovableUsers.ts](../../vsf-lms/src/hooks/useApprovableUsers.ts). [usePermissions.ts](../../vsf-lms/src/hooks/usePermissions.ts) gains `canApproveTrainingPlan(plan)`.
- UI: new [SubmitForApprovalDialog](../../vsf-lms/src/components/training-plans/SubmitForApprovalDialog.tsx) (Combobox approver picker), new [ApprovalStatusBanner](../../vsf-lms/src/components/training-plans/ApprovalStatusBanner.tsx), inline Approve/Reject actions on TrainingPlanDetail, `pending_approval` added to list-page status filter, AdminHeader bell wired to real notifications.

**Out of scope / v2 follow-ups:**
- Role-based approver fallback / delegation
- Multi-step approval chains
- Email notifications
- Compliance-category approval bypass (L&D-flagged risk)
- Re-approval on material edits
- Creator withdraw action
- Approval deadline + escalation

**Approved:** User confirmed plan on 2026-04-21.

---

## 2026-04-18 — Exam Score Publication Decoupled From Event Status

**Decision:** Score visibility is now controlled by an independent boolean toggle `exam_events.scores_published`, not a status step. The `published` value is removed from the `exam_events.status` enum. New lifecycle: `draft → scheduled → in_progress → grading → finished → cancelled`.

**Reason:**
1. **Fast finishers shouldn't wait for the cohort.** Enterprise training clients (internal certifications, compliance drills) routinely run exams where learners who finish early deserve instant feedback while slower ones are still testing. The old status-step model (`grading → published → finished`) forced all-or-nothing reveal tied to the lifecycle.
2. **Admins need a reversible live gate.** Publication must be flippable on/off at any time — not only during the narrow `published` window. Toggling OFF must hide scores again, even from learners who already saw them.
3. **Status enum should model lifecycle, not disclosure policy.** Mixing a visibility concern into the state machine made the flow brittle and blocked parallel operation (grading + partial publication).

**Implementation:**
- Migration [20260418140000_add_scores_published_to_exam_events.sql](../../vsf-lms/supabase/migrations/20260418140000_add_scores_published_to_exam_events.sql) adds `scores_published boolean NOT NULL DEFAULT false` to both `public.exam_events` and `v2.exam_events`. Backfills `scores_published=true` where old status was `published` or `finished`. Migrates `status='published'` rows to `status='finished'`. Updates v2 CHECK constraint to drop `published`.
- Admin: [useExamEvents.ts](../../vsf-lms/src/hooks/useExamEvents.ts) exports `useToggleExamEventScoresPublished`. [ExamEventDetail.new.tsx](../../vsf-lms/src/pages/exams/ExamEventDetail.new.tsx) replaces the "Công bố" action button with a `<Switch>` labeled "Công bố điểm cho học viên" — visible in `in_progress`/`grading`/`finished`, hidden in `draft`/`scheduled`. Off-toggle shows confirm dialog warning learners will lose score access.
- Learner: [useStandaloneExamDetail.ts](../../vsf-learner/src/hooks/useStandaloneExamDetail.ts) exposes `scoresPublished`. [ExamResult.tsx](../../vsf-learner/src/pages/exams/ExamResult.tsx) swaps the visibility gate from `showResultImmediately` to `scoresPublished`. Query has `staleTime: 30s` + `refetchOnWindowFocus` so admin toggle changes propagate on revisit/refocus (no realtime subscription — deferred).
- `show_result_immediately` config remains but no longer gates visibility — it only influences post-submit redirect behavior.

**Out of scope / Follow-ups:**
- Realtime toggle propagation via Supabase channel (learners don't need to refresh).
- Audit log of toggle flips with actor + timestamp.
- Per-learner publication (individualized reveal).

**Approved:** User confirmed Phase 1 analysis + Phase 2 plan on 2026-04-18.

---

## 2026-04-17 — Skills Proficiency Module: 5-Level Scale, Separate from Competencies

**Decision:** Enhance Skills module with a 5-level global proficiency scale (KN1–KN5). Skills and Competencies remain architecturally separate systems with different scales (5 vs 4).

**Proficiency scale:**
| Level | Label | Shorthand |
|-------|-------|-----------|
| 1 | Người mới bắt đầu | KN1 |
| 2 | Đang phát triển | KN2 |
| 3 | Đạt yêu cầu | KN3 |
| 4 | Thành thạo | KN4 |
| 5 | Chuyên gia / Dẫn dắt | KN5 |

**Reason:**
1. Vietnamese manufacturing companies need workforce capability mapping — "how many workers at KN3+ in Working at Heights?"
2. SAP SuccessFactors uses a similar separation; the 5-level Dreyfus model is well-established in L&D science.
3. Different scales (5 for Skills, 4 for Competencies) reinforce the distinction: Skills = developmental tracking, Competencies = NĐ 44/2016 compliance certification.
4. KN3 = "Đạt yêu cầu" aligns with Competency Level 3 — the threshold where formal certification may apply.

**MVP scope:** Proficiency definitions + manager assigns to employees + employee profile view + skill reports + learner portal read-only view. Deferred: auto-inference, OJT integration, bulk ops, self-declaration, gap analysis.

**Full spec:** `vsf-lms/docs/business-logic/skills-proficiency-module.md`

**Approved:** User confirmed Phase 1 analysis on 2026-04-17.

---

## 2026-04-17 — Skills vs Competencies Architecture Validated

**Decision:** EduLMS's separation of Skills (content tags) and Competencies (people assessment) is architecturally correct and aligned with SAP SuccessFactors. No restructuring needed.

**Reason:** SAP SF separates Skills and Competencies for data governance reasons, not L&D science. EduLMS's model (Skills tag content, Competencies assess people) maps directly to Vietnamese regulatory requirements: courses develop "kỹ năng" (tagged by skills), assessors certify "năng lực" (tracked by competency assessments). SAP SF's model would actually be worse for NĐ 44/2016 because it decouples skills from the competency evidence chain.

**Implications:** Do not add compliance-grade proficiency to Skills. Do not merge Skills and Competencies into one system. `subject_competency_map` is aspirational guidance, not automatic evidence.

**Approved:** User confirmed analysis on 2026-04-17.

---

## 2026-04-13 — Exam Password Gate Uses Per-Tab SessionStorage (Standalone Exams Only)

**Decision:** The Learner-side exam password gate persists the "verified" flag in **sessionStorage** (not localStorage) under key `exam_pwd_verified_${examEventId}`. Scope is **standalone exams only** (`exam_events`); class-based exams delivered via `assessment_templates` are out of scope.

**Reason:**
1. **Per-tab re-verification is the feature, not a bug.** Enterprise clients run in-person proctored exams where the proctor reads the password aloud. Re-opening the exam in a new tab should force re-verification — localStorage would silently authorize every tab and every future session.
2. **Client-side flag is defense-in-depth.** The RPC `verify_exam_password` (both schemas, `SECURITY DEFINER`) is the real gate — it re-validates password + participant list + time window on every call. The sessionStorage flag + `ExamPlayer` redirect exist only to avoid loading the player UI for an unverified user.
3. **Class-based exams use a different table.** `ExamBriefing` / `ExamActivityContent` read from `assessment_templates`, which has no `password_enabled` column. Wiring the gate there requires a separate design.

**Implications:**
- New RPC: `verify_exam_password(p_exam_event_id UUID, p_password TEXT) → JSONB` in `public` and `v2`.
- New learner hook: [vsf-learner/src/hooks/useVerifyExamPassword.ts](../../vsf-learner/src/hooks/useVerifyExamPassword.ts) exports `useVerifyExamPassword()` + `markExamPasswordVerified()` + `isExamPasswordVerified()`.
- `useStandaloneExamDetail` now surfaces `passwordEnabled: boolean`.
- `ExamDetail` intercepts "Bắt đầu thi" and shows `ExamPasswordDialog`; `ExamPlayer` redirects to detail when the sessionStorage flag is missing.

**Approved:** User confirmed scope and per-tab semantics on 2026-04-13.

---

## 2026-04-11 — Learning Paths Use BIGINT Primary Keys (Not UUID)

**Decision:** Keep the BIGINT primary keys on `learning_paths`, `learning_path_stages`, and `learning_path_steps`. The [learning-path-module.md](../../vsf-lms/docs/business-logic/learning-path-module.md) §9.1 originally rationalized UUID for "clean gamification integration," but this rationale does not hold up.

**Reason:**
1. **Tables already shipped with BIGINT.** The original learning paths migration created all three tables with `BIGINT PK GENERATED ALWAYS AS IDENTITY`. Migrating them to UUID would require data migration, FK rewrites across `learning_path_stages.learning_path_id`, `learning_path_steps.learning_path_id`, `learning_path_steps.stage_id`, and downstream code refactors (hooks, types, components that treat ids as `number`).
2. **Gamification doesn't care.** The gamification tables have their own UUID PKs and reference `learning_paths.id` as an opaque value. BIGINT works identically from the gamification side — nothing in the gamification pattern requires the referenced entity to be UUID.
3. **Consistency with other training entities.** Courses, programs, training plans, classes, and enrollments all use BIGINT PKs. BIGINT for learning paths matches the rest of the training data model.
4. **Cost / benefit is negative.** The only benefit UUID would offer is offline-friendly ID generation, which is not a requirement for admin-authored learning content.

**Implications:**
- The spec's §9.1 rationale and the §13 design principle "UUID primary keys for all new tables" are WRONG for learning paths. Update the spec to reflect this.
- `user_learning_path_enrollments`, `user_learning_path_progress`, and `training_plan_learning_paths` (Sub-phases B, C, F) also use BIGINT PKs.
- Polymorphic step references via `step_ref_id TEXT` remain unchanged (needed to bridge BIGINT courses and UUID assessment templates).

**Approved:** User confirmed via Q1 response on 2026-04-11. Documented before Sub-phase A implementation.

---

## 2026-03-09 — Exam Event Activation Rules

**Decision:** Exam events require ALL 5 setup items to be complete before activation.

| # | Item | Priority | Rationale |
|---|------|----------|-----------|
| 1 | Event name | Required | Identity |
| 2 | Assessment template linked | Required | Can't run exam without questions |
| 3 | Template has ≥1 question | Required | Empty template is useless |
| 4 | Start date set | Required | Scheduling |
| 5 | At least 1 participant added | Required | Initially proposed as "recommended", user corrected: **admin must add at least one student** |

**Pattern:** Follows `useClassSetupCompletion` hook pattern from Training Classes.

**UX decisions:**
- Activate button in header is disabled + shows tooltip when not ready
- Setup checklist card appears above tabs for draft events only
- Ready-to-activate alert includes inline text-style action link ("Kích hoạt →"), not a solid button
- Alert uses flex layout override (`[&>svg]:static [&>svg+div]:translate-y-0`) to fix vertical centering

---

## 2026-03 — Button + Link `asChild` Bug

**Decision:** Never use `asChild` pattern with `<Link>` inside `<Button>`.

**Reason:** Radix `Slot` component silently fails to render in certain contexts. No console errors — buttons just disappear from DOM. Has occurred multiple times (EditClassDialog, ClassSessionsTab).

**Alternative:** Always use `useNavigate()` hook for button-based navigation.

---

## 2026-03 — Content Status Naming

**Decision:** Content entities (Programs, Subjects, Courses) use `"published"` — never `"active"` — for the visible/active state.

**Reason:** UI code checks `status === "published"` to show publish/unpublish actions. Using `"active"` would break these checks.

**Exception:** Classes, Categories, and Skills use `"active"` because they have different lifecycles.

---

## 2026-03 — Class Manual Activation

**Decision:** Classes must be manually activated by admin (`draft → active`). Auto-transitions only apply for date-based changes (`active → in_progress → finished`).

**Reason:** Prevents incomplete classes from becoming visible to learners. Ensures operational readiness is confirmed by a human.

---

## 2026-03 — Versioned Supabase Client

**Decision:** ALL hooks must use `useVersionedSupabase()` and `useVersionedQueryKey()` — never the raw `supabase` client.

**Reason:** The dual-schema version system (public + v2) requires schema-aware queries. Raw client always queries `public`, causing 406 errors when user switches to `v2`.

---

## 2026-04-14 — Program Final Result computed client-side (not via RPC)

**Decision:** Admin Portal's program-level "Kết quả hoàn thành cuối cùng" (completed / not_completed / in_progress / exempted) is computed in TypeScript via `src/lib/training/programFinalResult.ts`, not through the `is_learner_compliant_with_program` Postgres RPC.

**Reason:** The RPC signature still takes BIGINT `program_id` while `programs.id` is UUID in the current schema — calling it from the admin portal would fail type checking and silently return incorrect results. Keeping the rule set in TS lets Phase 1 ship today with a binary completed/not_completed display; Phase 2 (score ranking) can reuse the same pure function.

**How to apply:** Any admin-portal surface that needs program final result must import `computeProgramFinalResult` from `@/lib/training/programFinalResult`. Keep the rules in sync with the learner portal's `useProgramCompliance` RPC call path until the RPC signature is fixed. Tracked separately as tech debt — fix the RPC signature so both portals can share server-side logic.

---

## 2026-05-06 — OJT Two-Tier Template Lock Model

**Decision:** OJT template fields are split into two tiers with different lock semantics on the assignment they spawn.

| Tier | Fields | Lock moment |
|------|--------|-------------|
| **Tier 1 (immutable post-issuance)** | Checklist items (titles, criteria, mandatory, ordering), template areas, `completion_rule`, `completion_threshold`, `skill_id`, `skill_level_id`, `skill_target_level`, `worker_group` | At assignment creation. Once any non-terminal assignment exists from a template, these fields are blocked from edit on the template — admins must clone-to-edit (`clone_ojt_template` RPC). Strict: blocks even cosmetic typo edits. |
| **Tier 2 (mutable until first evaluation)** | `require_supervisor_approval`, `require_learner_confirmation` | At first real `ojt_item_evaluations` insert (result ≠ `not_evaluated`). Recorded by trigger `trg_ojt_eval_lock_policy` setting `ojt_assignments.policy_locked_at`. Until that moment, template edits to these fields prompt the admin to propagate to in-flight no-eval assignments via `propagate_ojt_template_policy` RPC, with one `ojt_assignment_reviews` audit row per propagated assignment (action `rules_updated_from_template`). |

**Reason:** Synthesises three agent positions per the expert panel (system-architect + L&D-expert + cpo). NĐ 44/2016 audit-record requirements demand the *evaluation instrument itself* (Tier 1) be locked at issuance. The procedural booleans (Tier 2) can safely propagate until any evaluation event has occurred — narrower and more audit-defensible than the previous "non-terminal status" cutoff. Strict Tier-1 lock + clone-to-edit gives the Manager persona a one-click recovery path while preserving full historical integrity. Versioning bones (`ojt_templates.cloned_from_id`) ship now, full versioning UI later.

**How to apply:**
- Schema lives in `supabase/migrations/20260913100000_ojt_template_versioning_bones.sql` and `20260913200000_ojt_clone_template_and_propagate_rpcs.sql`. Both schemas (public + v2).
- Tier-1 enforcement is at the application layer (UI blocks save with "Nhân bản để chỉnh sửa" CTA) rather than a DB trigger — chosen so the app can present a clean clone-to-edit flow instead of a raw constraint error. The DB still enforces snapshot-at-create; the Tier-1 guard is purely UX.
- Tier-2 enforcement uses `policy_locked_at` set by `trg_ojt_eval_lock_policy` (atomic, server-side, audit-grade).
- Backfill: migration `20260913100000` sets `policy_locked_at` on existing assignments using the earliest non-`not_evaluated` evaluation. Default placeholder evaluations created at assignment-creation time (`result = 'not_evaluated'`) do NOT trigger the lock — trigger filters them out.
- The earlier resync migration `20260912100000` used the broader "non-terminal status" cutoff; the embedded audit query in `20260913100000` surfaces affected rows for ops review. Per L&D advice, no rollback is performed (a second retroactive write would be worse). One row was flagged on push (assignment id=1) — see `project_ojt_resync_audit_finding.md`.
- Future `ojt_template_versioning_*` UI should read from `cloned_from_id` to render the lineage chain. Existing assignments are already pinned to a specific template row by design (snapshot-at-create), so adding formal version numbers later is additive metadata, not a breaking change.

---

## 2026-04-24 — `vsf-learner` Reframed as the Workforce App (Pattern A)

**Decision:** `vsf-learner` is no longer "the learner portal" — it is the **workforce app** that hosts every non-back-office field persona, with role-gated navigation. Today that is Learner + Mentor (OJT); tomorrow it covers Teacher/Instructor and a future Observer role. `vsf-lms` stays back-office desktop-only.

**Reason:** Validated against Cornerstone, Docebo, and Workday Learning. The market norm is one workforce-facing surface (web + mobile) with role-gated navigation, not separate portals per persona. Spinning up a third portal for Mentors would diverge from peer platforms and triple maintenance cost. Confirmed by the user 2026-04-24 after market audit.

**How to apply:**
- New non-admin field personas (Mentor, future Teacher/Instructor, Observer) ship in `vsf-learner` with role-based nav guards, not in a new repo.
- Mentor-facing OJT screens (queue, evaluation form) live in `vsf-learner` — see `project_ojt_program_item.md`.
- `vsf-lms` remains "headquarters back-office" — admin, manager, content creator, reporting. No field-persona surfaces.
- Long-term open question: peer LMSes use a single web URL — consolidating `vsf-lms` and `vsf-learner` into one app is a defensible future cleanup, but out of scope for now.

---

## 2026-04-24 — OJT Promoted to First-Class `program_item`

**Decision:** OJT is a first-class `program_item` (alongside `course`), not a `course_activity`. Mentor UX is queue-centric (not calendar-driven); assignments are eager-created at enrollment time, not lazily on first attempt.

**Reason:** NĐ 44/2016 audit-record requirements treat practical training as a separate compliance artifact from courseware. Modeling OJT as a course-internal activity would have buried it under course versioning and broken the per-session evaluation record the regulation requires. Eager auto-create gives mentors a populated work queue from day one — matches how peer LMSes (Cornerstone, Workday) surface tasks for non-learner field personas.

**How to apply:**
- New tables: `ojt_templates`, `ojt_template_areas`, `ojt_template_items`, `ojt_assignments`, `ojt_assignment_areas`, `ojt_assignment_items`, `ojt_item_evaluations`, `ojt_assignment_reviews`. Both `public` and `v2` schemas.
- Enrollment trigger creates an `ojt_assignment` per mentee × OJT program_item at `learner_classes` insert time.
- Mentor work-queue lives in `vsf-learner` (workforce app) — see Pattern A reframing above.
- Admin views in `vsf-lms` are read-only catalogs of templates + assignment lists; mentors evaluate in the learner portal.

---

## 2026-04-24 — Mobile Design System v1

**Decision:** Mobile screens are **separate sibling files** (`Foo.mobile.tsx` / `Foo.desktop.tsx`), not responsive variants of the same component. Mobile DS lives only in `vsf-learner` (workforce app); `vsf-lms` stays desktop-only.

**Reason:** Field personas (Learner, Mentor) overwhelmingly use phones; back-office personas use desktops. A single responsive component balloons in complexity once safe-area handling, 44px touch targets, and mobile font scales enter the picture. Sibling files keep both layouts clean and let each evolve independently. Confirmed against Cornerstone Mobile and Workday Learning Mobile, which take the same posture.

**How to apply:**
- New mobile-targeted screens in `vsf-learner` ship as `<Name>.mobile.tsx` next to the existing desktop file. A small dispatcher (e.g., `<Name>.tsx`) selects by viewport.
- Use mobile design tokens: safe-area insets, 44px minimum touch targets, mobile font scale. See `project_mobile_design_system_v1.md` for token list.
- Do NOT make existing `vsf-lms` screens responsive for mobile — that portal is desktop-only.
- Do NOT introduce mobile patterns into `vsf-lms`.

---

## 2026-04-25 — OJT Single-Event Scheduling Model

**Decision:** OJT assignments are scheduled as **single calendar events** with `event_date` + `start_time` + `end_time`. The previous `start_date` / `due_date` range columns are dropped; `useExtendOjtAssignment` removed.

**Reason:** OJT sessions in practice are one in-person block — a mentor and a learner meet for a 2-hour shadow shift, not a week-long sprint. Modeling them as date ranges produced confusing UX (sessions that "ran" for a week with no actual contact) and broke the calendar/queue presentation in the workforce app.

**How to apply:**
- Reads/writes use `event_date` + `start_time` + `end_time`. Format with `formatOjtDateRange()` (see `OjtAssignmentDetail.new.tsx`).
- Do NOT reintroduce `start_date` / `due_date` on assignments — both portals expect the single-event shape.
- Migration: `20260902150000_ojt_assignment_date_range.sql` (this is the rework, not the original range model).

---

## 2026-05-04 — Skills + Level Scale Per-Tenant (D1 Reversal)

**Decision:** Skills and the KN level scale are **per-tenant**, not global. Reverses an earlier decision (D1 in `project_skills_proficiency_module.md`) that proposed a single global 5-level KN scale shared across companies.

**Reason:** Different enterprise customers (target audience: enterprise internal training, not public MOOCs) have meaningfully different skill taxonomies and proficiency rubrics. A global scale forced unrealistic mappings. Per-tenant ownership matches how Cornerstone and SuccessFactors model skill libraries.

**How to apply:**
- `skills` and `skill_levels` tables are scoped by tenant (company).
- Do NOT seed a global skill catalog or fixed KN1–KN5 scale. Each tenant defines its own.
- KN3 cap on OJT targets is removed.
- Supersedes `project_skills_proficiency_module.md` global-scale claim.

---

## 2026-05-04 — OJT `skill_target_level SMALLINT` → `skill_level_id` FK

**Decision:** OJT template/assignment skill-target columns migrate from `skill_target_level SMALLINT` (which encoded a global KN level by integer) to `skill_level_id UUID` foreign key referencing `skill_levels`. The `min_hours` field is removed from the form. SMALLINT column kept for one release for safe rollback.

**Reason:** Direct consequence of the per-tenant skills D1 reversal — a literal SMALLINT no longer maps to anything meaningful when each tenant owns its own scale. The FK lets the form pull the correct per-tenant level options. `min_hours` was unused operationally.

**How to apply:**
- Forms must use `skill_level_id` from the tenant's `skill_levels` rows. Don't synthesize "KN1–KN5" labels.
- See `project_ojt_skill_level_fk_migration.md` for the column-removal timeline.

---

## 2026-05-04 — Unified Exercises Tab (Class Detail)

**Decision:** The class detail "Grading" tab is renamed to "Bài tập / Exercises" (`?tab=exercises`). SCORM activities are merged in as a row type alongside assignments. The instructor task-queue signal is preserved via a "Cần chấm" pill; SCORM is excluded from pending/graded rollups.

**Reason:** "Grading" framed the tab around the instructor's verb; "Exercises" frames it around what learners actually see. Merging SCORM avoids two near-identical lists. SCORM excluded from rollups because it self-grades — counting SCORM rows as "needs grading" was a long-standing source of false instructor alerts.

**How to apply:**
- The route param is `?tab=exercises` — update any deep links from `?tab=grading`.
- "Cần chấm" pill remains the queue-style entry point for instructors.
- SCORM rows render in the unified table but never appear in pending/graded counters.

---

## 2026-05-04 — Phase 4 Gate Reduced to Lint + Build

**Decision:** Phase 4 verification gate is `npm run lint` + `npm run build` only. `npm run test` and `npm run test:coverage` are no longer Phase 4 gates — they run on demand.

**Reason:** The full coverage run added 2–3 minutes per task and burned the prompt cache, while catching almost nothing the build didn't catch. Phase 3 still requires tests for hooks/utils/services/stores — the discipline holds at write-time, not at gate-time.

**How to apply:**
- Phase 4 = `npm run lint && npm run build`. Both must pass. Stop there.
- Run `npm run test` or `npm run test:coverage` only when you actually need the result (e.g., debugging a flaky suite, checking a coverage hole).
- Phase 3: still write tests alongside new hooks/utils/services/stores per the existing rule.

---

## 2026-05-06 — OJT Assignment `company_id` + Auto-Generated `code`

> **SUPERSEDED in part by 2026-05-14.** The `company_id` decision still holds. The framing of `code` as a "stable per-session identifier" is no longer correct — the code is exclusively a one-time mentor-claim token (cleared on claim) and is not displayed in the Admin Portal. See the 2026-05-14 entry for the current semantics.

**Decision:** `ojt_assignments` gains `company_id` (Phase 1 multi-tenant pattern) and an auto-generated per-tenant `code`, set by a `BEFORE INSERT` trigger.

**Reason (`company_id`):** Tenant scoping was missing, blocking RLS work and any cross-tenant reporting. Auto-generation avoids admin-side typing drift.

**How to apply:**
- Migration: `20260914120000_ojt_assignments_add_company_id_and_code.sql` (initial shape; the code generation and uniqueness model were later rewritten by `20261013100000` and `20261121100000` — see 2026-05-14 entry).
- The `code` value is **not** a stable identifier. UUID `id` is the only stable handle.

---

## 2026-05-08 — Unified OJT Detail Page (mentor + learner)

**Decision:** `/ojt/:assignmentId` and `/mentor/ojt/:assignmentId` now render the same component (`pages/ojt/OjtDetail.tsx` proxy → `.desktop.tsx`/`.mobile.tsx`). Role is detected from `useLocation().pathname` via `getOjtViewerRole`. Same data, same layout; what differs is icons, status labels, and action buttons — driven by a role-aware status registry.

**Reason:** The previous setup had two divergent pages for one domain object. Mentor's two-column area-nav + per-item edit was strictly more capable; learner's score gauge + competency scores was the right "results" framing. Merging took the best of both and removed an entire parallel maintenance surface (`MentorOjtDetail.tsx` + desktop + mobile + tests, `OjtObservationChecklist`, `OjtPendingState`).

**How to apply:**
- Status icon/label/banner copy lives in `components/ojt/ojtStatusRegistry.ts` keyed by `(status, role)`. Adding a new OJT status — or making one read differently per role — means editing this registry, never the page.
- `OjtAreaSections` accepts `mode: "view" | "edit"`. Mentor pages get `edit` (radio + notes + save via `useEvaluateOjtItem`), everyone else gets `view`. `SupervisorOjtDetail` uses the same component in `view` mode.
- `useOjtAssignmentDetail` no longer filters `learner_id = user.id` — RLS is the boundary, and the client filter blocked mentor reads. The hook now also projects `require_learner_confirmation`, `require_supervisor_approval`, and the joined `program_item.programs(...)`.
- New role-detection helper: `lib/ojtViewerRole.ts` (`getOjtViewerRole(pathname)`). Pathname starts with `/mentor/ojt` → `"mentor"`, else `"learner"`. Use this anywhere a component needs to render role-specific affordances inside the OJT detail tree — do not duplicate the URL check.
- `OjtActionBar` is the single place mentor finalize / supervisor route / learner confirm-dispute branches live; new actions go there, not in the page.

---

## 2026-05-10 — Exam Paper Canonical Model (Phase 0 of Exam Event Management)

**Decision:** The canonical exam data hierarchy is **`exam_blueprints` (design-time spec) → `exam_papers` (runtime artifact) → `exam_sessions` (Phase 1, time-slot) → candidate**. `exam_blueprints` defines a topic × difficulty matrix with an approval workflow. An approved blueprint generates one or more `exam_papers` rows — each is a stable, code-named ("DE-XXX") assembly of questions reusable across Events. Phase 1's `exam_sessions` will assign a specific `exam_papers` row to each candidate. `exam_events` continue to exist as the overall occasion but in Phase 1 will reference papers via sessions rather than holding a `questions_json` snapshot directly.

**Reason:** A pre-existing audit (memo at `vsf-lms/docs/exam-event-management/`) found three exam tables with unclear relationships:
- `exam_papers`: defined + 5 seed rows, but no CRUD hook, no UI, no permission module — orphaned in code.
- `exam_blueprints`: approval workflow + assembly RPCs exist, but no UI surfaces them.
- `exam_events`: alive end-to-end, queries `question_banks` directly via `questions_json`, no FK to either Paper or Blueprint.

The Advance Exam Event Management requirement (Khảo thí, sourced from HVLĐ, locked exam-only per `project_advance_exam_event_management_scope`) needs "Exam Paper" (Đề thi) as a **reusable, code-named artifact** assigned per-candidate per-session — necessary for random-paper assignment (BO priority #1 anti-cheat) and for stable references in audit logs and grading workflows. Three options were considered:
- **A** — drop `exam_papers`, treat blueprint as both spec and runtime: simplest, but no DB artifact for "DE-001".
- **B (chosen)** — blueprint = spec, paper = runtime artifact, session assigns paper.
- **C** — merge papers into blueprints: conflates approval-time matrix rules with assembled question snapshot.

Option B was chosen because it (1) maps cleanly onto BO terminology, (2) preserves the existing approval workflow on blueprints (no rework), (3) gives random-paper-per-candidate a stable artifact to reference, and (4) supports paper reuse across multiple Events without re-approval. Three layers (blueprint → paper → event) is more concept than A but each layer has a distinct purpose.

**How to apply:**
- New code targeting "Đề thi" / Exam Paper concept must reference the `exam_papers` table — do not invent a new table or repurpose `exam_blueprints` for runtime question sets.
- `exam_blueprints` stays the home for design-time approval (`status: pending_approval → published`). Approving a blueprint is a separate workflow from publishing a paper.
- Phase 1 will add `exam_sessions` (Ca thi) with a M:N link to `exam_papers`; participants will carry `session_id` + `exam_paper_id`. `exam_events.questions_json` becomes legacy data that Phase 1 migration must address.
- `useCourseActivitySequence.new.tsx` already queries `exam_papers` as a passive relation — under Option B this becomes meaningful, no rework needed.
- **`company_id` gap** on `exam_events` and `exam_blueprints` is acknowledged but deferred to Phase 1 schema work, where it groups with the new `exam_sessions` table and `exam_event_participants` migration. Pattern to follow: `20260609120000_add_company_id_to_content_tables.sql`.
- Permission registry: Phase 0 added the `exam-papers` module under `assessment` category with actions `view, create, update, delete, publish, archive` (no `approve` — approval lives on blueprint). It is **separate from** `exam-templates` (which is bound to `assessment_templates`, not `exam_papers`) — the naming overlap is sub-optimal but disentangling is out of Phase 0 scope.
- Module count: 32 → 33.
- See `vsf-lms/docs/exam-event-management/phasing.md` for the full 9-phase plan.

---

## 2026-05-10 — Path X re-confirmed via specialist panel (Phase 1A start)

**Decision:** The Phase 0 model decision (Path B / Path X — `exam_papers` as the canonical Đề thi runtime artifact, separate from `assessment_templates`) is **re-affirmed and locked**. Phase 1A resurrects `exam_papers` as a real, first-class entity with code, question junction, CRUD UI, and routing. The Feb 2026 `assessment-module-refactor.md` step §4.3 that proposed merging `exam_papers → assessment_templates(source_type='library')` is **explicitly superseded for the formal Đề thi case**; the quiz half of that refactor stays.

**Reason:** During Phase 1A scoping, the Feb 2026 consolidation history was rediscovered (3 parallel type systems pre-refactor, drift across 4 places, `exam_papers` was incomplete with no question links). The user paused to ask whether the refactor decision was still right given the May 2026 HVLĐ requirements. A four-agent panel review (system-architect, cto, ld-expert, cpo) was convened. Three of four returned full reports with unanimous Path X verdicts; cto returned a partial response that was not blocking. Key arguments:
- **system-architect:** ownership semantics differ (content creator vs. Examination Council); cardinality is `Event → Session → (junction) → Paper`, which Path Y models with a fragile `WHERE source_type='library'` predicate; Phase 2's `exam_paper_access_log` only makes sense FK'd to a dedicated table; Path X is more reversible.
- **ld-expert:** in Vietnamese L&D practice, course quizzes (formative, embedded in subject lessons) and Đề thi (summative, Hội đồng-driven, audited under NĐ 44/2016) are categorically different. SAP SuccessFactors and Cornerstone — the peer references — keep these as separate data objects with separate permission and approval models.
- **cpo:** the requirements doc says "ExamPaper is an INDEPENDENT entity" three times in three different sections; the user mental model "create a new Đề thi for Q3 cert" maps to Path X cleanly; Path Y would require admin to understand a confusing `source_type` filter.
- The cpo agent surfaced the critical chronology: the Feb 2026 refactor was authored *before* HVLĐ requirements arrived (May 2026). It correctly killed `exam_papers` for what existed then; the May 2026 BO requirement re-introduces a use case the refactor didn't anticipate.

**How to apply:**
- `exam_papers` is the real home for Đề thi. Do not write new code targeting `assessment_templates(source_type='library')` for the formal exam-paper concept — that is now the legacy/duplicate path. The 5 rows that the Feb 2026 step inserted into `assessment_templates(source_type='library')` are flagged with `legacy_imported_at = '2026-05-10T00:00:00Z'` (migration `20260921130000`) for a future cleanup.
- The `exam-templates` permission module remains bound to `assessment_templates` (in-course quiz templates, including the existing ExamLibraryPage at `/exams/templates`). The `exam-papers` permission module added in Phase 0 binds to `exam_papers`. Two modules, two tables — naming overlap is sub-optimal but the Feb-2026 refactor already chose `exam-templates` for the templates concept; keeping that binding stable avoids breaking the existing library UI.
- Phase 1A schema (now shipped): `exam_papers.code` auto-generated as `DE-NNNNNN` via BEFORE INSERT trigger (UNIQUE per company); new `exam_paper_questions` junction (mirrors `assessment_template_questions`); `exam_blueprints.company_id` added.
- Phase 1A code (now shipped): `useExamPapers` + `useExamPaperQuestions` hooks (versioned client); `/exams/papers` list, `/exams/papers/new`, `/exams/papers/:id`, `/exams/papers/:id/edit` routes (proxy + .current + .new); sidebar entry "Đề thi" under Kiểm tra.
- Phase 1B (next) introduces `exam_sessions` (Ca thi) with M:N to `exam_papers` and migrates `exam_event_participants` to carry `session_id` + `exam_paper_id`.
- Migrations `20260921100000`–`20260921130000` are the Phase 1A schema set.

---

## 2026-05-11 — Phase 1B shipped: Exam Sessions (Ca thi) + Hierarchy

**Decision:** The Exam Session (Ca thi) layer is live. Hierarchy is now `Exam Event → Exam Session → Exam Paper → Candidate` end-to-end, with backwards compatibility for legacy events that have no sessions.

**Reason:** Phase 0 + Phase 1A established the canonical Đề thi (Exam Paper) entity. Phase 1B introduces the time-slot layer required by the BO (HVLĐ) to schedule multiple sessions per event, with per-session windows, optional per-session passwords, and per-candidate paper assignment (Phase 4 will use this to randomize paper variants).

**How to apply:**
- **New tables:** `exam_sessions`, `exam_session_papers` (M:N junction with `weight` reserved for Phase 4 random assignment), `exam_session_password_attempts` (rate-limit ladder, modeled after the Event-level table).
- **Altered tables:**
  - `exam_events.company_id` added (Phase 0 deferred gap closed).
  - `exam_blueprints.company_id` was added in Phase 1A.
  - `exam_event_participants` gained nullable `session_id` + `exam_paper_id`. The blanket `UNIQUE (exam_event_id, user_id)` was replaced by two partial UNIQUEs (`legacy` where `session_id IS NULL`, `session-scoped` where it's not).
- **Backfill:** every existing exam_event got one auto-Session covering its window (status mirrored from event), and existing participants were pointed at that auto-Session. `exam_paper_id` stays NULL on legacy rows — legacy delivery still goes through `assessment_template_id → questions_json`. The Session is structural overlay only for legacy data.
- **RPC:** `verify_exam_session_password(p_session_id, p_password)` returns the same shape as the existing `verify_exam_password` — `{ success, error, retry_after_seconds, attempts_remaining }`. Window checks precede rate-limit checks. Session > Event password priority will be surfaced in Phase 4; for now both passwords can be set and the learner gates against whichever path the UI exposes.
- **Permission registry:** `exam-sessions` module added under `assessment`. Module count 33 → 34. Actions: `view, create, update, delete, activate, archive`.
- **Status flow on `exam_sessions`:** `draft | scheduled | in_progress | finished | cancelled`. **Manual transitions only** in Phase 1B — auto-transitions deferred until exam scheduling is fully settled.
- **Mobile parity (vsf-learner) is NOT in this PR** — admin-only landing. Learner-side picks up the schema cleanly in a follow-up.
- **Migrations `20260922100000`–`20260922140000`** are the Phase 1B schema set.
- **New code surfaces:** `useExamSessions`, `useExamSessionPapers`, `useAssignParticipantToSession`, `examSession` types, `examSession` StatusEntity, `SessionsTab` + `CreateSessionDialog` + `SessionDetail` (proxy + .current + .new), route `/exams/events/:eventId/sessions/:sessionId`, and a `Sessions` tab in `ExamEventDetail`.
- **`exam_events.exam_password` stays in place** — Sessions get their own password; the priority/UX migration happens in Phase 4 (anti-cheat).

---

## 2026-05-11 — Phase 2A shipped: Question Bank approval + Blueprint UI

**Decision:** Two new admin surfaces went live as a single PR:

1. **Bank-level approval workflow** on `question_banks`. Status re-introduced (`draft | pending_approval | approved | archived`) with approval-tracking columns and 3 SECURITY DEFINER RPCs (`submit_question_bank_for_approval`, `approve_question_bank`, `reject_question_bank`) mirroring the July-2026 `exam_blueprints` pattern. Self-approval blocked. Existing banks backfilled to `approved` so live demo data continues to function. Question-level status stays removed (user-confirmed Phase 2 scoping).
2. **Blueprint UI** at `/exams/blueprints` surfacing the existing `exam_blueprints` + `exam_blueprint_cells` schema. List + create wizard + 3-tab detail (Metadata / Cells / Generated Papers). Submit / Approve / Reject actions wire the existing 3 blueprint RPCs. Generated-paper assembly + cell matrix editor land in Phase 2B.

**Reason:** Per HVLĐ requirements (panel-confirmed Phase 2 = bank-level approval + configurable blueprint matrix). User explicitly declined a hardcoded 30/50/20 rule and a hardcoded `module-count → question-count` rule — admin configures the matrix themselves via blueprint cells (Phase 2B editor).

**How to apply:**
- **Migrations `20260923100000` and `20260923110000`** add the question-bank columns + 3 RPCs. Both schemas. Backfill `approved` for existing rows.
- **Permission registry:** `question-banks` gains `approve` action. Module count stays at 34 (no new module).
- **New entity helpers:** `questionBank` and `examBlueprint` registered in `domainStyles.ts` StatusEntity; entity translations added under `entities.examBlueprint` in vi/en/id `common.json` (matches existing `entities.questionBank`).
- **`useApprovableUsers` is now parameterized** by module name with default `"training-plans"` for backward compat. Pass `"question-banks"` or `"exam-blueprints"` for the new flows.
- **New hooks:** `useSubmitQuestionBankForApproval`, `useApproveQuestionBank`, `useRejectQuestionBank` extend `useQuestionBanks`. `useExamBlueprints` (new file) provides CRUD + the 3 approval RPC wrappers.
- **New types:** `QuestionBankStatus` extends `QuestionBank` interface; `examBlueprint.ts` types file added with full Blueprint + Cell shapes plus RPC result contracts (`AssembleExamResult`, `BlueprintCoverageResult`, etc.) ready for Phase 2B.
- **New UI:** `QuestionBankApprovalBar` component (one reusable bar plugged into both QuestionBankDetail proxies); `Blueprints` list + `CreateBlueprint` wizard + `BlueprintDetail` 3-tab page (all with proxy + .current + .new pattern).
- **Sidebar:** "Ma trận đề" / "Blueprints" entry added under Kiểm tra in both AdminSidebar versions.
- **Tests:** 6 new approval tests in `useQuestionBanks.test.ts`; 13 new in `useExamBlueprints.test.ts`; permission-modules registry test extended (45→46 cases).
- **Verification:** lint 0 errors, build OK in 25.77s, 89 tests pass across the 3 relevant files.
- **Phase 2B (next)** adds: cell matrix editor (topic picker + difficulty + count + points), `AssemblePaperButton` wrapping `assemble_exam_from_blueprint` RPC, `exam_paper_access_log` table + write hook on paper view + admin-only audit viewer tab on `ExamPaperDetail`.

---

## 2026-05-11 — Phase 2B shipped: Cell matrix editor + Paper assembly + Audit log

**Decision:** Phase 2 of "Advance Exam Event Management" is **complete**. Phase 2B delivers the working end of the matrix → paper pipeline plus the paper-view audit trail.

**Reason:** Phase 2A scaffolded blueprints (list + create + read-only 3-tab detail) and bank-level approval. Phase 2B finishes the loop: admin can now define the matrix cells (topic × difficulty × count + points), submit through approval, then click "Generate Paper" to produce an `exam_papers` row via the existing `assemble_exam_from_blueprint` RPC. Every paper view writes an audit row visible to admins on a new tab.

**How to apply:**
- **New migration `20260924100000`** adds `exam_paper_access_log` (id BIGSERIAL, paper_id FK, user_id, access_type CHECK 'view', accessed_at, metadata JSONB). RLS mirrors `audit_log_entries`: admin-only SELECT via `is_admin_user(auth.uid())`; INSERT allowed to any authenticated user but constrained to `user_id = auth.uid()` or admin. Both schemas. `GRANT SELECT, INSERT` to `authenticated`.
- **No permission registry change.** Access Log tab gated by existing `audit-log:view` permission (consumed via `usePermissions().canViewAuditLog()`).
- **`useApprovableUsers` parameterization from Phase 2A** is leveraged by the blueprint approval flow ("exam-blueprints" module name).
- **New hooks:** `useExamBlueprintCells` (list / create / update / delete / reorder); `useExamPaperAccessLog` + `useRecordExamPaperAccess` (best-effort writes, `console.warn` on failure, never blocks reads).
- **New components:**
  - `CellEditorDialog` (modal: label, question_type, difficulty, min_questions, points_per_question, topic multi-select via `MultiSelectCombobox`).
  - `CellList` (dnd-kit sortable cards with edit/remove actions; reorder issues N parallel `UPDATE` calls).
  - `AssemblePaperButton` (wraps the RPC; surfaces `pool_depth_insufficient` short_cells inline in the dialog with a table).
  - `ExamPaperAccessLogTab` (read-only table of recent access entries).
- **BlueprintDetail updates:** Cells tab is now the full editor (read-only listing replaced); when blueprint status ≠ 'draft', editor disables Add/Edit/Reorder/Remove and shows an "Archive and clone to revise" hint. Header gains `AssemblePaperButton` when status = 'published' and `cells.length > 0`.
- **ExamPaperDetail updates:** `useEffect` with `useRef` sentinel fires `useRecordExamPaperAccess` once per mount (React-Strict-Mode safe). New "Access Log" tab inserted after "Usage", gated by `canViewAuditLog()` on both trigger AND content.
- **QuestionBanks list polish (deferred from 2A):** `status` column + `FilterChip` for status filter; client-side filtering uses the new `QuestionBankStatus` type. Filter store gained `status` key on the `questionBanks` namespace.
- **Server-side enforcement of "cells immutable on non-draft blueprints"** is UI-only in Phase 2B — Phase 8 (audit/hardening) can add an `exam_blueprint_cells` trigger gate referencing the parent blueprint's status.
- **Tests:** 9 in `useExamBlueprintCells.test.ts`, 4 in `useExamPaperAccessLog.test.ts`. All Phase 1 + 2 hook tests still pass.
- **Verification:** lint 0 errors, build OK in 14.75s, 102 tests pass across the 5 relevant files (cells, access log, blueprints, banks, registry).
- **Phase 2 is now fully complete.** Next is Phase 3 (self-registration of candidates).

---

## 2026-05-11 — Phase 3A shipped: Self-registration (admin side)

**Decision:** Admin-side machinery for candidate self-registration ships in Phase 3A. New `exam_event_registrations` table + `exam_event_eligible_groups` junction + 5 registration-config columns on `exam_events` + 3 SECURITY DEFINER RPCs (submit/approve/reject). Admin gets a "Registrations" tab on `ExamEventDetail` and an `EligibilitySection` on the Overview tab to configure the registration window, capacity, auto-approve toggle, and eligible user groups. **vsf-learner UI (Register button + My Registrations) is Phase 3B**.

**Reason:** HVLĐ §6.8 requires candidate self-registration with capacity, approval, and notifications. Splitting admin (3A) from learner (3B) lets the data plane stabilize before vsf-learner consumes it — same pattern as Phase 1B's admin-first cut.

**How to apply:**
- **Schema (4 migrations):**
  - `20260925100000` — 5 registration columns on `exam_events`: `registration_required`, `auto_approve_registration`, `registration_opens_at`, `registration_closes_at`, `registration_capacity`. Defaults preserve legacy admin-driven flow (`false` / `NULL`).
  - `20260925110000` — `exam_event_eligible_groups` M:N junction. Empty per event = company-wide eligibility.
  - `20260925120000` — `exam_event_registrations` table with status flow `pending_approval → approved | awaiting_session_assignment | rejected | cancelled`. RLS: owner-or-admin SELECT; writes via RPC only (admin-write policy for fallback).
  - `20260925130000` — 4 RPCs: `exam_event_user_is_eligible` (helper), `submit_exam_event_registration`, `approve_exam_event_registration`, `reject_exam_event_registration`. All notify via `notifications` table.
- **Approver model: `event.created_by` OR super-admin.** No per-event approver picker; the submission RPC fires its notification to the event creator. Self-approval blocked.
- **Capacity:** Event-level cap is checked at submission (`registration_capacity`). Session-level cap (Phase 1B) gates placement at admin slot-assignment time. Both coexist; event = upper bound, sessions = placement constraints.
- **Auto-approve flag:** When `auto_approve_registration=true`, submitted registrations land directly at `awaiting_session_assignment` (decided_by = submitter, decided_at = now). Notifications skip the approver step.
- **Permission registry:** `exam-events` gains `approve` action (4 → 5 actions). Module count stays 34. Test extends with one new case (47 total). No `register` action — RPC enforces caller identity via `auth.uid()`.
- **New hooks:** `useExamEventRegistrations.ts` (list by event + 3 RPC wrappers; `useSubmitExamEventRegistration` exposed for Phase 3B); `useExamEventEligibility.ts` (groups CRUD with delete-then-insert bulk set).
- **`useExamEvents.ts` type extensions:** both `ExamEventRow` and `ExamEventUpdate` gain the 5 registration columns. No logic change.
- **New components:** `RegistrationsTab.tsx` (DataList queue with status filter + Approve / Reject row actions; rejection requires reason ≥10 chars client + server); `EligibilitySection.tsx` (toggles + window pickers + capacity input + group multi-select via `MultiSelectCombobox`).
- **ExamEventDetail integration:** `Registrations` tab inserted between `Sessions` and `Participants`; `EligibilitySection` rendered inside the Overview tab.
- **i18n:** new `examRegistrations` namespace in vi/exams.json (~30 keys). en/id use fallback text from inline `t("key", "fallback")` calls.
- **StatusEntity:** `examRegistration` registered in `domainStyles.ts` with 5-state palette (pending warning, approved info, awaiting_session purple, rejected negative, cancelled neutral).
- **Tests:** 11 new in `useExamEventRegistrations.test.ts` covering list, submit/approve/reject signatures, client-side reason guard, and server-error surfaces.
- **Verification:** lint 0 errors; build OK in 15.13s. All Phase 1–3A registry + hook tests pass.
- **Phase 3B (next)** will add vsf-learner UI: eligible-exams list, Register button, My Registrations status view. Uses `useSubmitExamEventRegistration` already exposed in 3A.

---

## 2026-05-13 — Program Module: Item completion gate consolidated (None / Complete / Pass)

**Decision:** The two related-but-separate "completion strictness" controls in the Program module are collapsed into a single per-row dropdown on `program_items.completion_requirement` (TEXT, `'none' | 'complete' | 'pass'`). The per-prereq-link `requires_success` switch in the "Quản lý yêu cầu trước" dialog is gone. When an item is used as a prerequisite anywhere, the gate inherits from the prereq item's own `completion_requirement` — there is no longer a per-link override.

Per item type:
- **Course** items: `none` or `complete` only (CHECK enforced + app-layer enforced)
- **Assessment** items: `none`, `complete`, or `pass`
- **OJT** items: `none`, `complete`, or `pass` — `pass` for OJT means supervisor approval (label = "Yêu cầu phê duyệt giám sát" / "Bắt buộc duyệt"), distinct from the assessment "Yêu cầu đạt" / "Bắt buộc đạt"

Items set to `'none'` are filtered out of the prerequisite picker dialog (cannot gate other items — there's no completion event to wait on).

**Reason:** Two booleans (`is_required` on the row + `requires_success` per-link) in two different surfaces created configuration drift. Industry peers (SAP SuccessFactors, Cornerstone OnDemand) keep this strictness on the item itself, not on each dependency edge. The lost capability — Item A being a hard-pass gate for Item B but only a completion gate for Item C — is rarely used in practice; admins think item-by-item, not link-by-link. Validated via CPO + L&D + UI/UX expert review.

**Migration rule applied: "Strictest wins"**
- If any inbound prereq link to item A had `requires_success=true` → A becomes `'pass'`
- Else if A.is_required = true → A becomes `'complete'`
- Else → A becomes `'none'`
- Course items that landed at `'pass'` are downgraded to `'complete'` with a NOTICE (courses cannot require pass)
- Items that landed at `'none'` but have inbound prereq links are upgraded to `'complete'` (preserve admin's intent to gate; never silently drop a prereq edge)

**Forensic safeguard (per L&D):** `program_items.is_required` and `program_item_prerequisites.requires_success` are NOT dropped — they are kept with `COMMENT 'DEPRECATED 2026-11-19'` for audit reconstruction of certificates issued under the old per-link rules. Application code must NOT read or write to them after this change.

**Pre-migration audit:** `vsf-lms/scripts/audit-prereq-inconsistency.mjs` runs against both schemas before applying. It identifies items where the same item is used as a prereq with mixed `requires_success` (some true, some false) — those are the cases where strictest-wins would silently tighten a previously-loose link. Run results on prod (2026-05-13): 2 inconsistent items found, both `course` type, so they downgrade to `'complete'` anyway → zero net behavior change.

**How to apply:**
- **Migrations:**
  - `20261119000000_cleanup_orphan_program_items.sql` — deletes 45 orphan rows in `public.program_items` whose `program_id` no longer exists in `public.programs` (pre-existing dirty data, blocked the FK re-validation on the UPDATE in the next migration).
  - `20261119100000_program_items_completion_requirement.sql` — adds `completion_requirement TEXT NOT NULL DEFAULT 'complete' CHECK IN ('none','complete','pass')`, comments the deprecated columns, and runs the 4-step backfill on both `public` and `v2`.
- **New hook:** `useUpdateProgramItemCompletionRequirement` in [useTrainingPrograms.ts](vsf-lms/src/hooks/useTrainingPrograms.ts:589) replaces the deleted `useUpdateProgramItemRequired`.
- **Hook signature change:** `useSetProgramItemPrerequisites` mutation input is now `{ programId, itemId, prerequisiteItemIds: number[] }` (was `{ ..., links: PrerequisiteLink[] }` with `requires_success` per link). The `program_item_prerequisites` insert no longer writes `requires_success` — DB DEFAULT (false) fills it for the forensic record.
- **Type changes:** `ProgramItemBase.is_required` → `completion_requirement: CompletionRequirement`. `PrerequisiteLink` no longer has `requires_success`. Mirror changes in `vsf-learner/src/hooks/usePrograms.ts`.
- **UI changes:**
  - [SortableProgramItemRow.tsx](vsf-lms/src/components/training/programs/SortableProgramItemRow.tsx) — Switch replaced with `<Select>` (Course = 2 options, Assessment/OJT = 3). `'none'` is rendered with `text-muted-foreground`; `'pass'` gets a small `bg-support-warning` dot prefix.
  - [ManageItemPrerequisitesDialog.tsx](vsf-lms/src/components/training/programs/ManageItemPrerequisitesDialog.tsx) — Switch removed; per-row `<Badge>` shows the prereq item's strictness (`support-info` for `complete`, `support-warning` for `pass`); items with `'none'` are filtered out of the picker.
  - [ProgramItemsTab.tsx](vsf-lms/src/components/training/programs/ProgramItemsTab.tsx) — column header renamed "Bắt buộc" → "Yêu cầu" (`w-44`).
  - All other Program tabs (Assessments, Learners, LearnerDetailSheet) read `completion_requirement !== 'none'` instead of `is_required`.
  - Picker dialogs (Course/Assessment/Ojt) now send `completionRequirement: 'complete'` on create.
- **Learner runtime gate:** [useCanStartItem.ts](vsf-learner/src/hooks/useCanStartItem.ts) reads the prereq item's own `completion_requirement` to decide pass-vs-complete enforcement; per-link `requires_success` no longer consulted.
- **Dead code removed:** `ProgramCoursesTab.tsx` (and its test) + the deprecated `useUpdateProgramCourseRequired` wrapper hook + its test were unreferenced and deleted.
- **i18n:** new `programs.requirement.*` namespace in `vi/training.json` and `en/training.json` with `none` / `complete` / `pass` / `passOjt` labels + badge labels for the dialog.
- **Tests:** updated 9 admin program-related test files (243 tests pass) + 5 learner program-related test files (157 tests pass). `useCanStartItem.test.ts` rewritten for the new gate model.
- **Verification:** Phase 4 admin: lint 0 errors, build OK in 15.98s. Phase 4 learner: lint 0 errors, build OK in 5.36s.
- **Component registry refresh recommended** post-merge: `node scripts/generate-component-registry.mjs` (per CLAUDE.md rule #5).

## 2026-05-18 — Exam Blueprint Sections (Phần) — v2.1-A shipped

- **Decision:** Exam blueprints gain a 3-level hierarchy **Blueprint → Phần (Section) → Cell**. A Phần is a *container* that groups cells (a Part with one cell = the simple homogeneous block; a Part with many cells = the topic × level sub-matrix). Confirmed by L&D as required for NĐ 44/2016 Group 3–5 compliance exams (canonical VN structure: Phần I Trắc nghiệm / Phần II Tự luận; maps to Điều 18–21 dual knowledge+skill assessment). User-approved 2026-05-18.
- **Reason:** the flat `exam_blueprint_cells` list could not express Phần grouping, per-Part question-type lock, or per-Part subtotals that an auditor expects on the printed ma trận. This is the first slice (**v2.1-A**) of the Matrix v2 roadmap and was sequenced *before* the grid editor (v2.1-B) so `BlueprintGrid` is built section-aware once. See plan `~/.claude/plans/please-fix-the-bug-logical-dawn.md`.
- **Schema (additive, backward-compatible — migrations `20261124100000` + `20261124200000`, public+v2):** new `exam_blueprint_sections` (id, blueprint_id FK CASCADE, title NOT NULL, question_type_lock CHECK, order_index, `total_min_questions`/`total_points` trigger-maintained caches). `exam_blueprint_cells.section_id UUID NULL` FK **ON DELETE SET NULL** (NULL = flat/legacy cell — valid forever; deleting a Phần demotes its cells, never destroys them). `exam_papers.sections_json JSONB DEFAULT '[]'` = immutable assembly-time Phần snapshot `[{section_id,title,order_index,question_count,total_points}]`.
- **MVP-minimum attributes only** (user decision): title + question_type_lock + order_index + subtotal caches. **Deferred:** per-Part instructions, per-Part time limit, per-Part pass-rule (table left extensible). **Dropped from all phases:** min–max cell range (`max_questions`) — exact count only.
- **Triggers:** `sync_blueprint_section_totals` (AFTER cell I/U/D → recompute affected section caches, handles cross-section moves); `exam_blueprint_cell_section_type_lock` (BEFORE — reject a cell whose non-NULL question_type ≠ its section's lock; NULL cell type allowed); `exam_blueprint_sections_draft_guard` (BEFORE — sections are draft-only; cache-only updates bypass the guard so totals still sync on any blueprint status).
- **RPCs (public+v2):** `assemble_exam_from_blueprint` + `compute_blueprint_coverage` rewritten section-aware (iteration order = sections by order_index → cells by order_index → trailing flat cells; each selected question tagged `section_id`; `sections_json` snapshot written). New `reorder_blueprint_sections(blueprint_id, ordered_ids[])` — single-statement reorder via `unnest WITH ORDINALITY` (deliberately avoids the N-parallel-UPDATE antipattern still present in `useExamBlueprintCells.reorderCells`). `submit_blueprint_for_approval` gains gates: `empty_sections` (a Phần with 0 cells) and `orphan_cells` (when sections are used, every cell must belong to a Phần so per-Part subtotals reconcile to the whole exam).
- **Backward compat:** flat blueprints (zero sections, all `section_id` NULL) assemble exactly as before; `sections_json` stays `[]`. No data backfilled (auto-promote of legacy blueprints to a default "Phần 1" is a deferred separate migration, gated on v2.1-B UI).
- **App layer:** `src/types/examBlueprint.ts` + `Exam­BlueprintSection*` types, `section_id` on cell types, `ExamPaperSectionSnapshot`, `empty_sections`/`orphan_cells` error codes. New `src/hooks/useBlueprintSections.ts` (versioned client; CRUD via PostgREST since RLS permissive + triggers enforce integrity; reorder via RPC). No UI in this slice (section-aware grid is v2.1-B).
- **Verification:** Phase 4 lint 0 errors, build OK 20.84s. 32 blueprint hook tests pass (10 new sections + 9 cells + 13 blueprints, incl. flat-cell backward-compat). Migrations DDL-only — not in the RAM-crash class.
- **Not yet built (v2.1-B):** `clone_blueprint`, `compute_blueprint_pool_coverage` (live pre-generation), the `BlueprintGrid` section-aware editor, bank-gate relax. They will be section-aware by construction.

## 2026-05-18 — Exam Blueprint v2.1-B1 (backend prereqs) shipped

- **Decision:** v2.1-B (grid + coverage + clone + bank-gate) decomposed into 4 sub-slices B1→B4 (user-approved). **B1 = backend only, no UI.** Plus: existing FLAT blueprints **auto-promoted** to a default "Phần 1" (user chose this over a grid/list toggle; the deferred EXM-P2.1A-08 is now done). v2.1-B2 will be built with **inline edit + Popover** (user chose over keeping the modal).
- **Schema (additive, `20261125100000`, public+v2):** `exam_blueprints.pool_depth_multiplier NUMERIC NOT NULL DEFAULT 2 CHECK (>=1)` + `exam_blueprints.cloned_from_id UUID NULL FK ON DELETE SET NULL` + `exam_blueprint_cells.learning_objective TEXT NULL`. DDL-only.
- **RPCs (`20261125200000`, public+v2):** NEW `compute_blueprint_pool_coverage(blueprint_id)` — pre-generation, section-aware, callable on draft, per-cell bank pool vs `CEIL(pool_depth_multiplier × min_questions)`, returns cells[]+sections[]+all_sufficient. NEW `clone_blueprint(src_id)` — deep-copy → new draft, sections+cells remapped via a jsonb old→new id map, approval reset, `cloned_from_id` set. NEW `reorder_blueprint_cells(blueprint_id, ordered_ids[])` — single-statement `unnest WITH ORDINALITY`, draft-gated; **`useExamBlueprintCells.reorderCells` switched to it — fixes the long-standing N-parallel-UPDATE race.** `assemble_exam_from_blueprint` now reads `pool_depth_multiplier` (default 2 → behaviour unchanged for existing blueprints).
- **Backfill (`20261125300000`):** every blueprint with ≥1 cell and 0 sections gets one "Phần 1" wrapping all its cells (incl. published/archived → faithful single-Phần, backward-compatible). **Trigger-safety:** `exam_blueprint_sections_draft_guard` + `sync_blueprint_section_totals` disabled around the set-based promote, section caches recomputed authoritatively, both re-enabled. Idempotent, small data — not RAM-class.
- **App layer:** `examBlueprint.ts` (+ `pool_depth_multiplier`/`cloned_from_id` on blueprint, `learning_objective` on cells, `BlueprintPoolCoverage*`/`CloneBlueprintResult` types). New `src/hooks/useBlueprintPoolCoverage.ts` (`useBlueprintPoolCoverage` query + `useCloneBlueprint` mutation, versioned client).
- **Verification:** Phase 4 lint 0 errors, build OK 17.08s; 38 blueprint hook tests pass (5 new pool/clone + 10 sections + 10 cells incl. rewritten reorder + 13 blueprints). Migrations applied to remote (one transient `api.supabase.com` outage during the session — recovered, no migration impact).

## 2026-05-18 — Exam Blueprint v2.1-B2 (section grid editor) shipped

- **Decision (user-approved):** Cells tab gains a **section-grouped editable grid** (`BlueprintGrid`) — *not* a true topic×difficulty pivot. Rationale: cells are flexible filter-rows (multi-topic, arbitrary filters) and cognitive level is deferred to v2.2; a pivot would be lossy and pre-empt the v2.2 axis decision. A **Grid/List `ToggleGroup`** keeps the classic `CellList` available (default = grid). Phần management is **inline in the band header**.
- **UX:** each Phần = a band (inline-rename title, type-lock badge, `⋯` menu = set/clear type-lock + move up/down + delete-with-confirm, subtotal); cells = rows with **inline** `min_questions`/`points` + label edit (commit on blur/Enter), a **Popover** for secondary config (question_type / difficulty / topics / learning_objective), trash. Cells drag-reorder within a band (dnd-kit, reuses CellList pattern, single RPC). **Phần reorder via ⋯ up/down** (deliberate — avoids fragile nested-dnd; full Phần drag is a cheap fast-follow). `pool_depth_multiplier` editable via a toolbar Settings popover. Per-Phần + grand totals computed client-side for instant feedback.
- **Pure-UI slice — no schema/RPC.** Consumes v2.1-A/B1 hooks (`useBlueprintSections` CRUD/reorder, `useExamBlueprintCells` CRUD + RPC reorder, `useUpdateExamBlueprint` for the multiplier). Live pool-coverage heatmap deferred to **v2.1-B3** (will consume the B1 `compute_blueprint_pool_coverage` RPC); clone button + bank-gate relax = **v2.1-B4**.
- **Files:** new `src/components/exams/blueprints/BlueprintGrid.tsx` (+ co-located `GridToolbar`/`SectionBand`/`GridCellRow`/`CellConfigPopover`); new `src/lib/blueprint/gridTotals.ts` (pure `computeBlueprintTotals` + 4 unit tests); `BlueprintDetail.new.tsx` Cells tab rewired with the toggle; vi `exams.json` `examBlueprints.*` grid keys added (EN via inline `t()` defaults — matches the existing sparse-en convention for this namespace). `CellList`/`CellEditorDialog` retained untouched (list view + `.current`).
- **`required_tags` deliberately not surfaced** in the Popover — consistent with `CellEditorDialog` (no product decision to expose tag filtering yet; avoids gold-plating).
- **Verification:** Phase 4 lint 0 errors, build OK 18.22s; 42 blueprint tests pass (4 gridTotals + 5 pool/clone + 10 sections + 10 cells + 13 blueprints). Component test skipped per CLAUDE.md (pages/components optional); risk concentrated in the tested `gridTotals` util.

## 2026-05-18 — Exam Blueprint v2.1-B3 + B4 shipped (v2.1-B track complete)

- **B3 (live coverage, UI only):** new pure util `src/lib/blueprint/poolCoverage.ts` `deriveCoverageState(available, required, sufficient)` → 3-state `ok`/`thin`/`short` (user-chosen 3-state; `short`=!sufficient mirrors RPC, `thin`=sufficient but <1.5× required, `ok`=≥1.5×). `BlueprintGrid` calls the B1 `useBlueprintPoolCoverage`, maps `cell_id→coverage`, renders a per-cell `CoveragePill` (glyph+text+tone, never color-only) + a toolbar `CoverageSummaryText` ("X/N ô thiếu nguồn" / "Đủ nguồn" / no-bank / loading). **Debounced (500ms) `refetch`** driven by a memoised signature of coverage-relevant cell fields + `pool_depth_multiplier` (localized to the grid; one targeted `eslint-disable-next-line react-hooks/exhaustive-deps`, no new lint warnings). Surfaces shortfalls *before* "Generate Paper" instead of on failure.
- **B4 (clone + bank-gate):** migration `20261126100000` re-emits `submit_blueprint_for_approval` (public+v2) with a **bank-approved guard** — NULL bank or `question_banks.status <> 'approved'` → new error `bank_not_approved` (before the state transition; CREATE OR REPLACE only, signature unchanged → no `types:gen` needed, not a schema change). `CreateBlueprint.new.tsx` new-blueprint bank filter relaxed `status === 'approved'` → `status !== 'archived'` (draft/pending selectable; parallel authoring). **Clone ("Nhân bản") from any status** wired via the B1 `useCloneBlueprint`: a `DataListAction` on `Blueprints.new.tsx` + a header `Button` on `BlueprintDetail.new.tsx`, both → toast + navigate to the new draft.
- **Consistency note (intentional, not a gap):** `bank_not_approved` surfaces through `handleMutationError` exactly like its sibling submit codes (`no_cells`/`empty_sections`/`orphan_cells`) — `errorHandler.ts` has no code→i18n map, so none was added for one code; a friendly mapping for *all* blueprint RPC codes is a separate small follow-up. `required_tags` still not surfaced (consistent with `CellEditorDialog`).
- **i18n:** vi `examBlueprints.*` keys added for coverage + clone (EN via inline `t()` defaults — established sparse-en convention for this namespace).
- **Verification:** Phase 4 lint 0 errors, build OK 25.74s; 47 blueprint tests pass (5 poolCoverage + 4 gridTotals + 10 sections + 5 pool/clone + 10 cells + 13 blueprints). **v2.1-B (B1–B4) complete.** Remaining in the Matrix v2 roadmap: v2.2 (cognitive-level dimension) and v2.3 (bulk authoring + integrity guardrails). Printable ma trận still a deferred L&D compliance follow-up.

## 2026-05-19 — v2.1-B2 UX revision: cell editing via Dialog (not Popover/inline)

- **User feedback (screenshot):** the v2.1-B2 per-cell `CellConfigPopover` + inline number/label inputs were cramped, overlapped the grid, truncated the topic multiselect — "change to Dialog, much cleaner."
- **Decision:** the grid and List view now share **one** editor — the existing `CellEditorDialog` (centered 2-col modal). Extended it with: a full-width `learning_objective` Textarea, and an optional `sectionId` prop applied **only to the create payload** (edit leaves `section_id` untouched → cell keeps its Phần). `BlueprintGrid`: deleted `CellConfigPopover`; `GridCellRow` is now a read-only summary (label + optional objective subtitle, type/difficulty/coverage badges, "N câu · M đ/câu", drag handle, ✎ Edit, 🗑 delete); one `<CellEditorDialog>` instance is lifted to `BlueprintGrid` with `{open, cell, sectionId}` state; `onEditCell`/`onAddCell` callbacks thread through `SectionBand`. "+ Thêm ô" now opens the create Dialog scoped to that Phần (no more instant empty-row create). Section-band controls, totals, coverage pill/summary, dnd reorder unchanged.
- **Tradeoff (user-accepted):** per-cell count/points no longer inline-editable — all edits via the Dialog; grid still owns the structural value (bands, totals, live coverage, reorder).
- **Bonus:** List view now also exposes the learning-objective field (additive, no regression — List passes no `sectionId`).
- **Pure UI, no schema/RPC/migration.** Phase 4 lint 0 errors, build OK 31.48s; 47 blueprint tests still green (utils/hooks untouched). Component tests optional per CLAUDE.md — pure presentational reuse of the already-tested dialog.

## 2026-05-19 — Fix: glitchy cell drag-and-drop in BlueprintGrid

- **Bug:** dropping a dragged cell snapped it back, then jumped to the new
  position after a delay. Cause: `SectionBand` rendered the `cells` prop
  directly with no optimistic state — order only changed after the reorder
  mutation invalidated the query and the parent refetched.
- **Fix:** applied the canonical in-repo pattern from `CellList.tsx` to
  `SectionBand` — optimistic `localCells` `useState` + `useEffect` resync on
  `cells` prop change; `handleCellDragEnd` does `setLocalCells(next)` before
  `reorderCells.mutate(..., { onError: () => setLocalCells(cells) })`;
  render/empty-check/`cellIds` now derive from `localCells`. The
  `useReorderExamBlueprintCells` hook + single-RPC `reorder_blueprint_cells`
  were already correct — bug was purely the missing optimistic render.
- **Pattern note:** any dnd-kit reorder bound to a server-refetched list in
  this codebase must keep an optimistic local copy (CellList = the reference);
  reorder UIs that render the query prop directly will always snap-back.
- **Out of scope (flagged):** section ⋯ Move up/down has a similar smaller
  refetch lag (button, not drag) — optional same-pattern follow-up.
- Pure UI; no schema/RPC/migration/new tests. Phase 4 lint 0 errors, build OK
  53.34s; 29 scoped blueprint tests green (utils/hooks untouched).


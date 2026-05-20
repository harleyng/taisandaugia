# Business Rules — EduLMS

> Living document. Updated after every task that changes business logic.

---

## Entity Status Lifecycles

### Content Entities (Programs, Subjects, Courses)

```
CREATE → draft → published → archived
                     ↕ (unpublish)
                   draft
```

- Use `"published"` for the active/visible state — **never** `"active"`
- Unpublish: hides from catalog, disables new enrollments, BUT keeps existing classes running
- Archive: blocks if future-dated classes exist (admin must cancel/migrate first)
- Delete: only `draft` AND zero classes

### Training Classes

```
CREATE → draft → active → in_progress → finished
                              ↓
                          cancelled
```

- **Manual activation required** (`draft → active`)
- Auto-transitions: `active → in_progress` (start_date arrives), `in_progress → finished` (end_date passes)
- Activation requirements: start_date, instructor (if instructor-led), enrollment_method
- Hook: `useClassSetupCompletion` — checklist pattern with required/recommended items
- Status controls visibility; enrollment dates control enrollment ability (both gates required)
- UI mapping: `draft` → "upcoming", `active`/`in_progress` → "active", `finished` → "finished"

### Exam Hierarchy (canonical model, 2026-05-10)

The end-state exam data model has **four** layers, only some of which are wired today:

```
Question Bank ──┐
                ├─► Exam Blueprint (design-time spec)  ──► Exam Paper (runtime artifact, "DE-XXX")  ──► Exam Session (Phase 1)  ──► Candidate
Question Topics ┘            [approval workflow]                 [reusable across Events]                 [time-slot, password]
```

| Entity | Table | Purpose | Status today |
|---|---|---|---|
| Question Bank | `question_banks` | Container of questions, filtered by topic + difficulty | Live |
| Exam Blueprint | `exam_blueprints` + `exam_blueprint_cells` | Topic × difficulty matrix spec; approval workflow (`pending_approval → published`); assembly RPCs | **Phase 2 live** (2026-05-11): list / create / 3-tab detail at `/exams/blueprints/*`. **Cell matrix editor** (modal + dnd-kit reorder) ships in 2B. **"Generate Paper"** on published blueprints wraps `assemble_exam_from_blueprint` RPC; surfaces `pool_depth_insufficient` short_cells inline. Cell edits blocked on non-draft blueprints (UI-only — server hardening is a Phase 8 item). |
| Question Bank approval | `question_banks.status` | Bank-level lifecycle `draft → pending_approval → approved → archived` (re-introduced 2026-05-11 for HVLĐ requirement; supersedes April 2026 status removal at bank level only). Question-level status stays removed. | **Phase 2A live** (2026-05-11): `QuestionBankApprovalBar` in QuestionBankDetail. Self-approval blocked. Existing banks backfilled to `approved`. **2B polish:** list page gains `status` column + filter. |
| Paper view audit | `exam_paper_access_log` | Best-effort log of every ExamPaperDetail view. RLS reads gated by `is_admin_user()`; writes constrained to `user_id = auth.uid()` or admin. View-only in Phase 2B (edit/assemble events come in Phase 8). | **Phase 2B live** (2026-05-11): `useRecordExamPaperAccess` fired on mount with `useRef` sentinel for React Strict Mode. Admin-only "Access Log" tab on ExamPaperDetail gated by `usePermissions().canViewAuditLog()`. |
| Exam event self-registration | `exam_event_registrations` + `exam_event_eligible_groups` | Lifecycle `pending_approval → approved \| awaiting_session_assignment \| rejected \| cancelled`. Eligibility = user-group whitelist on the event (empty = company-wide). Approver = `event.created_by` (super-admin override). Event-level capacity + per-session capacity coexist. Learner self-cancel allowed **only** on `pending_approval`. Rejected registrations are blocked from re-apply by UNIQUE `(exam_event_id, user_id)` + client filter. | **Phase 3 complete** (2026-05-11): Phase 3A admin side (RegistrationsTab on ExamEventDetail + EligibilitySection on Overview, 3 RPCs submit/approve/reject) + Phase 3B learner side (vsf-learner sections "Kỳ thi đang mở đăng ký" / "Đăng ký của tôi", cancel RPC, RegisterDialog/CancelRegistrationDialog, both desktop + mobile via `MobileAwareProxy`). |
| Per-candidate paper assignment | `exam_event_participants.exam_paper_id` + RPC `assign_exam_paper_to_participant` | When a learner enters an exam, RPC picks one of the Session's papers at random and stores it on the participant row. **Sticky**: re-attempts reuse the same paper (anti-gaming). Errors `no_session` / `no_papers_assigned` block entry and force admin attention. | **Phase 4A live** (2026-05-11): migration `20260927100000`, hooks `useAssignedExamPaper` / `useAssignExamPaper`, `ExamPlayer` routes paper loading through assigned paper id, admin `SessionDetail` Candidates tab shows assigned paper code or "Chưa giao". |
| Deterministic anti-cheat: tab-switch | `exam_events.tab_switch_threshold` / `exam_sessions.tab_switch_threshold` (Session > Event priority) + `exam_anticheat_events` log + `assessment_submissions.auto_submit_reason` | When a candidate switches away from the exam tab for ≥1.5s, the player records a warning. After threshold `N`, the (N+1)-th switch auto-submits the exam with `auto_submit_reason='tab_switch_threshold'`. NULL threshold = detection disabled. Learner can dispute (batch, reason ≥10 chars, within 7 days of submission). Admin accepts/rejects individual warnings — score recalculation is Phase 6 scope. | **Phase 4B-1 live** (2026-05-11): migration `20260928100000`, 3 RPCs (log/dispute/resolve), learner hooks + `TabSwitchWarningDialog` + `AnticheatWarningsCard` on ExamResult, admin `AnticheatWarningsCardAdmin` on ExamGradingWorkspace. |
| Per-session password (Session > Event) | `exam_sessions.password_enabled`/`exam_password` + `exam_password_verifications.session_id` (nullable) | When the learner's session has `password_enabled=true`, the player gates entry on the session password (own rate-limit ladder keyed by `(user_id, session_id)`). Verification persists per-layer so refresh doesn't re-prompt. Falls back to event-level password when no session-level password is set. | **Phase 4B-2 live** (2026-05-11): migration `20260929100000`, `verify_exam_session_password` now persists, `has_exam_password_verified` accepts optional session_id, `ExamPasswordDialog` routes by priority. |
| Manual paper re-assign (admin) | RPC `reassign_exam_paper_to_participant` + `exam_event_participants.paper_reassigned_{at,by,reason}` audit columns | Admin can override a candidate's assigned paper (Phase 4A sticky default) — either pick from session's pool or re-roll randomly. **Hard-blocked** when any `assessment_submission` exists for the (user, event). Reason ≥5 chars required. | **Phase 4B-2 live** (2026-05-11): hook `useReassignExamPaper`, `ReassignPaperDialog`, per-candidate "Đổi đề" button on SessionDetail Candidates. |
| Single-device enforcement | `exam_active_sessions(user_id, exam_event_id)` UNIQUE + start/heartbeat/end RPCs + `exam_anticheat_events.kind='device_change'` | Player computes a browser fingerprint (UA+screen+tz), calls `start_exam_active_session` on mount, polls `heartbeat_exam_active_session` every 10s. When another device starts the same exam, the UPSERT rotates the row's fingerprint → next heartbeat from the old device returns `alive: false, kicked_reason: 'device_change'` → ExamPlayer auto-submits with `auto_submit_reason='device_change'`. A `device_change` warning row is logged at takeover when a submission already exists. Dispute UX inherited from Phase 4B-1. | **Phase 4C live** (2026-05-11): migration `20260930100000`, `useExamActiveSession` hook + `DeviceKickDialog` on learner, kind-label rendering on admin `AnticheatWarningsCardAdmin`. |
| Hide identity when grading | `exam_events.hide_identity_when_grading` BOOLEAN | When ON, admin `ExamGradingWorkspace` masks `learnerName + learnerEmail` with "Thí sinh #N" (N = participant order by `created_at ASC`). Super-admin always sees real identity. No data migration; masking happens at render time via `maskLearnerIdentity` helper. | **Phase 5A live** (2026-05-11): toggle in CreateExamEvent form (`.current` + `.new`). |
| Session-level scores published | `exam_sessions.scores_published` BOOLEAN (nullable) | Per-session override of event-level `scores_published`. NULL = inherit from event. Non-null = override (true=show, false=hide). Learner `useStandaloneExamDetail` computes effective value: `session.scores_published ?? event.scores_published`. Admin 3-state segmented control in CreateSessionDialog ("Theo kỳ thi / Bật / Tắt"). | **Phase 5A live** (2026-05-11). |
| Multi-grader assignment (admin) | `exam_submission_graders(submission_id, grader_id)` UNIQUE + RPCs `assign_grader_to_submission` / `unassign_grader_from_submission` | Admin can attach multiple graders to a submission (assignment intent only). The single `assessment_submissions.graded_by/score/feedback` fields remain authoritative — last-write-wins among assigned graders. Scoring resolution (avg / calibration) deferred to 5C. | **Phase 5B live** (2026-05-11): `useExamSubmissionGraders` hook + `AssignedGradersPanel` + `AssignGraderDialog` on `ExamGradingWorkspace`. |
| Proctor module (Giám sát kỳ thi) | `exam_session_proctors(session_id, proctor_id)` UNIQUE + `exam_incidents` audit + RPCs `assign_proctor_to_session` / `unassign_proctor_from_session` / `proctor_force_submit` / `proctor_invalidate_attempt` | Admin assigns proctors per-session. Proctors see a live dashboard (10s polling) of active exam sessions in their assigned Sessions only. Two interventions: **force_submit** (sets `auto_submit_reason='proctor_force_submit'`) and **invalidate** (flips submission `status='void'`). Both require reason ≥10 chars + write an audit row to `exam_incidents`. Admin views incidents on the grading workspace. | **Phase 5C-Proctor live** (2026-05-12): hooks `useExamSessionProctors` / `useProctorActiveSessions` / `useProctorIntervention` / `useExamIncidents`, components `ProctorsTab` / `ProctorDashboard` / `InterventionDialog` / `IncidentsCardAdmin`, route `/exams/proctor`, sidebar entry "Giám sát kỳ thi". |
| Exam Paper (Đề thi) | `exam_papers` | A specific assembled paper with code (e.g. `DE-000001`); reusable across Events; carries the questions a candidate sits | **Phase 1A live** (2026-05-10): `code` column + auto-gen trigger, `exam_paper_questions` junction, CRUD hooks (`useExamPapers`, `useExamPaperQuestions`), pages at `/exams/papers/*`, sidebar entry "Đề thi" |
| Exam Session (Ca thi) | `exam_sessions` | A time-slot within an Event; M:N to `exam_papers` via `exam_session_papers`; per-session window/password/capacity; manual status flow `draft|scheduled|in_progress|finished|cancelled` | **Phase 1B live** (2026-05-11): code `CA-NNNNNN` auto-gen, RPC `verify_exam_session_password`, admin UI (`SessionsTab` inside ExamEventDetail + `/exams/events/:eventId/sessions/:sessionId`). Legacy events auto-backfilled with one Default Session covering the event window. |
| Session-scoped placement (Phase 1C) | `exam_event_participants.session_id` NOT NULL + UNIQUE `(exam_event_id, user_id)` + UNIQUE `(session_id, user_id)` + RPC `place_registration_into_session` | **Candidates belong to Sessions, never to "the Event-as-a-pool".** Phase 1C (2026-05-12) flipped `session_id` to NOT NULL, deleted the Event-level Participants tab, and rewrote `AssignCandidatesDialog` with 3 source tabs (Direct users / User groups / Awaiting placement). `exam_event_registrations` gains terminal status `placed` + `placed_at`/`placed_by` audit. Approved registrations transition to `placed` atomically via the new RPC. | **Phase 1C live** (2026-05-12): migration `20261110200000_eliminate_event_level_participants.sql`. |
| Exam Event (Kỳ thi) | `exam_events` | The overall exam occasion | Live; today holds `questions_json` directly — Phase 1 reframes |

**Naming pitfall:** the `exam-templates` permission module is bound to `assessment_templates` (in-course quiz templates), NOT to `exam_papers`. Use the `exam-papers` permission module for `exam_papers` table operations. See [decisions-log.md → 2026-05-10 — Exam Paper Canonical Model](decisions-log.md).

**Phase boundaries:** today (2026-05-10) only the bottom-row "Exam Events" sub-section below describes the live behavior. Blueprint, Paper, and Session behaviors will be added as their respective phases land. See `vsf-lms/docs/exam-event-management/phasing.md`.

### Exam Events (Kỳ thi)

```
CREATE → draft → scheduled → in_progress → grading → finished
                                                         ↓
                                                     cancelled
```

- **Manual activation required** (`draft → scheduled`)
- Activation requirements (ALL **required**):
  1. Event name set
  2. At least 1 question added (stored as `questions_json` on the event)
  3. Start date set
  4. At least 1 participant added
- Hook: `useExamEventSetupCompletion` — same checklist pattern as classes
- No auto-transitions — lifecycle moves via admin actions (end exam → `grading`, finalize → `finished`)
- **`published` status has been removed** (2026-04-18) — score visibility is now controlled by the independent `scores_published` boolean toggle, not a status step

**MVP Rules:**
- Students can take the exam **once** only (`max_attempts = 1`, hardcoded)
- `scoring_strategy` is not configurable (irrelevant with 1 attempt)
- Questions are managed **directly** on the event (decoupled from assessment templates)

**Score Publication Toggle (`scores_published`):**
- Independent runtime boolean on `exam_events` — decoupled from `status`
- Admin Switch in ExamEventDetail, visible when status ∈ `{in_progress, grading, finished}` (hidden for draft/scheduled)
- Flipping ON → learners can immediately see their score (fast finishers don't wait for the cohort)
- Flipping OFF → scores hidden again for all learners (live gate; confirm dialog on toggle-off)
- Learner gate: `ExamResult.tsx` renders score when `scoresPublished=true`; otherwise shows "Bài thi đã nộp" pending card
- `show_result_immediately` still exists as config intent but no longer gates visibility — `scores_published` is the authoritative gate
- Live propagation: learner query has `staleTime: 30s` + `refetchOnWindowFocus` (no realtime subscription)

**Edit Rules (Post-Activation):**
| What | Editable? | Notes |
|------|-----------|-------|
| Event metadata (name, code, description, schedule, mode) | ❌ No | Only editable in draft |
| Questions (add/remove/reorder) | ❌ No | Only editable in draft |
| Exam config (via assessment template) | ❌ No | Only editable in draft |
| Exam password (`password_enabled`, `exam_password`) | ✅ Yes (except terminal) | Editable in all statuses EXCEPT `finished`/`cancelled`. Copy always available including when locked. |
| Participants (add/remove) | ✅ Yes | Allowed in draft, in_progress, grading |
| Score publication (`scores_published`) | ✅ Yes | Toggle available in in_progress/grading/finished |

**Learner-Side Password Gate (Standalone Exams):**
- When `password_enabled=true`, learner must enter the proctor-provided code before `/exams/:id/take` loads.
- Verification calls RPC `verify_exam_password` which re-checks password + participant + time window server-side.
- Success is persisted in sessionStorage key `exam_pwd_verified_${examEventId}` — **per-tab, intentionally**. New tab = re-verify.
- `ExamPlayer` performs a client-side redirect back to detail if the flag is missing (defense-in-depth; the RPC is the real gate).
- Class-based exams (delivered via `assessment_templates`, not `exam_events`) are **not** gated — `passwordEnabled` does not apply to `ExamBriefing` / `ExamActivityContent`.

### Training Plans

```
CREATE → draft → pending_approval → scheduled → in_progress → completed / incomplete
           ↑           ↓                              ↓
           └───reject──┘                          cancelled
```

- `draft → pending_approval`: creator submits; picks named approver at submission time (must have `training-plans:approve` permission, cannot be self)
- `pending_approval → scheduled` (or `in_progress` if start_date passed): approver clicks Approve; Super Admin may also approve as escape hatch
- `pending_approval → draft`: approver rejects with mandatory reason (min 10 chars); reason persisted as `latest_rejection_reason` and shown in persistent banner to creator
- `scheduled → in_progress`: auto when plan start date arrives (auto-transition skips `pending_approval` plans)
- `in_progress → completed/incomplete`: auto on end date (completed if KPI met)
- Approval is **one-time** per plan — editing after approval is allowed but surfaces an "Edited after approval" warning; no re-approval flow
- Creator cannot withdraw; only approver or Super Admin can move a plan out of `pending_approval`
- Cancel from `pending_approval` is allowed for creator and Super Admin
- **Approval gate (enforced at UI, hook, AND database)** — The following transitions are forbidden via direct `UPDATE` and must go through the corresponding RPC:
  - `draft → scheduled`, `draft → in_progress`, `draft → pending_approval` → must use `submit_training_plan_for_approval`
  - `pending_approval → scheduled`, `pending_approval → in_progress` → must use `approve_training_plan`
  - `pending_approval → draft` → must use `reject_training_plan`
  - Enforcement: `training_plans_status_gate` trigger on `public.training_plans` + `v2.training_plans` (migration `20260707100000_enforce_training_plan_status_gate.sql`). The three approval RPCs set a transaction-local `app.training_plan_bypass_gate` flag to perform the legitimate move. Client hook `useUpdateTrainingPlanStatus` also refuses these pairs when `currentStatus` is supplied. See decisions-log entry "Training Plan approval gate enforced server-side (2026-04-21)".

### Categories & Skills

```
CREATE → active → archived
```

- 2-state only, no draft

---

## Skills vs Competencies (separate systems)

| Aspect | Skills | Competencies |
|---|---|---|
| Purpose | Developmental tracking | NĐ 44/2016 compliance certification |
| Attached to | Content tags + 5-level KN scale on users | 4-level scale, people assessment |
| Legal role | None | Required for safety/occupational cert |
| Scale | KN1–KN5 (Dreyfus-aligned) | 4-level compliance |

**Rule:** Skills are NOT competencies. Completing a skill-tagged course does NOT auto-assess competency — evaluator notification only. Do not merge the two models. Decided 2026-04-17.

### Skills Proficiency (KN scale)

```
KN1 Người mới bắt đầu → KN2 Đang phát triển → KN3 Đạt yêu cầu → KN4 Thành thạo → KN5 Chuyên gia
```

- Assignment: **manager-only**, via `UserSkillsTab` on `/users/:id`
- Downgrades require typed "HẠ CẤP" confirmation
- Tables: `user_skill_proficiencies` (current), `user_skill_proficiency_log` (append-only audit); mirrored in `public` + `v2`
- RPCs: `set_skill_proficiency`, `remove_skill_proficiency` (SECURITY DEFINER, atomic upsert+log)
- Learner view: read-only `/my-skills` with Luật ATVSLĐ banner + per-entry "Từ OJT — không có giá trị pháp lý" tag on `ojt_completion`-sourced rows
- **OJT finalization (updated 2026-09-19):** Optional per-template supervisor approval (`require_supervisor_approval`) and learner confirmation (`require_learner_confirmation`) gates. Mentor submits via `finalize_ojt_assignment` RPC, which routes to `supervisor_pending_approval` → `supervisor_review_ojt_assignment` (approve/reject) → optionally `learner_pending_confirmation` → mentee confirms via `finalize_ojt_assignment` → `approved`. Skill grant fires atomically when status reaches `approved` (whichever RPC drives the final transition), with keep-higher-level policy and `source = 'ojt_completion'`. Skill + both flags are snapshotted on `ojt_assignments` at creation. **Source of truth for the target level is `ojt_assignments.skill_level_id` (UUID FK)**, with legacy SMALLINT `skill_target_level` as fallback only for pre-FK assignments. **No KN3 acknowledgement gate** — removed 2026-09-19 (was vestigial post-`project_skill_levels_per_tenant_d1_reversal`; multi-step approval already provides verification). The `p_kn3_acknowledged` parameter remains in the RPC signature for back-compat but is ignored. Both `finalize_ojt_assignment` and `supervisor_review_ojt_assignment` (public + v2) follow the same skill-resolution + grant logic via migrations `20260918100000_finalize_ojt_use_skill_level_id_v2.sql` and `20260919110000_ojt_remove_kn3_gate_and_supervisor_skill_id_fix.sql`.
- **OJT placement (updated 2026-04-25):** OJT lives at the **program level** as a `program_items.item_type='ojt'` row, NOT as a `course_activities.activity_type='ojt_checklist'` (that scaffolding was removed in cleanup 2026-04-25 — `course_activities.activity_type` is now `subject_content | exam | survey` only). Per OJT program_item carries `ojt_template_id`, `mentor_id` (required), `supervisor_id` (optional, falls back to mentor), `due_offset_days`. When a learner is enrolled in a program, the trigger `trg_program_assignments_create_ojt_assignments` eagerly calls `create_ojt_assignment` for every OJT item — populating the mentor's queue automatically. Mentor entry point is queue-centric (`/mentor/ojt/queue` in vsf-learner) — flat list of pending evaluations across all programs (Cornerstone/SF pattern). Driven by NĐ 44/2016 Đ.19–21 audit-record requirements.
- **Skills Development Report (shipped 2026-04-24, `/reports/skills-development`):** 5-tab admin report backed by SQL views + RPCs. Content Impact tab is Admin-only. Compliance banner (non-dismissible) reinforces Skills ≠ Competencies per NĐ 44/2016. Hard vetos from L&D: no mentor/template leaderboards, no per-mentor dispute rates (aggregate template-level only, Admin-only), N<5 suppression on department %s, KN5 names Admin-only drill-down, `course_completion` source excluded (feature deferred).
- **Deferred (do NOT build without approval):** auto-inference from course completion, self-declaration, gap analysis
- Full spec: `vsf-lms/docs/business-logic/skills-proficiency-module.md`

---

## Class Supplementary Content (Phase 1)

Managers (department managers, not L&D) can add supplementary materials to a Class without editing the underlying Course.

**Hard constraints:**
1. Every Class still links to a Course — `course_id NOT NULL` stays (no standalone classes)
2. Managers cannot edit Course content (L&D's domain)
3. Supplementary content must NOT affect Course completion or certificate issuance
4. DB-level guardrail: `is_supplementary BOOLEAN NOT NULL DEFAULT true CHECK (is_supplementary = true)` on `class_content_items`
5. Certificate issuance reads ONLY from `course_activities` — never from class supplements
6. Learner UI separates "Nội dung khóa học" vs "Tài liệu bổ sung từ lớp học"

**Phase 2 (informal class assessments):** requires L&D approval gate before activation; results labeled "informal" and never count toward Course certificate. Decided 2026-04-09.

Full spec: `vsf-lms/docs/business-logic/class-supplementary-content.md`

---

## Assignment Resubmission (manual-graded gate)

Manual-graded assignments (essay, file upload) **block** new submissions until the previous submission is `graded` or `returned`. Auto-graded questions are unaffected.

**Enforce at BOTH layers:**
- Backend: reject at API level
- Learner UI: hide resubmit button, show "Bài nộp đang chờ chấm điểm"

**Why:** prevents feedback-loop bypass, grader-queue pollution, ambiguous Luật ATVSLĐ 2015 audit trail, and scoring-strategy gaming. The existing `returned` status + `return_reason` is the grader-initiated revision path. Decided 2026-04-07.

---

## Course Edit Rules (Post-Publish)

| What | Editable? | Notes |
|------|-----------|-------|
| Metadata (name, code, description, etc.) | ✅ Always | Regardless of status |
| Curriculum (modules, lessons) | ❌ No | Must version or clone |
| Completion rules (passing score) | ❌ No | Must version or clone |

---

## Delivery Modes

| Mode | Description |
|------|-------------|
| `instructor_led` | Traditional classroom, requires instructor + schedule |
| `self_paced` | Learner-driven, no fixed schedule. Auto-creates one default class |
| `blended` | Combination of both |

Use `supportsSelfPaced()` from `deliveryModeService.ts` to check.

---

## Permission Registry

Single source of truth: [vsf-lms/src/lib/permission-modules.ts](../../vsf-lms/src/lib/permission-modules.ts) — **30 modules** across 6 categories (`primary`, `content`, `training`, `assessment`, `operations`, `admin`). The file mirrors the AdminSidebar ordering exactly — add a sidebar entry, register the matching permission module, and seed role grants in the same migration.

**Seed role grants** live in `supabase/migrations/20260706120000_add_permissions_for_new_modules.sql` (most recent). New modules must ship with:
1. A registry entry in `permission-modules.ts`.
2. A locale string in `src/i18n/locales/{vi,en,id}/organization.json` under `roles.detail.moduleNames.<id>`.
3. An additive migration seeding `role_permissions` for Super Admin / Training Admin / Instructor / Learner on **both** `public` and `v2` schemas, using `INSERT ... ON CONFLICT (role_id, module, action) DO NOTHING`.

**Current grant policies worth knowing:**
- **Super Admin** is granted every action on every module.
- **Training Admin** gets full CRUD on content/training/operations modules, `view` on `reports` and `audit-log`, `view+update` on `skill-proficiency`, and **no** access to `gamification` (Super Admin only).
- **Instructor** gets read-mostly training access plus CRUD on `ojt-evaluations` and `classes:update`.
- **Learner** grants are view-only on discoverability modules (`learning-paths`, `skill-proficiency` for own).

Predicates in [usePermissions.ts](../../vsf-lms/src/hooks/usePermissions.ts) are the client-side gate (e.g., `canViewAuditLog`, `canConfigureGamification`, `canAssignSkillProficiency`). **RLS on the backing tables is the authoritative gate** — do not rely on client-side predicates alone.

---

## Two-Portal Architecture

| Portal | Purpose | Users |
|--------|---------|-------|
| **Admin** (`vsf-lms`) | Content mgmt, training ops, user admin, reporting | Admin, Manager, Instructor, Content Creator |
| **Learner** (`vsf-learner`) | Course consumption, progress, assessments, certificates | Learners/students |

**Key rule:** Admin Portal does NOT include learner-specific features (course progress, certificates earned, learning history). Admin users **manage** learners, they don't learn in this portal.

> **Note (2026-04-24):** `vsf-learner` is reframed as the **workforce app** — it hosts every non-back-office field persona, not just learners. Mentor (OJT) lives there now; future Teacher/Instructor and Observer roles will too, with role-gated nav. See `decisions-log.md → 2026-04-24 — vsf-learner Reframed as the Workforce App`.

---

## OJT (On-the-Job Training)

OJT is a first-class `program_item` (not a `course_activity`) — modeled to satisfy NĐ 44/2016 audit-record requirements. See `decisions-log.md → 2026-04-24 — OJT Promoted to First-Class program_item`.

### Assignment Lifecycle

```
CREATE → pending_mentor (only when admin defers mentor) ──claim──┐
       └ not_started ────────────────────────────────────────────┴→ in_progress → (mentor evaluates items)
                                                                       ↓
                                                                    awaiting_supervisor_approval (if require_supervisor_approval)
                                                                       ↓
                                                                    awaiting_learner_confirmation (if require_learner_confirmation)
                                                                       ↓
                                                                    approved
```

- Assignments are **eager-created at enrollment time** — one per mentee × OJT program_item, via trigger on `learner_classes` insert.
- Each assignment carries:
  - `event_date` + `start_time` + `end_time` (single calendar event — not a date range; see 2026-04-25 decision)
  - `company_id` (tenant scope), `code` — stable per-session identifier `OJT-NNNNNN` (admin-visible; never cleared), and `claim_code` — one-time 6-digit mentor-claim token (Learner-only; cleared on claim). See Deferred-mentor flow below and `decisions-log.md → 2026-05-14 (evening) — OJT code vs claim_code Split`.
  - `skill_level_id` FK referencing the tenant's `skill_levels` (per-tenant scale; see 2026-05-04 D1 reversal)
  - `require_supervisor_approval` and `require_learner_confirmation` (procedural booleans, **not** statuses)
- **Mentor finalize is allowed** (does not require admin) — see migration `20260914110000_ojt_finalize_allow_mentor.sql`.
- **Deferred-mentor flow (2026-05-12, refined 2026-05-14 evening):** admin may create an OJT with mentor unassigned via the "Chỉ định người hướng dẫn sau" toggle (Dev/v2 only — hidden in Stable view). The assignment is born in `pending_mentor` with `mentor_id IS NULL`, an `OJT-NNNNNN` `code` (stable identifier — admin-visible), AND a random 6-digit `claim_code` (mentor-claim token — Learner Portal only). The learner sees the `claim_code` in their Learner Portal OJT detail (`OjtClaimQrPanel` + status alert) and shows it to the on-site PIC. The PIC enters it at `/mentor/ojt/claim/:code` (or via "Nhập mã buổi OJT" in the OJT hub); the `claim_ojt_as_mentor` RPC matches by `claim_code`, atomically seals `mentor_id = caller`, transitions to `not_started`, sets `mentor_claimed_at`, and **clears `claim_code` to NULL** (one-time semantics, per migration `20261122100000`). The `code` identifier persists unchanged. Claim is restricted to same-company users; rejects self-claim and supervisor-as-mentor. Lockstep CHECK enforces `(mentor_id IS NULL) = (status = 'pending_mentor')`. The `claim_code` is never displayed in the Admin Portal; `code` is freely displayed in the Admin Portal. See `decisions-log.md → 2026-05-14 (evening) — OJT code vs claim_code Split`.

### Template Lock Model (Tier 1 / Tier 2)

Two-tier lock — see `decisions-log.md → 2026-05-06 — OJT Two-Tier Template Lock Model` for the full table.

- **Tier 1 (immutable post-issuance):** checklist items, areas, completion rule, skill, `worker_group`. Locked the moment any non-terminal assignment exists. Edits require **clone-to-edit** via `clone_ojt_template` RPC.
- **Tier 2 (mutable until first evaluation):** `require_supervisor_approval`, `require_learner_confirmation`. Locked when the first real `ojt_item_evaluations` row (result ≠ `not_evaluated`) is inserted. Until then, template edits prompt propagation via `propagate_ojt_template_policy` RPC.

### UI Rules

- The header status row on `OjtAssignmentDetail` shows **only the assignment status** — never render `require_supervisor_approval` / `require_learner_confirmation` as chips next to it. Those are policy flags, not statuses; they belong inside the General tab via `OjtApprovalProgress` and the state banners.

---

## Training Plans

Status lifecycle (extended 2026-04-21 with `pending_approval`):

```
draft → pending_approval → scheduled → in_progress → completed | incomplete
                              ↓
                          cancelled
```

- Submission picks a **named approver**; approval is one-time (the picked approver, not "any approver").
- **Super Admin escape**: Super Admin can approve any pending plan regardless of who was named.
- See `project_training_plan_approval_workflow.md` for the full flow.

---

## External Certificates

Refactored 2026-04-22 to a **person-level credential ledger** (SuccessFactors / Cornerstone style). See `project_external_certificates_decoupled.md`.

- Table renamed: `certificate_evidence_uploads` → `external_certificates`.
- Goal FK is **nullable** — credentials live at the person level, not strictly under a training-plan goal.
- Companion table `certificate_requests` (2026-04-23): admin-initiated ad-hoc/bulk "ask learner to submit cert" workflow with tracker. Treat this as **operational workflow**, not the compliance record itself — the certificate row is the record.
- Demo seed: migration `20260711200000_seed_external_cert_demo_data.sql` (idempotent, fixed UUIDs).

---

## Skills + Competencies

- **Skills** = content tags (course/program metadata).
- **Competencies** = people-assessment artifacts.
- These are intentionally separate concepts — see `project_skills_vs_competencies_decision.md`.
- **Per-tenant** as of 2026-05-04: each company defines its own skill catalog and KN level scale. There is no global skill catalog or fixed KN1–KN5 scale.

# Analytics Patterns — EduLMS

> Living document. Updated when analytics patterns are established or changed.
> Referenced by: `data-analyst`, `cto`, `system-architect`, `qa`

## Canonical Metric Definitions

### Completion Rate (Global)
- **Formula:** `completed_enrollments / (enrolled + in_progress + completed) enrollments`
- **Excludes:** `cancelled`, `dropped` — these are removed from the denominator to avoid deflating the rate
- **Granularity:** Per-class, per-course, per-department, global
- **Period:** Based on `enrollments.completed_at` for period-scoped views; unscoped for global rate
- **Edge case:** 0 enrollments → return 0%, not NaN
- **Reference implementation:** `useDashboardStats.ts` (admin), `computeOverallCompletion()` (learner)

### Completion Rate (Learner-Scoped)
- **Formula:** `completed_enrollments / total_enrollments` (for a single user)
- **Includes all statuses** in denominator (enrolled, in_progress, completed)
- **Reference implementation:** `useLearningStats.ts` → `computeOverallCompletion()`

### Pass Rate
- **Formula:** `passed_attempts / total_attempts` (per exam event)
- **Includes retakes** as separate attempts
- **Threshold:** `exam_event.passing_score` (configurable per exam)
- **Note:** A learner who fails then passes counts as 1 pass + 1 fail = 2 attempts

### Training Plan KPI Achievement
- **Formula:** `achieved_kpis / total_kpis` (per training plan)
- **Achieved:** `current_value >= target_value` AND `current_value IS NOT NULL`
- **Auto-computed** via `compute_training_plan_auto_kpis` RPC function
- **Dashboard shows:** Top 3 in-progress training plans, ordered by `updated_at` DESC
- **Reference implementation:** `useDashboardKPIs.ts`

### Active Learners
- **Definition:** Users with at least one enrollment in status `enrolled` or `in_progress`
- **Period:** Within the selected time range (based on enrollment `created_at`)
- **Deduplication:** Count unique user IDs, not enrollment count

### Certificates Issued
- **Formula:** `COUNT(certificates)` where `issued_at >= period_start`
- **Period-scoped** using `certificates.issued_at`
- **Reference implementation:** `useDashboardStats.ts`

### Total Study Time (Learner)
- **Formula:** `SUM(assessment_submissions.time_spent_seconds) / 3600`
- **Includes:** Submissions with status `submitted` or `graded`
- **Rounded:** To 1 decimal place
- **Reference implementation:** `useLearningStats.ts`

### KN3+ Coverage (CANONICAL — org-wide headcount definition)
- **Formula:** `users_with_at_least_one_skill_at_kn3_plus / total_active_users`
- **Grain:** Headcount, not assignments. One user with 5 skills at KN3+ counts once.
- **Denominator:** `total_active_users` = users in scope (not archived / deactivated). Excludes users with zero skill assignments from the numerator but INCLUDES them in the denominator (the "zero-skill-user" problem is a signal, not a suppression).
- **Source of truth:** `rpt_workforce_skill_coverage` view (single row). Fields: `total_active_users`, `users_with_any_skill`, `users_at_kn3_plus`, `zero_skill_users`, `depts_below_threshold_count`.
- **Hero-tile denominator on Skills Development Overview tab uses this view** — not `rpt_skill_overview_kpis` (assignment-grain, used only for Top-N + heatmap).
- **Rationale:** Assignment-grain coverage double-counts learners with many skills and underweights learners with few. Headcount-grain answers "what % of our workforce is KN3-ready" — the question executives actually ask.
- **Edge case:** 0 active users → return `null`, render "—", never "0%".
- **Reference implementation:** `useWorkforceSkillCoverage.ts` + `deriveWorkforceMetrics()` helper.

### Skill Events (Growth tab)
- **Formula:** `COUNT(user_skill_proficiency_log)` grouped by `(month, skill, source)` within the window.
- **`kn3_plus_events` field:** All events where `new_level >= 3` — includes both *new* KN3+ attainments and re-evaluations that stayed/landed at KN3+. Do NOT confuse with "new KN3+ attainments."
- **Historical note:** v1 named this field `kn3_plus_new` which was semantically wrong. Renamed in migration `20260716100000` → `kn3_plus_events`. Any new query against `rpt_skill_growth_monthly` uses the new name.
- **Source filter:** `course_completion` is excluded from both UI filter and chart/table output (feature deferred; zero would mislead).

### OJT Template Dispute Rate (Admin-only aggregate)
- **Formula:** `disputed_approved_assignments / approved_assignments` × 100
- **CRITICAL:** Denominator MUST be scoped to approved assignments. v1 divided by a broader set which allowed dispute rate to exceed 100%. Fixed in migration `20260716100000`.
- **Aggregate only** — never rendered per-mentor (L&D veto: would chill legitimate learner disputes).

## Chart Conventions

### Chart Type Selection

| Data Question | Chart Type | EduLMS Example |
|---------------|-----------|----------------|
| How does X change over time? | Line chart | Completion rate trend by month |
| How do categories compare? | Bar chart (vertical) | Learners by department |
| How do categories rank? | Bar chart (horizontal) | Course completion rates ranked |
| What is the composition? (< 6 parts) | Pie/donut chart | Enrollment status distribution |
| What is the composition? (>= 6 parts) | Stacked bar chart | Training plan status breakdown |
| What is the distribution? | Histogram | Exam score distribution (0-50, 50-70, 70-85, 85-100) |
| What is the progress toward target? | Progress bar or gauge | KPI achievement percentage |
| What is the trend + comparison? | Grouped bar chart | Courses/classes by month |

### Color Palette (Semantic)

| Meaning | Color | Usage |
|---------|-------|-------|
| Success / Completed | `hsl(142, 76%, 36%)` — green | Completion badges, pass indicators |
| Warning / In Progress | `hsl(38, 92%, 50%)` — amber | In-progress status, attention needed |
| Error / Failed | `hsl(0, 84%, 60%)` — red | Fail indicators, overdue alerts |
| Primary / Info | `hsl(217, 91%, 35%)` — blue | Primary metrics, links, default chart color |
| Neutral / Not Started | `hsl(var(--muted-foreground))` — gray | Not started, inactive, baseline |

### Recharts Tooltip Pattern

All charts must use consistent tooltip styling:
```tsx
<Tooltip
  contentStyle={{
    backgroundColor: "hsl(var(--card))",
    border: "1px solid hsl(var(--border))",
    borderRadius: "8px",
  }}
/>
```

### Chart Sizing

| Context | Height | Notes |
|---------|--------|-------|
| Standard chart in card | `h-64` (256px) to `h-72` (288px) | Most report charts |
| Donut/pie chart | `innerRadius={60} outerRadius={90}` | Standard donut proportions |
| Container | `<ResponsiveContainer width="100%" height="100%">` | Always use responsive wrapper |

## Query Patterns

### Time Period Filtering

```typescript
// Reference implementation: useDashboardStats.ts
type DashboardPeriod = "last30" | "thisMonth" | "thisQuarter" | "thisYear";

function getPeriodStart(period: DashboardPeriod): string {
  const now = new Date();
  switch (period) {
    case "last30":
      const d = new Date(now);
      d.setDate(d.getDate() - 30);
      return d.toISOString();
    case "thisMonth":
      return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    case "thisQuarter":
      const q = Math.floor(now.getMonth() / 3) * 3;
      return new Date(now.getFullYear(), q, 1).toISOString();
    case "thisYear":
      return new Date(now.getFullYear(), 0, 1).toISOString();
  }
}
```

### Aggregation Strategy by Data Size

| Estimated Rows | Strategy | Example |
|----------------|----------|---------|
| < 1K | Direct Supabase query, client-side aggregation | Training plan KPIs |
| 1K – 10K | Indexed columns, Supabase `.select()` with filters | Enrollment counts per class |
| 10K – 100K | Server-side aggregation via RPC or DB view | Learning progress by department |
| 100K+ | Materialized view or pre-computed summary table | Historical trends over years |

### Caching Strategy

| Query Type | staleTime | gcTime | Rationale |
|-----------|-----------|--------|-----------|
| Dashboard summary stats | 5 min | 10 min | Balance freshness vs. load |
| Report data (filtered) | 5 min | 10 min | Same as dashboard |
| KPI computation | 0 (refetch on demand) | 5 min | KPIs update on user action |
| Historical trends (past periods) | 15 min | 30 min | Historical data rarely changes |

### Monthly Grouping Pattern

```typescript
// Reference: useLearningStats.ts → groupByMonth()
// Slice completed_at to "YYYY-MM" for month bucketing
const month = record.completed_at.slice(0, 7); // "2026-03"
```

## Sample Data Migration Status

| Report | Data Status | Hook | Notes |
|--------|-------------|------|-------|
| Admin Dashboard | REAL DATA | `useDashboardStats`, `useDashboardKPIs`, `useDashboardClasses`, `useDashboardUpcoming`, `useDashboardAlerts` | Fully connected |
| Training Overview Report | SAMPLE DATA | — | Hardcoded mock data in component |
| Learning Progress Report | SAMPLE DATA | — | Hardcoded mock data in component |
| Exam Results Report | SAMPLE DATA | — | Hardcoded mock data in component |
| Training Plan Report | SAMPLE DATA | — | Hardcoded mock data in component |
| Learner Dashboard/Reports | REAL DATA | `useLearningStats`, `useLearningHistory` | Fully connected |
| **Skills Development Report** | **REAL DATA (v2 recut)** | 12 hooks under `src/hooks/reports/` | SQL-view-backed (`rpt_skill_*` + `rpt_workforce_skill_coverage`). 4 tabs (Overview / Organization / Sources / Growth). Content Impact retired. v2 UX recut shipped 2026-04-24 — see decisions-log. |
| **Skill Proficiency Report** | **REAL DATA** | `useSkillKnDistribution` | Thin distribution table, reuses the same view as Skills Development Overview tab |
| Report Filters | HARDCODED OPTIONS | — | Dropdowns use static arrays, not dynamic queries (Skills Development has its own dynamic filter bar) |

## Known Issues

1. **ReportFilters.tsx** — Department, course, class, and exam dropdowns use hardcoded sample arrays instead of dynamic Supabase queries
2. **No analytics-specific indexes** — Report queries will need index support as data grows
3. **class_enrollment_stats view** — Limited to per-class enrollment counts; doesn't support cross-entity analytics
4. **Report pages are 300+ lines** — Inline sample data inflates page size; extract to hooks when migrating to real data
5. **No data freshness indicator** — Users cannot see when report data was last computed
6. **Learner course progress approximation** — `completionPercent` uses rough estimates (completed=100%, in_progress=50%, else=0%) instead of actual lesson-level progress

---

## Skills Reporting RPCs (2026-05-05 / 2026-05-06)

Two new server-side report RPCs, both per-tenant:

| RPC | Purpose | Migration | Notes |
|-----|---------|-----------|-------|
| `rpt_skill_gap_list` | Per-person skill-gap list (current vs target) | `20260910100000_rpt_skill_gap_list.sql` | Follow-up `20260506100000_rpt_skill_gap_list_add_job_title.sql` adds `job_title` to the projection. Drives the Skill Gap report tab. |
| `rpt_multi_skill_matrix` | Cross-skill × person heatmap | `20260903100000_rpt_multi_skill_matrix.sql` | Follow-up `20260903100100_rpt_multi_skill_matrix_drop_facility.sql` removes the `facility` filter (out of scope for MVP). |

**Pattern:** both RPCs return tenant-filtered rows (callers do not pass `company_id` — RLS / `auth.uid()` resolves it) and are read by `useSkillGapList` / `useMultiSkillMatrix` style hooks under `src/hooks/reports/`.

**Caching:** treat as report queries — `staleTime: 5 min`, `gcTime: 10 min` per the table above.

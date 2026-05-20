# Analytics Patterns — Tài Sản Đấu Giá

> Living document. Updated when analytics patterns are established or changed.
> Referenced by: `data-analyst`, `cto`, `system-architect`, `qa`

---

## Market Report Structure

The marketplace has three report categories, accessible under `/report`:

| Route | Page | Data Source |
|-------|------|-------------|
| `/report` | `MarketReport` | Overview dashboard — summary KPIs |
| `/report/bds` | `MarketReportCategory` (slug=bds) | Bất động sản (Real estate) segment |
| `/report/opp` | `MarketReportCategory` (slug=opp) | Cơ hội đầu tư (Investment opportunity) |
| `/report/deep/outcomes` | `MarketReportOutcomes` | Auction outcomes & results |

**Current state:** All report pages render mock data from `src/lib/mock*Report.ts`. Real DB integration is pending.

### Deep Reports

Report periods are granular (month / quarter / year) and require a credit unlock per period. The unlock key format is `"{slug}:{periodId}"` where `periodId` follows the patterns:
- Month: `"2025-01"` through `"2025-12"`
- Quarter: `"2025-Q1"` through `"2025-Q4"`
- Year: `"2025"`

---

## Canonical Metric Definitions

### Total Auction Value

```
Metric: Total auction value in period
Formula: SUM(listing_price_sessions.final_price) WHERE auction_date IN period
Excludes: cancelled auctions, auctions without final_price
Granularity: Per period (month / quarter / year)
Source: listing_price_sessions table
Edge case: 0 auctions → return 0, not null
```

### Auction Count

```
Metric: Number of auctions in period
Formula: COUNT(listing_price_sessions) WHERE auction_date IN period
Granularity: Per period, per category slug, per province
```

### Success Rate

```
Metric: Percentage of auctions that sold
Formula: COUNT(sold auctions) / COUNT(all auctions in period)
Sold: final_price IS NOT NULL AND status = 'sold'
Edge case: 0 auctions in period → return null (render "—"), not 0%
```

### Average Price

```
Metric: Average auction price per m²
Formula: AVG(final_price / area_m2) WHERE sold in period
Excludes: Listings without area_m2
Edge case: No sold listings → return null
```

### Price Trend (Month-over-Month)

```
Metric: % change in average price vs prior period
Formula: (current_avg - prior_avg) / prior_avg * 100
Display: Positive = green upward arrow, Negative = red downward arrow
Edge case: No prior period data → show "—", no arrow
```

---

## Chart Type Selection

| Data Question | Chart Type | Example |
|---------------|-----------|---------|
| How does price change over time? | Line chart | Average price by month |
| How do categories compare in volume? | Bar chart (vertical) | Listing count by province |
| How do categories rank by value? | Bar chart (horizontal) | Top auction companies by value |
| What is the composition? (≤ 5 slices) | Pie / donut | Listing category breakdown |
| What is the composition? (> 5 slices) | Stacked bar | Province × category matrix |
| What is the price distribution? | Histogram / area chart | Price range distribution |
| What is a KPI progress? | Progress bar | Unlock rate, fill rate |

### Chart Rules

- Y-axis always starts at zero unless explicitly justified
- Green = positive/success, Red = negative/error, Amber = neutral/warning — consistent with design tokens
- Tooltip must show absolute value + formatted label (not just percentage)
- Every chart must have an empty state (no data) that renders a placeholder, not a broken axis

---

## Report Period Helpers

Located in `src/lib/reportPeriods.ts`:

- `parsePeriod(periodId)` — parses a period string, returns `{ kind: "month"|"quarter"|"year", year, index }`
- `expandUnlock(periodId)` — returns all sub-periods covered by an unlock (e.g., year → all 12 months + 4 quarters)
- `formatPeriodLabel(periodId)` — human-readable label for display

---

## Analytics Technology Stack

| Layer | Technology |
|-------|-----------|
| Charting | Recharts v2.15.4 |
| Data fetching | TanStack React Query v5 |
| Database | Supabase PostgreSQL (single `public` schema) |
| Caching | staleTime 5–15 min for report data |

---

## Query Performance Tiers

| Estimated rows | Strategy |
|---------------|----------|
| < 1K | Direct query, client-side aggregation |
| 1K–10K | Indexed columns, server-side filter |
| 10K–100K | RPC function or DB view |
| 100K+ | Materialized view (future) |

---

## Filter Architecture

Report filters should propagate to all chart widgets on the same page. Canonical filter state shape:

```typescript
interface ReportFilters {
  slug: string;          // report category
  periodId: string;      // selected period
  province?: string;     // optional geographic filter
  category?: string;     // listing category filter
}
```

All widgets on a report page receive the same filter context — never have a widget with its own independent filter that differs from the page-level selection.

---

## Scope Boundaries

| This Agent Owns | Other Agent Owns |
|-----------------|-----------------|
| Chart TYPE selection (bar vs line vs pie) | UI/UX owns chart styling |
| Metric formula correctness | CPO owns which metrics to show |
| Report query performance strategy | CTO owns code structure |
| Recommending indexes / views | System Architect designs the migration |
| Data accuracy across all surfaces | Domain Expert owns market data semantics |

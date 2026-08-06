// Định dạng báo cáo tuân thủ bồi dưỡng toàn sàn.
//
// RPC admin_cpd_report chỉ trả SỐ LIỆU THÔ đã gộp. Kết luận tuân thủ tính ở đây
// bằng CHÍNH engine mà portal dùng (`evaluateCpd`) — một quy tắc, hai người gọi.
// Nhờ vậy số "đã đạt" của một tổ chức trên /admin luôn khớp trang
// /portal/boi-duong của tổ chức đó.

import { evaluateCpd, summarize, type CpdEvaluation, type CpdSummary } from '@/lib/personnel/cpd'

export interface RawCpdRow {
  auctioneer_id: string
  organization_id: string
  auction_org_id: string | null
  org_name: string
  province: string | null
  full_name: string
  position: string
  license_number: string
  license_expiry_date: string | null
  /** Đã quy đổi theo danh mục — SQL làm số học, TS giữ quy tắc kết luận. */
  credited_hours: number | string
  /** Nhãn "Hình thức — Vai trò" của các hoạt động cho đạt cả năm. */
  full_year_forms: string[] | null
  records_total: number
  records_without_proof: number
  is_exempt: boolean
  /** Tên trường hợp miễn, RPC đã join sang cpd_exemption_reasons. */
  exempt_reason: string | null
}

export interface RawCpdReport {
  year: number
  rows: RawCpdRow[]
  truncated: boolean
  cap: number
}

export interface CpdPersonRow extends CpdEvaluation {
  auctioneerId: string
  organizationId: string
  orgName: string
  province: string
  fullName: string
  position: string
  licenseNumber: string
}

export interface CpdOrgRow {
  organizationId: string
  orgName: string
  province: string
  summary: CpdSummary
  people: CpdPersonRow[]
}

export interface CpdProvinceStat {
  province: string
  total: number
  compliant: number
  /** 0..100 */
  rate: number
}

export interface CpdReport {
  year: number
  truncated: boolean
  cap: number
  summary: CpdSummary
  people: CpdPersonRow[]
  orgs: CpdOrgRow[]
  /** Xếp tỉnh tuân thủ THẤP nhất lên đầu — báo cáo này để tìm chỗ có vấn đề. */
  byProvince: CpdProvinceStat[]
  /** Tổ chức có nhiều người chưa hoàn thành nhất. */
  worstOrgs: Array<{ orgName: string; province: string; pending: number; total: number }>
}

const UNKNOWN_PROVINCE = 'Không rõ'

const emptySummary = (): CpdSummary => ({
  total: 0, met: 0, short: 0, overdue: 0, exempt: 0,
  missingProof: 0, ratio: 0,
})

export function formatCpdReport(raw: RawCpdReport | undefined, year: number): CpdReport {
  if (!raw) {
    return {
      year, truncated: false, cap: 0, summary: emptySummary(),
      people: [], orgs: [], byProvince: [], worstOrgs: [],
    }
  }

  const now = new Date()
  const people: CpdPersonRow[] = raw.rows.map((r) => ({
    auctioneerId: r.auctioneer_id,
    organizationId: r.organization_id,
    orgName: r.org_name,
    province: r.province || UNKNOWN_PROVINCE,
    fullName: r.full_name,
    position: r.position,
    licenseNumber: r.license_number,
    ...evaluateCpd(
      {
        creditedHours: Number(r.credited_hours) || 0,
        fullYearForms: r.full_year_forms ?? [],
        isExempt: r.is_exempt,
        exemptReason: r.exempt_reason ?? undefined,
        recordsTotal: r.records_total,
        recordsWithoutProof: r.records_without_proof,
      },
      raw.year,
      now,
    ),
  }))

  // ── Gộp theo tổ chức ──────────────────────────────────────────────────────
  const orgMap = new Map<string, CpdOrgRow>()
  for (const p of people) {
    let o = orgMap.get(p.organizationId)
    if (!o) {
      o = {
        organizationId: p.organizationId,
        orgName: p.orgName,
        province: p.province,
        summary: emptySummary(),
        people: [],
      }
      orgMap.set(p.organizationId, o)
    }
    o.people.push(p)
  }
  const orgs = [...orgMap.values()]
    .map((o) => ({ ...o, summary: summarize(o.people) }))
    .sort((a, b) => a.summary.ratio - b.summary.ratio || a.orgName.localeCompare(b.orgName, 'vi'))

  // ── Gộp theo tỉnh ─────────────────────────────────────────────────────────
  const provMap = new Map<string, { total: number; compliant: number }>()
  for (const p of people) {
    const e = provMap.get(p.province) ?? { total: 0, compliant: 0 }
    e.total += 1
    if (p.status === 'DAT' || p.status === 'MIEN') e.compliant += 1
    provMap.set(p.province, e)
  }
  const byProvince: CpdProvinceStat[] = [...provMap.entries()]
    .map(([province, v]) => ({
      province,
      total: v.total,
      compliant: v.compliant,
      rate: v.total === 0 ? 0 : Math.round((v.compliant / v.total) * 100),
    }))
    // Tỉnh yếu nhất lên đầu; đồng hạng thì tỉnh đông người trước.
    .sort((a, b) => a.rate - b.rate || b.total - a.total)

  const worstOrgs = orgs
    .map((o) => ({
      orgName: o.orgName,
      province: o.province,
      pending: o.summary.short + o.summary.overdue,
      total: o.summary.total,
    }))
    .filter((o) => o.pending > 0)
    .sort((a, b) => b.pending - a.pending || b.total - a.total)
    .slice(0, 10)

  return {
    year,
    truncated: raw.truncated,
    cap: raw.cap,
    summary: summarize(people),
    people,
    orgs,
    byProvince,
    worstOrgs,
  }
}

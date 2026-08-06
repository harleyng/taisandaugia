// Đối chiếu nghĩa vụ bồi dưỡng chuyên môn, nghiệp vụ hằng năm của đấu giá viên.
// Căn cứ: Thông tư 19/2024/TT-BTP (hiệu lực 01/01/2025).
//
// MỘT ENGINE DUY NHẤT, neo theo NĂM DƯƠNG LỊCH. Cả trang bồi dưỡng của tổ chức,
// banner trong hồ sơ từng người, hồ sơ kết xuất lẫn báo cáo toàn sàn bên /admin
// đều đi qua đây. Hai đường tính song song là cách chắc chắn nhất để hai màn
// hình hiển thị hai con số khác nhau cho cùng một người.
//
// Lõi `evaluateCpd()` nhận một struct ĐÃ GỘP chứ không nhận sự kiện thô, để
// đường portal (gộp từ org_auctioneer_events) và đường admin (gộp sẵn trong SQL
// của admin_cpd_report) dùng chung đúng một quy tắc.
//
// CÁCH TÍNH GIỜ KHÔNG SỐNG Ở ĐÂY. Nó là master data admin quản lý — xem
// cpd-catalog.ts. Engine chỉ nhận một `CpdRuleResolver` và hỏi từng bản ghi
// "mày tính giờ hay đạt cả năm", nhờ vậy đổi quy tắc không phải phát hành app.

import type { DossierEvent } from '@/types/personnel'
import { creditedHoursOf, type CpdRuleResolver } from './cpd-catalog'

/** Điều 26.1 — tối thiểu 01 ngày làm việc/năm. */
export const MIN_CPD_HOURS_PER_YEAR = 8

/** Điều 26.3 — hạn nộp giấy tờ cho Sở Tư pháp. */
export const CPD_FILING_DEADLINE = { month: 12, day: 15 } as const

/** Điều 27.2 — Sở Tư pháp đăng danh sách hoàn thành nghĩa vụ. */
export const CPD_PUBLISH_DEADLINE = { month: 12, day: 31 } as const

export type CpdStatus = 'MIEN' | 'DAT' | 'CHUA_DU' | 'QUA_HAN'

export type CpdReason =
  | 'exempt'            // có bản ghi miễn cho năm đó (Điều 26.3)
  | 'full_year_form'    // có hoạt động được tính là hoàn thành cả năm
  | 'hours_met'         // đủ 8 giờ quy đổi
  | 'hours_short'       // thiếu giờ, năm còn đang chạy
  | 'year_closed'       // thiếu giờ và năm đã đóng

export type CpdWarningTier = 'none' | 'warning' | 'urgent' | 'critical'

export const CPD_STATUS_LABELS: Record<CpdStatus, string> = {
  MIEN: 'Được miễn',
  DAT: 'Đạt',
  CHUA_DU: 'Chưa đủ',
  QUA_HAN: 'Quá hạn',
}

export const CPD_REASON_LABELS: Record<CpdReason, string> = {
  exempt: 'Được miễn nghĩa vụ trong năm',
  full_year_form: 'Đã có hoạt động được tính là hoàn thành nghĩa vụ cả năm',
  hours_met: 'Đã đủ số giờ bồi dưỡng tối thiểu',
  hours_short: 'Chưa đủ số giờ bồi dưỡng tối thiểu',
  year_closed: 'Năm đã kết thúc mà chưa đủ số giờ',
}

/**
 * Số liệu đã gộp của MỘT người trong MỘT năm — đầu vào duy nhất của quy tắc.
 * Portal dựng từ sự kiện thô; admin nhận thẳng từ RPC admin_cpd_report.
 */
export interface CpdAggregate {
  /** Tổng giờ SAU quy đổi của các bản ghi tính theo giờ. */
  creditedHours: number
  /** Tên các hoạt động cho hoàn thành nghĩa vụ cả năm (Điều 26.2). */
  fullYearForms: string[]
  isExempt: boolean
  exemptReason?: string
  /** Tổng số bản ghi bồi dưỡng trong năm. */
  recordsTotal: number
  /** Bản ghi chưa đính kèm giấy tờ xác nhận (Điều 27.1). */
  recordsWithoutProof: number
}

export interface CpdEvaluation {
  year: number
  hours: number
  required: number
  status: CpdStatus
  reason: CpdReason
  /** Mức độ cảnh báo, leo thang theo thời điểm trong năm. */
  tier: CpdWarningTier
  hasFullYearForm: boolean
  fullYearForms: string[]
  isExempt: boolean
  exemptReason?: string
  /** Cờ PHỤ — không đổi `status`. Nhắc nghiệp vụ, không phải kết luận pháp lý. */
  missingProof: boolean
}

const emptyAggregate = (): CpdAggregate => ({
  creditedHours: 0,
  fullYearForms: [],
  isExempt: false,
  recordsTotal: 0,
  recordsWithoutProof: 0,
})

/**
 * Quy tắc, theo đúng thứ tự ưu tiên:
 *   1. Được miễn                                        → MIEN
 *   2. Có hoạt động "hoàn thành cả năm"                  → DAT
 *   3. Đủ 8 giờ quy đổi                                  → DAT
 *   4. Năm đã đóng mà chưa đủ                            → QUA_HAN
 *   5. Còn lại                                           → CHUA_DU
 *
 * `missingProof` là cờ phụ, cố ý KHÔNG đổi trạng thái: tính hợp lệ pháp lý do
 * Sở Tư pháp phán, hệ thống chỉ nhắc.
 */
export function evaluateCpd(
  agg: CpdAggregate,
  year: number,
  now: Date = new Date(),
): CpdEvaluation {
  const hasFullYearForm = agg.fullYearForms.length > 0
  const yearClosed = year < now.getFullYear()

  let status: CpdStatus
  let reason: CpdReason
  if (agg.isExempt) {
    status = 'MIEN'
    reason = 'exempt'
  } else if (hasFullYearForm) {
    status = 'DAT'
    reason = 'full_year_form'
  } else if (agg.creditedHours >= MIN_CPD_HOURS_PER_YEAR) {
    status = 'DAT'
    reason = 'hours_met'
  } else if (yearClosed) {
    status = 'QUA_HAN'
    reason = 'year_closed'
  } else {
    status = 'CHUA_DU'
    reason = 'hours_short'
  }

  return {
    year,
    hours: agg.creditedHours,
    required: MIN_CPD_HOURS_PER_YEAR,
    status,
    reason,
    tier: warningTier(status, year, now),
    hasFullYearForm,
    fullYearForms: agg.fullYearForms,
    isExempt: agg.isExempt,
    exemptReason: agg.exemptReason,
    missingProof: agg.recordsWithoutProof > 0,
  }
}

/**
 * Mức cảnh báo leo thang theo thời điểm trong năm. Dự án không có cron/email —
 * tính phía client, cùng lối với `expiringLicenses` trong useAuctioneers.
 *
 *   đến 30/9      none     — còn cả quý để thu xếp
 *   01/10 → 14/12 warning  — vào mùa, nên nhắc
 *   từ 15/12      urgent   — đã quá hạn nộp giấy tờ cho Sở Tư pháp (Điều 26.3)
 *   năm đã đóng   critical
 */
export function warningTier(status: CpdStatus, year: number, now: Date = new Date()): CpdWarningTier {
  if (status === 'DAT' || status === 'MIEN') return 'none'
  if (status === 'QUA_HAN') return 'critical'

  const filingDeadline = new Date(year, CPD_FILING_DEADLINE.month - 1, CPD_FILING_DEADLINE.day)
  if (now >= filingDeadline) return 'urgent'
  if (now >= new Date(year, 9, 1)) return 'warning'
  return 'none'
}

/**
 * Số giờ để HIỂN THỊ trên thanh tiến độ "x/8 giờ".
 *
 * Khác `hours` (giờ thực sự cộng vào mốc): hoạt động cho hoàn thành cả năm
 * đóng góp 0 giờ theo quy tắc, nhưng người dùng đọc bảng cần thấy tiến độ đã
 * đầy — hiện "0/8 giờ" bên cạnh trạng thái "Đạt" là mâu thuẫn ngay trên một
 * dòng. Cố ý TÁCH khỏi `hours` để không ai lỡ dùng con số này đi chấm.
 */
export const progressHours = (ev: CpdEvaluation): number =>
  ev.hasFullYearForm ? ev.required : ev.hours

/** Số ngày còn lại tới hạn 15/12 của năm; âm nghĩa là đã quá hạn. */
export function daysUntilFilingDeadline(year: number, now: Date = new Date()): number {
  const deadline = new Date(year, CPD_FILING_DEADLINE.month - 1, CPD_FILING_DEADLINE.day)
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((deadline.getTime() - today.getTime()) / 86_400_000)
}

// ─── Dựng CpdAggregate từ sự kiện thô (đường portal) ────────────────────────

/**
 * Chỉ lấy sự kiện TRAINING đã được gán hình thức — bản ghi đào tạo không thuộc
 * diện bồi dưỡng bắt buộc (vd chứng chỉ tốt nghiệp đào tạo nghề đấu giá) để
 * trống hình thức và không tính vào nghĩa vụ.
 *
 * Năm lấy từ `cpdYear`; bản ghi cũ chưa có thì suy từ `startedOn` để không ai
 * mất giờ đã khai trước khi module này ra đời.
 */
export const cpdEventYear = (e: DossierEvent): number | undefined =>
  e.cpdYear ?? (e.startedOn ? Number(e.startedOn.slice(0, 4)) : undefined)

export function isCpdRecord(e: DossierEvent): boolean {
  return e.eventType === 'TRAINING' && !!e.cpdActivityTypeId
}

export function cpdRecordsFor(events: DossierEvent[], year: number): DossierEvent[] {
  return events.filter((e) => isCpdRecord(e) && cpdEventYear(e) === year)
}

/** Diện miễn đã gộp — chỉ cần cái tên để in ra, id đã tra ở tầng trên. */
export interface CpdExemptInfo {
  reasonName?: string
}

export function aggregateCpd(
  events: DossierEvent[],
  year: number,
  resolve: CpdRuleResolver,
  exempt?: CpdExemptInfo,
  /** Nhãn hình thức của một bản ghi — chỉ dùng để liệt kê, không ảnh hưởng chấm. */
  labelOf: (e: DossierEvent) => string = () => '',
): CpdAggregate {
  const records = cpdRecordsFor(events, year)
  const agg = emptyAggregate()

  agg.isExempt = !!exempt
  agg.exemptReason = exempt?.reasonName
  agg.recordsTotal = records.length

  for (const r of records) {
    if (r.attachments.length === 0) agg.recordsWithoutProof += 1

    const rule = resolve(r)
    if (!rule) continue
    if (rule.mode === 'FULL_YEAR') {
      const label = labelOf(r)
      if (label && !agg.fullYearForms.includes(label)) agg.fullYearForms.push(label)
      // Không có nhãn (danh mục chưa về) vẫn phải được ghi nhận là đạt cả năm,
      // nếu không trạng thái sẽ tụt xuống "chưa đủ" — sai theo hướng nguy hiểm.
      else if (!label) agg.fullYearForms.push('Hoạt động được tính hoàn thành cả năm')
    } else {
      agg.creditedHours += creditedHoursOf(r, rule)
    }
  }

  return agg
}

/** Kết quả cho một người trong một năm, kèm chính các bản ghi đã tính. */
export interface CpdPersonYear extends CpdEvaluation {
  auctioneerId: string
  records: DossierEvent[]
}

export function evaluatePerson(
  auctioneerId: string,
  events: DossierEvent[],
  year: number,
  resolve: CpdRuleResolver,
  exempt?: CpdExemptInfo,
  labelOf: (e: DossierEvent) => string = () => '',
  now: Date = new Date(),
): CpdPersonYear {
  return {
    auctioneerId,
    records: cpdRecordsFor(events, year),
    ...evaluateCpd(aggregateCpd(events, year, resolve, exempt, labelOf), year, now),
  }
}

// ─── Tổng hợp cả đội ────────────────────────────────────────────────────────

export interface CpdSummary {
  total: number
  met: number
  short: number
  overdue: number
  exempt: number
  missingProof: number
  /** Tỉ lệ tuân thủ 0..1 — người được miễn tính là tuân thủ. */
  ratio: number
}

export function summarize(rows: CpdEvaluation[]): CpdSummary {
  const s: CpdSummary = {
    total: rows.length,
    met: 0,
    short: 0,
    overdue: 0,
    exempt: 0,
    missingProof: 0,
    ratio: 0,
  }
  for (const r of rows) {
    if (r.status === 'DAT') s.met += 1
    else if (r.status === 'MIEN') s.exempt += 1
    else if (r.status === 'QUA_HAN') s.overdue += 1
    else s.short += 1
    if (r.missingProof) s.missingProof += 1
  }
  s.ratio = s.total === 0 ? 0 : (s.met + s.exempt) / s.total
  return s
}

/** Các năm có thể chọn ở bộ lọc: từ năm hiện tại lùi về 4 năm. */
export function selectableYears(now: Date = new Date()): number[] {
  const y = now.getFullYear()
  return [y, y - 1, y - 2, y - 3, y - 4]
}

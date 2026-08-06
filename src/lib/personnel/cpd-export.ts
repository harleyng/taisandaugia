// Kết xuất danh sách tuân thủ bồi dưỡng ra CSV để đối chiếu / nộp Sở Tư pháp.
//
// KHÔNG trừ credit: đây là báo cáo tuân thủ nội bộ, khác với "Xuất hồ sơ nhân
// sự" (sản phẩm kết xuất theo mẫu, có tính phí ở useDossierExports).

import type { Auctioneer } from '@/types/auctioneer'
import { POSITION_LABELS } from '@/types/auctioneer'
import { CPD_STATUS_LABELS, type CpdPersonYear } from '@/lib/personnel/cpd'

const escape = (v: string | number): string => {
  const s = String(v ?? '')
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

const HEADERS = [
  'Họ và tên',
  'Chức vụ',
  'Số thẻ đấu giá viên',
  'Số giờ đã quy đổi',
  'Số giờ tối thiểu',
  // Ghi TÊN hoạt động chứ không phải cờ Có/Không: người đọc file này (Sở Tư
  // pháp, kiểm toán nội bộ) cần biết đạt nhờ hoạt động nào.
  'Hoạt động hoàn thành cả năm',
  'Diện miễn',
  'Trạng thái',
  'Thiếu giấy tờ xác nhận',
]

export function cpdRowsToCsv(
  rows: Array<CpdPersonYear & { name: string }>,
  roster: Auctioneer[],
): string {
  const byId = new Map(roster.map((a) => [a.id, a]))
  const lines = [HEADERS.join(',')]

  for (const r of rows) {
    const p = byId.get(r.auctioneerId)
    lines.push([
      escape(r.name),
      escape(p ? POSITION_LABELS[p.position] : ''),
      escape(p?.licenseNumber ?? ''),
      r.hours,
      r.required,
      escape(r.fullYearForms.join('; ')),
      escape(r.isExempt ? (r.exemptReason ?? 'Có') : ''),
      escape(
        r.status === 'DAT' && r.reason === 'full_year_form'
          ? 'Đạt (hoàn thành cả năm)'
          : CPD_STATUS_LABELS[r.status],
      ),
      escape(r.missingProof ? 'Có' : ''),
    ].join(','))
  }

  return lines.join('\n')
}

/** BOM UTF-8 để Excel không đọc tiếng Việt thành ký tự lỗi. */
export function downloadCpdCsv(csv: string, year: number): void {
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `boi-duong-dau-gia-vien-${year}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

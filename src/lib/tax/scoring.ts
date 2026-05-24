import type { TaxRecord } from '@/types/tax'

// T1-T3 (tháng 1-3) → dùng năm N-2
// T4+ (tháng 4-12) → dùng năm N-1
// Theo TT 19/2024/TT-BTP: vì quyết toán năm N-1 thường chưa xong trong Q1
export function getTargetYear(date?: Date): number {
  const d = date ?? new Date()
  return d.getMonth() < 3 ? d.getFullYear() - 2 : d.getFullYear() - 1
}

// Tính điểm Mục IV.9 từ danh sách records
export function calcMucIV9(records: TaxRecord[]): number {
  const targetYear = getTargetYear()
  const active = records.filter((r) => !r.isDeleted)
  const target = active.find((r) => r.year === targetYear)
  if (!target || target.amount <= 0) return 0
  return scoreFromAmount(target.amount)
}

// Preview score từ số tiền (dùng trong form live preview)
export function previewScore(amountVnd: number): number {
  if (amountVnd <= 0) return 0
  return scoreFromAmount(amountVnd)
}

function scoreFromAmount(amountVnd: number): number {
  const millions = amountVnd / 1_000_000
  if (millions >= 100) return 3
  if (millions >= 50) return 2
  return 1
}

// Coaching text hiển thị "còn bao nhiêu để lên điểm tiếp theo"
export function nextThresholdText(amountVnd: number): string | null {
  if (amountVnd <= 0) return 'Nhập số liệu để được tính điểm'
  const millions = amountVnd / 1_000_000
  if (millions >= 100) return null
  if (millions >= 50) {
    const diff = (100 - millions).toFixed(1)
    return `Còn ${diff} triệu nữa để đạt tối đa 3 điểm`
  }
  const diff = (50 - millions).toFixed(1)
  return `Còn ${diff} triệu nữa để lên 2 điểm`
}

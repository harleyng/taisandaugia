import { Info } from 'lucide-react'

interface Props {
  targetYear: number
}

export function TargetYearBanner({ targetYear }: Props) {
  const now = new Date()
  const month = now.getMonth() + 1 // 1-12
  const year = now.getFullYear()
  const rule = month <= 3 ? 'T1-T3 → dùng năm N-2' : 'T4+ → dùng năm N-1'

  return (
    <div className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm">
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
      <div>
        <span className="font-medium text-amber-900">Năm tính điểm: {targetYear}</span>
        <span className="ml-2 text-amber-700">
          (Nộp hồ sơ tháng {month}/{year} — {rule})
        </span>
        <p className="mt-0.5 text-amber-700">
          Chỉ dữ liệu năm {targetYear} được dùng để tính điểm Mục IV.9. Các năm khác lưu làm lịch sử.
        </p>
      </div>
    </div>
  )
}

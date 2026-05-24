import type { InfrastructureScoreBreakdown } from '@/types/infrastructure'

interface Props {
  total: number
  breakdown: InfrastructureScoreBreakdown
}

const SUB_SECTIONS = [
  { key: 'II_1_1' as const, label: 'Trụ sở', max: 1.5 },
  { key: 'II_1_2' as const, label: 'Tiếp nhận HS', max: 1.5 },
  { key: 'II_2_1' as const, label: 'Camera trụ sở', max: 2 },
  { key: 'II_2_2' as const, label: 'Camera phiên ĐG', max: 2 },
  { key: 'II_3' as const, label: 'Trang TTĐT', max: 4 },
  { key: 'II_4' as const, label: 'Trang ĐG TT', max: 4 },
  { key: 'II_5' as const, label: 'Lưu trữ', max: 4 },
]

export function ScoreProgressCard({ total: _total, breakdown }: Props) {
  return (
    <div className="rounded-xl border bg-white p-4">
      <p className="text-xs text-muted-foreground mb-3">Chi tiết điểm từng tiêu chí — Mục II</p>
      <div className="grid grid-cols-7 gap-1">
        {SUB_SECTIONS.map((s) => {
          const val = breakdown[s.key]
          const isMax = val >= s.max
          return (
            <div key={s.key} className="text-center space-y-1">
              <div
                className={`rounded-lg py-1 text-xs font-semibold ${
                  isMax ? 'bg-green-100 text-green-700' : val > 0 ? 'bg-amber-100 text-amber-700' : 'bg-muted text-muted-foreground'
                }`}
              >
                {val}/{s.max}
              </div>
              <p className="text-[9px] text-muted-foreground leading-tight">{s.label}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

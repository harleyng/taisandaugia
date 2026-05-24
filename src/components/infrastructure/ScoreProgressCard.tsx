import { Progress } from '@/components/ui/progress'
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

const MAX_TOTAL = 19

function progressColor(total: number) {
  if (total >= 15) return 'bg-green-500'
  if (total >= 10) return 'bg-amber-500'
  return 'bg-red-500'
}

export function ScoreProgressCard({ total, breakdown }: Props) {
  const pct = Math.round((total / MAX_TOTAL) * 100)

  return (
    <div className="rounded-2xl border bg-white p-5 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Mục II — Cơ sở vật chất</p>
          <p className="text-3xl font-bold">
            {total}
            <span className="text-lg font-normal text-muted-foreground">/{MAX_TOTAL} điểm</span>
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-sm font-medium text-white ${progressColor(total)}`}
        >
          {pct}%
        </span>
      </div>

      <div className="space-y-1">
        <Progress value={pct} className="h-3" />
        {total < MAX_TOTAL && (
          <p className="text-xs text-muted-foreground">
            Còn {MAX_TOTAL - total} điểm có thể đạt thêm
          </p>
        )}
      </div>

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

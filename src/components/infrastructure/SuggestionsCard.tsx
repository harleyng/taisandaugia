import { Lightbulb, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Suggestion } from '@/lib/infrastructure/suggestions'

interface Props {
  suggestions: Suggestion[]
  onNavigate: (sectionId: string) => void
}

const EFFORT_LABEL = {
  LOW: 'Dễ',
  MEDIUM: 'Trung bình',
  HIGH: 'Phức tạp',
} as const

const EFFORT_CLASS = {
  LOW: 'bg-green-100 text-green-700',
  MEDIUM: 'bg-amber-100 text-amber-700',
  HIGH: 'bg-red-100 text-red-700',
} as const

export function SuggestionsCard({ suggestions, onNavigate }: Props) {
  if (suggestions.length === 0) return null

  const top = suggestions.slice(0, 3)

  return (
    <div className="rounded-2xl border bg-amber-50 border-amber-200 p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Lightbulb className="h-4 w-4 text-amber-600" />
        <p className="text-sm font-medium text-amber-900">
          Hoàn thiện {suggestions.length} mục để tăng điểm
        </p>
      </div>

      <div className="space-y-2">
        {top.map((s) => (
          <div
            key={`${s.sectionId}-${s.title}`}
            className="flex items-center justify-between rounded-xl bg-white border border-amber-100 px-3 py-2"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-medium">{s.title}</p>
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${EFFORT_CLASS[s.effort]}`}
                >
                  {EFFORT_LABEL[s.effort]}
                </span>
                <span className="text-xs font-semibold text-green-700">+{s.pointsGain}đ</span>
              </div>
              <p className="text-xs text-muted-foreground truncate">{s.description}</p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0 text-amber-700"
              onClick={() => onNavigate(s.sectionId)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  )
}

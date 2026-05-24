import { useState } from 'react'
import { Info } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { ScoreBreakdownData } from '@/lib/portal/scoreBreakdowns'

interface Props {
  data: ScoreBreakdownData
}

export function ScoreBreakdownDialog({ data }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        aria-label="Xem cách tính điểm"
        className="inline-flex items-center justify-center h-5 w-5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        onClick={() => setOpen(true)}
      >
        <Info className="h-3.5 w-3.5" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base">
              Cách tính điểm — {data.muc}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 pt-1">
            {data.sections.map((section) => (
              <div key={section.muc}>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mr-2">
                      {section.muc}
                    </span>
                    <span className="text-sm font-semibold">{section.title}</span>
                  </div>
                  <span className="text-xs text-muted-foreground bg-muted rounded-full px-2 py-0.5 shrink-0 ml-3">
                    tối đa {section.maxPoints}đ
                  </span>
                </div>
                <div className="rounded-xl border divide-y overflow-hidden">
                  {section.criteria.map((c, i) => (
                    <div key={i} className="flex items-center justify-between gap-3 px-3 py-2">
                      <span className="text-xs text-muted-foreground flex-1">{c.label}</span>
                      <span className="text-xs font-semibold tabular-nums shrink-0">{c.points}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <div className="flex items-center justify-between pt-3 border-t">
              <span className="text-sm font-semibold">Tổng điểm {data.muc}</span>
              <span className="text-sm font-bold text-primary">{data.maxTotal}đ</span>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

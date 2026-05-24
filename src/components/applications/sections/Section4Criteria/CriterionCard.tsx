import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { SectionVCriterion, CriterionNature, CriterionMeets } from '@/types/application'
import { CheckCircle2, XCircle, HelpCircle, Trash2, RefreshCw } from 'lucide-react'
import { classifyCriterion } from '@/lib/applications/auto-detect'

interface Props {
  criterion: SectionVCriterion
  onChange: (updated: SectionVCriterion) => void
  onDelete: () => void
}

const NATURE_LABELS: Record<CriterionNature, string> = {
  CAPACITY: 'Năng lực',
  PROPOSAL: 'Phương án',
}

export function CriterionCard({ criterion, onChange, onDelete }: Props) {
  const detectedNature = classifyCriterion(criterion.label)

  function toggleNature() {
    const next: CriterionNature = criterion.nature === 'CAPACITY' ? 'PROPOSAL' : 'CAPACITY'
    onChange({ ...criterion, nature: next, natureAutoDetected: false })
  }

  function resetNature() {
    onChange({ ...criterion, nature: detectedNature, natureAutoDetected: true })
  }

  function setMeets(meets: CriterionMeets) {
    onChange({ ...criterion, meets })
  }

  const meetsIcon =
    criterion.meets === true ? (
      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
    ) : criterion.meets === false ? (
      <XCircle className="h-4 w-4 text-destructive" />
    ) : (
      <HelpCircle className="h-4 w-4 text-muted-foreground" />
    )

  const meetsLabel =
    criterion.meets === true ? 'Đáp ứng' : criterion.meets === false ? 'Không đáp ứng' : 'Chưa xác định'

  return (
    <div className="py-4 border-b border-border last:border-0">
      {/* Header */}
      <div className="flex items-start gap-2 mb-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground leading-snug">{criterion.label}</p>

          {/* Auto-match result */}
          {criterion.autoMatchResult?.matched && (
            <p className="text-xs text-primary mt-1">
              ✓ Hệ thống tìm thấy: {criterion.autoMatchResult.matchedItems.join(', ')}
            </p>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Nature badge */}
          <Badge
            variant="outline"
            className={`text-xs cursor-pointer select-none ${
              criterion.nature === 'CAPACITY' ? 'border-blue-300 text-blue-700' : 'border-violet-300 text-violet-700'
            }`}
            onClick={toggleNature}
            title="Click để đổi phân loại"
          >
            {NATURE_LABELS[criterion.nature]}
            {!criterion.natureAutoDetected && <span className="ml-1 opacity-60">(ghi đè)</span>}
          </Badge>

          {!criterion.natureAutoDetected && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={resetNature}
              title="Reset về auto-detect"
            >
              <RefreshCw className="h-3 w-3" />
            </Button>
          )}

          {/* Points */}
          <Badge className="text-xs bg-muted text-foreground">{criterion.maxPoints}đ</Badge>

          {/* Delete */}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
            onClick={onDelete}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Meets selector */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs text-muted-foreground shrink-0">Đáp ứng:</span>
        <div className="flex gap-1.5">
          <Button
            type="button"
            variant={criterion.meets === true ? 'default' : 'outline'}
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => setMeets(criterion.meets === true ? null : true)}
          >
            <CheckCircle2 className="h-3 w-3" /> Có
          </Button>
          <Button
            type="button"
            variant={criterion.meets === false ? 'destructive' : 'outline'}
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => setMeets(criterion.meets === false ? null : false)}
          >
            <XCircle className="h-3 w-3" /> Không
          </Button>
        </div>
        <div className="flex items-center gap-1 ml-auto">
          {meetsIcon}
          <span className="text-xs text-muted-foreground">{meetsLabel}</span>
        </div>
      </div>

      {/* Evidence textarea */}
      <Textarea
        value={criterion.evidence}
        onChange={(e) => onChange({ ...criterion, evidence: e.target.value })}
        rows={2}
        placeholder="Bằng chứng, căn cứ để đáp ứng tiêu chí này..."
        className="text-sm resize-none"
      />
    </div>
  )
}

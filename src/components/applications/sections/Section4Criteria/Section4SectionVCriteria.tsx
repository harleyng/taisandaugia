import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { SectionVCriterion } from '@/types/application'
import { CriterionCard } from './CriterionCard'
import { AddCriterionDialog } from './AddCriterionDialog'
import { Plus } from 'lucide-react'

interface Props {
  criteria: SectionVCriterion[]
  onChange: (criteria: SectionVCriterion[]) => void
}

export function Section4SectionVCriteria({ criteria, onChange }: Props) {
  const [addOpen, setAddOpen] = useState(false)

  const totalScore = criteria.filter((c) => c.meets === true).reduce((sum, c) => sum + c.maxPoints, 0)
  const totalMax = criteria.reduce((sum, c) => sum + c.maxPoints, 0)

  function handleChange(index: number, updated: SectionVCriterion) {
    const next = [...criteria]
    next[index] = updated
    onChange(next)
  }

  function handleDelete(index: number) {
    onChange(criteria.filter((_, i) => i !== index))
  }

  function handleAdd(criterion: SectionVCriterion) {
    onChange([...criteria, criterion])
  }

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Mục V: Tiêu chí khác</h2>
          <p className="text-xs text-muted-foreground">
            Thêm từng tiêu chí từ thông báo lựa chọn — tối đa 8 điểm (có thể vượt tùy thông báo)
          </p>
        </div>
        {criteria.length > 0 && (
          <span className="text-sm font-semibold text-emerald-600 shrink-0">
            {totalScore}/{totalMax}đ
          </span>
        )}
      </div>

      {criteria.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center text-muted-foreground">
          <p className="text-sm">Chưa có tiêu chí nào</p>
          <p className="text-xs mt-1">
            Thêm từng tiêu chí từ phần "Tiêu chí khác" trong thông báo lựa chọn
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {criteria.map((c, i) => (
            <CriterionCard
              key={c.id}
              criterion={c}
              onChange={(updated) => handleChange(i, updated)}
              onDelete={() => handleDelete(i)}
            />
          ))}
        </div>
      )}

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full gap-1.5 border-dashed"
        onClick={() => setAddOpen(true)}
      >
        <Plus className="h-4 w-4" />
        Thêm tiêu chí từ thông báo
      </Button>

      <AddCriterionDialog open={addOpen} onOpenChange={setAddOpen} onAdd={handleAdd} />
    </div>
  )
}

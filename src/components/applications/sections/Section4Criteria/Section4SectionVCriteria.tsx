import { useState } from 'react'
import { Card } from '@/components/ui/card'
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
      {criteria.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground border-dashed">
          <p className="text-sm">Chưa có tiêu chí nào</p>
          <p className="text-xs mt-1">
            Thêm từng tiêu chí từ phần "Tiêu chí khác" trong thông báo lựa chọn
          </p>
        </Card>
      ) : (
        <Card className="px-4 py-0 overflow-hidden">
          {criteria.length > 0 && (
            <div className="flex justify-end pt-3 pb-1">
              <span className="text-xs font-semibold text-emerald-600">{totalScore}/{totalMax}đ</span>
            </div>
          )}
          {criteria.map((c, i) => (
            <CriterionCard
              key={c.id}
              criterion={c}
              onChange={(updated) => handleChange(i, updated)}
              onDelete={() => handleDelete(i)}
            />
          ))}
        </Card>
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

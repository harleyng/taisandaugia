import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { SectionVCriterion, CriterionNature } from '@/types/application'
import { classifyCriterion } from '@/lib/applications/auto-detect'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAdd: (criterion: SectionVCriterion) => void
}

export function AddCriterionDialog({ open, onOpenChange, onAdd }: Props) {
  const [label, setLabel] = useState('')
  const [maxPoints, setMaxPoints] = useState('2')
  const [natureOverride, setNatureOverride] = useState<CriterionNature | null>(null)

  const detectedNature = label.trim() ? classifyCriterion(label) : 'CAPACITY'
  const nature = natureOverride ?? detectedNature
  const isOverridden = natureOverride !== null

  function handleAdd() {
    if (!label.trim()) return
    const criterion: SectionVCriterion = {
      id: crypto.randomUUID(),
      label: label.trim(),
      maxPoints: Math.max(1, parseInt(maxPoints) || 1),
      nature,
      natureAutoDetected: !isOverridden,
      meets: null,
      evidence: '',
      attachedDocIds: [],
    }
    onAdd(criterion)
    setLabel('')
    setMaxPoints('2')
    setNatureOverride(null)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold">+ Thêm tiêu chí từ thông báo</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="criterion-label">Nội dung tiêu chí (từ thông báo)</Label>
            <Input
              id="criterion-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="VD: Tổ chức đã từng đấu giá QSDĐ tại địa bàn tỉnh X"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="max-points">Điểm tối đa (theo thông báo)</Label>
            <Input
              id="max-points"
              type="number"
              min={1}
              max={20}
              value={maxPoints}
              onChange={(e) => setMaxPoints(e.target.value)}
              className="w-28"
            />
          </div>

          {label.trim() && (
            <div className="space-y-2">
              <Label>Phân loại tiêu chí</Label>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant={nature === 'CAPACITY' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setNatureOverride('CAPACITY')}
                >
                  Năng lực
                </Button>
                <Button
                  type="button"
                  variant={nature === 'PROPOSAL' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setNatureOverride('PROPOSAL')}
                >
                  Phương án
                </Button>
                {isOverridden && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-xs text-muted-foreground"
                    onClick={() => setNatureOverride(null)}
                  >
                    Reset (auto: {detectedNature === 'CAPACITY' ? 'Năng lực' : 'Phương án'})
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {isOverridden ? 'Đã ghi đè auto-detect' : 'Tự động phân loại từ nội dung tiêu chí'}
              </p>
            </div>
          )}
        </div>

        <div className="flex gap-2 pt-2">
          <Button onClick={handleAdd} disabled={!label.trim()} className="flex-1">
            Thêm tiêu chí
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Hủy
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

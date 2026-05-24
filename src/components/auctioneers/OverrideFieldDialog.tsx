import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { AlertTriangle } from 'lucide-react'
import { FIELD_LABELS } from '@/types/auctioneer'

interface Props {
  open: boolean
  field: string
  originalValue: string
  onConfirm: (newValue: string, reason: string) => void
  onCancel: () => void
}

export function OverrideFieldDialog({ open, field, originalValue, onConfirm, onCancel }: Props) {
  const [newValue, setNewValue] = useState('')
  const [reason, setReason] = useState('')

  const fieldLabel = FIELD_LABELS[field] ?? field
  const canConfirm = newValue.trim().length > 0 && reason.trim().length > 0

  const handleConfirm = () => {
    if (!canConfirm) return
    onConfirm(newValue.trim(), reason.trim())
    setNewValue('')
    setReason('')
  }

  const handleOpenChange = (o: boolean) => {
    if (!o) {
      setNewValue('')
      setReason('')
      onCancel()
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-sm">Sửa: {fieldLabel}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="rounded-lg bg-muted/50 px-3 py-2 text-xs space-y-1">
            <p className="text-muted-foreground">Giá trị từ Cổng QG</p>
            <p className="font-medium text-foreground">{originalValue || '(trống)'}</p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Giá trị mới</Label>
            <Input
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              placeholder="Nhập giá trị đúng..."
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">
              Lý do sửa <span className="text-destructive">*</span>
            </Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="VD: Tên đệm bị sai chính tả, đã xác minh với CCCD..."
              rows={2}
            />
          </div>

          <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/5 px-3 py-2">
            <AlertTriangle className="h-3.5 w-3.5 text-warning shrink-0 mt-0.5" />
            <p className="text-xs text-warning leading-snug">
              Tôi xác nhận thông tin này khác với Cổng QG và sẽ được lưu như dữ liệu override.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={onCancel}>Huỷ</Button>
          <Button size="sm" onClick={handleConfirm} disabled={!canConfirm}>
            Xác nhận sửa
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

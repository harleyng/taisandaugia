import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

const REASONS = [
  'Ngoài địa bàn hoạt động',
  'Không đủ nhân sự trong thời gian kỳ vọng',
  'Giá khởi điểm chưa phù hợp',
  'Pháp lý chưa rõ ràng',
  'Khác',
]

interface DeclineDialogProps {
  title?: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (reason: string) => void
  isPending: boolean
}

/** Từ chối một yêu cầu ký gửi: chọn một lý do có sẵn, ghi chú thêm nếu cần. */
export function DeclineDialog({ title, open, onOpenChange, onConfirm, isPending }: DeclineDialogProps) {
  const [reason, setReason] = useState(REASONS[0])
  const [note, setNote] = useState('')

  useEffect(() => {
    if (!open) return
    setReason(REASONS[0])
    setNote('')
  }, [open])

  const submit = () => {
    const extra = note.trim()
    onConfirm(extra ? `${reason} — ${extra}` : reason)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Từ chối yêu cầu</DialogTitle>
          <DialogDescription>
            {title ? `${title}. ` : ''}Chủ tài sản sẽ thấy lý do bạn chọn.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3.5">
          <div role="radiogroup" aria-label="Lý do từ chối" className="flex flex-wrap gap-2">
            {REASONS.map((r) => (
              <label
                key={r}
                className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-2.5 py-2 text-[13px] has-[:checked]:border-primary"
              >
                <input
                  type="radio"
                  name="decline-reason"
                  value={r}
                  checked={reason === r}
                  onChange={() => setReason(r)}
                  className="accent-primary"
                />
                {r}
              </label>
            ))}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="decline-note">Ghi chú thêm</Label>
            <Textarea
              id="decline-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Không bắt buộc"
              className="min-h-[84px]"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Huỷ
          </Button>
          <Button variant="destructive" onClick={submit} disabled={isPending} className="gap-2">
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Từ chối yêu cầu
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

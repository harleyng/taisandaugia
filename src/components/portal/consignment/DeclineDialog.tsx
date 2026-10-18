import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const REASONS = [
  'Ngoài địa bàn hoạt động',
  'Không đủ nhân sự trong thời gian kỳ vọng',
  'Giá khởi điểm chưa phù hợp',
  'Pháp lý chưa rõ ràng',
]
const OTHER = 'Khác'

interface DeclineDialogProps {
  title?: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (reason: string) => void
  isPending: boolean
}

/** Từ chối một yêu cầu ký gửi: chọn một lý do có sẵn, hoặc "Khác" rồi tự nhập lý do. */
export function DeclineDialog({ title, open, onOpenChange, onConfirm, isPending }: DeclineDialogProps) {
  const [reason, setReason] = useState('')
  const [other, setOther] = useState('')

  useEffect(() => {
    if (!open) return
    setReason('')
    setOther('')
  }, [open])

  const isOther = reason === OTHER
  const finalReason = isOther ? other.trim() : reason
  const submit = () => {
    if (finalReason) onConfirm(finalReason)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Từ chối yêu cầu</DialogTitle>
          {title && <DialogDescription>{title}</DialogDescription>}
        </DialogHeader>

        <div className="flex flex-col gap-3.5">
          <div className="space-y-1.5">
            <Label htmlFor="decline-reason">
              Lý do từ chối <span className="text-destructive">*</span>
            </Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger id="decline-reason">
                <SelectValue placeholder="Chọn lý do" />
              </SelectTrigger>
              <SelectContent>
                {[...REASONS, OTHER].map((r) => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {isOther && (
            <div className="space-y-1.5">
              <Label htmlFor="decline-other">
                Lý do khác <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="decline-other"
                value={other}
                onChange={(e) => setOther(e.target.value)}
                placeholder="Nhập lý do từ chối"
                className="min-h-[84px]"
                autoFocus
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Huỷ
          </Button>
          <Button variant="destructive" onClick={submit} disabled={isPending || !finalReason} className="gap-2">
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Từ chối yêu cầu
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

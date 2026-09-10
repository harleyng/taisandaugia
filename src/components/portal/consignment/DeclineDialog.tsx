import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

interface DeclineDialogProps {
  title?: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (reason: string) => void
  isPending: boolean
}

/** Từ chối một yêu cầu ký gửi. Lý do là tuỳ chọn nhưng được khuyến khích. */
export function DeclineDialog({ title, open, onOpenChange, onConfirm, isPending }: DeclineDialogProps) {
  const [reason, setReason] = useState('')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Từ chối yêu cầu</DialogTitle>
          <DialogDescription>
            {title
              ? `Từ chối nhận ký gửi "${title}". Chủ tài sản sẽ thấy lý do bạn nêu.`
              : 'Chủ tài sản sẽ thấy lý do bạn nêu.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label htmlFor="decline-reason">Lý do (tuỳ chọn)</Label>
          <Textarea
            id="decline-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ví dụ: tài sản ngoài địa bàn hoạt động, đang quá tải lịch phiên…"
            className="min-h-[90px]"
          />
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isPending}>
            Quay lại
          </Button>
          <Button variant="destructive" onClick={() => onConfirm(reason.trim())} disabled={isPending} className="gap-2">
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Từ chối yêu cầu
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

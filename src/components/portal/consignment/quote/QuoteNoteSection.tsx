import { Paperclip, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'

export const MAX_DOC_BYTES = 10 * 1024 * 1024
const DOC_TYPES = ['application/pdf', 'image/jpeg', 'image/png']

interface Props {
  note: string
  onNoteChange: (v: string) => void
  file: File | null
  onFileChange: (f: File | null) => void
  /** Tệp đã gửi ở lần báo giá trước — giữ nguyên nếu không chọn tệp mới. */
  existingDocPath: string | null
}

/** C. Ghi chú & tệp đính kèm. */
export function QuoteNoteSection({ note, onNoteChange, file, onFileChange, existingDocPath }: Props) {
  const pickFile = (f: File | null) => {
    if (!f) return onFileChange(null)
    if (!DOC_TYPES.includes(f.type)) {
      toast.error('Chỉ nhận tệp PDF, JPG hoặc PNG.')
      return
    }
    if (f.size > MAX_DOC_BYTES) {
      toast.error('Tệp vượt quá 10MB.')
      return
    }
    onFileChange(f)
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="q-note">Ghi chú</Label>
        <Textarea
          id="q-note"
          value={note}
          onChange={(e) => onNoteChange(e.target.value)}
          placeholder="Điều kiện kèm theo, cam kết, lý do đề xuất khác với mong muốn của chủ tài sản…"
          className="min-h-[100px]"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="q-file">Tệp báo giá (PDF/JPG/PNG, ≤ 10MB)</Label>
        {file ? (
          <div className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
            <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="flex-1 truncate">{file.name}</span>
            <button
              type="button"
              onClick={() => onFileChange(null)}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Bỏ tệp đính kèm"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <Input
            id="q-file"
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
          />
        )}
        {!file && existingDocPath && (
          <p className="text-xs text-muted-foreground">Đang giữ tệp đã gửi lần trước.</p>
        )}
      </div>
    </div>
  )
}

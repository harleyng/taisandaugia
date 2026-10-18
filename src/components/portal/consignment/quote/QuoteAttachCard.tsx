import { useState } from 'react'
import { FileText, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { DetailCard } from '../detail/DetailCard'
import { Field, Hint } from './parts'

const MAX_DOC_BYTES = 10 * 1024 * 1024
const DOC_EXT = /\.(pdf|jpe?g|png)$/i

interface Props {
  note: string
  onNote: (v: string) => void
  file: File | null
  onFile: (f: File | null) => void
  /** Tệp đã gửi ở lần báo giá trước — giữ nguyên nếu không chọn tệp mới. */
  hasExistingDoc: boolean
}

const sizeMb = (bytes: number) => `${(bytes / 1048576).toFixed(1).replace('.', ',')} MB`

/** "Ghi chú & tệp đính kèm" — tệp báo giá kéo thả, PDF/JPG/PNG ≤ 10MB. */
export function QuoteAttachCard({ note, onNote, file, onFile, hasExistingDoc }: Props) {
  const [dragging, setDragging] = useState(false)

  const pick = (f: File | undefined) => {
    if (!f) return
    if (!DOC_EXT.test(f.name)) toast.error('Chỉ nhận PDF, JPG, PNG.')
    else if (f.size > MAX_DOC_BYTES) toast.error('Tệp vượt quá 10MB.')
    else onFile(f)
  }

  return (
    <DetailCard icon={FileText} title="Ghi chú & tệp đính kèm">
      <Field label="Ghi chú" htmlFor="q-note">
        <Textarea
          id="q-note"
          className="h-[120px]"
          placeholder="Điều kiện kèm theo, cam kết, lý do đề xuất khác với mong muốn của chủ tài sản…"
          value={note}
          onChange={(e) => onNote(e.target.value)}
        />
      </Field>

      <Field label="Tệp báo giá">
        {file ? (
          <div className="flex items-center gap-3 rounded-xl border border-border py-2.5 pl-2.5 pr-2">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-destructive/[0.08] font-mono text-[10.5px] font-semibold tracking-[0.03em] text-destructive">
              {(file.name.split('.').pop() ?? '').toUpperCase()}
            </span>
            <div className="flex min-w-0 flex-1 flex-col">
              <b className="truncate text-sm font-medium">{file.name}</b>
              <small className="text-xs text-muted-foreground">{sizeMb(file.size)} · Đính kèm vào báo giá</small>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Bỏ tệp"
              className="h-9 w-9 text-destructive hover:bg-destructive/[0.08] hover:text-destructive"
              onClick={() => onFile(null)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <label
            htmlFor="q-file"
            onDragOver={(e) => {
              e.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragging(false)
              pick(e.dataTransfer.files[0])
            }}
            className={cn(
              'flex cursor-pointer flex-col items-center gap-1.5 rounded-xl border-[1.5px] border-dashed border-border px-4 py-5 text-center text-sm text-muted-foreground transition-colors hover:border-primary hover:bg-primary/[0.04]',
              dragging && 'border-primary bg-primary/[0.04]',
            )}
          >
            <span className="mb-0.5 grid h-9 w-9 place-items-center rounded-[10px] bg-muted">
              <FileText className="h-4 w-4" />
            </span>
            <span>
              <b className="font-semibold text-primary">Chọn tệp</b> hoặc kéo thả vào đây
            </span>
            <small className="text-xs">PDF, JPG, PNG · tối đa 10MB</small>
            <input
              id="q-file"
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              className="sr-only"
              onChange={(e) => {
                pick(e.target.files?.[0])
                e.target.value = ''
              }}
            />
          </label>
        )}
        {!file && hasExistingDoc && <Hint>Đang giữ tệp đã gửi lần trước.</Hint>}
      </Field>
    </DetailCard>
  )
}

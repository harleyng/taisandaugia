import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { FileText, Loader2, Trash2, Upload, Eye } from 'lucide-react'
import {
  uploadDocFile,
  deleteDocFile,
  getDocSignedUrl,
  MAX_DOC_BYTES,
} from '@/lib/personnel/storage'

interface Props {
  organizationId: string
  auctioneerId: string
  /** Danh sách PATH trong bucket private (không phải URL). */
  value: string[]
  onChange: (paths: string[]) => void
  disabled?: boolean
}

/**
 * Tải giấy tờ lên bucket PRIVATE `personnel-docs`.
 *
 * Không dùng lại AssetDocUpload được vì component đó neo cứng bucket
 * 'asset-docs' và tiền tố `${userId}/`; hồ sơ nhân sự phải nằm dưới
 * `${organizationId}/` để đồng nghiệp cùng tổ chức đọc được.
 */
export function PersonnelFileUpload({
  organizationId,
  auctioneerId,
  value,
  onChange,
  disabled,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return
    setBusy(true)
    try {
      const uploaded: string[] = []
      for (const file of Array.from(files)) {
        if (file.size > MAX_DOC_BYTES) {
          toast.error(`"${file.name}" vượt quá 10MB.`)
          continue
        }
        uploaded.push(await uploadDocFile(organizationId, auctioneerId, file))
      }
      if (uploaded.length) {
        onChange([...value, ...uploaded])
        toast.success(`Đã tải lên ${uploaded.length} tệp.`)
      }
    } catch {
      toast.error('Tải tệp thất bại. Vui lòng thử lại.')
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function handlePreview(path: string) {
    const url = await getDocSignedUrl(path)
    if (url) window.open(url, '_blank', 'noopener')
    else toast.error('Không mở được tệp.')
  }

  async function handleRemove(path: string) {
    onChange(value.filter((p) => p !== path))
    // Xoá file vật lý là best-effort: metadata đã bỏ tham chiếu rồi, một file
    // mồ côi trong bucket không nên làm hỏng thao tác của người dùng.
    try { await deleteDocFile(path) } catch { /* bỏ qua */ }
  }

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp,application/pdf"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      {value.length > 0 && (
        <div className="divide-y rounded-lg border">
          {value.map((path) => (
            <div key={path} className="flex items-center gap-2 px-3 py-2">
              <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="flex-1 min-w-0 truncate text-xs">
                {path.split('/').pop()}
              </span>
              <Button type="button" variant="ghost" size="sm" onClick={() => handlePreview(path)}>
                <Eye className="h-3.5 w-3.5" />
              </Button>
              {!disabled && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  onClick={() => handleRemove(path)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {!disabled && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
          Tải tệp lên
        </Button>
      )}
      <p className="text-xs text-muted-foreground">PDF, JPG, PNG — tối đa 10MB mỗi tệp.</p>
    </div>
  )
}

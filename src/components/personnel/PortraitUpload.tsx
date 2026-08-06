import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Loader2, UserRound } from 'lucide-react'
import { uploadPortrait, MAX_PORTRAIT_BYTES } from '@/lib/personnel/storage'

interface Props {
  organizationId: string
  auctioneerId: string
  value?: string
  onChange: (url: string) => void
}

/**
 * Ảnh chân dung — bucket PUBLIC, lưu URL trực tiếp.
 * Đây là trường duy nhất trong hồ sơ đi ra ngoài công khai, nên không thể dùng
 * signed URL: khách vãng lai không đăng nhập thì không mint được.
 */
export function PortraitUpload({ organizationId, auctioneerId, value, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  async function handleFile(file: File | undefined) {
    if (!file) return
    if (file.size > MAX_PORTRAIT_BYTES) {
      toast.error('Ảnh vượt quá 5MB.')
      return
    }
    setBusy(true)
    try {
      onChange(await uploadPortrait(organizationId, auctioneerId, file))
      toast.success('Đã cập nhật ảnh chân dung.')
    } catch {
      toast.error('Tải ảnh thất bại.')
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="flex items-center gap-4">
      <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl border bg-secondary">
        {value ? (
          <img src={value} alt="Ảnh chân dung" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <UserRound className="h-8 w-8 text-muted-foreground" />
          </div>
        )}
      </div>
      <div className="space-y-1.5">
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          className="gap-1.5"
          onClick={() => inputRef.current?.click()}
        >
          {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {value ? 'Đổi ảnh' : 'Tải ảnh chân dung'}
        </Button>
        <p className="text-xs text-muted-foreground">
          JPG/PNG, tối đa 5MB. Ảnh này sẽ hiển thị công khai nếu bạn bật chia sẻ hồ sơ.
        </p>
      </div>
    </div>
  )
}

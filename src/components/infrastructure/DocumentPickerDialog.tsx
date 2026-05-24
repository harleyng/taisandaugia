import { useEffect, useState } from 'react'
import { CheckCircle2, FolderOpen, Loader2, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { supabase } from '@/integrations/supabase/client'
import { listDocuments, getDocument } from '@/lib/documents/storage'
import type { DocumentListItem } from '@/types/document'
import type { PhotoAttachment } from '@/types/infrastructure'

const BUCKET = 'org-documents'

interface DocWithUrl {
  item: DocumentListItem
  storagePath: string
  signedUrl: string | null
}

interface Props {
  open: boolean
  alreadyLinked: string[]
  onClose: () => void
  onSelect: (photos: PhotoAttachment[]) => void
}

export function DocumentPickerDialog({ open, alreadyLinked, onClose, onSelect }: Props) {
  const [docs, setDocs] = useState<DocWithUrl[]>([])
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!open) return
    setSelected(new Set())
    setQuery('')
    loadDocs()
  }, [open])

  async function loadDocs() {
    setLoading(true)
    const items = listDocuments().filter(
      (d) => d.mimeCategory === 'IMAGE' && !d.deletedAt,
    )

    const withUrls = await Promise.all(
      items.map(async (item) => {
        const full = getDocument(item.id)
        const storagePath = full?.storagePath ?? ''
        let signedUrl: string | null = null
        if (storagePath) {
          const { data } = await supabase.storage
            .from(BUCKET)
            .createSignedUrl(storagePath, 3600)
          signedUrl = data?.signedUrl ?? null
        }
        return { item, storagePath, signedUrl }
      }),
    )

    setDocs(withUrls)
    setLoading(false)
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handleConfirm() {
    const now = new Date().toISOString()
    const photos: PhotoAttachment[] = docs
      .filter((d) => selected.has(d.item.id))
      .map((d) => ({
        id: crypto.randomUUID(),
        documentId: d.item.id,
        storagePath: d.storagePath,
        url: d.signedUrl ?? undefined,
        fileName: d.item.originalFilename,
        fileSize: d.item.sizeBytes,
        uploadedAt: now,
        width: 0,
        height: 0,
      }))
    onSelect(photos)
    onClose()
  }

  const filtered = docs.filter(
    (d) =>
      !alreadyLinked.includes(d.item.id) &&
      d.item.displayName.toLowerCase().includes(query.toLowerCase()),
  )

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderOpen className="h-4 w-4" />
            Chọn từ Tủ tài liệu
          </DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm kiếm ảnh..."
            className="pl-8 h-8 text-sm"
          />
        </div>

        <div className="min-h-[240px] max-h-[400px] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-40 gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">Đang tải...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-2 text-muted-foreground">
              <FolderOpen className="h-8 w-8" />
              <p className="text-sm">
                {docs.length === 0
                  ? 'Chưa có ảnh nào trong Tủ tài liệu'
                  : 'Không tìm thấy ảnh phù hợp'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 p-1">
              {filtered.map(({ item, signedUrl }) => {
                const isSelected = selected.has(item.id)
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => toggle(item.id)}
                    className={`relative rounded-xl overflow-hidden border-2 transition-all aspect-square focus:outline-none ${
                      isSelected
                        ? 'border-primary ring-2 ring-primary/30'
                        : 'border-transparent hover:border-primary/40'
                    }`}
                  >
                    {signedUrl ? (
                      <img
                        src={signedUrl}
                        alt={item.displayName}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="h-full w-full bg-muted flex items-center justify-center">
                        <FolderOpen className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}

                    {isSelected && (
                      <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                        <CheckCircle2 className="h-6 w-6 text-primary drop-shadow" />
                      </div>
                    )}

                    <div className="absolute bottom-0 inset-x-0 bg-black/50 px-1.5 py-0.5">
                      <p className="text-[9px] text-white truncate">{item.displayName}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <p className="text-xs text-muted-foreground flex-1 self-center">
            {selected.size > 0 ? `Đã chọn ${selected.size} ảnh` : 'Nhấn vào ảnh để chọn'}
          </p>
          <Button type="button" variant="outline" onClick={onClose}>
            Hủy
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={selected.size === 0}>
            Thêm {selected.size > 0 ? `(${selected.size})` : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { vi } from 'date-fns/locale'
import { Calendar, Download, Pencil, Star, StarOff, Trash2 } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { TagBadge } from '../shared/TagBadge'
import { ExpiryBadge } from '../shared/ExpiryBadge'
import { FileTypeIcon } from '../shared/FileTypeIcon'
import { DocumentPreview } from './DocumentPreview'
import { VersionHistoryPanel } from './VersionHistoryPanel'
import type { UseDocumentsReturn } from '@/hooks/useDocuments'

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

interface Props {
  docId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  docs: UseDocumentsReturn
}

export function DocumentDetailSheet({ docId, open, onOpenChange, docs }: Props) {
  const [editName, setEditName] = useState(false)
  const [nameValue, setNameValue] = useState('')
  const [tagInput, setTagInput] = useState('')

  const doc = docId ? docs.getDocument(docId) : null

  if (!doc) return null

  const handleSaveName = () => {
    if (nameValue.trim()) docs.renameDocument(doc.id, nameValue.trim())
    setEditName(false)
  }

  const handleAddTag = () => {
    const t = tagInput.trim().replace(/^#/, '')
    if (t && !doc.tags.includes(t)) {
      docs.updateMetadata(doc.id, { tags: [...doc.tags, t] })
    }
    setTagInput('')
  }

  const handleRemoveTag = (tag: string) => {
    docs.updateMetadata(doc.id, { tags: doc.tags.filter((t) => t !== tag) })
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg p-0 flex flex-col">
        <SheetHeader className="px-6 pt-6 pb-4 border-b">
          <div className="flex items-start gap-3">
            <FileTypeIcon category={doc.mimeCategory} className="h-6 w-6 mt-0.5" />
            <div className="flex-1 min-w-0">
              {editName ? (
                <div className="flex gap-2">
                  <Input
                    value={nameValue}
                    onChange={(e) => setNameValue(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                    className="h-7 text-sm"
                    autoFocus
                  />
                  <Button size="sm" className="h-7" onClick={handleSaveName}>
                    Lưu
                  </Button>
                </div>
              ) : (
                <SheetTitle className="text-base leading-snug pr-2">
                  {doc.displayName}
                </SheetTitle>
              )}
              <p className="text-xs text-muted-foreground mt-0.5">
                {doc.originalFilename} · {formatBytes(doc.sizeBytes)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 mt-3">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => docs.downloadDocument(doc.id)}
            >
              <Download className="h-3.5 w-3.5" />
              Tải xuống
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => {
                setNameValue(doc.displayName)
                setEditName(true)
              }}
            >
              <Pencil className="h-3.5 w-3.5" />
              Đổi tên
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => docs.starDocument(doc.id, !doc.isStarred)}
            >
              {doc.isStarred ? (
                <>
                  <StarOff className="h-3.5 w-3.5" />
                  Bỏ sao
                </>
              ) : (
                <>
                  <Star className="h-3.5 w-3.5" />
                  Đánh dấu
                </>
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-destructive hover:text-destructive ml-auto"
              onClick={() => {
                docs.softDeleteDocument(doc.id)
                onOpenChange(false)
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="px-6 py-4 space-y-6">
            {/* Preview */}
            <DocumentPreview doc={doc} docs={docs} />

            <Separator />

            {/* Metadata */}
            <div className="space-y-4">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>
                  Cập nhật:{' '}
                  {format(parseISO(doc.updatedAt), "dd/MM/yyyy 'lúc' HH:mm", {
                    locale: vi,
                  })}
                </span>
                <ExpiryBadge expiryDate={doc.expiryDate} />
              </div>

              {/* Expiry date */}
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  Ngày hết hạn
                </Label>
                <Input
                  type="date"
                  className="h-8 text-sm"
                  value={doc.expiryDate ?? ''}
                  onChange={(e) =>
                    docs.updateMetadata(doc.id, {
                      expiryDate: e.target.value || undefined,
                    })
                  }
                />
              </div>

              {/* Tags */}
              <div className="space-y-1.5">
                <Label className="text-xs">Tags</Label>
                <div className="flex flex-wrap gap-1 mb-1.5">
                  {doc.tags.map((t) => (
                    <TagBadge key={t} tag={t} onRemove={() => handleRemoveTag(t)} />
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="Thêm tag..."
                    className="h-7 text-xs"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
                  />
                  <Button size="sm" className="h-7" onClick={handleAddTag}>
                    Thêm
                  </Button>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <Label className="text-xs">Mô tả</Label>
                <Textarea
                  placeholder="Thêm ghi chú..."
                  className="text-sm resize-none"
                  rows={2}
                  defaultValue={doc.description ?? ''}
                  onBlur={(e) =>
                    docs.updateMetadata(doc.id, {
                      description: e.target.value || undefined,
                    })
                  }
                />
              </div>

              {/* Linked entities */}
              {doc.linkedEntities.length > 0 && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Liên kết</Label>
                  <div className="flex flex-wrap gap-1">
                    {doc.linkedEntities.map((e, i) => (
                      <Badge key={i} variant="outline" className="text-xs">
                        {e.label}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <Separator />

            {/* Version history */}
            {doc.versions.length > 1 && <VersionHistoryPanel doc={doc} />}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}

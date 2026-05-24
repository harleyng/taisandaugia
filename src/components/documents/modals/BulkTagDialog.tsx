import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { TagBadge } from '../shared/TagBadge'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedCount: number
  onApply: (tags: string[]) => void
}

export function BulkTagDialog({ open, onOpenChange, selectedCount, onApply }: Props) {
  const [tags, setTags] = useState<string[]>([])
  const [input, setInput] = useState('')

  const addTag = () => {
    const t = input.trim().replace(/^#/, '')
    if (t && !tags.includes(t)) setTags((prev) => [...prev, t])
    setInput('')
  }

  const handleConfirm = () => {
    if (tags.length > 0) onApply(tags)
    setTags([])
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Thêm tags cho {selectedCount} file</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="flex gap-2">
            <Input
              placeholder="Tên tag..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addTag()}
              className="flex-1"
            />
            <Button variant="outline" onClick={addTag}>
              Thêm
            </Button>
          </div>
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {tags.map((t) => (
                <TagBadge
                  key={t}
                  tag={t}
                  onRemove={() => setTags((prev) => prev.filter((x) => x !== t))}
                />
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Hủy
          </Button>
          <Button onClick={handleConfirm} disabled={tags.length === 0}>
            Áp dụng
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

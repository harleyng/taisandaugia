import { useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { UseFoldersReturn } from '@/hooks/useFolders'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: 'create' | 'rename'
  parentId?: string | null
  folderId?: string
  currentName?: string
  folders: UseFoldersReturn
  onDone?: (folder: { id: string }) => void
}

export function FolderFormDialog({
  open,
  onOpenChange,
  mode,
  parentId = null,
  folderId,
  currentName = '',
  folders,
  onDone,
}: Props) {
  const [name, setName] = useState(currentName)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      setName(mode === 'rename' ? currentName : '')
      setError('')
    }
  }, [open, mode, currentName])

  const depth =
    mode === 'create' && parentId
      ? folders.getDepth(parentId) + 1
      : parentId
        ? folders.getDepth(folderId!)
        : 0

  const validate = (): boolean => {
    if (!name.trim()) { setError('Tên folder không được để trống'); return false }
    if (/[/\\:*?"<>|]/.test(name)) {
      setError('Tên không được chứa ký tự: / \\ : * ? " < > |')
      return false
    }
    if (name.length > 100) { setError('Tên tối đa 100 ký tự'); return false }
    const targetParent = mode === 'create' ? parentId : folders.folders.find(f => f.id === folderId)?.parentId ?? null
    if (folders.hasDuplicateName(name.trim(), targetParent ?? null, folderId)) {
      setError('Đã có folder cùng tên trong cùng cấp')
      return false
    }
    return true
  }

  // Tạo/đổi tên nay đi Supabase nên phải await: onDone cần id THẬT của thư mục
  // vừa tạo (call site dùng nó để chọn ngay thư mục đó).
  const handleSubmit = async () => {
    if (!validate()) return
    if (mode === 'create') {
      const f = await folders.createFolder(name.trim(), parentId ?? null)
      // undefined khi ghi thất bại — guard trong useFolders đã hiện toast, giữ
      // dialog mở để user thử lại thay vì đóng như thể đã thành công.
      if (!f) return
      onDone?.({ id: f.id })
    } else if (folderId) {
      await folders.renameFolder(folderId, name.trim())
      onDone?.({ id: folderId })
    }
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? 'Tạo folder mới' : 'Đổi tên folder'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="folder-name">Tên folder *</Label>
            <Input
              id="folder-name"
              value={name}
              onChange={(e) => { setName(e.target.value); setError('') }}
              placeholder="Nhập tên folder..."
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              autoFocus
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>

          {depth >= 5 && (
            <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                Folder ở cấp {depth + 1} — nên giữ cấu trúc không sâu hơn 5 cấp để dễ quản lý.
              </span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Hủy
          </Button>
          <Button onClick={handleSubmit}>
            {mode === 'create' ? 'Tạo folder' : 'Lưu'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

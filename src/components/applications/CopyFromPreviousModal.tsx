import { useMemo } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Application, AuctionPlan } from '@/types/application'
import { listApplications, getApplication } from '@/lib/applications/storage'
import { ASSET_CATEGORY_LABELS } from '@/lib/applications/labels'
import { ClipboardCopy, FileText } from 'lucide-react'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentId: string
  currentCategory: string
  onCopyPlan: (plan: Partial<AuctionPlan>) => void
}

export function CopyFromPreviousModal({
  open,
  onOpenChange,
  currentId,
  currentCategory,
  onCopyPlan,
}: Props) {
  const list = useMemo(() => {
    return listApplications()
      .filter((a) => a.id !== currentId)
  }, [currentId])

  function handleCopy(id: string) {
    const app = getApplication(id)
    if (!app) return
    const { format, receptionPlan, participantConditions, antiCollusionMeasures } = app.auctionPlan
    onCopyPlan({ format, receptionPlan, participantConditions, antiCollusionMeasures })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold">📋 Copy từ hồ sơ cũ</DialogTitle>
        </DialogHeader>

        {list.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Chưa có hồ sơ nào được lưu để copy
          </p>
        ) : (
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {list.map((item) => {
              const full = getApplication(item.id)
              const category = full?.announcement.assetCategory ?? ''
              const isSameCategory = category === currentCategory
              return (
                <div
                  key={item.id}
                  className="flex items-start gap-3 rounded-lg border border-border p-3 hover:bg-muted/30"
                >
                  <FileText className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {category && (
                        <Badge variant="outline" className="text-[10px]">
                          {ASSET_CATEGORY_LABELS[category] ?? category}
                        </Badge>
                      )}
                      {isSameCategory && (
                        <span className="text-[10px] text-primary">Cùng loại tài sản</span>
                      )}
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(item.updatedAt).toLocaleDateString('vi-VN')}
                      </span>
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" className="h-7 text-xs shrink-0" onClick={() => handleCopy(item.id)}>
                    <ClipboardCopy className="h-3.5 w-3.5 mr-1" />
                    Copy
                  </Button>
                </div>
              )
            })}
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Nội dung Mục III (4 sub-sections) sẽ được copy sang hồ sơ hiện tại.
        </p>
      </DialogContent>
    </Dialog>
  )
}

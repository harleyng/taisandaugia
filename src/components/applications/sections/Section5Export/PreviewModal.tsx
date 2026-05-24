import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { ExportFormat } from '@/types/application'
import { FolderArchive, FileText } from 'lucide-react'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  format: ExportFormat
  ownerName: string
}

export function PreviewModal({ open, onOpenChange, format, ownerName }: Props) {
  const safeTitle = ownerName ? ownerName.slice(0, 30) : 'HoSo'
  const dateStr = new Date().toISOString().slice(0, 10)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold">🔍 Preview cấu trúc file xuất</DialogTitle>
        </DialogHeader>

        {format === 'SEPARATED' ? (
          <div className="font-mono text-sm space-y-1.5">
            <div className="flex items-center gap-2 text-muted-foreground">
              <FolderArchive className="h-4 w-4" />
              <span className="font-semibold text-foreground">HoSo-{safeTitle}-{dateStr}.zip</span>
            </div>
            <div className="pl-6 space-y-1.5 border-l-2 border-border ml-2">
              <FileRow name="01_Ho-so-nang-luc.docx" pages={15} color="text-primary" />
              <FileRow name="02_Phuong-an-dau-gia.docx" pages={10} color="text-violet-600" />
            </div>
          </div>
        ) : (
          <div className="font-mono text-sm space-y-1.5">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              <span className="font-semibold text-foreground">HoSo-Tich-hop-{safeTitle}-{dateStr}.docx</span>
            </div>
            <div className="pl-6 space-y-2 border-l-2 border-border ml-2 text-muted-foreground">
              <SectionRow label="Đơn đăng ký tham gia đấu giá" />
              <SectionRow label="Mục I — Đăng ký danh sách Bộ Tư pháp" />
              <SectionRow label="Mục II — Cơ sở vật chất" />
              <SectionRow label="Mục III — Phương án đấu giá" />
              <SectionRow label="Mục IV — Kinh nghiệm, năng lực" />
              <SectionRow label="Mục V — Tiêu chí khác" />
            </div>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Nội dung thực tế được tạo từ dữ liệu bạn đã nhập. Preview chỉ hiển thị cấu trúc.
        </p>
      </DialogContent>
    </Dialog>
  )
}

function FileRow({ name, pages, color }: { name: string; pages: number; color: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-1.5">
        <FileText className={`h-3.5 w-3.5 ${color}`} />
        <span className={`text-xs ${color}`}>{name}</span>
      </div>
      <Badge variant="secondary" className="text-[10px]">
        ~{pages} trang
      </Badge>
    </div>
  )
}

function SectionRow({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-1.5 text-xs">
      <span className="text-muted-foreground">├─</span>
      <span>{label}</span>
    </div>
  )
}

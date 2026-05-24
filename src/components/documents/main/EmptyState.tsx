import { FileX2, Folder, SearchX, Trash2 } from 'lucide-react'

interface Props {
  variant: 'empty-folder' | 'no-results' | 'empty-trash' | 'all-empty'
}

export function EmptyState({ variant }: Props) {
  const configs = {
    'empty-folder': {
      icon: <Folder className="h-10 w-10 text-muted-foreground/50" />,
      title: 'Folder này chưa có tài liệu',
      desc: 'Kéo file vào đây hoặc nhấn "Tải file lên" để bắt đầu.',
    },
    'no-results': {
      icon: <SearchX className="h-10 w-10 text-muted-foreground/50" />,
      title: 'Không tìm thấy kết quả',
      desc: 'Thử thay đổi từ khóa hoặc bỏ bớt bộ lọc.',
    },
    'empty-trash': {
      icon: <Trash2 className="h-10 w-10 text-muted-foreground/50" />,
      title: 'Thùng rác trống',
      desc: 'Các file đã xóa sẽ được giữ 30 ngày trước khi xóa vĩnh viễn.',
    },
    'all-empty': {
      icon: <FileX2 className="h-10 w-10 text-muted-foreground/50" />,
      title: 'Chưa có tài liệu nào',
      desc: 'Tải file lên để lưu trữ và quản lý tài liệu của công ty.',
    },
  }

  const { icon, title, desc } = configs[variant]

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center px-4">
      {icon}
      <h3 className="mt-4 font-medium">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground max-w-xs">{desc}</p>
    </div>
  )
}

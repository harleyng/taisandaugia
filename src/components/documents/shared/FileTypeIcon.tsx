import { File, FileImage, FileSpreadsheet, FileText } from 'lucide-react'
import type { MimeCategory } from '@/types/document'
import { cn } from '@/lib/utils'

interface Props {
  category: MimeCategory
  className?: string
}

export function FileTypeIcon({ category, className }: Props) {
  const cls = cn('shrink-0', className)
  switch (category) {
    case 'PDF':
      return <FileText className={cn(cls, 'text-red-500')} />
    case 'WORD':
      return <FileText className={cn(cls, 'text-blue-500')} />
    case 'EXCEL':
      return <FileSpreadsheet className={cn(cls, 'text-green-600')} />
    case 'IMAGE':
      return <FileImage className={cn(cls, 'text-purple-500')} />
    default:
      return <File className={cn(cls, 'text-muted-foreground')} />
  }
}

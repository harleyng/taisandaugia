import { ValidationError } from '@/lib/applications/validation'
import { AlertTriangle } from 'lucide-react'

interface Props {
  errors: ValidationError[]
}

export function WarningsList({ errors }: Props) {
  if (errors.length === 0) return null

  return (
    <div className="rounded-lg bg-amber-50 border border-amber-200 p-3.5">
      <div className="flex items-center gap-2 mb-2">
        <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
        <p className="text-sm font-medium text-amber-800">
          {errors.length} vấn đề cần xử lý trước khi xuất file
        </p>
      </div>
      <ul className="space-y-1">
        {errors.map((err, i) => (
          <li key={i} className="flex items-start gap-2 text-xs text-amber-700">
            <span className="shrink-0 font-medium">[{err.section}]</span>
            <span>{err.message}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

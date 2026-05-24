import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { ExportFormat } from '@/types/application'
import { FileStack, FileText } from 'lucide-react'

interface Props {
  value: ExportFormat | null
  onChange: (format: ExportFormat) => void
}

const OPTIONS: { value: ExportFormat; icon: React.ReactNode; title: string; description: string }[] = [
  {
    value: 'SEPARATED',
    icon: <FileStack className="h-5 w-5 text-primary" />,
    title: 'Tách rời (3 file)',
    description: '01_Hồ sơ năng lực · 02_Phương án đấu giá — đóng thành 2 quyển riêng, nộp kèm nhau',
  },
  {
    value: 'INTEGRATED',
    icon: <FileText className="h-5 w-5 text-violet-600" />,
    title: 'Tích hợp (1 file)',
    description: 'Tất cả nội dung theo thứ tự Phụ lục I — đóng thành 1 quyển duy nhất',
  },
]

export function FormatPicker({ value, onChange }: Props) {
  return (
    <RadioGroup
      value={value ?? ''}
      onValueChange={(v) => onChange(v as ExportFormat)}
      className="space-y-2"
    >
      {OPTIONS.map((opt) => (
        <label
          key={opt.value}
          className={`flex items-start gap-3 rounded-lg border p-3.5 cursor-pointer transition-colors ${
            value === opt.value
              ? 'border-primary bg-primary/5'
              : 'border-border bg-white hover:bg-muted/30'
          }`}
        >
          <RadioGroupItem value={opt.value} id={`format-${opt.value}`} className="mt-0.5" />
          <div className="flex items-start gap-2.5 flex-1">
            {opt.icon}
            <div>
              <Label htmlFor={`format-${opt.value}`} className="text-sm font-medium cursor-pointer">
                {opt.title}
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{opt.description}</p>
            </div>
          </div>
        </label>
      ))}
    </RadioGroup>
  )
}

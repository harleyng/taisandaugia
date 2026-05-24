import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Upload, FileSpreadsheet, Download } from 'lucide-react'
import { generateExcelTemplate, parseExcelFile, validateTemplateHeaders } from '@/lib/auction-history/import-parser'

interface Props {
  onFile: (file: File, headers: string[], rows: Record<string, unknown>[]) => void
}

export function ImportUploadStep({ onFile }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>()

  const handleFile = async (file: File) => {
    if (!file.name.match(/\.(xlsx|xls|csv)$/i)) {
      setError('Chỉ hỗ trợ file .xlsx, .xls, .csv')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('File tối đa 10MB')
      return
    }
    setLoading(true)
    setError(undefined)
    try {
      const { headers, rows } = await parseExcelFile(file)
      if (rows.length === 0) { setError('File không có dữ liệu'); return }
      if (rows.length > 5000) { setError('File tối đa 5000 dòng'); return }
      const templateError = validateTemplateHeaders(headers)
      if (templateError) { setError(templateError); return }
      onFile(file, headers, rows)
    } catch {
      setError('Không thể đọc file. Vui lòng kiểm tra định dạng.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => generateExcelTemplate()}>
        <Download className="h-4 w-4" />Tải template Excel mẫu
      </Button>

      <div
        className={`border-2 border-dashed rounded-xl p-10 text-center transition-colors cursor-pointer ${
          dragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
        onClick={() => inputRef.current?.click()}
      >
        <FileSpreadsheet className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
        {loading ? (
          <p className="text-sm text-muted-foreground">Đang đọc file...</p>
        ) : (
          <>
            <p className="text-sm font-medium">Kéo thả file vào đây</p>
            <p className="text-xs text-muted-foreground mt-1">hoặc click để chọn file</p>
            <p className="text-xs text-muted-foreground mt-2">Hỗ trợ: .xlsx, .xls, .csv · Tối đa 10MB · 5000 dòng</p>
          </>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
      />

      <div className="flex justify-center">
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => inputRef.current?.click()}>
          <Upload className="h-4 w-4" />Chọn file
        </Button>
      </div>
    </div>
  )
}

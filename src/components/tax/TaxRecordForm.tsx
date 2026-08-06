import { useEffect, useRef, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import { AlertTriangle, Paperclip, Plus, X } from 'lucide-react'
import { toast } from 'sonner'
import type { TaxRecord, TaxRecordType, SupportingDocument, DocType } from '@/types/tax'
import { TAX_RECORD_TYPE_LABELS, DOC_TYPE_LABELS } from '@/types/tax'
import { ScoreReferenceBar } from './ScoreReferenceBar'
import { previewScore, nextThresholdText } from '@/lib/tax/scoring'

const CURRENT_YEAR = new Date().getFullYear()
const YEAR_OPTIONS = Array.from({ length: 10 }, (_, i) => CURRENT_YEAR - i)

const DOC_TYPES: DocType[] = ['TAX_RETURN', 'TAX_RECEIPT', 'AUDIT_REPORT', 'OTHER']

const formSchema = z.object({
  year: z.number().int().min(2000).max(CURRENT_YEAR),
  recordType: z.enum(['CIT', 'NSNN'] as const),
  amount: z
    .number({ invalid_type_error: 'Vui lòng nhập số tiền' })
    .min(0, 'Số tiền phải ≥ 0'),
  vatExcluded: z.literal(true, {
    errorMap: () => ({ message: 'Bắt buộc xác nhận số tiền đã trừ VAT' }),
  }),
  isFinalized: z.boolean(),
  finalizedDate: z.string().optional(),
  notes: z.string().optional(),
})

type FormValues = z.infer<typeof formSchema>

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  existing?: TaxRecord
  defaultYear: number
  defaultRecordType: TaxRecordType
  existingYears: number[]
  onSave: (record: TaxRecord) => void
}

export function TaxRecordForm({
  open,
  onOpenChange,
  existing,
  defaultYear,
  defaultRecordType,
  existingYears,
  onSave,
}: Props) {
  const isEdit = Boolean(existing)

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      year: existing?.year ?? defaultYear,
      recordType: existing?.recordType ?? defaultRecordType,
      amount: existing?.amount ?? 0,
      // z.literal(true) — checkbox bắt buộc tick. Chưa tick thì để undefined
      // để zod báo lỗi, thay vì false (false không hợp kiểu `true`).
      vatExcluded: (existing?.vatExcluded ? true : undefined) as true,
      isFinalized: existing?.isFinalized ?? false,
      finalizedDate: existing?.finalizedDate ?? '',
      notes: existing?.notes ?? '',
    },
  })

  const [docs, setDocs] = useState<SupportingDocument[]>(
    existing?.supportingDocuments ?? []
  )
  const [newDocName, setNewDocName] = useState('')
  const [newDocType, setNewDocType] = useState<DocType>('TAX_RETURN')
  const [docError, setDocError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Reset form khi dialog mở/đóng hoặc đổi record
  useEffect(() => {
    if (open) {
      form.reset({
        year: existing?.year ?? defaultYear,
        recordType: existing?.recordType ?? defaultRecordType,
        amount: existing?.amount ?? 0,
        // z.literal(true) — checkbox bắt buộc tick. Chưa tick thì để undefined
      // để zod báo lỗi, thay vì false (false không hợp kiểu `true`).
      vatExcluded: (existing?.vatExcluded ? true : undefined) as true,
        isFinalized: existing?.isFinalized ?? false,
        finalizedDate: existing?.finalizedDate ?? '',
        notes: existing?.notes ?? '',
      })
      setDocs(existing?.supportingDocuments ?? [])
      setNewDocName('')
      setDocError('')
    }
  }, [open, existing?.id])  // eslint-disable-line react-hooks/exhaustive-deps

  const watchedAmount = useWatch({ control: form.control, name: 'amount' }) ?? 0
  const watchedVat = useWatch({ control: form.control, name: 'vatExcluded' })
  const watchedFinalized = useWatch({ control: form.control, name: 'isFinalized' })

  const amountMillion = watchedAmount > 0 ? (watchedAmount / 1_000_000).toFixed(1) : ''
  const coaching = nextThresholdText(watchedAmount)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setNewDocName(file.name)
      setDocError('')
    }
    e.target.value = ''
  }

  const addDoc = () => {
    if (!newDocName.trim()) {
      setDocError('Vui lòng chọn tệp trước khi thêm')
      return
    }
    setDocs((prev) => [
      ...prev,
      {
        docId: Math.random().toString(36).slice(2, 10),
        docType: newDocType,
        fileName: newDocName.trim(),
      },
    ])
    setNewDocName('')
    setNewDocType('TAX_RETURN')
    setDocError('')
  }

  const removeDoc = (docId: string) => {
    setDocs((prev) => prev.filter((d) => d.docId !== docId))
  }

  const onSubmit = (values: FormValues) => {
    // Kiểm tra trùng năm (chỉ khi thêm mới)
    if (!isEdit && existingYears.includes(values.year)) {
      toast.warning(`Đã có dữ liệu năm ${values.year}. Vui lòng sửa record hiện có.`)
      return
    }

    const score = previewScore(values.amount)
    const now = new Date().toISOString()

    const record: TaxRecord = {
      id: existing?.id ?? Math.random().toString(36).slice(2, 10),
      year: values.year,
      recordType: values.recordType,
      amount: values.amount,
      vatExcluded: values.vatExcluded,
      isFinalized: values.isFinalized,
      finalizedDate: values.isFinalized ? values.finalizedDate : undefined,
      supportingDocuments: docs,
      notes: values.notes?.trim() || undefined,
      isDeleted: false,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      scoreContribution: score,
    }

    onSave(record)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? `Sửa dữ liệu thuế năm ${existing?.year}` : 'Thêm dữ liệu thuế'}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            {/* Năm tài chính */}
            <FormField
              control={form.control}
              name="year"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Năm tài chính *</FormLabel>
                  <Select
                    value={String(field.value)}
                    onValueChange={(v) => field.onChange(Number(v))}
                    disabled={isEdit}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {YEAR_OPTIONS.map((y) => (
                        <SelectItem key={y} value={String(y)}>
                          {y}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Loại kê khai */}
            <FormField
              control={form.control}
              name="recordType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Loại kê khai</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {(Object.keys(TAX_RECORD_TYPE_LABELS) as TaxRecordType[]).map((t) => (
                        <SelectItem key={t} value={t}>
                          {TAX_RECORD_TYPE_LABELS[t]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Số tiền */}
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Số tiền (VND, đã trừ VAT) *</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type="number"
                        min={0}
                        placeholder="Ví dụ: 120000000"
                        value={field.value || ''}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      />
                    </div>
                  </FormControl>
                  {amountMillion && (
                    <p className="text-xs text-muted-foreground">
                      ≈ {amountMillion} triệu VND
                    </p>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Live score preview */}
            <ScoreReferenceBar amountVnd={watchedAmount} />
            {coaching && (
              <p className="text-xs text-amber-700 flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                {coaching}
              </p>
            )}

            {/* VAT confirmation — bắt buộc */}
            <FormField
              control={form.control}
              name="vatExcluded"
              render={({ field }) => (
                <FormItem className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <FormControl>
                    <Checkbox
                      checked={field.value === true}
                      onCheckedChange={(checked) =>
                        field.onChange(checked ? true : undefined)
                      }
                      className="mt-0.5"
                    />
                  </FormControl>
                  <div className="space-y-0.5">
                    <FormLabel className="font-medium text-amber-900 cursor-pointer">
                      Tôi xác nhận số tiền đã loại trừ VAT (nếu có)
                    </FormLabel>
                    <p className="text-xs text-amber-700">
                      VAT là thuế gián thu, không phản ánh năng lực. Phụ lục I yêu cầu số đã trừ VAT.
                    </p>
                    <FormMessage />
                  </div>
                </FormItem>
              )}
            />

            {/* Tình trạng quyết toán */}
            <FormField
              control={form.control}
              name="isFinalized"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between">
                  <FormLabel className="cursor-pointer">Đã quyết toán xong</FormLabel>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            {watchedFinalized && (
              <FormField
                control={form.control}
                name="finalizedDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ngày quyết toán</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Tài liệu chứng minh */}
            <div className="space-y-2">
              <p className="text-sm font-medium">Tài liệu chứng minh (tuỳ chọn)</p>
              {docs.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  ⚠ Thiếu file có thể bị từ chối khi nộp hồ sơ
                </p>
              )}
              {docs.map((doc) => (
                <div
                  key={doc.docId}
                  className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                >
                  <div>
                    <p className="font-medium truncate max-w-xs">{doc.fileName}</p>
                    <p className="text-xs text-muted-foreground">{DOC_TYPE_LABELS[doc.docType]}</p>
                  </div>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => removeDoc(doc.docId)}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Select
                    value={newDocType}
                    onValueChange={(v) => { setNewDocType(v as DocType); setDocError('') }}
                  >
                    <SelectTrigger className="w-44 shrink-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DOC_TYPES.map((dt) => (
                        <SelectItem key={dt} value={dt}>
                          {DOC_TYPE_LABELS[dt]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground transition-colors"
                  >
                    <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className={newDocName ? 'text-foreground truncate' : 'text-muted-foreground'}>
                      {newDocName || 'Chọn tệp PDF, JPG, PNG…'}
                    </span>
                  </button>
                  <Button type="button" size="icon" variant="outline" onClick={addDoc}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {docError && (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    {docError}
                  </p>
                )}
              </div>
            </div>

            {/* Ghi chú */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ghi chú nội bộ (tuỳ chọn)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Ghi chú thêm..."
                      rows={2}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Huỷ
              </Button>
              <Button type="submit" disabled={!watchedVat}>
                {isEdit ? 'Cập nhật' : 'Lưu'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

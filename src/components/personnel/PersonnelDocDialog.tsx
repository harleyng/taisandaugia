import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import type { PersonnelDocument, DocType } from '@/types/personnel'
import { DOC_TYPE_LABELS, DOC_TYPE_ORDER } from '@/types/personnel'
import { PersonnelFileUpload } from './PersonnelFileUpload'

const schema = z.object({
  docType: z.enum([
    'DGV_CARD', 'CCHN', 'DEGREE', 'TRAINING_CERT',
    'CRIMINAL_RECORD', 'LABOR_CONTRACT', 'PORTRAIT', 'OTHER',
  ]),
  title: z.string().optional(),
  docNumber: z.string().optional(),
  issuer: z.string().optional(),
  issuedDate: z.string().optional(),
  expiryDate: z.string().optional(),
  notes: z.string().optional(),
})

type Values = z.infer<typeof schema>

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  organizationId: string
  auctioneerId: string
  existing?: PersonnelDocument
  onSave: (doc: Partial<PersonnelDocument>) => void
}

export function PersonnelDocDialog({
  open, onOpenChange, organizationId, auctioneerId, existing, onSave,
}: Props) {
  const [filePaths, setFilePaths] = useState<string[]>(existing?.filePaths ?? [])
  const [fileError, setFileError] = useState<string | null>(null)

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      docType: existing?.docType ?? 'DGV_CARD',
      title: existing?.title ?? '',
      docNumber: existing?.docNumber ?? '',
      issuer: existing?.issuer ?? '',
      issuedDate: existing?.issuedDate ?? '',
      expiryDate: existing?.expiryDate ?? '',
      notes: existing?.notes ?? '',
    },
  })

  useEffect(() => {
    if (open) {
      setFilePaths(existing?.filePaths ?? [])
      setFileError(null)
      form.reset({
        docType: existing?.docType ?? 'DGV_CARD',
        title: existing?.title ?? '',
        docNumber: existing?.docNumber ?? '',
        issuer: existing?.issuer ?? '',
        issuedDate: existing?.issuedDate ?? '',
        expiryDate: existing?.expiryDate ?? '',
        notes: existing?.notes ?? '',
      })
    }
  }, [open, existing?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  function submit(v: Values) {
    // Bản chụp là BẮT BUỘC: hồ sơ năng lực phải kèm được giấy tờ gốc, và
    // phụ lục trang 3 của mẫu xuất PDF dựng từ chính các ảnh này.
    if (filePaths.length === 0) {
      setFileError('Phải tải lên ít nhất một bản chụp/scan của giấy tờ này.')
      return
    }
    setFileError(null)
    onSave({ ...existing, ...v, docType: v.docType as DocType, filePaths })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-sm">
            {existing ? 'Sửa giấy tờ' : 'Thêm giấy tờ hành nghề'}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(submit)} className="space-y-4 pt-1">
            <FormField control={form.control} name="docType" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Loại giấy tờ <span className="text-destructive">*</span></FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>
                    {DOC_TYPE_ORDER.map((t) => (
                      <SelectItem key={t} value={t}>{DOC_TYPE_LABELS[t]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField control={form.control} name="docNumber" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Số hiệu</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="issuer" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Nơi cấp</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="issuedDate" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Ngày cấp</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="expiryDate" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Ngày hết hạn</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                </FormItem>
              )} />
            </div>

            <FormField control={form.control} name="title" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Tên gọi / ghi chú ngắn</FormLabel>
                <FormControl><Input {...field} placeholder="VD: Bằng Cử nhân Luật" /></FormControl>
              </FormItem>
            )} />

            <div>
              <p className="text-xs font-medium mb-1.5">
                Bản chụp / scan <span className="text-destructive">*</span>
              </p>
              <PersonnelFileUpload
                organizationId={organizationId}
                auctioneerId={auctioneerId}
                value={filePaths}
                onChange={(p) => { setFilePaths(p); if (p.length) setFileError(null) }}
              />
              {fileError && <p className="text-xs text-destructive mt-1.5">{fileError}</p>}
            </div>

            <FormField control={form.control} name="notes" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Ghi chú</FormLabel>
                <FormControl><Textarea rows={2} {...field} /></FormControl>
              </FormItem>
            )} />

            <DialogFooter>
              <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                Hủy
              </Button>
              <Button type="submit" size="sm">Lưu</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
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
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Lock, PenLine } from 'lucide-react'
import type { Auctioneer, PublicFieldKey } from '@/types/auctioneer'
import {
  POSITION_LABELS,
  CONTRACT_TYPE_LABELS,
  FIELD_LABELS,
  PUBLIC_FIELD_KEYS,
  makeDefaultFieldSources,
} from '@/types/auctioneer'
import { OverrideFieldDialog } from './OverrideFieldDialog'
import { usePortalOrg } from '@/hooks/usePortalOrg'

const formSchema = z.object({
  fullName: z.string().min(2, 'Tên phải ít nhất 2 ký tự'),
  licenseNumber: z.string().min(1, 'Bắt buộc'),
  licenseIssuedDate: z.string().min(1, 'Bắt buộc'),
  joinedDate: z.string().min(1, 'Bắt buộc'),
  professionalCertNumber: z.string().min(1, 'Bắt buộc'),
  position: z.enum(['DIRECTOR', 'DEPUTY_DIRECTOR', 'AUCTIONEER']),
  contractType: z.enum(['OFFICIAL', 'COLLABORATOR']),
  dateOfBirth: z.string().optional(),
  permanentAddress: z.string().optional(),
  licenseExpiryDate: z.string().optional(),
  email: z.string().email('Email không hợp lệ').optional().or(z.literal('')),
  phone: z.string().optional(),
  internalNotes: z.string().optional(),
})

type FormValues = z.infer<typeof formSchema>

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  existing?: Auctioneer
  onSave: (auctioneer: Auctioneer) => void
}

function toFormValues(a?: Auctioneer): FormValues {
  return {
    fullName: a?.fullName ?? '',
    licenseNumber: a?.licenseNumber ?? '',
    licenseIssuedDate: a?.licenseIssuedDate ?? '',
    joinedDate: a?.joinedDate ?? '',
    professionalCertNumber: a?.professionalCertNumber ?? '',
    position: a?.position ?? 'AUCTIONEER',
    contractType: a?.contractType ?? 'OFFICIAL',
    dateOfBirth: a?.dateOfBirth ?? '',
    permanentAddress: a?.permanentAddress ?? '',
    licenseExpiryDate: a?.licenseExpiryDate ?? '',
    email: a?.email ?? '',
    phone: a?.phone ?? '',
    internalNotes: a?.internalNotes ?? '',
  }
}

export function AuctioneerForm({ open, onOpenChange, existing, onSave }: Props) {
  const { organizationId } = usePortalOrg()
  const isCrawled = existing?.source === 'CRAWLED' || existing?.source === 'CRAWLED_USER_ENRICHED'

  // Mirror of existing with applied overrides — updated as user overrides fields
  const [localAuctioneer, setLocalAuctioneer] = useState<Auctioneer | undefined>(existing)
  const [overrideField, setOverrideField] = useState<PublicFieldKey | null>(null)

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: toFormValues(existing),
  })

  // Reset form + local state whenever the dialog opens for a different record
  useEffect(() => {
    if (open) {
      setLocalAuctioneer(existing)
      form.reset(toFormValues(existing))
    }
  }, [open, existing?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const onSubmit = (values: FormValues) => {
    const now = new Date().toISOString()

    if (existing) {
      const base = localAuctioneer ?? existing
      const updated: Auctioneer = {
        ...base,
        position: values.position,
        contractType: values.contractType,
        licenseExpiryDate: values.licenseExpiryDate || undefined,
        email: values.email || undefined,
        phone: values.phone || undefined,
        internalNotes: values.internalNotes || undefined,
        updatedAt: now,
        ...(!isCrawled && {
          fullName: values.fullName,
          licenseNumber: values.licenseNumber,
          licenseIssuedDate: values.licenseIssuedDate,
          joinedDate: values.joinedDate,
          professionalCertNumber: values.professionalCertNumber,
          dateOfBirth: values.dateOfBirth || undefined,
          permanentAddress: values.permanentAddress || undefined,
        }),
      }
      onSave(updated)
    } else {
      const created: Auctioneer = {
        id: crypto.randomUUID(),
        orgId: organizationId ?? '',
        source: 'MANUAL',
        isVerifiedByPublicSource: false,
        fullName: values.fullName,
        licenseNumber: values.licenseNumber,
        licenseIssuedDate: values.licenseIssuedDate,
        joinedDate: values.joinedDate,
        professionalCertNumber: values.professionalCertNumber,
        dateOfBirth: values.dateOfBirth || undefined,
        permanentAddress: values.permanentAddress || undefined,
        fieldSources: makeDefaultFieldSources('USER'),
        overrides: [],
        position: values.position,
        contractType: values.contractType,
        licenseExpiryDate: values.licenseExpiryDate || undefined,
        email: values.email || undefined,
        phone: values.phone || undefined,
        internalNotes: values.internalNotes || undefined,
        isActive: true,
        attachedDocuments: [],
        createdAt: now,
        updatedAt: now,
      }
      onSave(created)
    }
    onOpenChange(false)
  }

  const handleOverrideConfirm = (newValue: string, reason: string) => {
    if (!overrideField || !localAuctioneer) return
    const now = new Date().toISOString()
    const originalValue = (localAuctioneer[overrideField as keyof Auctioneer] as string) ?? ''
    const updated: Auctioneer = {
      ...localAuctioneer,
      [overrideField]: newValue,
      fieldSources: { ...localAuctioneer.fieldSources, [overrideField]: 'USER_OVERRIDE' as const },
      overrides: [
        ...localAuctioneer.overrides.filter((o) => o.field !== overrideField),
        { field: overrideField, originalValue, overriddenValue: newValue, reason, overriddenAt: now, overriddenBy: 'user' },
      ],
      source: 'CRAWLED_USER_ENRICHED' as const,
      updatedAt: now,
    }
    setLocalAuctioneer(updated)
    setOverrideField(null)
  }

  const getDisplayValue = (field: PublicFieldKey): string => {
    if (!localAuctioneer) return ''
    const override = localAuctioneer.overrides.find((o) => o.field === field)
    return override?.overriddenValue ?? (localAuctioneer[field as keyof Auctioneer] as string) ?? ''
  }

  const isOverridden = (field: PublicFieldKey) =>
    localAuctioneer?.fieldSources[field] === 'USER_OVERRIDE'

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-sm">
              {existing ? 'Sửa đấu giá viên' : 'Thêm đấu giá viên'}
            </DialogTitle>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 pt-1">

              {/* ── Public fields: locked for crawled records ── */}
              {isCrawled && localAuctioneer ? (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Thông tin từ Cổng QG
                  </p>
                  {PUBLIC_FIELD_KEYS.map((field) => {
                    const value = getDisplayValue(field)
                    const overridden = isOverridden(field)
                    return (
                      <div key={field} className="flex items-start gap-2">
                        <div className="flex-1 min-w-0 rounded-lg border border-border bg-muted/30 px-3 py-2">
                          <p className="text-xs text-muted-foreground">{FIELD_LABELS[field] ?? field}</p>
                          <p className="text-sm font-medium">{value || '—'}</p>
                          {overridden && (
                            <Badge variant="outline" className="text-[10px] mt-1 text-warning border-warning/30">
                              User override
                            </Badge>
                          )}
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0 mt-1"
                          onClick={() => setOverrideField(field)}
                          title="Sửa"
                        >
                          {overridden
                            ? <PenLine className="h-3.5 w-3.5 text-warning" />
                            : <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
                        </Button>
                      </div>
                    )
                  })}
                </div>
              ) : (
                /* Manual — all public fields editable */
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Thông tin chính
                  </p>

                  <FormField control={form.control} name="fullName" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Họ tên <span className="text-destructive">*</span></FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )} />

                  <div className="grid grid-cols-2 gap-3">
                    <FormField control={form.control} name="licenseNumber" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Số thẻ ĐGV <span className="text-destructive">*</span></FormLabel>
                        <FormControl><Input {...field} placeholder="406/ĐGV" /></FormControl>
                        <FormMessage className="text-xs" />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="professionalCertNumber" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Số CCHN <span className="text-destructive">*</span></FormLabel>
                        <FormControl><Input {...field} placeholder="484/TP/ĐG-CCHN" /></FormControl>
                        <FormMessage className="text-xs" />
                      </FormItem>
                    )} />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <FormField control={form.control} name="licenseIssuedDate" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Ngày cấp thẻ <span className="text-destructive">*</span></FormLabel>
                        <FormControl><Input type="date" {...field} /></FormControl>
                        <FormMessage className="text-xs" />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="joinedDate" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Ngày bắt đầu công tác <span className="text-destructive">*</span></FormLabel>
                        <FormControl><Input type="date" {...field} /></FormControl>
                        <FormMessage className="text-xs" />
                      </FormItem>
                    )} />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <FormField control={form.control} name="dateOfBirth" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Ngày sinh</FormLabel>
                        <FormControl><Input type="date" {...field} /></FormControl>
                      </FormItem>
                    )} />
                    <div /> {/* spacer */}
                  </div>

                  <FormField control={form.control} name="permanentAddress" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Địa chỉ thường trú</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                    </FormItem>
                  )} />
                </div>
              )}

              {/* ── Internal fields (always editable) ── */}
              <div className="space-y-3 pt-1 border-t border-border">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide pt-1">
                  Thông tin nội bộ
                </p>

                <div className="grid grid-cols-2 gap-3">
                  <FormField control={form.control} name="position" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Chức vụ <span className="text-destructive">*</span></FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.entries(POSITION_LABELS).map(([v, l]) => (
                            <SelectItem key={v} value={v}>{l}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="contractType" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Loại HĐ <span className="text-destructive">*</span></FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.entries(CONTRACT_TYPE_LABELS).map(([v, l]) => (
                            <SelectItem key={v} value={v}>{l}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )} />
                </div>

                <FormField control={form.control} name="licenseExpiryDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Ngày hết hạn thẻ ĐGV</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                  </FormItem>
                )} />

                <div className="grid grid-cols-2 gap-3">
                  <FormField control={form.control} name="email" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Email</FormLabel>
                      <FormControl><Input type="email" {...field} /></FormControl>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="phone" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">SĐT</FormLabel>
                      <FormControl><Input type="tel" {...field} /></FormControl>
                    </FormItem>
                  )} />
                </div>

                <FormField control={form.control} name="internalNotes" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Ghi chú nội bộ</FormLabel>
                    <FormControl>
                      <Textarea {...field} rows={2} placeholder="Ghi chú chỉ dùng nội bộ..." />
                    </FormControl>
                  </FormItem>
                )} />
              </div>

              <div className="flex gap-2 pt-2 border-t border-border">
                <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
                  Huỷ
                </Button>
                <Button type="submit" className="flex-1">
                  {existing ? 'Lưu thay đổi' : 'Thêm ĐGV'}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <OverrideFieldDialog
        open={overrideField !== null}
        field={overrideField ?? ''}
        originalValue={overrideField && localAuctioneer
          ? (localAuctioneer[overrideField as keyof Auctioneer] as string) ?? ''
          : ''}
        onConfirm={handleOverrideConfirm}
        onCancel={() => setOverrideField(null)}
      />
    </>
  )
}

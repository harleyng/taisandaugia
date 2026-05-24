import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet'
import { Form } from '@/components/ui/form'
import { Button } from '@/components/ui/button'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import type { OrgGeneralInfo, Branch, BankAccount } from '@/types/general-info'
import { EntityInfoSection } from './sections/EntityInfoSection'
import { AddressContactSection } from './sections/AddressContactSection'
import { LegalRepSection } from './sections/LegalRepSection'
import { EstablishmentSection } from './sections/EstablishmentSection'
import { BranchFormDialog } from './BranchFormDialog'
import { BankAccountFormDialog } from './BankAccountFormDialog'
import { BranchesCard } from './BranchesCard'
import { BankAccountsCard } from './BankAccountsCard'

export const editSchema = z.object({
  name: z.string().min(2, 'Tên công ty phải có ít nhất 2 ký tự'),
  shortName: z.string().optional(),
  orgType: z.enum(['TRUNG_TAM_DV', 'CONG_TY_HOP_DANH', 'DN_TU_NHAN']),
  taxCode: z.string().min(10, 'MST phải có 10 chữ số').max(13),
  registrationCode: z.string().optional(),
  logoUrl: z.string().optional(),
  address: z.string().min(3, 'Vui lòng nhập địa chỉ'),
  ward: z.string().optional(),
  district: z.string().optional(),
  province: z.string().min(1, 'Vui lòng chọn tỉnh/TP'),
  phone: z.string().regex(/^0[0-9]{9}$/, 'Số điện thoại không hợp lệ (VD: 0971234567)'),
  alternativePhone: z.string().optional(),
  fax: z.string().optional(),
  email: z.string().email('Email không hợp lệ'),
  alternativeEmail: z.string().email('Email không hợp lệ').optional().or(z.literal('')),
  website: z.string().url('URL không hợp lệ (bắt đầu bằng https://)').optional().or(z.literal('')),

  legalRepName: z.string().min(3, 'Họ tên phải có ít nhất 3 ký tự'),
  legalRepPosition: z.string().optional(),
  legalRepIdNumber: z.string().optional(),
  legalRepIdIssuedDate: z.string().optional(),
  legalRepIdIssuedPlace: z.string().optional(),

  foundedDate: z.string().min(1, 'Vui lòng nhập ngày thành lập'),
  establishmentDecisionNumber: z.string().optional(),
  establishmentDecisionDate: z.string().optional(),
  establishmentDecisionIssuer: z.string().optional(),
  establishmentDecisionFile: z.string().optional(),
  businessLicenseNumber: z.string().optional(),
  businessLicenseDate: z.string().optional(),
  businessLicenseIssuer: z.string().optional(),
  businessLicenseFile: z.string().optional(),
})

export type EditFormValues = z.infer<typeof editSchema>

interface EditInfoSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  info: OrgGeneralInfo
  onSave: (values: EditFormValues, branches: Branch[], bankAccounts: BankAccount[]) => void
}

export function EditInfoSheet({ open, onOpenChange, info, onSave }: EditInfoSheetProps) {
  const [branches, setBranches] = useState<Branch[]>([])
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])
  const [branchDialog, setBranchDialog] = useState<{ open: boolean; existing?: Branch }>({ open: false })
  const [bankDialog, setBankDialog] = useState<{ open: boolean; existing?: BankAccount }>({ open: false })
  const [saving, setSaving] = useState(false)

  const form = useForm<EditFormValues>({
    resolver: zodResolver(editSchema),
    defaultValues: buildDefaults(info),
  })

  useEffect(() => {
    if (open) {
      form.reset(buildDefaults(info))
      setBranches(info.branches ?? [])
      setBankAccounts(info.bankAccounts ?? [])
    }
  }, [open, info, form])

  const handleSubmit = async (values: EditFormValues) => {
    setSaving(true)
    try {
      onSave(values, branches, bankAccounts)
      toast.success('Đã lưu thông tin chung')
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  // Branch handlers
  const handleSaveBranch = (branch: Omit<Branch, 'id'>) => {
    if (branchDialog.existing) {
      setBranches((prev) => prev.map((b) => b.id === branchDialog.existing!.id ? { ...branch, id: branchDialog.existing!.id } : b))
    } else {
      setBranches((prev) => [...prev, { ...branch, id: crypto.randomUUID() }])
    }
  }
  const handleRemoveBranch = (id: string) => setBranches((prev) => prev.filter((b) => b.id !== id))

  // Bank account handlers
  const handleSaveBankAccount = (account: Omit<BankAccount, 'id'>) => {
    if (bankDialog.existing) {
      setBankAccounts((prev) => prev.map((a) => a.id === bankDialog.existing!.id ? { ...account, id: bankDialog.existing!.id } : a))
    } else {
      setBankAccounts((prev) => [...prev, { ...account, id: crypto.randomUUID() }])
    }
  }
  const handleRemoveBankAccount = (id: string) => setBankAccounts((prev) => prev.filter((a) => a.id !== id))

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:w-[560px] sm:max-w-[560px] overflow-y-auto flex flex-col p-0">
          <SheetHeader className="px-6 py-4 border-b shrink-0">
            <SheetTitle>Sửa thông tin chung</SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto">
            <Form {...form}>
              <form id="edit-general-info" onSubmit={form.handleSubmit(handleSubmit)}>
                <Accordion type="multiple" defaultValue={['entity']} className="divide-y">
                  <AccordionItem value="entity" className="border-0">
                    <AccordionTrigger className="px-6 py-3 text-sm font-semibold hover:no-underline">
                      1. Thông tin pháp nhân
                    </AccordionTrigger>
                    <AccordionContent className="px-6 pb-4">
                      <EntityInfoSection form={form} />
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="address" className="border-0">
                    <AccordionTrigger className="px-6 py-3 text-sm font-semibold hover:no-underline">
                      2. Địa chỉ &amp; liên hệ
                    </AccordionTrigger>
                    <AccordionContent className="px-6 pb-4">
                      <AddressContactSection form={form} />
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="legal-rep" className="border-0">
                    <AccordionTrigger className="px-6 py-3 text-sm font-semibold hover:no-underline">
                      3. Đại diện pháp lý
                    </AccordionTrigger>
                    <AccordionContent className="px-6 pb-4">
                      <LegalRepSection form={form} />
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="establishment" className="border-0">
                    <AccordionTrigger className="px-6 py-3 text-sm font-semibold hover:no-underline">
                      4. Thành lập &amp; pháp lý
                    </AccordionTrigger>
                    <AccordionContent className="px-6 pb-4">
                      <EstablishmentSection form={form} />
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="branches" className="border-0">
                    <AccordionTrigger className="px-6 py-3 text-sm font-semibold hover:no-underline">
                      5. Chi nhánh &amp; VPDD
                    </AccordionTrigger>
                    <AccordionContent className="px-6 pb-4">
                      <BranchesCard
                        branches={branches}
                        onAdd={() => setBranchDialog({ open: true })}
                        onEdit={(b) => setBranchDialog({ open: true, existing: b })}
                        onRemove={handleRemoveBranch}
                      />
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="banks" className="border-0">
                    <AccordionTrigger className="px-6 py-3 text-sm font-semibold hover:no-underline">
                      6. Tài khoản ngân hàng
                    </AccordionTrigger>
                    <AccordionContent className="px-6 pb-4">
                      <BankAccountsCard
                        accounts={bankAccounts}
                        onAdd={() => setBankDialog({ open: true })}
                        onEdit={(a) => setBankDialog({ open: true, existing: a })}
                        onRemove={handleRemoveBankAccount}
                      />
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </form>
            </Form>
          </div>

          <SheetFooter className="px-6 py-4 border-t shrink-0 flex gap-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
              Hủy
            </Button>
            <Button type="submit" form="edit-general-info" className="flex-1" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              💾 Lưu thay đổi
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <BranchFormDialog
        open={branchDialog.open}
        onOpenChange={(o) => setBranchDialog({ open: o })}
        existing={branchDialog.existing}
        onSave={handleSaveBranch}
      />

      <BankAccountFormDialog
        open={bankDialog.open}
        onOpenChange={(o) => setBankDialog({ open: o })}
        existing={bankDialog.existing}
        onSave={handleSaveBankAccount}
      />
    </>
  )
}

export function buildDefaults(info: OrgGeneralInfo): EditFormValues {
  return {
    name: info.name ?? '',
    shortName: info.shortName ?? '',
    orgType: info.orgType ?? 'CONG_TY_HOP_DANH',
    taxCode: info.taxCode ?? '',
    registrationCode: info.registrationCode ?? '',
    logoUrl: info.logoUrl ?? '',
    address: info.address ?? '',
    ward: info.ward ?? '',
    district: info.district ?? '',
    province: info.province ?? '',
    phone: info.phone ?? '',
    alternativePhone: info.alternativePhone ?? '',
    fax: info.fax ?? '',
    email: info.email ?? '',
    alternativeEmail: info.alternativeEmail ?? '',
    website: info.website ?? '',
    legalRepName: info.legalRepName ?? '',
    legalRepPosition: info.legalRepPosition ?? '',
    legalRepIdNumber: info.legalRepIdNumber ?? '',
    legalRepIdIssuedDate: info.legalRepIdIssuedDate ?? '',
    legalRepIdIssuedPlace: info.legalRepIdIssuedPlace ?? '',
    foundedDate: info.foundedDate ?? '',
    establishmentDecisionNumber: info.establishmentDecisionNumber ?? '',
    establishmentDecisionDate: info.establishmentDecisionDate ?? '',
    establishmentDecisionIssuer: info.establishmentDecisionIssuer ?? '',
    establishmentDecisionFile: info.establishmentDecisionFile ?? '',
    businessLicenseNumber: info.businessLicenseNumber ?? '',
    businessLicenseDate: info.businessLicenseDate ?? '',
    businessLicenseIssuer: info.businessLicenseIssuer ?? '',
    businessLicenseFile: info.businessLicenseFile ?? '',
  }
}

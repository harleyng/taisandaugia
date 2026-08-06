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
import { editSchema, buildDefaults, type EditFormValues } from './editSchema'

// editSchema / EditFormValues / buildDefaults nay ở ./editSchema.
// Re-export CHỈ TYPE cho ~6 call site cũ — type bị xoá lúc compile nên không
// vi phạm react-refresh/only-export-components.
export type { EditFormValues } from './editSchema'

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


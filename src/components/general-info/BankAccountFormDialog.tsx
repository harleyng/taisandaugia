import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Form, FormField, FormControl, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import type { BankAccount } from '@/types/general-info'

const schema = z.object({
  bankName: z.string().min(2, 'Vui lòng nhập tên ngân hàng'),
  accountNumber: z.string().min(4, 'Số tài khoản không hợp lệ'),
  accountHolder: z.string().min(2, 'Vui lòng nhập tên chủ tài khoản'),
  branch: z.string().optional(),
  isPrimary: z.boolean(),
})

type FormValues = z.infer<typeof schema>

interface BankAccountFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  existing?: BankAccount
  onSave: (account: Omit<BankAccount, 'id'>) => void
}

export function BankAccountFormDialog({ open, onOpenChange, existing, onSave }: BankAccountFormDialogProps) {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { bankName: '', accountNumber: '', accountHolder: '', branch: '', isPrimary: false },
  })

  useEffect(() => {
    if (open) {
      form.reset(existing
        ? { ...existing, branch: existing.branch ?? '' }
        : { bankName: '', accountNumber: '', accountHolder: '', branch: '', isPrimary: false }
      )
    }
  }, [open, existing, form])

  const onSubmit = (values: FormValues) => {
    onSave({ ...values, branch: values.branch || undefined })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{existing ? 'Sửa tài khoản ngân hàng' : 'Thêm tài khoản ngân hàng'}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="bankName" render={({ field }) => (
              <FormItem>
                <FormLabel>Ngân hàng *</FormLabel>
                <FormControl><Input {...field} placeholder="VD: Vietcombank" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="branch" render={({ field }) => (
              <FormItem>
                <FormLabel>Chi nhánh NH</FormLabel>
                <FormControl><Input {...field} placeholder="VD: CN TP.HCM" /></FormControl>
              </FormItem>
            )} />

            <FormField control={form.control} name="accountNumber" render={({ field }) => (
              <FormItem>
                <FormLabel>Số tài khoản *</FormLabel>
                <FormControl><Input {...field} className="font-mono" placeholder="Số tài khoản" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="accountHolder" render={({ field }) => (
              <FormItem>
                <FormLabel>Chủ tài khoản *</FormLabel>
                <FormControl><Input {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="isPrimary" render={({ field }) => (
              <FormItem className="flex items-center gap-3">
                <FormControl>
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
                <FormLabel className="!mt-0">Tài khoản chính</FormLabel>
              </FormItem>
            )} />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Hủy</Button>
              <Button type="submit">Lưu</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

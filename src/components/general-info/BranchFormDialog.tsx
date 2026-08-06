import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Form, FormField, FormControl, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { vietnamProvinces } from '@/constants/vietnam-locations'
import type { Branch } from '@/types/general-info'

const schema = z.object({
  name: z.string().min(2, 'Vui lòng nhập tên'),
  type: z.enum(['BRANCH', 'REP_OFFICE']),
  address: z.string().min(3, 'Vui lòng nhập địa chỉ'),
  province: z.string().min(1, 'Vui lòng chọn tỉnh/TP'),
  district: z.string().optional(),
  ward: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email('Email không hợp lệ').optional().or(z.literal('')),
  managerName: z.string().optional(),
  establishedDate: z.string().optional(),
  isActive: z.boolean(),
})

type FormValues = z.infer<typeof schema>

interface BranchFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  existing?: Branch
  onSave: (branch: Omit<Branch, 'id'>) => void
}

export function BranchFormDialog({ open, onOpenChange, existing, onSave }: BranchFormDialogProps) {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      type: 'BRANCH',
      address: '',
      province: '',
      district: '',
      ward: '',
      phone: '',
      email: '',
      managerName: '',
      establishedDate: '',
      isActive: true,
    },
  })

  useEffect(() => {
    if (open) {
      form.reset(existing
        ? { ...existing, email: existing.email ?? '', phone: existing.phone ?? '', district: existing.district ?? '', ward: existing.ward ?? '', managerName: existing.managerName ?? '', establishedDate: existing.establishedDate ?? '' }
        : { name: '', type: 'BRANCH', address: '', province: '', district: '', ward: '', phone: '', email: '', managerName: '', establishedDate: '', isActive: true }
      )
    }
  }, [open, existing, form])

  // Liệt kê tường minh các trường bắt buộc của Branch thay vì `...values`.
  // Với `strictNullChecks: false`, z.infer đánh dấu MỌI trường là optional
  // (`undefined extends string` thành true), nên spread không thoả được
  // Omit<Branch, 'id'>. Zod vẫn kiểm ở runtime — đây chỉ là bù cho suy kiểu.
  const onSubmit = (values: FormValues) => {
    onSave({
      name: values.name,
      type: values.type,
      address: values.address,
      province: values.province,
      isActive: values.isActive,
      email: values.email || undefined,
      phone: values.phone || undefined,
      district: values.district || undefined,
      ward: values.ward || undefined,
      managerName: values.managerName || undefined,
      establishedDate: values.establishedDate || undefined,
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{existing ? 'Sửa chi nhánh / VPDD' : 'Thêm chi nhánh / VPDD'}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem>
                <FormLabel>Tên chi nhánh / VPDD *</FormLabel>
                <FormControl><Input {...field} placeholder="VD: Chi nhánh Hà Nội" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="type" render={({ field }) => (
              <FormItem>
                <FormLabel>Loại</FormLabel>
                <FormControl>
                  <RadioGroup value={field.value} onValueChange={field.onChange} className="flex gap-4">
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="BRANCH" id="type-branch" />
                      <Label htmlFor="type-branch">Chi nhánh</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="REP_OFFICE" id="type-rep" />
                      <Label htmlFor="type-rep">Văn phòng đại diện</Label>
                    </div>
                  </RadioGroup>
                </FormControl>
              </FormItem>
            )} />

            <FormField control={form.control} name="address" render={({ field }) => (
              <FormItem>
                <FormLabel>Địa chỉ *</FormLabel>
                <FormControl><Input {...field} placeholder="Số nhà, tên đường..." /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="province" render={({ field }) => (
              <FormItem>
                <FormLabel>Tỉnh / TP *</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger><SelectValue placeholder="Chọn tỉnh/TP" /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {vietnamProvinces.map((p) => (
                      <SelectItem key={p.name} value={p.name}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="district" render={({ field }) => (
                <FormItem>
                  <FormLabel>Quận / Huyện</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="ward" render={({ field }) => (
                <FormItem>
                  <FormLabel>Phường / Xã</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                </FormItem>
              )} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="phone" render={({ field }) => (
                <FormItem>
                  <FormLabel>Số điện thoại</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl><Input {...field} type="email" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <FormField control={form.control} name="managerName" render={({ field }) => (
              <FormItem>
                <FormLabel>Trưởng chi nhánh</FormLabel>
                <FormControl><Input {...field} /></FormControl>
              </FormItem>
            )} />

            <FormField control={form.control} name="isActive" render={({ field }) => (
              <FormItem className="flex items-center gap-3">
                <FormControl>
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
                <FormLabel className="!mt-0">Đang hoạt động</FormLabel>
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
